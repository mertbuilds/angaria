// SMS signing over MCP (docs/adr/0010-mcp-agent-actions.md), the app's own
// flow split across two calls: request_signing_sms leases the GİB session,
// checks the drafts and has GİB send the SMS şifresi; sign_invoices verifies
// the code the user typed to their agent on that same session. Both need
// Ajanlar onaylayabilir ve silebilir. The code is never logged or returned.
import { signInvoicesInput, signingRequestInput } from '@angaria/mcp-server/inputs';
import { GibError, roundKurus } from 'angaria-earsiv-sdk';
import { customerName } from './customer.ts';
import { describeError } from './gib-errors.ts';
import { invoiceStatus, parseGIBInvoice, statusText } from './invoices.ts';
import { SIGNING_ATTEMPTS, SIGNING_TTL_MS, type SigningInvoice } from './mcp-state.ts';
import {
  defineTool,
  errorOutput,
  failure,
  json,
  textField,
  type McpToolContext,
} from './mcp-tool-kit.ts';
import { smsCodeError } from './sms-code.ts';

/** Only the last four digits of the phone GİB texts. */
export function maskPhone(phone: string) {
  const digits = phone.replaceAll(/\D/g, '');
  return digits.length <= 4 ? '****' : `${'*'.repeat(digits.length - 4)}${digits.slice(-4)}`;
}

export const SIGNED = 'Fatura onaylandı.';

const requestSigningSMS = defineTool({
  annotations: { destructiveHint: false, openWorldHint: true },
  description:
    "Step 1 of signing: checks that each uuid is an unsigned draft (Taslak) of the company and has GİB text an SMS code (SMS şifresi) to the user's registered phone. Returns an operationId, the masked phone and the drafts it covers: show the user what will be signed and ask them for the 6 character code (letters and digits), then call sign_invoices. The code expires in about three minutes; asking again replaces the operation (at most one SMS a minute). While it waits, Angaria's other GİB calls wait too. Needs Ajanlar onaylayabilir ve silebilir switched on in Angaria.",
  gib: true,
  inputSchema: signingRequestInput,
  name: 'request_signing_sms',
  run: async (ctx, { uuids }, signal) => {
    const wait = ctx.state.signing.smsWait();
    if (wait > 0) {
      return failure(
        `SMS şifresi az önce gönderildi. Telefonuna gelen şifreyi kullan ya da ${wait} saniye sonra yenisini iste.`,
        { code: 'rate-limit', retryAfterSeconds: wait },
      );
    }
    // A new request replaces the open operation. Its lease holds the session,
    // so it ends first; otherwise the new lease waits behind it until it times out.
    if (ctx.state.signing.busy()) {
      return failure('Önceki onay sürüyor. Sonucunu bekle, sonra yeni SMS şifresi iste.', {
        code: 'busy',
      });
    }
    ctx.state.signing.endAll('replaced');
    const lease = await ctx.lease(signal);
    let checked;
    try {
      checked = await checkDrafts(ctx, lease.session, uuids);
    } catch (error) {
      lease.release(error);
      throw error;
    }
    if (checked.problems.length > 0) {
      lease.release();
      return failure('SMS şifresi istenmedi: bazı faturalar onaylanacak bir taslak değil.', {
        code: 'not-a-draft',
        invoices: checked.problems,
      });
    }
    let sent;
    try {
      sent = await ctx.client.startSMSSign(lease.session);
    } catch (error) {
      lease.release(error);
      throw error;
    }
    const operation = ctx.state.signing.start({
      companyId: ctx.company().id,
      invoices: checked.invoices,
      lease,
      oid: sent.oid,
      phone: sent.phone,
    });
    ctx.onAction({
      count: operation.invoices.length,
      expiresAt: operation.expiresAt,
      kind: 'signing-requested',
      operationId: operation.id,
    });
    const phone = maskPhone(sent.phone);
    return json(
      {
        expiresInSeconds: SIGNING_TTL_MS / 1000,
        invoices: checked.invoices.map(({ date, number, recipient, uuid }, index) => ({
          date,
          number,
          recipient,
          total: checked.totals[index],
          uuid,
        })),
        message: `SMS şifresi ${phone} numarasına gönderildi. Telefonuna gelen 6 haneli şifreyi yaz; ${SIGNING_TTL_MS / 60_000} dakika içinde kullanılmalı.`,
        operationId: operation.id,
        phone,
      },
      `SMS ${phone} numarasına gönderildi`,
    );
  },
  summarize: ({ uuids }) => `${uuids.length} taslak için SMS şifresi`,
});

/** Each uuid's draft, or why it cannot be signed; read on the leased session. */
async function checkDrafts(
  ctx: McpToolContext,
  session: Parameters<McpToolContext['client']['getDrafts']>[0],
  uuids: ReadonlyArray<string>,
) {
  const invoices: Array<SigningInvoice> = [];
  const totals: Array<{ amount: number; currency: string }> = [];
  const problems: Array<{ message: string; uuid: string }> = [];
  for (const uuid of new Set(uuids)) {
    let detail;
    try {
      detail = await ctx.client.getInvoiceDetail(session, uuid);
    } catch (error) {
      if (error instanceof GibError && error.code !== 'not-found' && error.code !== 'validation') {
        throw error;
      }
      problems.push({ message: 'GİB’de bulunamadı', uuid });
      continue;
    }
    const date = textField(detail.faturaTarihi);
    const rows = date ? await ctx.client.getDrafts(session, date, date) : [];
    const row = rows.find((candidate) => candidate.ettn === uuid);
    if (!row) {
      problems.push({ message: 'GİB’de bulunamadı', uuid });
      continue;
    }
    const status = invoiceStatus(row);
    if (status.filter !== 'onaylanmadi') {
      problems.push({ message: `${statusText(status)}, taslak değil`, uuid });
      continue;
    }
    const parsed = parseGIBInvoice(detail);
    invoices.push({
      date,
      number: row.belgeNumarasi,
      recipient: customerName(parsed.recipient) || (row.aliciUnvanAdSoyad ?? ''),
      uuid,
    });
    totals.push({ amount: roundKurus(parsed.total), currency: parsed.settings.currency });
  }
  return { invoices, problems, totals };
}

const signInvoices = defineTool({
  annotations: { destructiveHint: true, openWorldHint: true },
  description:
    "Step 2 of signing: signs the drafts of a request_signing_sms operation with the 6 character SMS code (letters and digits) the user gave you, passed exactly as typed. A signed invoice is a legal invoice and cannot be deleted, only cancelled on the GİB portal, so call this only with a code the user typed for this operation. Pass the same company as the request. Returns each invoice's status. A wrong code can be tried again up to three times; an expired one needs a new request_signing_sms. Never store or repeat the code. Needs Ajanlar onaylayabilir ve silebilir switched on in Angaria.",
  gib: true,
  inputSchema: signInvoicesInput,
  limit: { max: 10, windowMs: 60_000 },
  name: 'sign_invoices',
  run: async (ctx, { code, operationId }) => {
    const codeProblem = smsCodeError(code);
    if (codeProblem) {
      return failure(codeProblem, { code: 'invalid-input' });
    }
    const operation = ctx.state.signing.find(operationId);
    if (operation === 'expired') {
      return failure(
        'SMS şifresinin süresi doldu. request_signing_sms ile yeni bir SMS şifresi iste.',
        { code: 'operation-expired' },
      );
    }
    if (!operation) {
      return failure(
        'Bu onay işlemi Angaria’da yok. Önce request_signing_sms ile SMS şifresi iste.',
        { code: 'unknown-operation' },
      );
    }
    if (operation.companyId !== ctx.company().id) {
      return failure(
        'Bu onay işlemi başka bir şirketin. sign_invoices’ı request_signing_sms’teki şirketle çağır.',
        { code: 'other-company' },
      );
    }
    if (operation.busy) {
      return failure('Bu onay sürüyor. Sonucunu bekle.', { code: 'busy' });
    }
    operation.busy = true;
    const { lease } = operation;
    const uuids = operation.invoices.map((invoice) => invoice.uuid);
    try {
      await ctx.client.verifyAndSign(
        lease.session,
        code.replaceAll(/\s/g, ''),
        operation.oid,
        uuids,
      );
    } catch (error) {
      operation.busy = false;
      if (error instanceof GibError && error.code === 'sms-code-wrong') {
        operation.attempts += 1;
        const left = SIGNING_ATTEMPTS - operation.attempts;
        if (left <= 0) {
          ctx.state.signing.end(operation.id, 'failed');
          return failure(
            'SMS şifresi üç kez kabul edilmedi. request_signing_sms ile yeni bir SMS şifresi iste.',
            { code: 'sms-code-wrong' },
          );
        }
        return failure(describeError(error).text, { attemptsLeft: left, code: 'sms-code-wrong' });
      }
      ctx.state.signing.end(operation.id, 'failed', error);
      return errorOutput(error);
    }
    // Signed: the statuses come from GİB's list, on the same session.
    const statuses = new Map<string, string>();
    for (const date of new Set(operation.invoices.map((invoice) => invoice.date))) {
      const rows = await ctx.client.getDrafts(lease.session, date, date).catch(() => []);
      for (const row of rows) {
        if (row.ettn) {
          statuses.set(row.ettn, statusText(invoiceStatus(row)));
        }
      }
    }
    ctx.state.signing.end(operation.id, 'signed');
    const invoices = operation.invoices.map(({ number, recipient, uuid }) => ({
      number,
      recipient,
      status: statuses.get(uuid) ?? 'Onaylı',
      uuid,
    }));
    ctx.onAction({ invoices, kind: 'signed' });
    const count = invoices.length;
    return json(
      { invoices, message: count === 1 ? SIGNED : `${count} fatura onaylandı.` },
      count === 1
        ? `${invoices[0].number ?? invoices[0].uuid} onaylandı`
        : `${count} fatura onaylandı`,
    );
  },
  summarize: () => 'SMS şifresiyle onay',
});

export const SIGNING_TOOLS = [requestSigningSMS, signInvoices];
