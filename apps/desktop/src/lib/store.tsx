import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import type {
  AdvancedInvoiceFields,
  CompanyInfo,
  Credentials,
  InvoiceItem,
  InvoiceSettings,
  InvoiceTemplate,
  Recipient,
} from "./types.ts";

const newId = () => crypto.randomUUID();

const SEED_RECIPIENTS: Recipient[] = [
  {
    id: newId(),
    taxIDOrTRID: "2222222222",
    taxOffice: "",
    title: "PLASTIC SOFTWARE LLC",
    name: "",
    surname: "",
    fullAddress: "500 Westover Dr #10034\nSanford, NC 27330",
    country: "Amerika Birleşik Dev",
    city: "",
    district: "",
  },
  {
    id: newId(),
    taxIDOrTRID: "1234567890",
    taxOffice: "Kadıköy",
    title: "ÖRNEK TEKNOLOJİ A.Ş.",
    name: "Ahmet",
    surname: "Yılmaz",
    fullAddress: "Bağdat Cad. No:123 Kadıköy",
    country: "Türkiye",
    city: "İstanbul",
    district: "Kadıköy",
  },
  {
    id: newId(),
    taxIDOrTRID: "9876543210",
    taxOffice: "",
    title: "ACME GMBH",
    name: "Hans",
    surname: "Müller",
    fullAddress: "Hauptstraße 42, 10115 Berlin",
    country: "Almanya",
    city: "Berlin",
    district: "",
  },
];

const DEFAULT_ITEM_ADVANCED = {
  unitType: "C62",
  discountRate: 0,
  discountAmount: 0,
  discountReason: "",
  gtip: "",
};

const SEED_ITEMS: InvoiceItem[] = [
  {
    id: newId(),
    name: "Engineering Services - Mühendislik Hizmetleri",
    quantity: 1,
    unitPrice: 100,
    VATRate: 0,
    ...DEFAULT_ITEM_ADVANCED,
  },
  {
    id: newId(),
    name: "Yazılım Geliştirme Hizmeti",
    quantity: 1,
    unitPrice: 5000,
    VATRate: 20,
    ...DEFAULT_ITEM_ADVANCED,
  },
  {
    id: newId(),
    name: "Danışmanlık Hizmeti",
    quantity: 1,
    unitPrice: 2500,
    VATRate: 20,
    ...DEFAULT_ITEM_ADVANCED,
  },
];

function loadLocal<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}

function currentTime() {
  const now = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
}

const BLANK_RECIPIENT: Recipient = {
  id: "",
  taxIDOrTRID: "",
  taxOffice: "",
  title: "",
  name: "",
  surname: "",
  fullAddress: "",
  country: "",
  city: "",
  district: "",
};

const DEFAULT_SETTINGS: InvoiceSettings = {
  currency: "TRY",
  currencyRate: "",
  invoiceType: "SATIS",
};

export const DEFAULT_ADVANCED_FIELDS: AdvancedInvoiceFields = {
  manualDate: "",
  manualTime: currentTime(),
  irsaliyeNumarasi: "",
  irsaliyeTarihi: "",
  paymentTotal: "",
};

/** Safely convert unknown GIB field to string */
function str(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  return typeof v === "string" ? v : fallback;
}

function makeBlankItem(): InvoiceItem {
  return {
    id: newId(),
    name: "",
    quantity: 1,
    unitPrice: 0,
    VATRate: 20,
    ...DEFAULT_ITEM_ADVANCED,
  };
}

interface Store {
  creds: Credentials;
  setCreds: React.Dispatch<React.SetStateAction<Credentials>>;
  companyInfo: CompanyInfo;
  setCompanyInfo: React.Dispatch<React.SetStateAction<CompanyInfo>>;
  recipient: Recipient;
  setRecipient: React.Dispatch<React.SetStateAction<Recipient>>;
  invoiceSettings: InvoiceSettings;
  setInvoiceSettings: React.Dispatch<React.SetStateAction<InvoiceSettings>>;
  items: InvoiceItem[];
  setItems: React.Dispatch<React.SetStateAction<InvoiceItem[]>>;
  note: string;
  setNote: React.Dispatch<React.SetStateAction<string>>;
  savedRecipients: Recipient[];
  setSavedRecipients: React.Dispatch<React.SetStateAction<Recipient[]>>;
  savedItems: InvoiceItem[];
  setSavedItems: React.Dispatch<React.SetStateAction<InvoiceItem[]>>;
  invoiceTemplates: InvoiceTemplate[];
  setInvoiceTemplates: React.Dispatch<React.SetStateAction<InvoiceTemplate[]>>;
  advancedFields: AdvancedInvoiceFields;
  setAdvancedFields: React.Dispatch<React.SetStateAction<AdvancedInvoiceFields>>;
  invoiceDateRange: { start: string; end: string };
  setInvoiceDateRange: React.Dispatch<React.SetStateAction<{ start: string; end: string }>>;
  invoicePageSize: number;
  setInvoicePageSize: React.Dispatch<React.SetStateAction<number>>;
  /** true when the invoice form has been initialized (via template or scratch) */
  invoiceStarted: boolean;
  /** Reset invoice form to blank state */
  resetInvoiceForm: () => void;
  /** Load a template into the invoice form and mark it as started */
  loadTemplate: (id: string) => string | null;
  /** Start a blank invoice form */
  startBlankInvoice: () => void;
  /** ID of the template the invoice was started from, null if from scratch */
  sourceTemplateId: string | null;
  /** true when in template editing mode (save as template instead of creating invoice) */
  templateEditMode: boolean;
  /** Load a GIB invoice into the form in template editing mode */
  loadFromGIBInvoice: (data: Record<string, unknown>) => void;
  newId: () => string;
  defaultItemAdvanced: typeof DEFAULT_ITEM_ADVANCED;
}

const StoreContext = createContext<Store | null>(null);

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [creds, setCreds] = useState<Credentials>(() =>
    loadLocal("fatura-creds", { username: "", password: "", testMode: true }),
  );

  const [companyInfo, setCompanyInfo] = useState<CompanyInfo>(() =>
    loadLocal("fatura-company-info", {
      name: "",
      address: "",
      taxID: "",
      taxOffice: "",
      phone: "",
      email: "",
      bankName: "",
      accountHolder: "",
      iban: "",
      swiftCode: "",
      bankAddress: "",
    }),
  );

  const [savedRecipients, setSavedRecipients] = useState<Recipient[]>(() =>
    loadLocal("fatura-saved-recipients", SEED_RECIPIENTS),
  );
  const [savedItems, setSavedItems] = useState<InvoiceItem[]>(() =>
    loadLocal("fatura-saved-items", SEED_ITEMS),
  );

  // Invoice form state — not persisted, starts blank
  const [recipient, setRecipient] = useState<Recipient>({ ...BLANK_RECIPIENT, id: newId() });
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>({ ...DEFAULT_SETTINGS });
  const [items, setItems] = useState<InvoiceItem[]>(() => [makeBlankItem()]);
  const [note, setNote] = useState("");
  const [advancedFields, setAdvancedFields] = useState<AdvancedInvoiceFields>({
    ...DEFAULT_ADVANCED_FIELDS,
  });
  const [invoiceStarted, setInvoiceStarted] = useState(false);
  const [sourceTemplateId, setSourceTemplateId] = useState<string | null>(null);
  const [templateEditMode, setTemplateEditMode] = useState(false);

  const [invoiceTemplates, setInvoiceTemplates] = useState<InvoiceTemplate[]>(() =>
    loadLocal("fatura-templates", []),
  );

  const [invoicePageSize, setInvoicePageSize] = useState(10);

  const [invoiceDateRange, setInvoiceDateRange] = useState(() => {
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const today = `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()}`;
    return { start: today, end: today };
  });

  const resetInvoiceForm = useCallback(() => {
    setRecipient({ ...BLANK_RECIPIENT, id: newId() });
    setInvoiceSettings({ ...DEFAULT_SETTINGS });
    setItems([makeBlankItem()]);
    setNote("");
    setAdvancedFields({ ...DEFAULT_ADVANCED_FIELDS, manualTime: currentTime() });
    setInvoiceStarted(false);
    setSourceTemplateId(null);
    setTemplateEditMode(false);
  }, []);

  const loadTemplate = useCallback(
    (id: string): string | null => {
      const t = invoiceTemplates.find((x) => x.id === id);
      if (!t) return null;
      setRecipient({ ...t.recipient, id: newId() });
      setInvoiceSettings({ ...t.settings });
      setItems(t.items.map((i) => ({ ...i, id: newId() })));
      setNote(t.note);
      setAdvancedFields({ ...DEFAULT_ADVANCED_FIELDS, manualTime: currentTime() });
      setInvoiceStarted(true);
      setSourceTemplateId(id);
      // Update lastUsedAt
      setInvoiceTemplates((prev) =>
        prev.map((x) => (x.id === id ? { ...x, lastUsedAt: Date.now() } : x)),
      );
      return t.name;
    },
    [invoiceTemplates],
  );

  const startBlankInvoice = useCallback(() => {
    resetInvoiceForm();
    setInvoiceStarted(true);
  }, [resetInvoiceForm]);

  const loadFromGIBInvoice = useCallback((data: Record<string, unknown>) => {
    const table = (data.malHizmetTable as Record<string, unknown>[]) ?? [];
    setRecipient({
      id: newId(),
      taxIDOrTRID: str(data.vknTckn),
      taxOffice: str(data.vergiDairesi),
      title: str(data.aliciUnvan),
      name: str(data.aliciAdi),
      surname: str(data.aliciSoyadi),
      fullAddress: str(data.bulvarcaddesokak),
      country: str(data.ulke),
      city: str(data.sehir).trim(),
      district: str(data.mahalleSemtIlce),
    });
    const rate = str(data.dovzTLkur);
    setInvoiceSettings({
      currency: str(data.paraBirimi, "TRY"),
      currencyRate: rate === "0" ? "" : rate,
      invoiceType: str(data.faturaTipi, "SATIS"),
    });
    setItems(
      table.length > 0
        ? table.map((row) => ({
            id: newId(),
            name: str(row.malHizmet),
            quantity: Number(row.miktar) || 1,
            unitPrice: Number(row.birimFiyat) || 0,
            VATRate: Number(row.kdvOrani) || 0,
            unitType: str(row.birim, "C62"),
            discountRate: Number(row.iskontoOrani) || 0,
            discountAmount: Number(row.iskontoTutari) || 0,
            discountReason: str(row.iskontoNedeni),
            gtip: str(row.gtip),
          }))
        : [makeBlankItem()],
    );
    setNote(str(data.not));
    setAdvancedFields({ ...DEFAULT_ADVANCED_FIELDS, manualTime: currentTime() });
    setInvoiceStarted(true);
    setTemplateEditMode(false);
  }, []);

  // Persist only data that should survive restarts
  useEffect(() => localStorage.setItem("fatura-creds", JSON.stringify(creds)), [creds]);
  useEffect(
    () => localStorage.setItem("fatura-company-info", JSON.stringify(companyInfo)),
    [companyInfo],
  );
  useEffect(
    () => localStorage.setItem("fatura-saved-recipients", JSON.stringify(savedRecipients)),
    [savedRecipients],
  );
  useEffect(
    () => localStorage.setItem("fatura-saved-items", JSON.stringify(savedItems)),
    [savedItems],
  );
  useEffect(
    () => localStorage.setItem("fatura-templates", JSON.stringify(invoiceTemplates)),
    [invoiceTemplates],
  );
  return (
    <StoreContext.Provider
      value={{
        creds,
        setCreds,
        companyInfo,
        setCompanyInfo,
        recipient,
        setRecipient,
        invoiceSettings,
        setInvoiceSettings,
        items,
        setItems,
        note,
        setNote,
        savedRecipients,
        setSavedRecipients,
        savedItems,
        setSavedItems,
        invoiceTemplates,
        setInvoiceTemplates,
        advancedFields,
        setAdvancedFields,
        invoiceDateRange,
        setInvoiceDateRange,
        invoicePageSize,
        setInvoicePageSize,
        invoiceStarted,
        resetInvoiceForm,
        loadTemplate,
        startBlankInvoice,
        sourceTemplateId,
        templateEditMode,
        loadFromGIBInvoice,
        newId,
        defaultItemAdvanced: DEFAULT_ITEM_ADVANCED,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
