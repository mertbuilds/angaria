const PROD_URL = 'https://earsivportal.efatura.gov.tr';

export interface SessionInfo {
  baseUrl: string;
  cookies: Array<string>;
  token: string;
}

export interface InvoiceItem {
  discountAmount?: number;
  discountRate?: number;
  discountReason?: string;
  gtip?: string;
  name: string;
  price: number;
  quantity: number;
  unitPrice: number;
  unitType?: string;
  VATAmount: number;
  VATRate: number;
}

export interface InvoiceDetails {
  city?: string;
  country?: string;
  currency?: string;
  currencyRate?: string;
  date: string; // DD/MM/YYYY
  district?: string;
  fullAddress: string;
  grandTotal: number;
  grandTotalInclVAT: number;
  invoiceType?: string;
  irsaliyeNumarasi?: string;
  irsaliyeTarihi?: string;
  items: Array<InvoiceItem>;
  name?: string;
  note?: string;
  paymentTotal: number;
  surname?: string;
  taxIDOrTRID: string;
  taxOffice?: string;
  time: string; // HH:MM:SS
  title: string;
  totalDiscount?: number;
  totalVAT: number;
}

/** One row of the document list (EARSIV_PORTAL_TASLAKLARI_GETIR), as GİB sends it. */
export interface DraftRow {
  [key: string]: unknown;
  aliciUnvanAdSoyad?: string;
  aliciVknTckn?: string;
  belgeNumarasi?: string;
  /** dd-MM-yyyy */
  belgeTarihi?: string;
  belgeTuru?: string;
  ettn?: string;
  /** Onaylanmadı, Onaylandı, Silinmiş */
  onayDurumu?: string;
}

type FetchFn = typeof globalThis.fetch;

function extractCookies(response: Response): Array<string> {
  const cookies: Array<string> = [];
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') {
      const cookie = value.split(';')[0];
      if (cookie) {
        cookies.push(cookie);
      }
    }
  });
  return cookies;
}

function mergeCookies(existing: Array<string>, incoming: Array<string>): Array<string> {
  const map = new Map<string, string>();
  for (const c of [...existing, ...incoming]) {
    const name = c.split('=')[0];
    if (name) {
      map.set(name, c);
    }
  }
  return [...map.values()];
}

/** The portal account's own taxpayer: the seller on every invoice it issues. */
export interface UserInfo {
  /** Unvan, else "Ad Soyad" */
  name: string;
  /** VKN (10 digits) or TCKN (11 digits) */
  taxID: string;
  taxOffice: string;
}

/** A taxpayer as GİB's registry (sicil, MERNİS) knows it; empty strings where it says nothing. */
export interface Taxpayer {
  /** A person's first name */
  name: string;
  /** A person's last name */
  surname: string;
  taxOffice: string;
  /** A company's unvan */
  title: string;
}

export interface EarsivClient {
  cancelInvoice(
    session: SessionInfo,
    reason: string,
    invoice: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  createDraftInvoice(
    session: SessionInfo,
    details: InvoiceDetails,
  ): Promise<{ date: string; response: Record<string, unknown>; uuid: string }>;
  /**
   * GİB's own copy of a document: the zip the portal's İndir button saves
   * (the e-Arşiv invoice as HTML, with its XML where GİB adds it).
   */
  downloadInvoice(
    session: SessionInfo,
    ettn: string,
    onayDurumu: string,
    options?: { signal?: AbortSignal },
  ): Promise<Uint8Array<ArrayBuffer>>;
  forceLogout(username: string, password: string): Promise<void>;
  getDrafts(
    session: SessionInfo,
    startDate: string,
    endDate: string,
    options?: { signal?: AbortSignal },
  ): Promise<Array<DraftRow>>;
  getInvoiceDetail(session: SessionInfo, ettn: string): Promise<Record<string, unknown>>;
  getInvoiceHTML(session: SessionInfo, uuid: string, onayDurumu: string): Promise<string>;
  getSigningPhone(session: SessionInfo): Promise<string>;
  /**
   * The registry's unvan or name and tax office for a VKN / TCKN, as the
   * portal's own Yeni fatura fills them; null when GİB knows nothing for it.
   */
  getTaxpayer(session: SessionInfo, taxID: string): Promise<Taxpayer | null>;
  /** Kullanıcı bilgileri: the account's VKN / TCKN, unvan or name, and tax office. */
  getUserInfo(session: SessionInfo): Promise<UserInfo>;
  getUUID(session: SessionInfo): Promise<string>;
  login(username: string, password: string): Promise<SessionInfo>;
  logout(session: SessionInfo): Promise<void>;
  requestSigningSMS(session: SessionInfo, phone: string): Promise<string>;
  signInvoiceHSM(
    session: SessionInfo,
    invoice: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  startSMSSign(session: SessionInfo): Promise<{ oid: string; phone: string }>;
  verifyAndSign(
    session: SessionInfo,
    smsCode: string,
    oid: string,
    invoiceIds: Array<string>,
  ): Promise<Record<string, unknown>>;
}

export const GIB_ERROR_CODES = [
  'auth',
  'maintenance',
  'network',
  'not-found',
  'range-too-long',
  'rate-limit',
  'session-expired',
  'session-locked',
  'sms-code-wrong',
  'sms-failed',
  'unknown',
  'validation',
] as const;

/** What went wrong in a GİB call, for the app to tell the user what to do. */
export type GibErrorCode = (typeof GIB_ERROR_CODES)[number];

/**
 * Every failure of a portal call. `message` is GİB's own text when it sent
 * one, else a short Turkish description; `gibMessage` is GİB's text alone.
 */
export class GibError extends Error {
  readonly code: GibErrorCode;
  readonly gibMessage?: string;
  /** HTTP status of a reply that was not GİB's JSON. */
  readonly status?: number;

  constructor(
    code: GibErrorCode,
    message: string,
    options: { cause?: unknown; gibMessage?: string; status?: number } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = 'GibError';
    this.code = code;
    this.gibMessage = options.gibMessage;
    this.status = options.status;
  }
}

// GİB's texts, lowercased with Turkish rules. Portal states win over the
// caller's fallback; content refusals only apply without one.
const PORTAL_TEXTS: Array<[RegExp, GibErrorCode]> = [
  [/birden fazla giriş|açık (?:bir )?oturum|güvenli çıkış/, 'session-locked'],
  [/bakım/, 'maintenance'],
  [/tarih aralığı.*(?:fazla|uzun)/, 'range-too-long'],
  [/(?:çok fazla|fazla sayıda) (?:istek|işlem|deneme|sorgu)|kısa süre/, 'rate-limit'],
  [
    /süresi dol|zaman ?aşımı|sona er|yeniden giriş|tekrar giriş|oturum geçersiz|token/,
    'session-expired',
  ],
];
const CONTENT_TEXTS: Array<[RegExp, GibErrorCode]> = [
  [/bulunamadı|bulunmamaktadır/, 'not-found'],
  [
    /olamaz|olmalı|giriniz|girilmeli|zorunlu|eksik|uymuyor|uyuşmuyor|geçerli bir|geçersiz|hatalı|silinemez/,
    'validation',
  ],
];

/** The code of one of GİB's texts; `fallback` is what the call means otherwise. */
function classifyGibMessage(text: string, fallback?: GibErrorCode): GibErrorCode {
  const lower = text.toLocaleLowerCase('tr');
  const match = (texts: Array<[RegExp, GibErrorCode]>) =>
    texts.find(([pattern]) => pattern.test(lower))?.[1];
  return match(PORTAL_TEXTS) ?? fallback ?? match(CONTENT_TEXTS) ?? 'unknown';
}

/** GİB's text as a GibError: `fallback` names the failure when GİB sent no text. */
function gibError(text: unknown, fallback: string, code?: GibErrorCode): GibError {
  const gibMessage = typeof text === 'string' && text.trim() ? text.trim() : undefined;
  return gibMessage
    ? new GibError(classifyGibMessage(gibMessage, code), gibMessage, { gibMessage })
    : new GibError(code ?? 'unknown', fallback);
}

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const norm = (s: string) => s.trim().toLocaleUpperCase('tr');
const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** A document list that is not a list of rows: a text in its place is GİB's own message. */
const unreadableList = (value: unknown) => gibError(value, 'GİB belge listesi okunamadı');

/** GİB's error envelope ({ error: '1', messages: [{ text }] }) as a GibError, else null. */
function portalError(
  result: Record<string, unknown>,
  fallback: string,
  code?: GibErrorCode,
): GibError | null {
  if (result.error !== '1' && result.error !== 1) {
    return null;
  }
  const messages = result.messages as Array<{ text?: unknown }> | undefined;
  return gibError(messages?.[0]?.text, fallback, code);
}

const isAbort = (error: unknown) => error instanceof Error && error.name === 'AbortError';

/** A zip starts with a local file header: PK\x03\x04. */
const isZip = (bytes: Uint8Array) =>
  bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04;

/**
 * A reply that is not GİB's JSON: its maintenance page, a proxy's error
 * page, or anything else in place of the envelope.
 */
function replyError(response: Response, body: string): GibError {
  const { status } = response;
  if (body.toLocaleLowerCase('tr').includes('bakım')) {
    return new GibError('maintenance', 'GİB e-Arşiv portalı bakımda', { status });
  }
  // 503 without the maintenance page: the portal (or its proxy) is overloaded.
  if (status === 429 || status === 503) {
    return new GibError('rate-limit', 'GİB çok fazla istek aldı', { status });
  }
  return new GibError(
    'unknown',
    response.ok
      ? 'GİB beklenmeyen bir yanıt verdi'
      : `GİB beklenmeyen bir yanıt verdi (HTTP ${status})`,
    { status },
  );
}

/**
 * Longest range one draft list request may cover, both ends included. GİB
 * refuses ranges longer than seven days ("Seçilen tarih aralığı 7 günden
 * fazla olamaz!").
 */
export const MAX_DRAFT_RANGE_DAYS = 7;

const pad = (n: number) => String(n).padStart(2, '0');

function parseGIBDate(value: string): Date | null {
  const match = /^(\d{2})[/-](\d{2})[/-](\d{4})$/.exec(value);
  if (!match) {
    return null;
  }
  const [, dd, mm, yyyy] = match.map(Number);
  const date = new Date(yyyy, mm - 1, dd);
  return date.getMonth() === mm - 1 ? date : null;
}

const formatGIBDate = (date: Date) =>
  `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;

/**
 * Splits an inclusive range of GİB dates (dd/MM/yyyy or dd-MM-yyyy) into
 * consecutive ranges of at most `days` days, oldest first. A range GİB would
 * reject anyway (malformed, or start after end) comes back unchanged.
 */
export function splitDateRange(
  startDate: string,
  endDate: string,
  days = MAX_DRAFT_RANGE_DAYS,
): Array<{ endDate: string; startDate: string }> {
  const start = parseGIBDate(startDate);
  const end = parseGIBDate(endDate);
  if (!start || !end || start > end) {
    return [{ endDate, startDate }];
  }
  const ranges: Array<{ endDate: string; startDate: string }> = [];
  for (let from = start; from <= end;) {
    const last = new Date(from.getFullYear(), from.getMonth(), from.getDate() + days - 1);
    const to = last < end ? last : end;
    ranges.push({ endDate: formatGIBDate(to), startDate: formatGIBDate(from) });
    from = new Date(to.getFullYear(), to.getMonth(), to.getDate() + 1);
  }
  return ranges;
}

/**
 * An amount rounded to kuruş, half away from zero. Reads the value at 15
 * significant digits first, so binary noise (1.005 is 1.00499999...) rounds the
 * way the decimal reads.
 */
export function roundKurus(value: number): number {
  const kurus = Math.round(Number((Math.abs(value) * 100).toPrecision(15)));
  return value < 0 && kurus !== 0 ? -kurus / 100 : kurus / 100;
}

/** An amount as GİB stores it: "1250.50". */
const money = (value: number) => roundKurus(value).toFixed(2);

/**
 * A unit price as GİB stores it: two decimals ("1250.50"), more when the price
 * has them, up to eight ("33.3333").
 */
const unitPrice = (value: number) => value.toFixed(8).replace(/(\.\d{2}\d*?)0+$/, '$1');

/**
 * The EARSIV_PORTAL_FATURA_OLUSTUR payload for `details`. Amounts go as sent,
 * rounded to kuruş: the caller rounds each line and sums the rounded lines.
 */
export function draftInvoicePayload(details: InvoiceDetails): Record<string, unknown> {
  for (const item of details.items) {
    // kdvOrani goes as a whole number: a fraction would be rounded away silently.
    if (!Number.isInteger(item.VATRate)) {
      throw new RangeError(`KDV oranı tam sayı olmalı: ${item.VATRate}`);
    }
  }
  return {
    // Must be empty: GİB now assigns the ETTN server-side and rejects
    // client-generated UUIDs with "Ettn ya eksik ya boş..." errors.
    faturaUuid: '',
    belgeNumarasi: '',
    faturaTarihi: details.date,
    saat: details.time,
    paraBirimi: details.currency ?? 'TRY',
    dovzTLkur: details.currencyRate ?? '0',
    faturaTipi: details.invoiceType ?? 'ISTISNA',
    hangiTip: '5000/30000',
    vknTckn: details.taxIDOrTRID,
    aliciUnvan: details.title,
    aliciAdi: details.name ?? '',
    aliciSoyadi: details.surname ?? '',
    binaAdi: '',
    binaNo: '',
    kapiNo: '',
    kasabaKoy: '',
    vergiDairesi: details.taxOffice ?? '',
    ulke: details.country ?? '',
    bulvarcaddesokak: details.fullAddress,
    irsaliyeNumarasi: details.irsaliyeNumarasi ?? '',
    irsaliyeTarihi: details.irsaliyeTarihi ?? '',
    mahalleSemtIlce: details.district ?? '',
    sehir: details.city ?? ' ',
    postaKodu: '',
    tel: '',
    fax: '',
    eposta: '',
    websitesi: '',
    iadeTable: [],
    ihracKayitliKarsiBelgeNo: '',
    yatirimTesvikNumarasi: '',
    yatirimTesvikTarihi: details.date,
    vergiCesidi: ' ',
    malHizmetTable: details.items.map((item) => ({
      malHizmet: item.name,
      miktar: item.quantity,
      birim: item.unitType ?? 'C62',
      birimFiyat: unitPrice(item.unitPrice),
      fiyat: money(item.price),
      iskontoOrani: item.discountRate ?? 0,
      iskontoTutari: money(item.discountAmount ?? 0),
      iskontoNedeni: item.discountReason ?? '',
      malHizmetTutari: money(item.price),
      kdvOrani: String(item.VATRate),
      vergiOrani: 0,
      kdvTutari: money(item.VATAmount),
      vergininKdvTutari: '0',
      ozelMatrahTutari: '0',
      hesaplananotvtevkifatakatkisi: '0',
      gtip: item.gtip ?? '',
    })),
    tip: 'İskonto',
    matrah: money(details.grandTotal),
    malhizmetToplamTutari: money(details.grandTotal),
    toplamIskonto: money(details.totalDiscount ?? 0),
    hesaplanankdv: money(details.totalVAT),
    vergilerToplami: money(details.totalVAT),
    vergilerDahilToplamTutar: money(details.grandTotalInclVAT),
    odenecekTutar: money(details.paymentTotal),
    not: details.note ?? '',
    siparisNumarasi: '',
    siparisTarihi: '',
    fisNo: '',
    fisTarihi: '',
    fisSaati: ' ',
    fisTipi: ' ',
    zRaporNo: '',
    okcSeriNo: '',
  };
}

export interface ClientOptions {
  /**
   * Portal origin, e.g. the local GİB emulator (packages/gib-emulator).
   * Default: the production portal.
   */
  baseUrl?: string;
  fetch?: FetchFn;
}

export function createClient(options?: ClientOptions): EarsivClient {
  const fetchFn: FetchFn = options?.fetch ?? globalThis.fetch;
  const portalUrl = options?.baseUrl ?? PROD_URL;

  /**
   * POSTs a form and reads GİB's JSON. A request that fails (DNS, TLS,
   * timeout, offline) is a `network` GibError, a reply that is not GİB's JSON
   * is classified by replyError.
   */
  async function post(
    url: string,
    headers: Record<string, string>,
    body: string,
  ): Promise<{ json: Record<string, unknown>; response: Response }> {
    let response: Response;
    let text: string;
    try {
      response = await fetchFn(url, { method: 'POST', headers, body });
      text = await response.text();
    } catch (error) {
      if (isAbort(error)) {
        throw error;
      }
      throw new GibError('network', 'GİB’e ulaşılamadı', { cause: error });
    }
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    if (!isRecord(json) || (!response.ok && json.error !== '1' && json.error !== 1)) {
      throw replyError(response, text);
    }
    return { json, response };
  }

  async function dispatch(
    session: SessionInfo,
    cmd: string,
    pageName: string,
    data: Record<string, unknown> = {},
    code?: GibErrorCode,
  ): Promise<Record<string, unknown>> {
    const callid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const body = `cmd=${cmd}&callid=${callid}&pageName=${pageName}&token=${session.token}&jp=${encodeURIComponent(JSON.stringify(data))}`;

    const { json: result, response } = await post(
      `${session.baseUrl}/earsiv-services/dispatch`,
      {
        accept: 'application/json, text/javascript, */*; q=0.01',
        'cache-control': 'no-cache',
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        pragma: 'no-cache',
        cookie: session.cookies.join('; '),
        Referer: `${session.baseUrl}/index.jsp`,
      },
      body,
    );

    session.cookies = mergeCookies(session.cookies, extractCookies(response));

    const error = portalError(result, 'GİB portaldan bilinmeyen hata', code);
    if (error) {
      throw error;
    }

    return result;
  }

  const postLogin = (baseUrl: string, username: string, password: string) =>
    post(
      `${baseUrl}/earsiv-services/assos-login`,
      {
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        Referer: `${baseUrl}/intragiris.html`,
      },
      `assoscmd=anologin&rtype=json&userid=${encodeURIComponent(username)}&sifre=${encodeURIComponent(password)}&sifre2=${encodeURIComponent(password)}&parola=1&`,
    );

  async function login(username: string, password: string): Promise<SessionInfo> {
    const baseUrl = portalUrl;
    const { json, response } = await postLogin(baseUrl, username, password);
    const cookies = extractCookies(response);

    if (!json.token) {
      const messages = json.messages as Array<{ text?: unknown }> | undefined;
      throw gibError(messages?.[0]?.text, 'Giriş başarısız', 'auth');
    }

    return { token: json.token as string, cookies, baseUrl };
  }

  /**
   * assoscmd=logout: `anologin` is the portal's login command and, without a
   * userid, fails instead of ending the session.
   */
  async function sendLogout(baseUrl: string, cookies: Array<string>, token: string) {
    const { json } = await post(
      `${baseUrl}/earsiv-services/assos-login`,
      {
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        cookie: cookies.join('; '),
        Referer: `${baseUrl}/intragiris.html`,
      },
      `assoscmd=logout&rtype=json&token=${token}&`,
    );
    const error = portalError(json, 'Çıkış başarısız');
    if (error) {
      throw error;
    }
  }

  async function logout(session: SessionInfo): Promise<void> {
    await sendLogout(session.baseUrl, session.cookies, session.token);
  }

  async function forceLogout(username: string, password: string): Promise<void> {
    const baseUrl = portalUrl;
    const { json, response } = await postLogin(baseUrl, username, password);
    const cookies = extractCookies(response);
    const token = (json.token as string) ?? '';

    await sendLogout(baseUrl, cookies, token);
  }

  async function getUUID(session: SessionInfo): Promise<string> {
    const result = await dispatch(session, 'EARSIV_PORTAL_UUID_GETIR', 'RG_BASITFATURA');
    return result.data as string;
  }

  async function createDraftInvoice(
    session: SessionInfo,
    details: InvoiceDetails,
  ): Promise<{ date: string; response: Record<string, unknown>; uuid: string }> {
    const invoiceData = draftInvoicePayload(details);

    const result = await dispatch(
      session,
      'EARSIV_PORTAL_FATURA_OLUSTUR',
      'RG_BASITFATURA',
      invoiceData,
    );

    // GİB may report failure with HTTP 200 and no error flag; only the
    // known success message in `data` confirms the draft was created.
    const data = result.data;
    if (typeof data !== 'string' || !data.includes('başarıyla oluşturul')) {
      throw gibError(data, 'Fatura oluşturulamadı');
    }

    const uuid = await findCreatedDraftUUID(session, details);
    return { uuid, date: details.date, response: result };
  }

  /** The create response doesn't include the server-assigned ETTN, so look
   * it up in the drafts list: same date, unsigned, preferring a recipient
   * match, newest document number wins. Returns "" if not found. */
  async function findCreatedDraftUUID(
    session: SessionInfo,
    details: InvoiceDetails,
  ): Promise<string> {
    try {
      const drafts = await getDrafts(session, details.date, details.date);
      const dashDate = details.date.replaceAll('/', '-');
      let rows = drafts.filter(
        (d) =>
          (d.belgeTarihi === details.date || d.belgeTarihi === dashDate) &&
          d.onayDurumu === 'Onaylanmadı',
      );

      const candidates = [details.title, `${details.name ?? ''} ${details.surname ?? ''}`]
        .map(norm)
        .filter(Boolean);
      const recipientRows = rows.filter((d) => candidates.includes(norm(str(d.aliciUnvanAdSoyad))));
      if (recipientRows.length > 0) {
        rows = recipientRows;
      }

      const newest = rows.reduce<Record<string, unknown> | undefined>(
        (best, d) => (!best || str(d.belgeNumarasi) > str(best.belgeNumarasi) ? d : best),
        undefined,
      );
      return typeof newest?.ettn === 'string' ? newest.ettn : '';
    } catch {
      return '';
    }
  }

  async function getInvoiceDetail(
    session: SessionInfo,
    ettn: string,
  ): Promise<Record<string, unknown>> {
    const result = await dispatch(session, 'EARSIV_PORTAL_FATURA_GETIR', 'RG_BASITFATURA', {
      ettn,
    });
    return result.data as Record<string, unknown>;
  }

  async function getInvoiceHTML(
    session: SessionInfo,
    uuid: string,
    onayDurumu: string,
  ): Promise<string> {
    const result = await dispatch(session, 'EARSIV_PORTAL_FATURA_GOSTER', 'RG_BASITTASLAKLAR', {
      ettn: uuid,
      onayDurumu,
    });
    return result.data as string;
  }

  /**
   * GET /earsiv-services/download (EARSIV_PORTAL_BELGE_INDIR). A zip comes
   * back as is; anything else is GİB's error envelope, a plain text such as
   * "Oturum geçersiz, token yok", or an HTML page.
   */
  async function downloadInvoice(
    session: SessionInfo,
    ettn: string,
    onayDurumu: string,
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<Uint8Array<ArrayBuffer>> {
    const query = new URLSearchParams({
      token: session.token,
      ettn,
      belgeTip: 'FATURA',
      onayDurumu,
      cmd: 'EARSIV_PORTAL_BELGE_INDIR',
    });
    let response: Response;
    let bytes: Uint8Array<ArrayBuffer>;
    try {
      response = await fetchFn(`${session.baseUrl}/earsiv-services/download?${query}`, {
        headers: { cookie: session.cookies.join('; '), Referer: `${session.baseUrl}/index.jsp` },
        signal,
      });
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch (error) {
      if (isAbort(error)) {
        throw error;
      }
      throw new GibError('network', 'GİB’e ulaşılamadı', { cause: error });
    }
    if (response.ok && isZip(bytes)) {
      return bytes;
    }
    const text = new TextDecoder().decode(bytes).trim();
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      json = undefined;
    }
    if (isRecord(json)) {
      throw portalError(json, 'GİB belgeyi vermedi') ?? replyError(response, text);
    }
    if (text && !text.startsWith('<')) {
      throw gibError(text, 'GİB belgeyi vermedi');
    }
    throw replyError(response, text);
  }

  /**
   * Every document dated within the range. Ranges longer than GİB allows are
   * fetched in chunks, one after the other on the same session, and merged
   * oldest first; a row returned twice (same ETTN) is kept once.
   */
  async function getDrafts(
    session: SessionInfo,
    startDate: string,
    endDate: string,
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<Array<DraftRow>> {
    const rows: Array<DraftRow> = [];
    const seen = new Set<string>();
    for (const range of splitDateRange(startDate, endDate)) {
      signal?.throwIfAborted();
      const result = await dispatch(
        session,
        'EARSIV_PORTAL_TASLAKLARI_GETIR',
        'RG_BASITTASLAKLAR',
        {
          baslangic: range.startDate,
          bitis: range.endDate,
          hangiTip: '5000/30000',
          table: [],
        },
      );
      if (!Array.isArray(result.data)) {
        throw unreadableList(result.data);
      }
      for (const row of result.data as Array<unknown>) {
        if (!isRecord(row)) {
          throw unreadableList(row);
        }
        // A refused query comes back as data, not as an error: [{ error: '...' }].
        if (typeof row.error === 'string') {
          throw gibError(row.error, 'GİB belge listesi okunamadı');
        }
        const ettn = str(row.ettn);
        if (ettn) {
          if (seen.has(ettn)) {
            continue;
          }
          seen.add(ettn);
        }
        rows.push(row as DraftRow);
      }
    }
    return rows;
  }

  async function signInvoiceHSM(
    session: SessionInfo,
    invoice: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return dispatch(session, 'EARSIV_PORTAL_FATURA_HSM_CIHAZI_ILE_IMZALA', 'RG_BASITTASLAKLAR', {
      imzalanacaklar: [invoice],
    });
  }

  async function getSigningPhone(session: SessionInfo): Promise<string> {
    const result = await dispatch(
      session,
      'EARSIV_PORTAL_TELEFONNO_SORGULA',
      'RG_BASITTASLAKLAR',
      {},
      'sms-failed',
    );
    const data = result.data as Record<string, string> | undefined;
    return data?.telefon ?? '';
  }

  async function getUserInfo(session: SessionInfo): Promise<UserInfo> {
    const result = await dispatch(
      session,
      'EARSIV_PORTAL_KULLANICI_BILGILERI_GETIR',
      'RG_KULLANICI',
    );
    const data = isRecord(result.data) ? result.data : {};
    const text = (key: string) => (typeof data[key] === 'string' ? data[key].trim() : '');
    return {
      name: text('unvan') || [text('ad'), text('soyad')].filter(Boolean).join(' '),
      taxID: text('vknTckn'),
      taxOffice: text('vergiDairesi'),
    };
  }

  async function getTaxpayer(session: SessionInfo, taxID: string): Promise<Taxpayer | null> {
    // The parameter is spelled vknTcknn by the portal itself.
    const result = await dispatch(
      session,
      'SICIL_VEYA_MERNISTEN_BILGILERI_GETIR',
      'RG_BASITFATURA',
      {
        vknTcknn: taxID,
      },
    );
    const data = isRecord(result.data) ? result.data : {};
    const text = (key: string) => (typeof data[key] === 'string' ? data[key].trim() : '');
    const found: Taxpayer = {
      name: text('adi'),
      surname: text('soyadi'),
      taxOffice: text('vergiDairesi'),
      title: text('unvan'),
    };
    return found.title || found.name || found.surname ? found : null;
  }

  async function requestSigningSMS(session: SessionInfo, phone: string): Promise<string> {
    const result = await dispatch(
      session,
      'EARSIV_PORTAL_SMSSIFRE_GONDER',
      'RG_SMSONAY',
      { CEPTEL: phone, KCEPTEL: false, TIP: '' },
      'sms-failed',
    );
    const data = result.data as Record<string, string> | undefined;
    return data?.oid ?? '';
  }

  async function verifyAndSign(
    session: SessionInfo,
    smsCode: string,
    oid: string,
    invoiceIds: Array<string>,
  ): Promise<Record<string, unknown>> {
    const result = await dispatch(session, '0lhozfib5410mp', 'RG_SMSONAY', {
      SIFRE: smsCode,
      OID: oid,
      OPR: 1,
      DATA: invoiceIds.map((ettn) => ({ belgeTuru: 'FATURA', ettn })),
    });

    const data = result.data as Record<string, string> | undefined;
    // A wrong or expired code, or an unknown OID: a new SMS fixes all three.
    if (data?.sonuc === '0') {
      const gibMessage = data.msg?.trim() || undefined;
      throw new GibError('sms-code-wrong', gibMessage ?? 'SMS şifresi hatalı', { gibMessage });
    }

    return result;
  }

  async function startSMSSign(session: SessionInfo): Promise<{ oid: string; phone: string }> {
    const phone = await getSigningPhone(session);
    if (!phone) {
      throw new GibError('sms-failed', 'SMS onay için kayıtlı telefon numarası bulunamadı');
    }
    const oid = await requestSigningSMS(session, phone);
    if (!oid) {
      throw new GibError('sms-failed', 'SMS gönderimi başarısız');
    }
    return { phone, oid };
  }

  async function cancelInvoice(
    session: SessionInfo,
    reason: string,
    invoice: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const result = await dispatch(session, 'EARSIV_PORTAL_FATURA_SIL', 'RG_BASITTASLAKLAR', {
      silinecekler: [invoice],
      aciklama: reason,
    });
    return result;
  }

  return {
    login,
    logout,
    forceLogout,
    getUUID,
    createDraftInvoice,
    getInvoiceDetail,
    getInvoiceHTML,
    downloadInvoice,
    getDrafts,
    signInvoiceHSM,
    getSigningPhone,
    getUserInfo,
    getTaxpayer,
    requestSigningSMS,
    verifyAndSign,
    startSMSSign,
    cancelInvoice,
  };
}
