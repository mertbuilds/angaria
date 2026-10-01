import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { request } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest';
import { messages, type RunningEmulator, startEmulator } from '../src/index.ts';

// Protocol-level checks: raw HTTP in, the portal's exact shapes out.

let emulator: RunningEmulator;

beforeAll(async () => {
  emulator = await startEmulator();
});

afterAll(() => emulator.close());

beforeEach(() => emulator.reset());

const form = (fields: Record<string, string>) => new URLSearchParams(fields).toString();

async function post(
  path: string,
  fields: Record<string, string>,
  cookie = '',
  base = emulator.url,
): Promise<Response> {
  return fetch(`${base}${path}`, {
    body: form(fields),
    headers: {
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      ...(cookie ? { cookie } : {}),
    },
    method: 'POST',
  });
}

const loginFields = (userid: string, password: string) => ({
  assoscmd: 'login',
  parola: '1',
  rtype: 'json',
  sifre: password,
  sifre2: password,
  userid,
});

async function login(userid = '33333301', password = '1', base = emulator.url) {
  const response = await post(
    '/earsiv-services/assos-login',
    loginFields(userid, password),
    '',
    base,
  );
  const body = (await response.json()) as Record<string, unknown>;
  return {
    body,
    cookie: (response.headers.get('set-cookie') ?? '').split(';')[0],
    token: String(body.token ?? ''),
  };
}

async function dispatch(
  token: string,
  cmd: string,
  jp: Record<string, unknown> = {},
  base = emulator.url,
): Promise<Record<string, unknown>> {
  const response = await post(
    '/earsiv-services/dispatch',
    { callid: 'test', cmd, jp: JSON.stringify(jp), pageName: 'RG_BASITFATURA', token },
    '',
    base,
  );
  return (await response.json()) as Record<string, unknown>;
}

const admin = (method: string, path: string, body?: unknown) =>
  fetch(`${emulator.url}/__emulator${path}`, {
    body: body === undefined ? undefined : JSON.stringify(body),
    method,
  });

const today = () => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
  }).formatToParts(new Date());
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('day')}/${part('month')}/${part('year')}`;
};

const draft = (overrides: Record<string, unknown> = {}) => ({
  aliciAdi: 'Ali',
  aliciSoyadi: 'Veli',
  aliciUnvan: '',
  faturaTarihi: today(),
  faturaUuid: '',
  malHizmetTable: [
    {
      kdvOrani: '20',
      kdvTutari: '20.00',
      malHizmet: 'Danışmanlık',
      malHizmetTutari: '100.00',
      miktar: 1,
    },
  ],
  odenecekTutar: '120.00',
  paraBirimi: 'TRY',
  saat: '10:00:00',
  vknTckn: '11111111111',
  ...overrides,
});

async function createDraft(token: string, overrides: Record<string, unknown> = {}) {
  await dispatch(token, 'EARSIV_PORTAL_FATURA_OLUSTUR', draft(overrides));
  const list = await dispatch(token, 'EARSIV_PORTAL_TASLAKLARI_GETIR', {
    baslangic: today(),
    bitis: today(),
  });
  return (list.data as Array<Record<string, string>>).at(-1) ?? {};
}

describe('login', () => {
  test('issues a token and a session cookie', async () => {
    const { body, cookie, token } = await login();
    expect(token).toMatch(/^[\da-f]{96}$/);
    expect(body.redirectUrl).toContain(token);
    expect(cookie).toMatch(/^JSESSIONID=[\da-f]+$/);
  });

  test('refuses a wrong password with the error envelope', async () => {
    const { body } = await login('33333301', 'yanlis');
    expect(body).toMatchObject({
      error: '1',
      messages: [{ text: messages.invalidCredentials }],
    });
  });

  test('allows one session per user until logout', async () => {
    const first = await login();
    const second = await login();
    expect(second.body.messages).toEqual([{ text: messages.sessionLocked, type: '4' }]);

    await post('/earsiv-services/assos-login', {
      assoscmd: 'logout',
      rtype: 'json',
      token: first.token,
    });
    expect((await login()).token).not.toBe('');
  });

  test('a logout with the refused login cookie ends the open session (force logout)', async () => {
    const first = await login();
    const refused = await login();
    expect(refused.token).toBe('');

    const response = await post(
      '/earsiv-services/assos-login',
      { assoscmd: 'logout', rtype: 'json', token: '' },
      refused.cookie,
    );
    expect(await response.json()).toEqual({ data: { redirectUrl: 'login.html' } });
    expect((await dispatch(first.token, 'EARSIV_PORTAL_UUID_GETIR')).error).toBe('1');
    expect((await login()).token).not.toBe('');
  });

  test('anologin without a userid is a login with missing fields, not a logout', async () => {
    const { cookie, token } = await login();
    const response = await post(
      '/earsiv-services/assos-login',
      { assoscmd: 'anologin', rtype: 'json', token },
      cookie,
    );
    expect(await response.json()).toMatchObject({
      error: '1',
      messages: [{ text: messages.loginFieldsMissing, type: '5' }],
    });
    expect((await dispatch(token, 'EARSIV_PORTAL_UUID_GETIR')).error).toBeUndefined();
  });

  test('a session opened elsewhere locks the user', async () => {
    await admin('POST', '/lock', { userid: '33333302' });
    const { body } = await login('33333302');
    expect(body.messages).toEqual([{ text: messages.sessionLocked, type: '4' }]);
  });
});

describe('sessions', () => {
  test('an expired token gets the error envelope and releases the lock', async () => {
    let clock = Date.UTC(2026, 8, 30, 9);
    const local = await startEmulator({
      config: { sessionTtlSeconds: 60 },
      now: () => clock,
    });
    try {
      const { token } = await login('33333301', '1', local.url);
      clock += 30_000;
      expect((await dispatch(token, 'EARSIV_PORTAL_UUID_GETIR', {}, local.url)).data).toMatch(
        /^[\da-f]{8}-[\da-f]{4}-1[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/,
      );
      clock += 61_000;
      expect(await dispatch(token, 'EARSIV_PORTAL_UUID_GETIR', {}, local.url)).toMatchObject({
        error: '1',
        messages: [{ text: messages.sessionExpired }],
      });
      expect((await login('33333301', '1', local.url)).token).not.toBe('');
    } finally {
      await local.close();
    }
  });

  test('POST /__emulator/expire ends sessions', async () => {
    const { token } = await login();
    await admin('POST', '/expire', { userid: '33333301' });
    expect((await dispatch(token, 'EARSIV_PORTAL_UUID_GETIR')).messages).toEqual([
      { text: messages.sessionExpired, type: '4' },
    ]);
  });
});

describe('dispatch', () => {
  test('wraps data in the GİB envelope', async () => {
    const { token } = await login();
    const body = await dispatch(token, 'EARSIV_PORTAL_TELEFONNO_SORGULA');
    expect(Object.keys(body)).toEqual(['data', 'metadata']);
    expect(body.data).toEqual({ telefon: '5550000001' });
    expect((body.metadata as { optime: string }).optime).toMatch(/^\d{14}$/);
  });

  test('answers an unknown command with Service Not Found', async () => {
    const { token } = await login();
    expect(await dispatch(token, 'EARSIV_PORTAL_SMSSIFRE_DOGRULA')).toMatchObject({
      error: '1',
      messages: [{ text: 'Service Not Found' }],
    });
  });

  test('refuses a client-sent ETTN with HTTP 200 text and no error flag', async () => {
    const { token } = await login();
    const body = await dispatch(
      token,
      'EARSIV_PORTAL_FATURA_OLUSTUR',
      draft({ faturaUuid: '11111111-2222-1333-a444-555555555555' }),
    );
    expect(body.error).toBeUndefined();
    expect(body.data).toBe(messages.ettnRejected);
  });

  test('creates numbered drafts with server-assigned ETTNs', async () => {
    const { token } = await login();
    const created = await dispatch(token, 'EARSIV_PORTAL_FATURA_OLUSTUR', draft());
    expect(created.data).toBe(messages.draftCreated);
    await dispatch(token, 'EARSIV_PORTAL_FATURA_OLUSTUR', draft({ aliciUnvan: 'ACME A.Ş.' }));

    const list = await dispatch(token, 'EARSIV_PORTAL_TASLAKLARI_GETIR', {
      baslangic: today(),
      bitis: today(),
      hangiTip: '5000/30000',
      table: [],
    });
    const year = today().slice(-4);
    expect(list.data).toEqual([
      {
        aliciUnvanAdSoyad: 'Ali Veli',
        aliciVknTckn: '11111111111',
        belgeNumarasi: `GIB${year}000000001`,
        belgeTarihi: today().replaceAll('/', '-'),
        belgeTuru: 'FATURA',
        ettn: expect.stringMatching(/^[\da-f-]{36}$/),
        onayDurumu: 'Onaylanmadı',
      },
      expect.objectContaining({
        aliciUnvanAdSoyad: 'ACME A.Ş.',
        belgeNumarasi: `GIB${year}000000002`,
      }),
    ]);
  });

  test('refuses a list range over the limit, both ends counted, as a data row', async () => {
    const { token } = await login();
    const within = await dispatch(token, 'EARSIV_PORTAL_TASLAKLARI_GETIR', {
      baslangic: '01/09/2026',
      bitis: '07/09/2026',
    });
    expect(within.data).toEqual([]);

    const over = await dispatch(token, 'EARSIV_PORTAL_TASLAKLARI_GETIR', {
      baslangic: '01/09/2026',
      bitis: '08/09/2026',
    });
    expect(over.error).toBeUndefined();
    expect(over.data).toEqual([{ error: 'Seçilen tarih aralığı 7 günden fazla olamaz!' }]);

    await admin('PATCH', '/config', { maxRangeDays: 2 });
    const configured = await dispatch(token, 'EARSIV_PORTAL_TASLAKLARI_GETIR', {
      baslangic: '01/09/2026',
      bitis: '04/09/2026',
    });
    expect(configured.data).toEqual([{ error: 'Seçilen tarih aralığı 2 günden fazla olamaz!' }]);
  });

  test('returns the detail and the preview HTML with the QR markup', async () => {
    const { token } = await login();
    const row = await createDraft(token);

    const detail = await dispatch(token, 'EARSIV_PORTAL_FATURA_GETIR', { ettn: row.ettn });
    expect(detail.data).toMatchObject({
      belgeNumarasi: row.belgeNumarasi,
      faturaUuid: row.ettn,
      vknTckn: '11111111111',
    });

    const page = await dispatch(token, 'EARSIV_PORTAL_FATURA_GOSTER', {
      ettn: row.ettn,
      onayDurumu: 'Onaylanmadı',
    });
    const html = String(page.data);
    expect(html).toContain('<div id="qrcode" align="right"></div>');
    expect(html).toContain('makeCode(document.getElementById("qrvalue").innerHTML);');
    const qr = /<div id="qrvalue"[^>]*>([^<]*)<\/div>/.exec(html)?.[1] ?? '';
    expect(JSON.parse(qr)).toMatchObject({
      avkntckn: '11111111111',
      ettn: row.ettn,
      no: row.belgeNumarasi,
      senaryo: 'EARSIVFATURA',
      vkntckn: '3333333301',
    });
  });

  test('names units in the preview HTML the way the portal does', async () => {
    const { token } = await login();
    const [line] = draft().malHizmetTable;
    const row = await createDraft(token, {
      malHizmetTable: [
        { ...line, birim: 'HUR', miktar: 2 },
        { ...line, birim: 'C62', miktar: 3 },
        { ...line, birim: 'KGM', miktar: 4 },
        { ...line, birim: 'XYZ', miktar: 5 },
      ],
    });

    const page = await dispatch(token, 'EARSIV_PORTAL_FATURA_GOSTER', {
      ettn: row.ettn,
      onayDurumu: 'Onaylanmadı',
    });
    const quantities = Array.from(
      String(page.data).matchAll(/<td class="lineTableTd" align="right">&nbsp;(\d+ [^<]*)<\/td>/g),
      ([, quantity]) => quantity,
    );
    expect(quantities).toEqual(['2 Saat', '3 Adet', '4 kg', '5 XYZ']);
  });

  test('signs drafts with the SMS code', async () => {
    const { token } = await login();
    const row = await createDraft(token);

    expect(
      await dispatch(token, 'EARSIV_PORTAL_SMSSIFRE_GONDER', { CEPTEL: '5559999999' }),
    ).toMatchObject({ error: '1' });
    const sent = await dispatch(token, 'EARSIV_PORTAL_SMSSIFRE_GONDER', {
      CEPTEL: '5550000001',
      KCEPTEL: false,
      TIP: '',
    });
    const { oid } = sent.data as { oid: string };

    const sign = (code: string) =>
      dispatch(token, '0lhozfib5410mp', {
        DATA: [{ belgeTuru: 'FATURA', ettn: row.ettn }],
        OID: oid,
        OPR: 1,
        SIFRE: code,
      });
    expect((await sign('000000')).data).toEqual({ msg: messages.smsCodeWrong, sonuc: '0' });
    expect((await sign('123456')).data).toMatchObject({ sonuc: '1' });
    expect((await sign('123456')).data).toMatchObject({ sonuc: '0' });

    const state = (await (await admin('GET', '/state')).json()) as {
      invoices: Array<{ ettn: string; onayDurumu: string }>;
      sms: Array<{ code: string; used: boolean }>;
    };
    expect(state.invoices.find((invoice) => invoice.ettn === row.ettn)?.onayDurumu).toBe(
      'Onaylandı',
    );
    expect(state.sms).toEqual([expect.objectContaining({ code: '123456', used: true })]);
  });

  test('uses the SMS code set through the control API', async () => {
    await admin('POST', '/sms-code', { code: '654321' });
    const { token } = await login();
    await dispatch(token, 'EARSIV_PORTAL_SMSSIFRE_GONDER', { CEPTEL: '5550000001' });
    const state = (await (await admin('GET', '/state')).json()) as { sms: Array<{ code: string }> };
    expect(state.sms.at(-1)?.code).toBe('654321');
  });

  test('has no phone for 33333303', async () => {
    const { token } = await login('33333303');
    expect((await dispatch(token, 'EARSIV_PORTAL_TELEFONNO_SORGULA')).data).toEqual({});
  });

  test('deletes unsigned drafts only', async () => {
    const { token } = await login();
    const row = await createDraft(token);

    expect(
      await dispatch(token, 'EARSIV_PORTAL_FATURA_SIL', { aciklama: '', silinecekler: [row] }),
    ).toMatchObject({ error: '1', messages: [{ text: messages.deleteReasonMissing }] });

    const deleted = await dispatch(token, 'EARSIV_PORTAL_FATURA_SIL', {
      aciklama: 'hatalı',
      silinecekler: [row],
    });
    expect(deleted.data).toBe(messages.deleted(1));
    const list = await dispatch(token, 'EARSIV_PORTAL_TASLAKLARI_GETIR', {
      baslangic: today(),
      bitis: today(),
    });
    expect((list.data as Array<Record<string, string>>)[0].onayDurumu).toBe('Silinmiş');
  });

  test('keeps signed documents from deletion', async () => {
    const seeded = (await (
      await admin('POST', '/seed', {
        invoices: [{ date: '01/09/2026', status: 'Onaylandı', userid: '33333301' }],
      })
    ).json()) as { invoices: Array<Record<string, string>> };
    const { token } = await login();
    expect(
      await dispatch(token, 'EARSIV_PORTAL_FATURA_SIL', {
        aciklama: 'iptal',
        silinecekler: seeded.invoices,
      }),
    ).toMatchObject({ error: '1', messages: [{ text: messages.notDeletable }] });
  });

  test('returns the user info', async () => {
    const { token } = await login('12345678', 'angaria');
    expect((await dispatch(token, 'EARSIV_PORTAL_KULLANICI_BILGILERI_GETIR')).data).toMatchObject({
      ad: 'Deniz',
      soyad: 'Yılmaz',
      vknTckn: '10000000146',
    });
  });
});

describe('chaos', () => {
  test('a text fault answers HTTP 200 with the error text in data and creates nothing', async () => {
    await admin('POST', '/faults', { cmd: 'EARSIV_PORTAL_FATURA_OLUSTUR', kind: 'text' });
    const { token } = await login();
    const body = await dispatch(token, 'EARSIV_PORTAL_FATURA_OLUSTUR', draft());
    expect(body).toMatchObject({ data: messages.textError });
    expect(body.error).toBeUndefined();
    expect((await dispatch(token, 'EARSIV_PORTAL_FATURA_OLUSTUR', draft())).data).toBe(
      messages.draftCreated,
    );
    const state = (await (await admin('GET', '/state')).json()) as { invoices: Array<unknown> };
    expect(state.invoices).toHaveLength(4);
  });

  test('a 5xx fault answers an HTML error page', async () => {
    await admin('POST', '/faults', { cmd: 'login', kind: '5xx', status: 502 });
    const response = await post('/earsiv-services/assos-login', loginFields('33333301', '1'));
    expect(response.status).toBe(502);
    expect(await response.text()).toContain('502 Bad Gateway');
    expect((await login()).token).not.toBe('');
  });

  test('maintenance answers HTML instead of JSON', async () => {
    await admin('PATCH', '/config', { chaos: { maintenance: true } });
    const response = await post('/earsiv-services/assos-login', loginFields('33333301', '1'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    await expect(response.json()).rejects.toThrow();
  });

  test('latency delays portal responses', async () => {
    await admin('PATCH', '/config', { chaos: { latencyMs: 150 } });
    const started = performance.now();
    await login();
    expect(performance.now() - started).toBeGreaterThanOrEqual(140);
  });
});

describe('TCMB', () => {
  let tcmb: RunningEmulator;
  let afternoon: RunningEmulator;

  beforeAll(async () => {
    // Wednesday 30 September 2026, 12:00 and 16:00 in Istanbul. TCMB publishes
    // the day's bulletin at 15:30.
    tcmb = await startEmulator({ now: () => Date.UTC(2026, 8, 30, 9) });
    afternoon = await startEmulator({ now: () => Date.UTC(2026, 8, 30, 13) });
  });

  afterAll(() => Promise.all([tcmb.close(), afternoon.close()]));

  const get = (path: string, base = tcmb.url) => fetch(`${base}/kurlar/${path}`);

  test('serves a bulletin in the TCMB schema, the same every time', async () => {
    const response = await get('202609/29092026.xml');
    const xml = await response.text();
    expect(response.status).toBe(200);
    expect(xml).toContain('<Tarih_Date Tarih="29.09.2026" Date="09/29/2026"');
    expect(xml).toMatch(
      /<Currency CrossOrder="0" Kod="USD" CurrencyCode="USD">\s*<Unit>1<\/Unit>[\s\S]*?<ForexBuying>\d+\.\d{4}<\/ForexBuying>/,
    );
    expect(xml).toMatch(/CurrencyCode="JPY">\s*<Unit>100<\/Unit>/);
    expect(await (await get('202609/29092026.xml')).text()).toBe(xml);
  });

  test('lists the currencies of the 2026 feed', async () => {
    const xml = await (await get('202609/29092026.xml')).text();
    expect([...xml.matchAll(/CurrencyCode="(\w+)"/g)].map((match) => match[1])).toEqual([
      'USD',
      'AUD',
      'DKK',
      'EUR',
      'GBP',
      'CHF',
      'SEK',
      'CAD',
      'KWD',
      'NOK',
      'SAR',
      'JPY',
      'RON',
      'RUB',
      'CNY',
      'PKR',
      'QAR',
      'KRW',
      'AZN',
      'AED',
      'KZT',
      'XDR',
    ]);
    expect(xml).toMatch(
      /CurrencyCode="XDR">[\s\S]*?<ForexBuying>\d+\.\d{4}<\/ForexBuying>\s*<ForexSelling\/>/,
    );
  });

  test('has no bulletin on weekends, holidays, half days, future days or under the wrong month', async () => {
    expect((await get('202609/27092026.xml')).status).toBe(404);
    expect((await get('202510/29102025.xml')).status).toBe(404);
    expect((await get('202510/28102025.xml')).status).toBe(404);
    expect((await get('202603/19032026.xml')).status).toBe(404);
    expect((await get('202605/27052026.xml')).status).toBe(404);
    expect((await get('202610/01102026.xml')).status).toBe(404);
    expect((await get('202608/29092026.xml')).status).toBe(404);
    expect((await get('202509/29092025.xml')).status).toBe(200);
  });

  test("today's bulletin appears at 15:30", async () => {
    expect((await get('202609/30092026.xml')).status).toBe(404);
    expect(await (await get('today.xml')).text()).toContain('Tarih="29.09.2026"');

    expect((await get('202609/30092026.xml', afternoon.url)).status).toBe(200);
    expect(await (await get('today.xml', afternoon.url)).text()).toContain('Tarih="30.09.2026"');
  });
});

/** A raw request, so the test can send any Host header. */
function raw(
  path: string,
  {
    body,
    headers = {},
    method = 'GET',
  }: {
    body?: string;
    headers?: Record<string, string>;
    method?: string;
  } = {},
) {
  return new Promise<{ body: string; headers: Record<string, unknown>; status: number }>(
    (resolve, reject) => {
      const outgoing = request(`${emulator.url}${path}`, { headers, method }, (response) => {
        let text = '';
        response.setEncoding('utf8');
        response.on('data', (chunk: string) => (text += chunk));
        response.on('end', () =>
          resolve({ body: text, headers: response.headers, status: response.statusCode ?? 0 }),
        );
      });
      outgoing.on('error', reject);
      outgoing.end(body);
    },
  );
}

describe('access', () => {
  test('refuses a Host other than loopback or *.angaria.localhost', async () => {
    expect(
      (await raw('/__emulator/state', { headers: { host: 'rebind.evil.example' } })).status,
    ).toBe(403);
    expect(
      (await raw('/kurlar/today.xml', { headers: { host: 'evil.example:5180' } })).status,
    ).toBe(403);
    for (const host of ['127.0.0.1:5180', 'localhost', '[::1]:5180', 'gib.angaria.localhost']) {
      expect((await raw('/__emulator/state', { headers: { host } })).status).toBe(200);
    }
  });

  test('refuses /__emulator from a web page on another origin, and sends no CORS headers', async () => {
    const preflight = await raw('/__emulator/config', {
      headers: {
        'access-control-request-method': 'PATCH',
        origin: 'https://evil.example',
      },
      method: 'OPTIONS',
    });
    expect(preflight.status).toBe(403);
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined();

    const seed = await raw('/__emulator/seed', {
      body: JSON.stringify({ invoices: [{ userid: '33333301' }] }),
      headers: { 'content-type': 'text/plain', origin: 'https://evil.example' },
      method: 'POST',
    });
    expect(seed.status).toBe(403);
    const state = (await (await admin('GET', '/state')).json()) as { invoices: Array<unknown> };
    expect(state.invoices).toHaveLength(3);

    const local = await raw('/__emulator/state', { headers: { origin: 'http://localhost:5173' } });
    expect(local.status).toBe(200);
    expect(local.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('PATCH /__emulator/config never takes a state file', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gib-emulator-'));
    const stateFile = join(dir, 'written.json');
    try {
      const response = await admin('PATCH', '/config', { maxRangeDays: 3, stateFile });
      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: expect.stringContaining('Not patchable: stateFile'),
      });
      await admin('POST', '/seed', { invoices: [{ userid: '33333301' }] });
      expect(existsSync(stateFile)).toBe(false);
      expect(emulator.config.maxRangeDays).toBe(7);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });

  test('portal routes allow CORS for the desktop dev origins only', async () => {
    for (const origin of [
      'http://localhost:5173',
      'http://127.0.0.1:1420',
      'tauri://localhost',
      'http://tauri.localhost',
    ]) {
      const response = await raw('/kurlar/today.xml', { headers: { origin } });
      expect(response.headers['access-control-allow-origin']).toBe(origin);
      const preflight = await raw('/earsiv-services/dispatch', {
        headers: { 'access-control-request-method': 'POST', origin },
        method: 'OPTIONS',
      });
      expect(preflight.headers['access-control-allow-origin']).toBe(origin);
    }
    const foreign = await raw('/kurlar/today.xml', { headers: { origin: 'https://evil.example' } });
    expect(foreign.status).toBe(200);
    expect(foreign.headers['access-control-allow-origin']).toBeUndefined();
  });
});

describe('persistence', () => {
  test('a state file keeps documents and numbering across restarts', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'gib-emulator-'));
    const stateFile = join(dir, 'state.json');
    try {
      const first = await startEmulator({ config: { seedInvoices: [], stateFile } });
      const { token } = await login('33333301', '1', first.url);
      await dispatch(token, 'EARSIV_PORTAL_FATURA_OLUSTUR', draft(), first.url);
      await first.close();

      const second = await startEmulator({ config: { seedInvoices: [], stateFile } });
      const again = await login('33333301', '1', second.url);
      await dispatch(again.token, 'EARSIV_PORTAL_FATURA_OLUSTUR', draft(), second.url);
      const list = await dispatch(
        again.token,
        'EARSIV_PORTAL_TASLAKLARI_GETIR',
        { baslangic: today(), bitis: today() },
        second.url,
      );
      await second.close();
      expect(
        (list.data as Array<Record<string, string>>).map((row) => row.belgeNumarasi.slice(-1)),
      ).toEqual(['1', '2']);
    } finally {
      rmSync(dir, { force: true, recursive: true });
    }
  });
});
