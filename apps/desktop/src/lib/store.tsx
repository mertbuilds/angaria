import { toast } from '@angaria/ui';
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import {
  createPasswordVault,
  ENTITIES_STORAGE_KEY,
  LEGACY_CREDS_STORAGE_KEY,
  migrateCredentials,
} from './credentials.ts';
import { parseGIBInvoice, presetRange, type DateRange } from './invoices.ts';
import { secretDelete, secretGet, secretSet } from './native.ts';
import type {
  AdvancedInvoiceFields,
  CompanyInfo,
  Credentials,
  CredentialsInfo,
  Entity,
  InvoiceFormValues,
  InvoiceItem,
  InvoiceSettings,
  InvoiceSource,
  InvoiceTemplate,
  Recipient,
  StoredCredentials,
} from './types.ts';

const newId = () => crypto.randomUUID();
const NO_TEMPLATES: Array<InvoiceTemplate> = [];
const ACTIVE_ENTITY_STORAGE_KEY = 'fatura-active-entity-id';

const secrets = { delete: secretDelete, get: secretGet, set: secretSet };
const passwords = createPasswordVault(secrets);

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

const DEFAULT_CREDS: StoredCredentials = { username: '', testMode: true };

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
  return index === 0 ? 'Ana şirket' : `Şirket ${index + 1}`;
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
      creds: loadLocal(LEGACY_CREDS_STORAGE_KEY, { ...DEFAULT_CREDS }),
      companyInfo: loadLocal('fatura-company-info', { ...DEFAULT_COMPANY_INFO }),
      savedRecipients: loadLocal('fatura-saved-recipients', SEED_RECIPIENTS),
      savedItems: loadLocal('fatura-saved-items', SEED_ITEMS),
      invoiceTemplates: loadLocal('fatura-templates', []),
    },
  ];
}

interface CredentialStartup {
  migrationFailed: boolean;
  /** Entity ids with a password in the keychain */
  passwordSaved: Record<string, boolean>;
}

async function prepareCredentials(): Promise<CredentialStartup> {
  // Persist the normalized entities first so legacy single-entity creds get an
  // entity id to migrate under.
  localStorage.setItem(ENTITIES_STORAGE_KEY, JSON.stringify(loadEntities()));
  const { failed } = await migrateCredentials(localStorage, secrets);
  const saved = await Promise.all(
    loadEntities().map(async (entity) => {
      const password = await passwords.get(entity.id).catch(() => null);
      return [entity.id, Boolean(password)] as const;
    }),
  );
  return { migrationFailed: failed > 0, passwordSaved: Object.fromEntries(saved) };
}

let credentialStartup: Promise<CredentialStartup> | null = null;

function withoutPassword(creds: StoredCredentials): StoredCredentials {
  const next = { ...creds };
  delete next.password;
  return next;
}

interface Store {
  activeEntity: Entity;
  activeEntityId: string;
  advancedFields: AdvancedInvoiceFields;
  companyInfo: CompanyInfo;
  createEntity: () => void;
  /** Non-secret credentials of the active entity. Read the password with getCredentials. */
  creds: CredentialsInfo;
  defaultItemAdvanced: typeof DEFAULT_ITEM_ADVANCED;
  /** Clear the entity's username and remove its password from the keychain */
  deleteCredentials: (entityId: string) => Promise<void>;
  /** Also removes the entity's password from the keychain */
  deleteEntity: (id: string) => void;
  entities: Array<Entity>;
  /** Full login for an entity, password read from the keychain. Call right before logging in. */
  getCredentials: (entityId: string) => Promise<Credentials>;
  /** true when the active entity has a username and a saved password */
  hasCredentials: boolean;
  /** The Faturalar list's range, Bu ay at launch */
  invoiceDateRange: DateRange;
  /**
   * Changes whenever the invoice form is replaced as a whole (reset, template,
   * GİB invoice, restore), so a mounted form can start over from the store.
   */
  invoiceFormRevision: number;
  invoiceSettings: InvoiceSettings;
  /** What filled the invoice form; null for a blank form */
  invoiceSource: InvoiceSource | null;
  /** true when the invoice form has been initialized (via template or scratch) */
  invoiceStarted: boolean;
  invoiceTemplates: Array<InvoiceTemplate>;
  items: Array<InvoiceItem>;
  /** Load a GIB invoice into the form */
  loadFromGIBInvoice: (data: Record<string, unknown>) => void;
  /** Load a template into the invoice form and mark it as started */
  loadTemplate: (id: string) => string | null;
  newId: () => string;
  note: string;
  recipient: Recipient;
  renameEntity: (id: string, name: string) => void;
  /** Reset invoice form to blank state */
  resetInvoiceForm: () => void;
  /** Put back a form saved before a reset or load (undo) */
  restoreInvoiceDraft: (values: InvoiceFormValues, source: InvoiceSource | null) => void;
  savedItems: Array<InvoiceItem>;
  savedRecipients: Array<Recipient>;
  setActiveEntityId: React.Dispatch<React.SetStateAction<string>>;
  setAdvancedFields: React.Dispatch<React.SetStateAction<AdvancedInvoiceFields>>;
  setCompanyInfo: React.Dispatch<React.SetStateAction<CompanyInfo>>;
  /**
   * Update the given fields. username and testMode apply immediately; a password
   * is written to the keychain ('' removes it). Rejects if the keychain write fails.
   */
  setCredentials: (entityId: string, creds: Partial<Credentials>) => Promise<void>;
  setInvoiceDateRange: React.Dispatch<React.SetStateAction<DateRange>>;
  setInvoiceSettings: React.Dispatch<React.SetStateAction<InvoiceSettings>>;
  setInvoiceTemplates: React.Dispatch<React.SetStateAction<Array<InvoiceTemplate>>>;
  setItems: React.Dispatch<React.SetStateAction<Array<InvoiceItem>>>;
  setNote: React.Dispatch<React.SetStateAction<string>>;
  setRecipient: React.Dispatch<React.SetStateAction<Recipient>>;
  setSavedItems: React.Dispatch<React.SetStateAction<Array<InvoiceItem>>>;
  setSavedRecipients: React.Dispatch<React.SetStateAction<Array<Recipient>>>;
  /** Start a blank invoice form */
  startBlankInvoice: () => void;
}

const StoreContext = createContext<Store | null>(null);

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return ctx;
}

/** Renders children once GİB passwords are migrated to the keychain and loaded. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [startup, setStartup] = useState<CredentialStartup | null>(null);

  useEffect(() => {
    let active = true;
    credentialStartup ??= prepareCredentials().catch(() => ({
      migrationFailed: true,
      passwordSaved: {},
    }));
    void credentialStartup.then((result) => {
      if (active) {
        setStartup(result);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  if (!startup) {
    return null;
  }
  return <LoadedStoreProvider startup={startup}>{children}</LoadedStoreProvider>;
}

function LoadedStoreProvider({
  children,
  startup,
}: {
  children: ReactNode;
  startup: CredentialStartup;
}) {
  const [entities, setEntities] = useState<Array<Entity>>(() => loadEntities());
  const entitiesRef = useRef(entities);
  const [passwordSaved, setPasswordSaved] = useState(startup.passwordSaved);
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
  const [invoiceSource, setInvoiceSource] = useState<InvoiceSource | null>(null);
  const [invoiceFormRevision, setInvoiceFormRevision] = useState(0);

  const [invoiceDateRange, setInvoiceDateRange] = useState(() => presetRange('bu-ay', new Date()));

  // An active id that names no company (stale or deleted) moves to the first one.
  if (!entities.some((entity) => entity.id === activeEntityId)) {
    const firstId = entities[0]?.id ?? '';
    if (firstId !== activeEntityId) {
      setActiveEntityId(firstId);
    }
  }

  useEffect(() => {
    entitiesRef.current = entities;
  }, [entities]);

  useEffect(() => {
    if (startup.migrationFailed) {
      toast.warning(
        "GİB şifresi Anahtar Zinciri'ne taşınamadı. Şifreniz silinmedi, uygulama bir sonraki açılışta yeniden deneyecek.",
        { id: 'credentials-migration' },
      );
    }
  }, [startup.migrationFailed]);

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
      if (entities.length > 1 && entities.some((entity) => entity.id === id)) {
        void passwords
          .delete(id)
          .catch(() =>
            toast.warning("Silinen şirketin GİB şifresi Anahtar Zinciri'nden kaldırılamadı."),
          );
      }
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

  const updateCreds = useCallback(
    (entityId: string, updater: (creds: StoredCredentials) => StoredCredentials) => {
      setEntities((prev) =>
        prev.map((entity) =>
          entity.id === entityId ? { ...entity, creds: updater(entity.creds) } : entity,
        ),
      );
    },
    [],
  );

  const getCredentials = useCallback(async (entityId: string): Promise<Credentials> => {
    const entity = entitiesRef.current.find((e) => e.id === entityId);
    if (!entity) {
      throw new Error('Şirket bulunamadı');
    }
    const { password: plaintext, ...creds } = entity.creds;
    let password: string | null = null;
    try {
      password = await passwords.get(entityId);
    } catch (error) {
      if (!plaintext) {
        throw new Error("GİB şifresi Anahtar Zinciri'nden okunamadı", { cause: error });
      }
    }
    return { ...creds, password: password ?? plaintext ?? '' };
  }, []);

  const setCredentials = useCallback(
    async (entityId: string, { password, ...fields }: Partial<Credentials>) => {
      if (Object.keys(fields).length > 0) {
        updateCreds(entityId, (creds) => ({ ...creds, ...fields }));
      }
      if (password === undefined) {
        return;
      }
      try {
        await passwords.set(entityId, password);
      } catch (error) {
        throw new Error("GİB şifresi Anahtar Zinciri'ne kaydedilemedi", { cause: error });
      }
      updateCreds(entityId, withoutPassword);
      setPasswordSaved((prev) => ({ ...prev, [entityId]: password !== '' }));
    },
    [updateCreds],
  );

  const deleteCredentials = useCallback(
    (entityId: string) => setCredentials(entityId, { username: '', password: '' }),
    [setCredentials],
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

  const storedCreds = activeEntity?.creds ?? DEFAULT_CREDS;
  const creds: CredentialsInfo = {
    username: storedCreds.username,
    testMode: storedCreds.testMode,
    hasPassword: Boolean(storedCreds.password) || passwordSaved[activeEntity?.id] === true,
  };
  const hasCredentials = Boolean(creds.username && creds.hasPassword);
  const companyInfo = activeEntity?.companyInfo ?? DEFAULT_COMPANY_INFO;
  const savedRecipients = activeEntity?.savedRecipients ?? [];
  const savedItems = activeEntity?.savedItems ?? [];
  const invoiceTemplates = activeEntity?.invoiceTemplates ?? NO_TEMPLATES;

  const resetInvoiceForm = useCallback(() => {
    setRecipient({ ...BLANK_RECIPIENT, id: newId() });
    setInvoiceSettings({ ...DEFAULT_SETTINGS });
    setItems([makeBlankItem()]);
    setNote('');
    setAdvancedFields({ ...DEFAULT_ADVANCED_FIELDS, manualTime: currentTime() });
    setInvoiceStarted(false);
    setInvoiceSource(null);
    setInvoiceFormRevision((revision) => revision + 1);
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
      setInvoiceSource({ kind: 'template', name: t.name, templateId: id });
      setInvoiceFormRevision((revision) => revision + 1);
      // Update lastUsedAt
      setInvoiceTemplates((prev) =>
        prev.map((x) => (x.id === id ? { ...x, lastUsedAt: Date.now() } : x)),
      );
      return t.name;
    },
    [invoiceTemplates, setInvoiceTemplates],
  );

  const startBlankInvoice = useCallback(() => {
    resetInvoiceForm();
    setInvoiceStarted(true);
  }, [resetInvoiceForm]);

  const loadFromGIBInvoice = useCallback((data: Record<string, unknown>) => {
    const { items, note, recipient, settings } = parseGIBInvoice(data);
    setRecipient({ ...recipient, id: newId() });
    setInvoiceSettings(settings);
    setItems(
      items.length > 0 ? items.map((item) => ({ ...item, id: newId() })) : [makeBlankItem()],
    );
    setNote(note);
    setAdvancedFields({ ...DEFAULT_ADVANCED_FIELDS, manualTime: currentTime() });
    setInvoiceStarted(true);
    setInvoiceSource({
      kind: 'invoice',
      label: str(data.belgeNumarasi) || str(data.aliciUnvan) || 'GİB faturası',
    });
    setInvoiceFormRevision((revision) => revision + 1);
  }, []);

  const restoreInvoiceDraft = useCallback(
    (values: InvoiceFormValues, source: InvoiceSource | null) => {
      setRecipient(values.recipient);
      setInvoiceSettings(values.invoiceSettings);
      setItems(values.items);
      setNote(values.note);
      setAdvancedFields(values.advancedFields);
      setInvoiceStarted(true);
      setInvoiceSource(source);
      setInvoiceFormRevision((revision) => revision + 1);
    },
    [],
  );

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
        hasCredentials,
        getCredentials,
        setCredentials,
        deleteCredentials,
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
        invoiceStarted,
        invoiceFormRevision,
        invoiceSource,
        restoreInvoiceDraft,
        resetInvoiceForm,
        loadTemplate,
        startBlankInvoice,
        loadFromGIBInvoice,
        newId,
        defaultItemAdvanced: DEFAULT_ITEM_ADVANCED,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
