import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type {
  AdvancedInvoiceFields,
  CompanyInfo,
  Credentials,
  Entity,
  InvoiceItem,
  InvoiceSettings,
  InvoiceTemplate,
  Recipient,
} from './types.ts';

const newId = () => crypto.randomUUID();
const ENTITIES_STORAGE_KEY = 'fatura-entities';
const ACTIVE_ENTITY_STORAGE_KEY = 'fatura-active-entity-id';

const SEED_RECIPIENTS: Array<Recipient> = [
  {
    id: newId(),
    taxIDOrTRID: '2222222222',
    taxOffice: '',
    title: 'PLASTIC SOFTWARE LLC',
    name: '',
    surname: '',
    fullAddress: '500 Westover Dr #10034\nSanford, NC 27330',
    country: 'Amerika Birleşik Dev',
    city: '',
    district: '',
  },
  {
    id: newId(),
    taxIDOrTRID: '1234567890',
    taxOffice: 'Kadıköy',
    title: 'ÖRNEK TEKNOLOJİ A.Ş.',
    name: 'Ahmet',
    surname: 'Yılmaz',
    fullAddress: 'Bağdat Cad. No:123 Kadıköy',
    country: 'Türkiye',
    city: 'İstanbul',
    district: 'Kadıköy',
  },
  {
    id: newId(),
    taxIDOrTRID: '9876543210',
    taxOffice: '',
    title: 'ACME GMBH',
    name: 'Hans',
    surname: 'Müller',
    fullAddress: 'Hauptstraße 42, 10115 Berlin',
    country: 'Almanya',
    city: 'Berlin',
    district: '',
  },
];

const DEFAULT_ITEM_ADVANCED = {
  unitType: 'C62',
  discountRate: 0,
  discountAmount: 0,
  discountReason: '',
  gtip: '',
};

const DEFAULT_CREDS: Credentials = { username: '', password: '', testMode: true };

const DEFAULT_COMPANY_INFO: CompanyInfo = {
  name: '',
  address: '',
  taxID: '',
  taxOffice: '',
  phone: '',
  email: '',
  bankName: '',
  accountHolder: '',
  iban: '',
  swiftCode: '',
  bankAddress: '',
};

const SEED_ITEMS: Array<InvoiceItem> = [
  {
    id: newId(),
    name: 'Engineering Services - Mühendislik Hizmetleri',
    quantity: 1,
    unitPrice: 100,
    VATRate: 0,
    ...DEFAULT_ITEM_ADVANCED,
  },
  {
    id: newId(),
    name: 'Yazılım Geliştirme Hizmeti',
    quantity: 1,
    unitPrice: 5000,
    VATRate: 20,
    ...DEFAULT_ITEM_ADVANCED,
  },
  {
    id: newId(),
    name: 'Danışmanlık Hizmeti',
    quantity: 1,
    unitPrice: 2500,
    VATRate: 20,
    ...DEFAULT_ITEM_ADVANCED,
  },
];

function loadLocal<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') ?? fallback;
  } catch {
    return fallback;
  }
}

const p = (n: number) => String(n).padStart(2, '0');

function currentTime() {
  const now = new Date();
  return `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
}

const BLANK_RECIPIENT: Recipient = {
  id: '',
  taxIDOrTRID: '',
  taxOffice: '',
  title: '',
  name: '',
  surname: '',
  fullAddress: '',
  country: '',
  city: '',
  district: '',
};

const DEFAULT_SETTINGS: InvoiceSettings = {
  currency: 'TRY',
  currencyRate: '',
  invoiceType: 'SATIS',
};

export const DEFAULT_ADVANCED_FIELDS: AdvancedInvoiceFields = {
  manualDate: '',
  manualTime: currentTime(),
  irsaliyeNumarasi: '',
  irsaliyeTarihi: '',
  paymentTotal: '',
};

/** Safely convert unknown GIB field to string */
function str(v: unknown, fallback = ''): string {
  if (v == null) {
    return fallback;
  }
  return typeof v === 'string' ? v : fallback;
}

function makeBlankItem(): InvoiceItem {
  return {
    id: newId(),
    name: '',
    quantity: 1,
    unitPrice: 0,
    VATRate: 20,
    ...DEFAULT_ITEM_ADVANCED,
  };
}

function makeEntityName(index: number) {
  return index === 0 ? 'Ana Varlık' : `Varlık ${index + 1}`;
}

function makeDefaultEntity(index: number, seedData = true): Entity {
  return {
    id: newId(),
    name: makeEntityName(index),
    creds: { ...DEFAULT_CREDS },
    companyInfo: { ...DEFAULT_COMPANY_INFO },
    savedRecipients: seedData ? SEED_RECIPIENTS : [],
    savedItems: seedData ? SEED_ITEMS : [],
    invoiceTemplates: [],
  };
}

function loadEntities(): Array<Entity> {
  const stored = loadLocal<Array<Entity> | null>(ENTITIES_STORAGE_KEY, null);
  if (Array.isArray(stored) && stored.length > 0) {
    return stored.map((entity, index) => ({
      id: entity.id || newId(),
      name: entity.name || makeEntityName(index),
      creds: entity.creds ?? { ...DEFAULT_CREDS },
      companyInfo: entity.companyInfo ?? { ...DEFAULT_COMPANY_INFO },
      savedRecipients: entity.savedRecipients ?? [],
      savedItems: entity.savedItems ?? [],
      invoiceTemplates: entity.invoiceTemplates ?? [],
    }));
  }

  return [
    {
      ...makeDefaultEntity(0, false),
      creds: loadLocal('fatura-creds', { ...DEFAULT_CREDS }),
      companyInfo: loadLocal('fatura-company-info', { ...DEFAULT_COMPANY_INFO }),
      savedRecipients: loadLocal('fatura-saved-recipients', SEED_RECIPIENTS),
      savedItems: loadLocal('fatura-saved-items', SEED_ITEMS),
      invoiceTemplates: loadLocal('fatura-templates', []),
    },
  ];
}

interface Store {
  activeEntity: Entity;
  activeEntityId: string;
  advancedFields: AdvancedInvoiceFields;
  companyInfo: CompanyInfo;
  createEntity: () => void;
  creds: Credentials;
  defaultItemAdvanced: typeof DEFAULT_ITEM_ADVANCED;
  deleteEntity: (id: string) => void;
  entities: Array<Entity>;
  invoiceDateRange: { end: string; start: string };
  invoicePageSize: number;
  invoiceSettings: InvoiceSettings;
  /** true when the invoice form has been initialized (via template or scratch) */
  invoiceStarted: boolean;
  invoiceTemplates: Array<InvoiceTemplate>;
  items: Array<InvoiceItem>;
  /** Load a GIB invoice into the form in template editing mode */
  loadFromGIBInvoice: (data: Record<string, unknown>) => void;
  /** Load a template into the invoice form and mark it as started */
  loadTemplate: (id: string) => string | null;
  newId: () => string;
  note: string;
  recipient: Recipient;
  renameEntity: (id: string, name: string) => void;
  /** Reset invoice form to blank state */
  resetInvoiceForm: () => void;
  savedItems: Array<InvoiceItem>;
  savedRecipients: Array<Recipient>;
  setActiveEntityId: React.Dispatch<React.SetStateAction<string>>;
  setAdvancedFields: React.Dispatch<React.SetStateAction<AdvancedInvoiceFields>>;
  setCompanyInfo: React.Dispatch<React.SetStateAction<CompanyInfo>>;
  setCreds: React.Dispatch<React.SetStateAction<Credentials>>;
  setInvoiceDateRange: React.Dispatch<React.SetStateAction<{ end: string; start: string }>>;
  setInvoicePageSize: React.Dispatch<React.SetStateAction<number>>;
  setInvoiceSettings: React.Dispatch<React.SetStateAction<InvoiceSettings>>;
  setInvoiceTemplates: React.Dispatch<React.SetStateAction<Array<InvoiceTemplate>>>;
  setItems: React.Dispatch<React.SetStateAction<Array<InvoiceItem>>>;
  setNote: React.Dispatch<React.SetStateAction<string>>;
  setRecipient: React.Dispatch<React.SetStateAction<Recipient>>;
  setSavedItems: React.Dispatch<React.SetStateAction<Array<InvoiceItem>>>;
  setSavedRecipients: React.Dispatch<React.SetStateAction<Array<Recipient>>>;
  /** ID of the template the invoice was started from, null if from scratch */
  sourceTemplateId: string | null;
  /** Start a blank invoice form */
  startBlankInvoice: () => void;
  /** true when in template editing mode (save as template instead of creating invoice) */
  templateEditMode: boolean;
}

const StoreContext = createContext<Store | null>(null);

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return ctx;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [entities, setEntities] = useState<Array<Entity>>(() => loadEntities());
  const [activeEntityId, setActiveEntityId] = useState(
    () => loadLocal<string | null>(ACTIVE_ENTITY_STORAGE_KEY, null) ?? loadEntities()[0]?.id ?? '',
  );

  // Invoice form state — not persisted, starts blank
  const [recipient, setRecipient] = useState<Recipient>({ ...BLANK_RECIPIENT, id: newId() });
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>({ ...DEFAULT_SETTINGS });
  const [items, setItems] = useState<Array<InvoiceItem>>(() => [makeBlankItem()]);
  const [note, setNote] = useState('');
  const [advancedFields, setAdvancedFields] = useState<AdvancedInvoiceFields>({
    ...DEFAULT_ADVANCED_FIELDS,
  });
  const [invoiceStarted, setInvoiceStarted] = useState(false);
  const [sourceTemplateId, setSourceTemplateId] = useState<string | null>(null);
  const [templateEditMode, setTemplateEditMode] = useState(false);

  const [invoicePageSize, setInvoicePageSize] = useState(10);

  const [invoiceDateRange, setInvoiceDateRange] = useState(() => {
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    const today = `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()}`;
    return { start: today, end: today };
  });

  useEffect(() => {
    if (entities.some((entity) => entity.id === activeEntityId)) {
      return;
    }
    setActiveEntityId(entities[0]?.id ?? '');
  }, [activeEntityId, entities]);

  const activeEntity = entities.find((entity) => entity.id === activeEntityId) ?? entities[0];

  const updateActiveEntity = useCallback(
    (updater: (entity: Entity) => Entity) => {
      setEntities((prev) =>
        prev.map((entity) => (entity.id === activeEntity.id ? updater(entity) : entity)),
      );
    },
    [activeEntity.id],
  );

  const createEntity = useCallback(() => {
    const next = makeDefaultEntity(entities.length, false);
    setEntities((prev) => [...prev, next]);
    setActiveEntityId(next.id);
  }, [entities.length]);

  const renameEntity = useCallback((id: string, name: string) => {
    setEntities((prev) =>
      prev.map((entity, index) =>
        entity.id === id ? { ...entity, name: name.trim() || makeEntityName(index) } : entity,
      ),
    );
  }, []);

  const deleteEntity = useCallback(
    (id: string) => {
      setEntities((prev) => {
        if (prev.length <= 1) {
          return prev;
        }
        return prev.filter((entity) => entity.id !== id);
      });
      setActiveEntityId((current) => {
        if (current !== id) {
          return current;
        }
        const remaining = entities.filter((entity) => entity.id !== id);
        return remaining[0]?.id ?? current;
      });
    },
    [entities],
  );

  const setCreds: React.Dispatch<React.SetStateAction<Credentials>> = useCallback(
    (value) => {
      updateActiveEntity((entity) => ({
        ...entity,
        creds: typeof value === 'function' ? value(entity.creds) : value,
      }));
    },
    [updateActiveEntity],
  );

  const setCompanyInfo: React.Dispatch<React.SetStateAction<CompanyInfo>> = useCallback(
    (value) => {
      updateActiveEntity((entity) => ({
        ...entity,
        companyInfo: typeof value === 'function' ? value(entity.companyInfo) : value,
      }));
    },
    [updateActiveEntity],
  );

  const setSavedRecipients: React.Dispatch<React.SetStateAction<Array<Recipient>>> = useCallback(
    (value) => {
      updateActiveEntity((entity) => ({
        ...entity,
        savedRecipients: typeof value === 'function' ? value(entity.savedRecipients) : value,
      }));
    },
    [updateActiveEntity],
  );

  const setSavedItems: React.Dispatch<React.SetStateAction<Array<InvoiceItem>>> = useCallback(
    (value) => {
      updateActiveEntity((entity) => ({
        ...entity,
        savedItems: typeof value === 'function' ? value(entity.savedItems) : value,
      }));
    },
    [updateActiveEntity],
  );

  const setInvoiceTemplates: React.Dispatch<React.SetStateAction<Array<InvoiceTemplate>>> =
    useCallback(
      (value) => {
        updateActiveEntity((entity) => ({
          ...entity,
          invoiceTemplates: typeof value === 'function' ? value(entity.invoiceTemplates) : value,
        }));
      },
      [updateActiveEntity],
    );

  const creds = activeEntity?.creds ?? DEFAULT_CREDS;
  const companyInfo = activeEntity?.companyInfo ?? DEFAULT_COMPANY_INFO;
  const savedRecipients = activeEntity?.savedRecipients ?? [];
  const savedItems = activeEntity?.savedItems ?? [];
  const invoiceTemplates = activeEntity?.invoiceTemplates ?? [];

  const resetInvoiceForm = useCallback(() => {
    setRecipient({ ...BLANK_RECIPIENT, id: newId() });
    setInvoiceSettings({ ...DEFAULT_SETTINGS });
    setItems([makeBlankItem()]);
    setNote('');
    setAdvancedFields({ ...DEFAULT_ADVANCED_FIELDS, manualTime: currentTime() });
    setInvoiceStarted(false);
    setSourceTemplateId(null);
    setTemplateEditMode(false);
  }, []);

  const loadTemplate = useCallback(
    (id: string): string | null => {
      const t = invoiceTemplates.find((x) => x.id === id);
      if (!t) {
        return null;
      }
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
    const table = (data.malHizmetTable as Array<Record<string, unknown>>) ?? [];
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
      currency: str(data.paraBirimi, 'TRY'),
      currencyRate: rate === '0' ? '' : rate,
      invoiceType: str(data.faturaTipi, 'SATIS'),
    });
    setItems(
      table.length > 0
        ? table.map((row) => ({
            id: newId(),
            name: str(row.malHizmet),
            quantity: Number(row.miktar) || 1,
            unitPrice: Number(row.birimFiyat) || 0,
            VATRate: Number(row.kdvOrani) || 0,
            unitType: str(row.birim, 'C62'),
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
  useEffect(() => localStorage.setItem(ENTITIES_STORAGE_KEY, JSON.stringify(entities)), [entities]);
  useEffect(
    () => localStorage.setItem(ACTIVE_ENTITY_STORAGE_KEY, JSON.stringify(activeEntityId)),
    [activeEntityId],
  );
  return (
    <StoreContext.Provider
      value={{
        entities,
        activeEntityId,
        activeEntity,
        setActiveEntityId,
        createEntity,
        renameEntity,
        deleteEntity,
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
