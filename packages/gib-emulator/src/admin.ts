import {
  type EmulatorConfig,
  type EmulatorUser,
  type InvoiceFixture,
  makeUser,
  mergeConfig,
  type PartialConfig,
} from './config.ts';
import { endSessions, jsonReply, type PortalContext, type Reply } from './gib.ts';
import { addFixture, lockUser, type StoredInvoice } from './state.ts';

// The control API under /__emulator. Plain JSON, no auth: the emulator only
// listens on loopback.

const FAULT_KINDS = ['5xx', 'error', 'maintenance', 'text'] as const;

export type FaultKind = (typeof FAULT_KINDS)[number];

/** A one-shot failure for the next `count` matching requests. */
export interface Fault {
  /** A dispatch `cmd`, a login `assoscmd`, or 'tcmb'. Any request when absent. */
  cmd?: string;
  /** Default 1. */
  count?: number;
  /**
   * 5xx: an HTML error page with `status` (default 503). error: GİB's error
   * envelope with `text`. maintenance: the maintenance HTML page (HTTP 200).
   * text: HTTP 200 with `text` in `data` and no error flag.
   */
  kind: FaultKind;
  status?: number;
  text?: string;
}

export interface AdminContext extends PortalContext {
  faults: Array<Fault>;
  reset: () => void;
  setConfig: (config: EmulatorConfig) => void;
}

const iso = (time: number) => new Date(time).toISOString();

const invoiceView = (invoice: StoredInvoice) => ({
  aliciUnvanAdSoyad: invoice.aliciUnvanAdSoyad,
  aliciVknTckn: invoice.aliciVknTckn,
  belgeNumarasi: invoice.belgeNumarasi,
  belgeTarihi: invoice.belgeTarihi,
  createdAt: iso(invoice.createdAt),
  ettn: invoice.ettn,
  onayDurumu: invoice.onayDurumu,
  silmeNedeni: invoice.silmeNedeni,
  userid: invoice.userid,
});

function describeState(ctx: AdminContext) {
  const now = ctx.now();
  return {
    config: { ...ctx.config, seedInvoices: undefined, users: undefined },
    faults: ctx.faults,
    invoices: [...ctx.state.invoices.values()].map(invoiceView),
    sessions: [...ctx.state.sessions.values()].map((session) => ({
      expiresAt: iso(session.expiresAt),
      foreign: session.foreign,
      token: session.token,
      userid: session.userid,
    })),
    sms: ctx.state.sms.map((item) => ({
      code: item.code,
      expired: item.expiresAt <= now,
      oid: item.oid,
      phone: item.phone,
      sentAt: iso(item.sentAt),
      used: item.used,
      userid: item.userid,
    })),
    users: [...ctx.state.users.values()].map((user) => ({
      hsm: user.hsm,
      name: user.unvan || `${user.ad} ${user.soyad}`.trim(),
      password: user.password,
      telefon: user.telefon,
      userid: user.userid,
      vknTckn: user.vknTckn,
    })),
  };
}

const badRequest = (message: string): Reply => ({
  ...jsonReply({ error: message }),
  status: 400,
});

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

const userid = (body: unknown) => {
  const value = asRecord(body).userid;
  return typeof value === 'string' && value ? value : undefined;
};

/**
 * GET  /__emulator, /__emulator/state   everything: config, users, sessions, invoices, SMS codes, faults
 * POST /__emulator/reset                back to the start config and the seed state
 * POST /__emulator/seed                 { users?: [...], invoices?: [InvoiceFixture] }
 * PATCH /__emulator/config              a PartialConfig (chaos knobs, maxRangeDays, smsCode, ...)
 * POST /__emulator/sms-code             { code } ('random' for six random digits per SMS)
 * GET|POST|DELETE /__emulator/faults    list, queue (Fault or Fault[]), clear one-shot failures
 * POST /__emulator/lock                 { userid }: a session opened elsewhere holds the lock
 * POST /__emulator/expire               { userid? }: end sessions as if they timed out
 */
export function adminReply(ctx: AdminContext, method: string, path: string, body: unknown): Reply {
  const route = `${method} ${path.replace(/\/+$/, '') || '/__emulator'}`;
  switch (route) {
    case 'GET /__emulator':
    case 'GET /__emulator/state':
      return jsonReply(describeState(ctx));
    case 'POST /__emulator/reset':
      ctx.reset();
      ctx.log('state reset');
      return jsonReply(describeState(ctx));
    case 'POST /__emulator/seed': {
      const { invoices = [], users = [] } = asRecord(body) as {
        invoices?: Array<InvoiceFixture>;
        users?: Array<Partial<EmulatorUser>>;
      };
      for (const user of users) {
        if (!user.userid || !user.password || !user.vknTckn) {
          return badRequest('Each user needs userid, password and vknTckn.');
        }
        ctx.state.users.set(user.userid, {
          ...(ctx.state.users.get(user.userid) ??
            makeUser({ password: user.password, userid: user.userid, vknTckn: user.vknTckn })),
          ...user,
        });
      }
      const missing = invoices.find((fixture) => !ctx.state.users.has(fixture.userid));
      if (missing) {
        return badRequest(`Unknown user ${missing.userid}.`);
      }
      const created = invoices.map((fixture) =>
        invoiceView(addFixture(ctx.state, fixture, ctx.now())),
      );
      ctx.persist();
      return jsonReply({ invoices: created });
    }
    case 'PATCH /__emulator/config':
      ctx.setConfig(mergeConfig(ctx.config, asRecord(body) as PartialConfig));
      return jsonReply(describeState(ctx).config);
    case 'POST /__emulator/sms-code': {
      const { code } = asRecord(body);
      if (typeof code !== 'string' || !/^(?:\d{4,8}|random)$/.test(code)) {
        return badRequest('code must be 4 to 8 digits or "random".');
      }
      ctx.setConfig(mergeConfig(ctx.config, { smsCode: code }));
      return jsonReply({ smsCode: code });
    }
    case 'GET /__emulator/faults':
      return jsonReply(ctx.faults);
    case 'POST /__emulator/faults': {
      const faults: Array<Fault> = [];
      for (const item of (Array.isArray(body) ? body : [body]).map(asRecord)) {
        const kind = FAULT_KINDS.find((value) => value === item.kind);
        if (!kind) {
          return badRequest(`kind must be one of ${FAULT_KINDS.join(', ')}.`);
        }
        faults.push({
          cmd: typeof item.cmd === 'string' ? item.cmd : undefined,
          count: typeof item.count === 'number' ? item.count : 1,
          kind,
          status: typeof item.status === 'number' ? item.status : undefined,
          text: typeof item.text === 'string' ? item.text : undefined,
        });
      }
      ctx.faults.push(...faults);
      return jsonReply(ctx.faults);
    }
    case 'DELETE /__emulator/faults':
      ctx.faults.length = 0;
      return jsonReply(ctx.faults);
    case 'POST /__emulator/lock': {
      const id = userid(body);
      if (!id || !ctx.state.users.has(id)) {
        return badRequest('userid must name a known user.');
      }
      lockUser(ctx.state, id, ctx.now(), ctx.config.sessionTtlSeconds);
      ctx.log(`${id}: locked by a session opened elsewhere`);
      return jsonReply({ locked: id });
    }
    case 'POST /__emulator/expire': {
      const ended = endSessions(ctx, userid(body));
      ctx.log(`${ended} session(s) expired`);
      return jsonReply({ expired: ended });
    }
    default:
      return { ...jsonReply({ error: `No route ${route}.` }), status: 404 };
  }
}
