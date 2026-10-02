import { messages } from '@angaria/gib-emulator';
import { beforeEach, describe, expect, inject, test } from 'vitest';
import { createClient, draftInvoicePayload, GibError, type InvoiceDetails } from '../src/index.ts';

// The SDK end to end against the GİB emulator (started by tests/emulator-setup.ts).

const baseUrl = inject('gibEmulatorUrl');
const client = createClient({ baseUrl });

async function admin(method: string, path: string, body?: unknown) {
  const response = await fetch(`${baseUrl}/__emulator${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    method,
  });
  return (await response.json()) as Record<string, unknown>;
}

beforeEach(async () => {
  await admin('POST', '/reset');
});

const pad = (n: number) => String(n).padStart(2, '0');
const now = new Date();
const today = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
const daysAgo = (days: number) => {
  const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
};

const invoice = (overrides: Partial<InvoiceDetails> = {}): InvoiceDetails => ({
  city: 'Ankara',
  country: 'Türkiye',
  currency: 'TRY',
  date: today,
  fullAddress: 'Test Mah. Deneme Cad. No:1',
  grandTotal: 100,
  grandTotalInclVAT: 120,
  invoiceType: 'SATIS',
  items: [
    {
      name: 'Danışmanlık',
      price: 100,
      quantity: 1,
      unitPrice: 100,
      VATAmount: 20,
      VATRate: 20,
    },
  ],
  name: 'Ali',
  paymentTotal: 120,
  surname: 'Veli',
  taxIDOrTRID: '11111111111',
  time: '10:00:00',
  title: '',
  totalVAT: 20,
  ...overrides,
});

const rows = async (session: Awaited<ReturnType<typeof client.login>>) =>
  (await client.getDrafts(session, today, today)) as Array<Record<string, string>>;

describe('session', () => {
  test('logs in with a token and a cookie, and out again', async () => {
    const session = await client.login('33333301', '1', true);
    expect(session.baseUrl).toBe(baseUrl);
    expect(session.token).not.toBe('');
    expect(session.cookies).toEqual([expect.stringMatching(/^JSESSIONID=/)]);

    await client.logout(session);
    await expect(client.getUUID(session)).rejects.toThrow(messages.sessionExpired);
    await client.logout(await client.login('33333301', '1', true));
  });

  test('logs a production-mode session out with assoscmd=logout', async () => {
    const session = await client.login('12345678', 'angaria', false);
    await client.logout(session);
    await expect(client.getUUID(session)).rejects.toThrow(messages.sessionExpired);
    await client.logout(await client.login('12345678', 'angaria', false));
  });

  test('a logout the portal refuses throws its message', async () => {
    const session = await client.login('33333301', '1', true);
    await admin('POST', '/faults', { cmd: 'logout', kind: 'error', text: 'Çıkış yapılamadı' });
    await expect(client.logout(session)).rejects.toThrow('Çıkış yapılamadı');
    await client.logout(session);
  });

  test('rejects a wrong password with the portal message', async () => {
    await expect(client.login('33333301', 'yanlis', true)).rejects.toThrow(
      messages.invalidCredentials,
    );
  });

  test('refuses a second login until a force logout ends the open session', async () => {
    const first = await client.login('33333301', '1', true);
    await expect(client.login('33333301', '1', true)).rejects.toThrow('birden fazla giriş');

    await client.forceLogout('33333301', '1', true);
    await expect(client.getUUID(first)).rejects.toThrow(messages.sessionExpired);
    const second = await client.login('33333301', '1', false);
    expect(second.token).not.toBe(first.token);
    await client.logout(second);
  });

  test('an expired token fails with the portal message', async () => {
    const session = await client.login('33333301', '1', true);
    await admin('POST', '/expire');
    await expect(client.getDrafts(session, today, today)).rejects.toThrow(messages.sessionExpired);
  });
});

describe('invoices', () => {
  test('create, find the ETTN, list, preview, sign by SMS', async () => {
    const session = await client.login('33333301', '1', true);
    const { response, uuid } = await client.createDraftInvoice(session, invoice());
    expect(response.data).toBe(messages.draftCreated);
    expect(uuid).toMatch(/^[\da-f]{8}-[\da-f]{4}-1[\da-f]{3}-[\da-f]{4}-[\da-f]{12}$/);

    const [row] = await rows(session);
    expect(row).toMatchObject({
      aliciUnvanAdSoyad: 'Ali Veli',
      belgeNumarasi: `GIB${now.getFullYear()}000000001`,
      ettn: uuid,
      onayDurumu: 'Onaylanmadı',
    });

    const detail = await client.getInvoiceDetail(session, uuid);
    expect(detail).toMatchObject({ faturaUuid: uuid, odenecekTutar: '120.00' });

    const html = await client.getInvoiceHTML(session, uuid, 'Onaylanmadı');
    expect(html).toContain('id="qrvalue"');
    expect(html).toContain(uuid);

    const { oid, phone } = await client.startSMSSign(session);
    expect(phone).toBe('5550000001');
    await expect(client.verifyAndSign(session, '000000', oid, [uuid])).rejects.toThrow(
      messages.smsCodeWrong,
    );
    const signed = await client.verifyAndSign(session, '123456', oid, [uuid]);
    expect(signed.data).toMatchObject({ sonuc: '1' });
    expect((await rows(session))[0].onayDurumu).toBe('Onaylandı');

    await expect(client.cancelInvoice(session, 'iptal', row)).rejects.toThrow(
      messages.notDeletable,
    );
    await client.logout(session);
  });

  test('the invoice page shows the totals the payload sent, its VAT summed from the lines', async () => {
    // The .005 fixture of tests/payload.test.ts: VAT 1.005 on each line, 1.01 rounded.
    const details = invoice({
      grandTotal: 120.6,
      grandTotalInclVAT: 123.63,
      items: [
        { name: 'A', price: 10.05, quantity: 1, unitPrice: 10.05, VATAmount: 1.01, VATRate: 10 },
        { name: 'B', price: 100.5, quantity: 1, unitPrice: 100.5, VATAmount: 1.01, VATRate: 1 },
        { name: 'C', price: 10.05, quantity: 4, unitPrice: 2.5125, VATAmount: 1.01, VATRate: 10 },
      ],
      paymentTotal: 123.63,
      totalVAT: 3.03,
    });
    const sent = draftInvoicePayload(details);
    const session = await client.login('33333301', '1', true);
    const { uuid } = await client.createDraftInvoice(session, details);
    const html = await client.getInvoiceHTML(session, uuid, 'Onaylanmadı');
    await client.logout(session);

    // "1.234,56 TL" as GİB's payload writes it: "1234.56".
    const shown = (label: string) => {
      const escaped = label.replaceAll(/[()]/g, (char) => `\\${char}`);
      const match = new RegExp(`${escaped}</span></td>\\s*<td[^>]*>([^<]+)</td>`).exec(html);
      return match?.[1].replace(' TL', '').replaceAll('.', '').replace(',', '.');
    };
    expect(shown('Mal Hizmet Toplam Tutarı')).toBe(sent.malhizmetToplamTutari);
    expect(shown('Vergiler Dahil Toplam Tutar')).toBe(sent.vergilerDahilToplamTutar);
    expect(shown('Ödenecek Tutar')).toBe(sent.odenecekTutar);
    const vat = [shown('Hesaplanan KDV(%10)'), shown('Hesaplanan KDV(%1)')];
    expect(vat).toEqual(['2.02', '1.01']);
    expect((Number(vat[0]) + Number(vat[1])).toFixed(2)).toBe(sent.hesaplanankdv);

    const qr = JSON.parse(/id="qrvalue"[^>]*>([^<]*)</.exec(html)?.[1] ?? '{}') as Record<
      string,
      string
    >;
    expect(qr).toMatchObject({
      'hesaplanankdv(1)': '1.01',
      'hesaplanankdv(10)': '2.02',
      malhizmettoplam: sent.malhizmetToplamTutari,
      odenecek: sent.odenecekTutar,
      vergidahil: sent.vergilerDahilToplamTutar,
    });
  });

  test('deletes a draft', async () => {
    const session = await client.login('33333302', '1', true);
    await client.createDraftInvoice(
      session,
      invoice({ name: '', surname: '', title: 'ACME A.Ş.' }),
    );
    const [row] = await rows(session);
    expect(row.aliciUnvanAdSoyad).toBe('ACME A.Ş.');

    await client.cancelInvoice(session, 'hatalı giriş', row);
    expect((await rows(session))[0].onayDurumu).toBe('Silinmiş');
    await client.logout(session);
  });

  test('SMS signing needs a registered phone', async () => {
    const session = await client.login('33333303', '1', true);
    await expect(client.startSMSSign(session)).rejects.toThrow('kayıtlı telefon numarası');
    await client.logout(session);
  });
});

describe('portal limits and failures', () => {
  test('long ranges are fetched in chunks the portal accepts', async () => {
    const session = await client.login('12345678', 'angaria', false);
    const all = (await client.getDrafts(session, daysAgo(45), today)) as Array<
      Record<string, string>
    >;
    expect(all.map((row) => row.onayDurumu).toSorted()).toEqual([
      'Onaylandı',
      'Onaylandı',
      'Silinmiş',
    ]);
    await client.logout(session);
  });

  test('a range over the portal limit throws its message', async () => {
    await admin('PATCH', '/config', { maxRangeDays: 3 });
    const session = await client.login('33333301', '1', true);
    await expect(client.getDrafts(session, daysAgo(9), today)).rejects.toThrow(
      'Seçilen tarih aralığı 3 günden fazla olamaz!',
    );
    await client.logout(session);
  });

  test('HTTP 200 with an error text in data is a failed draft, not a success', async () => {
    await admin('POST', '/faults', { cmd: 'EARSIV_PORTAL_FATURA_OLUSTUR', kind: 'text' });
    const session = await client.login('33333301', '1', true);
    await expect(client.createDraftInvoice(session, invoice())).rejects.toThrow(messages.textError);
    expect(await rows(session)).toEqual([]);
    await client.logout(session);
  });

  test('the error envelope becomes the thrown message', async () => {
    await admin('POST', '/faults', {
      cmd: 'EARSIV_PORTAL_TASLAKLARI_GETIR',
      kind: 'error',
      text: 'Genel Sistem Hatası',
    });
    const session = await client.login('33333301', '1', true);
    await expect(client.getDrafts(session, today, today)).rejects.toThrow('Genel Sistem Hatası');
    await client.logout(session);
  });

  test('a maintenance page instead of JSON rejects as maintenance', async () => {
    await admin('PATCH', '/config', { chaos: { maintenance: true } });
    await expect(client.login('33333301', '1', true)).rejects.toMatchObject({
      code: 'maintenance',
      name: 'GibError',
    });
  });
});

/** The GibError `promise` rejects with. */
async function failure(promise: Promise<unknown>): Promise<GibError> {
  const rejection = await promise.then(
    () => undefined,
    (error: unknown) => error,
  );
  expect(rejection).toBeInstanceOf(GibError);
  return rejection as GibError;
}

describe('typed errors', () => {
  test('a wrong password is auth, with GİB’s text', async () => {
    const error = await failure(client.login('33333301', 'yanlis', true));
    expect(error).toMatchObject({
      code: 'auth',
      gibMessage: messages.invalidCredentials,
      message: messages.invalidCredentials,
    });
  });

  test('a session open elsewhere is session-locked', async () => {
    await admin('POST', '/lock', { userid: '33333301' });
    const error = await failure(client.login('33333301', '1', true));
    expect(error).toMatchObject({ code: 'session-locked', gibMessage: messages.sessionLocked });
  });

  test('an expired token is session-expired', async () => {
    const session = await client.login('33333301', '1', true);
    await admin('POST', '/expire');
    expect((await failure(client.getUUID(session))).code).toBe('session-expired');
  });

  test('the maintenance page is maintenance on every call', async () => {
    const session = await client.login('33333301', '1', true);
    await admin('POST', '/faults', { cmd: 'EARSIV_PORTAL_TASLAKLARI_GETIR', kind: 'maintenance' });
    const error = await failure(client.getDrafts(session, today, today));
    expect(error).toMatchObject({ code: 'maintenance', status: 200 });
    expect(error.gibMessage).toBeUndefined();
    await client.logout(session);
  });

  test('a 5xx page is unknown with its status, a 429 is rate-limit', async () => {
    await admin('POST', '/faults', { cmd: 'login', kind: '5xx', status: 502 });
    expect(await failure(client.login('33333301', '1', true))).toMatchObject({
      code: 'unknown',
      message: 'GİB beklenmeyen bir yanıt verdi (HTTP 502)',
      status: 502,
    });
    await admin('POST', '/faults', { cmd: 'login', kind: '5xx', status: 429 });
    expect((await failure(client.login('33333301', '1', true))).code).toBe('rate-limit');
  });

  test('the error envelope is classified by its text', async () => {
    const session = await client.login('33333301', '1', true);
    const cases: Array<[string, string]> = [
      ['Genel Sistem Hatası', 'unknown'],
      [messages.maintenance, 'maintenance'],
      ['Çok fazla istek gönderdiniz. Lütfen bekleyiniz.', 'rate-limit'],
      ['Kayıt bulunamadı.', 'not-found'],
      ['Alıcı VKN/TCKN 10 veya 11 haneli olmalıdır.', 'validation'],
      ['Service Not Found', 'unknown'],
    ];
    for (const [text, code] of cases) {
      await admin('POST', '/faults', { cmd: 'EARSIV_PORTAL_UUID_GETIR', kind: 'error', text });
      expect(await failure(client.getUUID(session)), text).toMatchObject({
        code,
        gibMessage: text,
        message: text,
      });
    }
    await client.logout(session);
  });

  test('HTTP 200 with an error text on create keeps GİB’s text', async () => {
    const session = await client.login('33333301', '1', true);
    await admin('POST', '/faults', { cmd: 'EARSIV_PORTAL_FATURA_OLUSTUR', kind: 'text' });
    expect(await failure(client.createDraftInvoice(session, invoice()))).toMatchObject({
      code: 'unknown',
      gibMessage: messages.textError,
    });
    await admin('POST', '/faults', {
      cmd: 'EARSIV_PORTAL_FATURA_OLUSTUR',
      kind: 'text',
      text: messages.ettnRejected,
    });
    expect((await failure(client.createDraftInvoice(session, invoice()))).code).toBe('validation');
    await client.logout(session);
  });

  test('a range over the limit is range-too-long, a missing invoice not-found', async () => {
    await admin('PATCH', '/config', { maxRangeDays: 3 });
    const session = await client.login('33333301', '1', true);
    expect((await failure(client.getDrafts(session, daysAgo(9), today))).code).toBe(
      'range-too-long',
    );
    expect((await failure(client.getInvoiceDetail(session, 'yok'))).code).toBe('not-found');
    await client.logout(session);
  });

  test('SMS: no phone and a refused number are sms-failed, a wrong code sms-code-wrong', async () => {
    const phoneless = await client.login('33333303', '1', true);
    expect((await failure(client.startSMSSign(phoneless))).code).toBe('sms-failed');
    await client.logout(phoneless);

    const session = await client.login('33333301', '1', true);
    expect(await failure(client.requestSigningSMS(session, '5559999999'))).toMatchObject({
      code: 'sms-failed',
      gibMessage: messages.phoneMismatch,
    });
    const { uuid } = await client.createDraftInvoice(session, invoice());
    const { oid } = await client.startSMSSign(session);
    expect(await failure(client.verifyAndSign(session, '000000', oid, [uuid]))).toMatchObject({
      code: 'sms-code-wrong',
      gibMessage: messages.smsCodeWrong,
    });
    expect((await failure(client.verifyAndSign(session, '123456', 'yok', [uuid]))).code).toBe(
      'sms-code-wrong',
    );
    await client.logout(session);
  });

  test('signing a signed invoice away is validation', async () => {
    const session = await client.login('12345678', 'angaria', false);
    const signed = (await client.getDrafts(session, daysAgo(7), today)).find(
      (row) => row.onayDurumu === 'Onaylandı',
    );
    expect(signed).toBeDefined();
    expect(await failure(client.cancelInvoice(session, 'iptal', signed ?? {}))).toMatchObject({
      code: 'validation',
      gibMessage: messages.notDeletable,
    });
    await client.logout(session);
  });

  test('a request that never reaches GİB is network, in Node and in Tauri', async () => {
    for (const reason of [
      new TypeError('fetch failed'),
      'error sending request for url (https://earsivportal.efatura.gov.tr/earsiv-services/assos-login)',
    ]) {
      const offline = createClient({ baseUrl, fetch: () => Promise.reject(reason) });
      expect(await failure(offline.login('33333301', '1', true))).toMatchObject({
        cause: reason,
        code: 'network',
        message: 'GİB’e ulaşılamadı',
      });
    }
  });

  test('an aborted request stays an abort', async () => {
    const abort = new DOMException('Aborted', 'AbortError');
    const aborted = createClient({ baseUrl, fetch: () => Promise.reject(abort) });
    await expect(aborted.login('33333301', '1', true)).rejects.toBe(abort);
  });
});
