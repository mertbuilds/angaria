const PROD_URL = "https://earsivportal.efatura.gov.tr";
const TEST_URL = "https://earsivportaltest.efatura.gov.tr";

export interface SessionInfo {
  token: string;
  cookies: string[];
  baseUrl: string;
}

export interface InvoiceItem {
  name: string;
  quantity: number;
  unitType?: string;
  unitPrice: number;
  price: number;
  VATRate: number;
  VATAmount: number;
  discountRate?: number;
  discountAmount?: number;
  discountReason?: string;
  gtip?: string;
}

export interface InvoiceDetails {
  date: string; // DD/MM/YYYY
  time: string; // HH:MM:SS
  currency?: string;
  currencyRate?: string;
  invoiceType?: string;
  taxIDOrTRID: string;
  title: string;
  name?: string;
  surname?: string;
  fullAddress: string;
  country?: string;
  city?: string;
  district?: string;
  taxOffice?: string;
  items: InvoiceItem[];
  grandTotal: number;
  totalVAT: number;
  grandTotalInclVAT: number;
  paymentTotal: number;
  note?: string;
  totalDiscount?: number;
  irsaliyeNumarasi?: string;
  irsaliyeTarihi?: string;
}

type FetchFn = typeof globalThis.fetch;

function extractCookies(response: Response): string[] {
  const cookies: string[] = [];
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === "set-cookie") {
      const cookie = value.split(";")[0];
      if (cookie) cookies.push(cookie);
    }
  });
  return cookies;
}

function mergeCookies(existing: string[], incoming: string[]): string[] {
  const map = new Map<string, string>();
  for (const c of [...existing, ...incoming]) {
    const name = c.split("=")[0];
    if (name) map.set(name, c);
  }
  return [...map.values()];
}

export interface EarsivClient {
  login(username: string, password: string, testMode: boolean): Promise<SessionInfo>;
  logout(session: SessionInfo): Promise<void>;
  forceLogout(username: string, password: string, testMode: boolean): Promise<void>;
  getUUID(session: SessionInfo): Promise<string>;
  createDraftInvoice(
    session: SessionInfo,
    details: InvoiceDetails,
  ): Promise<{ uuid: string; date: string; response: Record<string, unknown> }>;
  getInvoiceDetail(session: SessionInfo, ettn: string): Promise<Record<string, unknown>>;
  getInvoiceHTML(session: SessionInfo, uuid: string, onayDurumu: string): Promise<string>;
  getDrafts(session: SessionInfo, startDate: string, endDate: string): Promise<unknown[]>;
  signInvoiceHSM(
    session: SessionInfo,
    invoice: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
  getSigningPhone(session: SessionInfo): Promise<string>;
  requestSigningSMS(session: SessionInfo, phone: string): Promise<string>;
  verifyAndSign(
    session: SessionInfo,
    smsCode: string,
    oid: string,
    invoiceIds: string[],
  ): Promise<Record<string, unknown>>;
  startSMSSign(session: SessionInfo): Promise<{ phone: string; oid: string }>;
  cancelInvoice(
    session: SessionInfo,
    reason: string,
    invoice: Record<string, unknown>,
  ): Promise<Record<string, unknown>>;
}

export function createClient(options?: { fetch?: FetchFn }): EarsivClient {
  const fetchFn: FetchFn = options?.fetch ?? globalThis.fetch;

  async function dispatch(
    session: SessionInfo,
    cmd: string,
    pageName: string,
    data: Record<string, unknown> = {},
  ): Promise<Record<string, unknown>> {
    const callid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const body = `cmd=${cmd}&callid=${callid}&pageName=${pageName}&token=${session.token}&jp=${encodeURIComponent(JSON.stringify(data))}`;

    const response = await fetchFn(`${session.baseUrl}/earsiv-services/dispatch`, {
      method: "POST",
      headers: {
        accept: "application/json, text/javascript, */*; q=0.01",
        "cache-control": "no-cache",
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        pragma: "no-cache",
        cookie: session.cookies.join("; "),
        Referer: `${session.baseUrl}/index.jsp`,
      },
      body,
    });

    session.cookies = mergeCookies(session.cookies, extractCookies(response));
    const result = (await response.json()) as Record<string, unknown>;

    if (result.error === "1" || result.error === 1) {
      const messages = result.messages as Array<{ text: string }> | undefined;
      const msg = messages?.[0]?.text ?? "GİB portaldan bilinmeyen hata";
      throw new Error(msg);
    }

    return result;
  }

  async function login(
    username: string,
    password: string,
    testMode: boolean,
  ): Promise<SessionInfo> {
    const baseUrl = testMode ? TEST_URL : PROD_URL;
    const cmd = testMode ? "login" : "anologin";

    const response = await fetchFn(`${baseUrl}/earsiv-services/assos-login`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        Referer: `${baseUrl}/intragiris.html`,
      },
      body: `assoscmd=${cmd}&rtype=json&userid=${encodeURIComponent(username)}&sifre=${encodeURIComponent(password)}&sifre2=${encodeURIComponent(password)}&parola=1&`,
    });

    const cookies = extractCookies(response);
    const json = (await response.json()) as Record<string, unknown>;

    if (!json.token) {
      const messages = json.messages as Array<{ text: string }> | undefined;
      const msg = messages?.[0]?.text ?? "Giriş başarısız";
      throw new Error(msg);
    }

    return { token: json.token as string, cookies, baseUrl };
  }

  async function logout(session: SessionInfo): Promise<void> {
    const cmd = session.baseUrl === TEST_URL ? "logout" : "anologin";
    await fetchFn(`${session.baseUrl}/earsiv-services/assos-login`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        cookie: session.cookies.join("; "),
        Referer: `${session.baseUrl}/intragiris.html`,
      },
      body: `assoscmd=${cmd}&rtype=json&token=${session.token}&`,
    });
  }

  async function forceLogout(username: string, password: string, testMode: boolean): Promise<void> {
    const baseUrl = testMode ? TEST_URL : PROD_URL;
    const cmd = testMode ? "login" : "anologin";

    const response = await fetchFn(`${baseUrl}/earsiv-services/assos-login`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        Referer: `${baseUrl}/intragiris.html`,
      },
      body: `assoscmd=${cmd}&rtype=json&userid=${encodeURIComponent(username)}&sifre=${encodeURIComponent(password)}&sifre2=${encodeURIComponent(password)}&parola=1&`,
    });

    const cookies = extractCookies(response);
    const json = (await response.json()) as Record<string, unknown>;
    const token = (json.token as string) ?? "";

    const logoutCmd = testMode ? "logout" : "anologin";
    await fetchFn(`${baseUrl}/earsiv-services/assos-login`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
        cookie: cookies.join("; "),
        Referer: `${baseUrl}/intragiris.html`,
      },
      body: `assoscmd=${logoutCmd}&rtype=json&token=${token}&`,
    });
  }

  async function getUUID(session: SessionInfo): Promise<string> {
    const result = await dispatch(session, "EARSIV_PORTAL_UUID_GETIR", "RG_BASITFATURA");
    return result.data as string;
  }

  async function createDraftInvoice(
    session: SessionInfo,
    details: InvoiceDetails,
  ): Promise<{ uuid: string; date: string; response: Record<string, unknown> }> {
    const invoiceData: Record<string, unknown> = {
      // Must be empty: GİB now assigns the ETTN server-side and rejects
      // client-generated UUIDs with "Ettn ya eksik ya boş..." errors.
      faturaUuid: "",
      belgeNumarasi: "",
      faturaTarihi: details.date,
      saat: details.time,
      paraBirimi: details.currency ?? "TRY",
      dovzTLkur: details.currencyRate ?? "0",
      faturaTipi: details.invoiceType ?? "ISTISNA",
      hangiTip: "5000/30000",
      vknTckn: details.taxIDOrTRID,
      aliciUnvan: details.title,
      aliciAdi: details.name ?? "",
      aliciSoyadi: details.surname ?? "",
      binaAdi: "",
      binaNo: "",
      kapiNo: "",
      kasabaKoy: "",
      vergiDairesi: details.taxOffice ?? "",
      ulke: details.country ?? "",
      bulvarcaddesokak: details.fullAddress,
      irsaliyeNumarasi: details.irsaliyeNumarasi ?? "",
      irsaliyeTarihi: details.irsaliyeTarihi ?? "",
      mahalleSemtIlce: details.district ?? "",
      sehir: details.city ?? " ",
      postaKodu: "",
      tel: "",
      fax: "",
      eposta: "",
      websitesi: "",
      iadeTable: [],
      ihracKayitliKarsiBelgeNo: "",
      yatirimTesvikNumarasi: "",
      yatirimTesvikTarihi: details.date,
      vergiCesidi: " ",
      malHizmetTable: details.items.map((item) => ({
        malHizmet: item.name,
        miktar: item.quantity,
        birim: item.unitType ?? "C62",
        birimFiyat: item.unitPrice.toFixed(2),
        fiyat: item.price.toFixed(2),
        iskontoOrani: item.discountRate ?? 0,
        iskontoTutari: (item.discountAmount ?? 0).toFixed(2),
        iskontoNedeni: item.discountReason ?? "",
        malHizmetTutari: (item.quantity * item.unitPrice).toFixed(2),
        kdvOrani: item.VATRate.toFixed(0),
        vergiOrani: 0,
        kdvTutari: item.VATAmount.toFixed(2),
        vergininKdvTutari: "0",
        ozelMatrahTutari: "0",
        hesaplananotvtevkifatakatkisi: "0",
        gtip: item.gtip ?? "",
      })),
      tip: "İskonto",
      matrah: details.grandTotal.toFixed(2),
      malhizmetToplamTutari: details.grandTotal.toFixed(2),
      toplamIskonto: (details.totalDiscount ?? 0).toFixed(2),
      hesaplanankdv: details.totalVAT.toFixed(2),
      vergilerToplami: details.totalVAT.toFixed(2),
      vergilerDahilToplamTutar: details.grandTotalInclVAT.toFixed(2),
      odenecekTutar: details.paymentTotal.toFixed(2),
      not: details.note ?? "",
      siparisNumarasi: "",
      siparisTarihi: "",
      fisNo: "",
      fisTarihi: "",
      fisSaati: " ",
      fisTipi: " ",
      zRaporNo: "",
      okcSeriNo: "",
    };

    const result = await dispatch(
      session,
      "EARSIV_PORTAL_FATURA_OLUSTUR",
      "RG_BASITFATURA",
      invoiceData,
    );

    // GİB may report failure with HTTP 200 and no error flag; only the
    // known success message in `data` confirms the draft was created.
    const data = result.data;
    if (typeof data !== "string" || !data.includes("başarıyla oluşturul")) {
      throw new Error(typeof data === "string" && data ? data : "Fatura oluşturulamadı");
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
      const dashDate = details.date.replaceAll("/", "-");
      let rows = drafts.filter(
        (d) =>
          (d.belgeTarihi === details.date || d.belgeTarihi === dashDate) &&
          d.onayDurumu === "Onaylanmadı",
      );

      const str = (v: unknown) => (typeof v === "string" ? v : "");
      const norm = (s: string) => s.trim().toLocaleUpperCase("tr");
      const candidates = [details.title, `${details.name ?? ""} ${details.surname ?? ""}`]
        .map(norm)
        .filter(Boolean);
      const recipientRows = rows.filter((d) => candidates.includes(norm(str(d.aliciUnvanAdSoyad))));
      if (recipientRows.length > 0) rows = recipientRows;

      const newest = rows.reduce<Record<string, unknown> | undefined>(
        (best, d) => (!best || str(d.belgeNumarasi) > str(best.belgeNumarasi) ? d : best),
        undefined,
      );
      return typeof newest?.ettn === "string" ? newest.ettn : "";
    } catch {
      return "";
    }
  }

  async function getInvoiceDetail(
    session: SessionInfo,
    ettn: string,
  ): Promise<Record<string, unknown>> {
    const result = await dispatch(session, "EARSIV_PORTAL_FATURA_GETIR", "RG_BASITFATURA", {
      ettn,
    });
    return result.data as Record<string, unknown>;
  }

  async function getInvoiceHTML(
    session: SessionInfo,
    uuid: string,
    onayDurumu: string,
  ): Promise<string> {
    const result = await dispatch(session, "EARSIV_PORTAL_FATURA_GOSTER", "RG_BASITTASLAKLAR", {
      ettn: uuid,
      onayDurumu,
    });
    return result.data as string;
  }

  async function getDrafts(
    session: SessionInfo,
    startDate: string,
    endDate: string,
  ): Promise<unknown[]> {
    const result = await dispatch(session, "EARSIV_PORTAL_TASLAKLARI_GETIR", "RG_BASITTASLAKLAR", {
      baslangic: startDate,
      bitis: endDate,
      hangiTip: "5000/30000",
      table: [],
    });
    return (result.data as unknown[]) ?? [];
  }

  async function signInvoiceHSM(
    session: SessionInfo,
    invoice: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    return dispatch(session, "EARSIV_PORTAL_FATURA_HSM_CIHAZI_ILE_IMZALA", "RG_BASITTASLAKLAR", {
      imzalanacaklar: [invoice],
    });
  }

  async function getSigningPhone(session: SessionInfo): Promise<string> {
    const result = await dispatch(
      session,
      "EARSIV_PORTAL_TELEFONNO_SORGULA",
      "RG_BASITTASLAKLAR",
      {},
    );
    const data = result.data as Record<string, string> | undefined;
    return data?.telefon ?? "";
  }

  async function requestSigningSMS(session: SessionInfo, phone: string): Promise<string> {
    const result = await dispatch(session, "EARSIV_PORTAL_SMSSIFRE_GONDER", "RG_SMSONAY", {
      CEPTEL: phone,
      KCEPTEL: false,
      TIP: "",
    });
    const data = result.data as Record<string, string> | undefined;
    return data?.oid ?? "";
  }

  async function verifyAndSign(
    session: SessionInfo,
    smsCode: string,
    oid: string,
    invoiceIds: string[],
  ): Promise<Record<string, unknown>> {
    const result = await dispatch(session, "0lhozfib5410mp", "RG_SMSONAY", {
      SIFRE: smsCode,
      OID: oid,
      OPR: 1,
      DATA: invoiceIds.map((ettn) => ({ belgeTuru: "FATURA", ettn })),
    });

    const data = result.data as Record<string, string> | undefined;
    if (data?.sonuc === "0") {
      throw new Error(data.msg || "SMS kodu hatalı");
    }

    return result;
  }

  async function startSMSSign(session: SessionInfo): Promise<{ phone: string; oid: string }> {
    const phone = await getSigningPhone(session);
    if (!phone) throw new Error("SMS onay için kayıtlı telefon numarası bulunamadı");
    const oid = await requestSigningSMS(session, phone);
    if (!oid) throw new Error("SMS gönderimi başarısız");
    return { phone, oid };
  }

  async function cancelInvoice(
    session: SessionInfo,
    reason: string,
    invoice: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const result = await dispatch(session, "EARSIV_PORTAL_FATURA_SIL", "RG_BASITTASLAKLAR", {
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
