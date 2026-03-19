import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type {
  AdvancedInvoiceFields,
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

export const DEFAULT_ADVANCED_FIELDS: AdvancedInvoiceFields = {
  manualDate: "",
  manualTime: "",
  irsaliyeNumarasi: "",
  irsaliyeTarihi: "",
  paymentTotal: "",
};

interface Store {
  creds: Credentials;
  setCreds: React.Dispatch<React.SetStateAction<Credentials>>;
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
  viewMode: "simple" | "advanced";
  setViewMode: React.Dispatch<React.SetStateAction<"simple" | "advanced">>;
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

  const [savedRecipients, setSavedRecipients] = useState<Recipient[]>(() =>
    loadLocal("fatura-saved-recipients", SEED_RECIPIENTS),
  );
  const [savedItems, setSavedItems] = useState<InvoiceItem[]>(() =>
    loadLocal("fatura-saved-items", SEED_ITEMS),
  );

  const [recipient, setRecipient] = useState<Recipient>(() =>
    loadLocal("fatura-v2-recipient", {
      id: newId(),
      taxIDOrTRID: "",
      taxOffice: "",
      title: "",
      name: "",
      surname: "",
      fullAddress: "",
      country: "",
      city: "",
      district: "",
    }),
  );

  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>(() =>
    loadLocal("fatura-v2-settings", {
      currency: "TRY",
      currencyRate: "",
      invoiceType: "SATIS",
    }),
  );

  const [items, setItems] = useState<InvoiceItem[]>(() =>
    loadLocal("fatura-v2-items", [
      { id: newId(), name: "", quantity: 1, unitPrice: 0, VATRate: 20, ...DEFAULT_ITEM_ADVANCED },
    ]),
  );

  const [note, setNote] = useState(() => loadLocal("fatura-v2-note", ""));

  const [invoiceTemplates, setInvoiceTemplates] = useState<InvoiceTemplate[]>(() =>
    loadLocal("fatura-templates", []),
  );

  const [advancedFields, setAdvancedFields] = useState<AdvancedInvoiceFields>(() =>
    loadLocal("fatura-advanced-fields", DEFAULT_ADVANCED_FIELDS),
  );

  const [viewMode, setViewMode] = useState<"simple" | "advanced">(() =>
    loadLocal("fatura-view-mode", "simple"),
  );

  // Persist to localStorage
  useEffect(() => localStorage.setItem("fatura-creds", JSON.stringify(creds)), [creds]);
  useEffect(
    () => localStorage.setItem("fatura-saved-recipients", JSON.stringify(savedRecipients)),
    [savedRecipients],
  );
  useEffect(
    () => localStorage.setItem("fatura-saved-items", JSON.stringify(savedItems)),
    [savedItems],
  );
  useEffect(
    () => localStorage.setItem("fatura-v2-settings", JSON.stringify(invoiceSettings)),
    [invoiceSettings],
  );
  useEffect(
    () => localStorage.setItem("fatura-v2-recipient", JSON.stringify(recipient)),
    [recipient],
  );
  useEffect(() => localStorage.setItem("fatura-v2-items", JSON.stringify(items)), [items]);
  useEffect(() => localStorage.setItem("fatura-v2-note", JSON.stringify(note)), [note]);
  useEffect(
    () => localStorage.setItem("fatura-templates", JSON.stringify(invoiceTemplates)),
    [invoiceTemplates],
  );
  useEffect(
    () => localStorage.setItem("fatura-advanced-fields", JSON.stringify(advancedFields)),
    [advancedFields],
  );
  useEffect(() => localStorage.setItem("fatura-view-mode", JSON.stringify(viewMode)), [viewMode]);

  return (
    <StoreContext.Provider
      value={{
        creds,
        setCreds,
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
        viewMode,
        setViewMode,
        newId,
        defaultItemAdvanced: DEFAULT_ITEM_ADVANCED,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
