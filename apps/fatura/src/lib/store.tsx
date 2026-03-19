import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import type {
  Credentials,
  InvoiceItem,
  InvoiceSettings,
  InvoiceTemplate,
  Recipient,
} from "./types.ts";

const newId = () => crypto.randomUUID();

function loadLocal<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}

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
  newId: () => string;
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
    loadLocal("fatura-saved-recipients", []),
  );
  const [savedItems, setSavedItems] = useState<InvoiceItem[]>(() =>
    loadLocal("fatura-saved-items", []),
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
      { id: newId(), name: "", quantity: 1, unitPrice: 0, VATRate: 20 },
    ]),
  );

  const [note, setNote] = useState(() => loadLocal("fatura-v2-note", ""));

  const [invoiceTemplates, setInvoiceTemplates] = useState<InvoiceTemplate[]>(() =>
    loadLocal("fatura-templates", []),
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
        newId,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
