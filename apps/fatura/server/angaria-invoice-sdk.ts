const PROD_URL = "https://earsivportal.efatura.gov.tr";
const TEST_URL = "https://earsivportaltest.efatura.gov.tr";

interface SessionInfo {
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
  currency?: string; // TRY, USD, EUR, etc.
  currencyRate?: string; // exchange rate to TRY
  invoiceType?: string; // ISTISNA, SATIS, IADE, TEVKIFAT, etc.
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
}

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

async function dispatch(
  session: SessionInfo,
  cmd: string,
  pageName: string,
  data: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const callid = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const body = `cmd=${cmd}&callid=${callid}&pageName=${pageName}&token=${session.token}&jp=${encodeURIComponent(JSON.stringify(data))}`;

  const response = await fetch(`${session.baseUrl}/earsiv-services/dispatch`, {
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
  return (await response.json()) as Record<string, unknown>;
}

export async function login(
  username: string,
  password: string,
  testMode: boolean,
): Promise<SessionInfo> {
  const baseUrl = testMode ? TEST_URL : PROD_URL;
  const cmd = testMode ? "login" : "anologin";

  const response = await fetch(`${baseUrl}/earsiv-services/assos-login`, {
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

export async function logout(session: SessionInfo): Promise<void> {
  const cmd = session.baseUrl === TEST_URL ? "logout" : "anologin";
  await fetch(`${session.baseUrl}/earsiv-services/assos-login`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded;charset=UTF-8",
      cookie: session.cookies.join("; "),
      Referer: `${session.baseUrl}/intragiris.html`,
    },
    body: `assoscmd=${cmd}&rtype=json&token=${session.token}&`,
  });
}

export async function getUUID(session: SessionInfo): Promise<string> {
  const result = await dispatch(session, "EARSIV_PORTAL_UUID_GETIR", "RG_BASITFATURA");
  return result.data as string;
}

export async function lookupRecipient(
  session: SessionInfo,
  taxId: string,
): Promise<Record<string, unknown>> {
  const result = await dispatch(session, "SICIL_VEYA_MERNISTEN_BILGILERI_GETIR", "RG_BASITFATURA", {
    vknTcknn: taxId,
  });
  return result.data as Record<string, unknown>;
}

export async function createDraftInvoice(
  session: SessionInfo,
  details: InvoiceDetails,
): Promise<{ uuid: string; date: string; response: Record<string, unknown> }> {
  const uuid = await getUUID(session);

  const invoiceData: Record<string, unknown> = {
    faturaUuid: uuid,
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
    irsaliyeNumarasi: "",
    irsaliyeTarihi: "",
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

  // GIB returns errors as Turkish text in the data field (e.g. "Bu mükellef ... fatura kesemez")
  // Success responses either have no data or a confirmation message containing "başarı"
  if (
    typeof result.data === "string" &&
    result.data.length > 0 &&
    !result.data.toLowerCase().includes("başarı") &&
    (result.error === "1" || result.data.includes("kesemez") || result.data.includes("hata"))
  ) {
    throw new Error(result.data);
  }

  return { uuid, date: details.date, response: result };
}

export async function getInvoiceHTML(
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

export async function getDrafts(
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

export async function cancelInvoice(
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
