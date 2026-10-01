const PROD_URL = 'https://earsivportal.efatura.gov.tr';
const TEST_URL = 'https://earsivportaltest.efatura.gov.tr';

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
  forceLogout(username: string, password: string, testMode: boolean): Promise<void>;
  getDrafts(session: SessionInfo, startDate: string, endDate: string): Promise<Array<unknown>>;
  getInvoiceDetail(session: SessionInfo, ettn: string): Promise<Record<string, unknown>>;
  getInvoiceHTML(session: SessionInfo, uuid: string, onayDurumu: string): Promise<string>;
  getSigningPhone(session: SessionInfo): Promise<string>;
  getUUID(session: SessionInfo): Promise<string>;
  login(username: string, password: string, testMode: boolean): Promise<SessionInfo>;
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

const str = (v: unknown) => (typeof v === 'string' ? v : '');
const norm = (s: string) => s.trim().toLocaleUpperCase('tr');

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

export interface ClientOptions {
  /**
   * Portal origin for both modes, e.g. the local GİB emulator
   * (packages/gib-emulator). Default: the real production and test portals.
   */
  baseUrl?: string;
  fetch?: FetchFn;
}

export function createClient(options?: ClientOptions): EarsivClient {
  const fetchFn: FetchFn = options?.fetch ?? globalThis.fetch;
  const portalUrl = (testMode: boolean) => options?.baseUrl ?? (testMode ? TEST_URL : PROD_URL);

  async function dispatch(
    session: SessionInfo,
    cmd: string,
    pageName: string,
    data: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    const callid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const body = `cmd=${cmd}&callid=${callid}&pageName=${pageName}&token=${session.token}&jp=${encodeURIComponent(JSON.stringify(data))}`;

    const response = await fetchFn(`${session.baseUrl}/earsiv-services/dispatch`, {
      method: 'POST',
      headers: {
        accept: 'application/json, text/javascript, */*; q=0.01',
        'cache-control': 'no-cache',
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        pragma: 'no-cache',
        cookie: session.cookies.join('; '),
        Referer: `${session.baseUrl}/index.jsp`,
      },
      body,
    });

    session.cookies = mergeCookies(session.cookies, extractCookies(response));
    const result = (await response.json()) as Record<string, unknown>;

    if (result.error === '1' || result.error === 1) {
      const messages = result.messages as Array<{ text: string }> | undefined;
      const msg = messages?.[0]?.text ?? 'GİB portaldan bilinmeyen hata';
      throw new Error(msg);
    }

    return result;
  }

  async function login(
    username: string,
    password: string,
    testMode: boolean,
  ): Promise<SessionInfo> {
    const baseUrl = portalUrl(testMode);
    const cmd = testMode ? 'login' : 'anologin';

    const response = await fetchFn(`${baseUrl}/earsiv-services/assos-login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        Referer: `${baseUrl}/intragiris.html`,
      },
      body: `assoscmd=${cmd}&rtype=json&userid=${encodeURIComponent(username)}&sifre=${encodeURIComponent(password)}&sifre2=${encodeURIComponent(password)}&parola=1&`,
    });

    const cookies = extractCookies(response);
    const json = (await response.json()) as Record<string, unknown>;

    if (!json.token) {
      const messages = json.messages as Array<{ text: string }> | undefined;
      const msg = messages?.[0]?.text ?? 'Giriş başarısız';
      throw new Error(msg);
    }

    return { token: json.token as string, cookies, baseUrl };
  }

  async function logout(session: SessionInfo): Promise<void> {
    const cmd = session.baseUrl === TEST_URL ? 'logout' : 'anologin';
    await fetchFn(`${session.baseUrl}/earsiv-services/assos-login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        cookie: session.cookies.join('; '),
        Referer: `${session.baseUrl}/intragiris.html`,
      },
      body: `assoscmd=${cmd}&rtype=json&token=${session.token}&`,
    });
  }

  async function forceLogout(username: string, password: string, testMode: boolean): Promise<void> {
    const baseUrl = portalUrl(testMode);
    const cmd = testMode ? 'login' : 'anologin';

    const response = await fetchFn(`${baseUrl}/earsiv-services/assos-login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        Referer: `${baseUrl}/intragiris.html`,
      },
      body: `assoscmd=${cmd}&rtype=json&userid=${encodeURIComponent(username)}&sifre=${encodeURIComponent(password)}&sifre2=${encodeURIComponent(password)}&parola=1&`,
    });

    const cookies = extractCookies(response);
    const json = (await response.json()) as Record<string, unknown>;
    const token = (json.token as string) ?? '';

    const logoutCmd = testMode ? 'logout' : 'anologin';
    await fetchFn(`${baseUrl}/earsiv-services/assos-login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
        cookie: cookies.join('; '),
        Referer: `${baseUrl}/intragiris.html`,
      },
      body: `assoscmd=${logoutCmd}&rtype=json&token=${token}&`,
    });
  }

  async function getUUID(session: SessionInfo): Promise<string> {
    const result = await dispatch(session, 'EARSIV_PORTAL_UUID_GETIR', 'RG_BASITFATURA');
    return result.data as string;
  }

  async function createDraftInvoice(
    session: SessionInfo,
    details: InvoiceDetails,
  ): Promise<{ date: string; response: Record<string, unknown>; uuid: string }> {
    const invoiceData: Record<string, unknown> = {
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
        birimFiyat: item.unitPrice.toFixed(2),
        fiyat: item.price.toFixed(2),
        iskontoOrani: item.discountRate ?? 0,
        iskontoTutari: (item.discountAmount ?? 0).toFixed(2),
        iskontoNedeni: item.discountReason ?? '',
        malHizmetTutari: (item.quantity * item.unitPrice).toFixed(2),
        kdvOrani: item.VATRate.toFixed(0),
        vergiOrani: 0,
        kdvTutari: item.VATAmount.toFixed(2),
        vergininKdvTutari: '0',
        ozelMatrahTutari: '0',
        hesaplananotvtevkifatakatkisi: '0',
        gtip: item.gtip ?? '',
      })),
      tip: 'İskonto',
      matrah: details.grandTotal.toFixed(2),
      malhizmetToplamTutari: details.grandTotal.toFixed(2),
      toplamIskonto: (details.totalDiscount ?? 0).toFixed(2),
      hesaplanankdv: details.totalVAT.toFixed(2),
      vergilerToplami: details.totalVAT.toFixed(2),
      vergilerDahilToplamTutar: details.grandTotalInclVAT.toFixed(2),
      odenecekTutar: details.paymentTotal.toFixed(2),
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
      throw new Error(typeof data === 'string' && data ? data : 'Fatura oluşturulamadı');
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
      const drafts = (await getDrafts(session, details.date, details.date)) as Array<
        Record<string, unknown>
      >;
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
   * Every document dated within the range. Ranges longer than GİB allows are
   * fetched in chunks, one after the other on the same session, and merged
   * oldest first; a row returned twice (same ETTN) is kept once.
   */
  async function getDrafts(
    session: SessionInfo,
    startDate: string,
    endDate: string,
  ): Promise<Array<unknown>> {
    const rows: Array<unknown> = [];
    const seen = new Set<string>();
    for (const range of splitDateRange(startDate, endDate)) {
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
      for (const row of (result.data as Array<unknown>) ?? []) {
        const record = (row ?? {}) as Record<string, unknown>;
        // A refused query comes back as data, not as an error: [{ error: '...' }].
        if (typeof record.error === 'string') {
          throw new Error(record.error);
        }
        const ettn = str(record.ettn);
        if (ettn) {
          if (seen.has(ettn)) {
            continue;
          }
          seen.add(ettn);
        }
        rows.push(row);
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
    );
    const data = result.data as Record<string, string> | undefined;
    return data?.telefon ?? '';
  }

  async function requestSigningSMS(session: SessionInfo, phone: string): Promise<string> {
    const result = await dispatch(session, 'EARSIV_PORTAL_SMSSIFRE_GONDER', 'RG_SMSONAY', {
      CEPTEL: phone,
      KCEPTEL: false,
      TIP: '',
    });
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
    if (data?.sonuc === '0') {
      throw new Error(data.msg || 'SMS kodu hatalı');
    }

    return result;
  }

  async function startSMSSign(session: SessionInfo): Promise<{ oid: string; phone: string }> {
    const phone = await getSigningPhone(session);
    if (!phone) {
      throw new Error('SMS onay için kayıtlı telefon numarası bulunamadı');
    }
    const oid = await requestSigningSMS(session, phone);
    if (!oid) {
      throw new Error('SMS gönderimi başarısız');
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
    getDrafts,
    signInvoiceHSM,
    getSigningPhone,
    requestSigningSMS,
    verifyAndSign,
    startSMSSign,
    cancelInvoice,
  };
}
