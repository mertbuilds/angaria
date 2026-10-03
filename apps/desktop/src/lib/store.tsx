import { toast } from '@angaria/ui';
import { addDays } from 'date-fns';
import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useLayoutEffect,
  useRef,
  type ReactNode,
} from 'react';
import { vault } from './app-vault.ts';
import {
  ENTITIES_STORAGE_KEY,
  LEGACY_CREDS_STORAGE_KEY,
  migrateCredentials,
} from './credentials.ts';
import { customerName, findCustomer } from './customer.ts';
import { applyCustomer } from './invoice-form.ts';
import { parseGIBInvoice, presetRange, type DateRange } from './invoices.ts';
import { reportKeychainError } from './keychain-error.ts';
import { withServiceCurrencies } from './services.ts';
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
  Recipient,
  Service,
  StoredCredentials,
} from './types.ts';
import { toGIB } from './utils.ts';

const newId = () => crypto.randomUUID();
const NO_RECIPIENTS: Array<Recipient> = [];
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
    taxIDOrTRID: '2222222222',
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

const DEFAULT_CREDS: StoredCredentials = { username: '' };

/**
 * The stored login with only the fields the app knows: the GİB test portal
 * mode (`testMode`, removed 2026-10-02) is dropped on load.
 */
function loadCreds(creds: Partial<StoredCredentials> | null | undefined): StoredCredentials {
  const { password, username = '' } = creds ?? {};
  return password === undefined ? { username } : { password, username };
}

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

const SEED_ITEMS: Array<Service> = [
  {
    id: newId(),
    currency: 'USD',
    name: 'Engineering Services - Mühendislik Hizmetleri',
    quantity: 1,
    unitPrice: 100,
    VATRate: 0,
    ...DEFAULT_ITEM_ADVANCED,
  },
  {
    id: newId(),
    currency: 'TRY',
    name: 'Yazılım Geliştirme Hizmeti',
    quantity: 1,
    unitPrice: 5000,
    VATRate: 20,
    ...DEFAULT_ITEM_ADVANCED,
  },
  {
    id: newId(),
    currency: 'TRY',
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

const DEFAULT_ADVANCED_FIELDS: AdvancedInvoiceFields = {
  dueDate: '',
  manualDate: '',
  // Empty: the moment the invoice goes to GİB (toDraftDetails).
  manualTime: '',
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

function blankForm(): InvoiceFormValues {
  return {
    advancedFields: { ...DEFAULT_ADVANCED_FIELDS },
    invoiceSettings: { ...DEFAULT_SETTINGS },
    items: [makeBlankItem()],
    note: '',
    recipient: { ...BLANK_RECIPIENT, id: newId() },
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
  };
}

/**
 * The stored companies, with only the fields the app knows. Invoice templates
 * (removed 2026-10-01) are not among them: the startup save (prepareCredentials)
 * writes the companies back without them, so stored ones go silently. Services
 * saved before they had a currency take the one their invoices were in, when
 * the customers tell it (withServiceCurrencies).
 */
function loadEntities(): Array<Entity> {
  const stored = loadLocal<Array<Entity> | null>(ENTITIES_STORAGE_KEY, null);
  if (Array.isArray(stored) && stored.length > 0) {
    return stored.map((entity, index) => ({
      id: entity.id || newId(),
      name: entity.name || makeEntityName(index),
      creds: loadCreds(entity.creds),
      companyInfo: entity.companyInfo ?? { ...DEFAULT_COMPANY_INFO },
      savedRecipients: entity.savedRecipients ?? [],
      savedItems: withServiceCurrencies(entity.savedItems ?? [], entity.savedRecipients ?? []),
    }));
  }

  const savedRecipients = loadLocal('fatura-saved-recipients', SEED_RECIPIENTS);
  return [
    {
      ...makeDefaultEntity(0, false),
      creds: loadCreds(
        loadLocal<Partial<StoredCredentials> | null>(LEGACY_CREDS_STORAGE_KEY, null),
      ),
      companyInfo: loadLocal('fatura-company-info', { ...DEFAULT_COMPANY_INFO }),
      savedRecipients,
      savedItems: withServiceCurrencies(
        loadLocal('fatura-saved-items', SEED_ITEMS),
        savedRecipients,
      ),
    },
  ];
}

const MIGRATION_WARNING =
  'GİB şifresi Anahtar Zinciri’ne taşınamadı. Şifre silinmedi, Angaria bir sonraki açılışta yeniden dener.';
const READ_ERROR = 'GİB şifresi Anahtar Zinciri’nden okunamadı';

interface CredentialStartup {
  /** The warning to show when a password could not move to the keychain */
  migrationWarning: string | null;
  /** Entity ids with a password in the vault */
  passwordSaved: Record<string, boolean>;
}

async function prepareCredentials(): Promise<CredentialStartup> {
  // Persist the normalized entities first so legacy single-entity creds get an
  // entity id to migrate under.
  localStorage.setItem(ENTITIES_STORAGE_KEY, JSON.stringify(loadEntities()));
  // The vault's one read of this launch. If it fails, getCredentials tries
  // again and reports it when a password is needed.
  await vault.load().catch((error: unknown) => reportKeychainError(READ_ERROR, error));
  const { error, failed } = await migrateCredentials(localStorage, vault);
  return {
    migrationWarning: failed > 0 ? reportKeychainError(MIGRATION_WARNING, error) : null,
    passwordSaved: Object.fromEntries(
      loadEntities().map((entity) => [entity.id, vault.hasPassword(entity.id)]),
    ),
  };
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
  /** Writes a pending password change now (blur, leaving Ayarlar). Never rejects. */
  flushCredentials: () => Promise<void>;
  /** Full login for an entity, password read from the vault. Call right before logging in. */
  getCredentials: (entityId: string) => Promise<Credentials>;
  /** true when the active entity has a username and a saved password */
  hasCredentials: boolean;
  /** The Faturalar list's range, Bu ay at launch */
  invoiceDateRange: DateRange;
  /**
   * Changes whenever the invoice form is replaced as a whole (reset, GİB
   * invoice, customer, restore), so a mounted form can start over from the store.
   */
  invoiceFormRevision: number;
  invoiceSettings: InvoiceSettings;
  /** What filled the invoice form; null for a blank form */
  invoiceSource: InvoiceSource | null;
  /**
   * true once the invoice form was started: blank, from a GİB invoice or for a
   * customer. A reset clears it, and /yeni offers the recent invoices again.
   */
  invoiceStarted: boolean;
  items: Array<InvoiceItem>;
  /** Load a GIB invoice into the form; a saved customer's due date applies */
  loadFromGIBInvoice: (data: Record<string, unknown>) => void;
  newId: () => string;
  note: string;
  recipient: Recipient;
  renameEntity: (id: string, name: string) => void;
  /** Reset invoice form to blank state */
  resetInvoiceForm: () => void;
  /** Put back a form saved before a reset or load (undo) */
  restoreInvoiceDraft: (values: InvoiceFormValues, source: InvoiceSource | null) => void;
  savedItems: Array<Service>;
  savedRecipients: Array<Recipient>;
  setActiveEntityId: React.Dispatch<React.SetStateAction<string>>;
  setAdvancedFields: React.Dispatch<React.SetStateAction<AdvancedInvoiceFields>>;
  setCompanyInfo: React.Dispatch<React.SetStateAction<CompanyInfo>>;
  /**
   * Update the given fields. username applies immediately; a password
   * is written to the keychain once typing pauses ('' removes it). Resolves after
   * that write, rejects if it fails.
   */
  setCredentials: (entityId: string, creds: Partial<Credentials>) => Promise<void>;
  setInvoiceDateRange: React.Dispatch<React.SetStateAction<DateRange>>;
  setInvoiceSettings: React.Dispatch<React.SetStateAction<InvoiceSettings>>;
  setItems: React.Dispatch<React.SetStateAction<Array<InvoiceItem>>>;
  setNote: React.Dispatch<React.SetStateAction<string>>;
  setRecipient: React.Dispatch<React.SetStateAction<Recipient>>;
  setSavedItems: React.Dispatch<React.SetStateAction<Array<Service>>>;
  setSavedRecipients: React.Dispatch<React.SetStateAction<Array<Recipient>>>;
  /** Start a blank invoice form */
  startBlankInvoice: () => void;
  /** Start a blank invoice form for a saved customer, with its defaults */
  startInvoiceFor: (customer: Recipient) => void;
}

const StoreContext = createContext<Store | null>(null);

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) {
    throw new Error('useStore must be used within StoreProvider');
  }
  return ctx;
}

/** Renders children once the vault is loaded and GİB passwords are migrated to it. */
export function StoreProvider({ children }: { children: ReactNode }) {
  const [startup, setStartup] = useState<CredentialStartup | null>(null);

  useEffect(() => {
    let active = true;
    credentialStartup ??= prepareCredentials().catch((error: unknown) => ({
      migrationWarning: reportKeychainError(MIGRATION_WARNING, error),
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

  // Invoice form state: not persisted, starts blank
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

  // A layout effect, so the ref is current before any child's effect runs: Ayarlar
  // reads a new company's password as soon as it is active.
  useLayoutEffect(() => {
    entitiesRef.current = entities;
  }, [entities]);

  useEffect(() => {
    if (startup.migrationWarning) {
      toast.warning(startup.migrationWarning, { id: 'credentials-migration' });
    }
  }, [startup.migrationWarning]);

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
        void vault
          .deletePassword(id)
          .catch((error: unknown) =>
            toast.warning(
              reportKeychainError(
                'Silinen şirketin GİB şifresi Anahtar Zinciri’nden kaldırılamadı.',
                error,
              ),
            ),
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

  /** Takes hasPassword for an entity from the vault in memory. */
  const syncPasswordSaved = useCallback((entityId: string) => {
    const saved = vault.hasPassword(entityId);
    setPasswordSaved((prev) => (prev[entityId] === saved ? prev : { ...prev, [entityId]: saved }));
  }, []);

  const getCredentials = useCallback(
    async (entityId: string): Promise<Credentials> => {
      const entity = entitiesRef.current.find((e) => e.id === entityId);
      if (!entity) {
        throw new Error('Şirket bulunamadı');
      }
      const { password: plaintext, ...creds } = entity.creds;
      let password: string | null = null;
      try {
        password = await vault.getPassword(entityId);
        // The startup read may have failed and this one worked.
        syncPasswordSaved(entityId);
      } catch (error) {
        if (!plaintext) {
          throw new Error(reportKeychainError(READ_ERROR, error), { cause: error });
        }
      }
      return { ...creds, password: password ?? plaintext ?? '' };
    },
    [syncPasswordSaved],
  );

  const setCredentials = useCallback(
    async (entityId: string, { password, ...fields }: Partial<Credentials>) => {
      if (Object.keys(fields).length > 0) {
        updateCreds(entityId, (creds) => ({ ...creds, ...fields }));
      }
      if (password === undefined) {
        return;
      }
      try {
        await vault.setPassword(entityId, password);
      } catch (error) {
        throw new Error(
          reportKeychainError('GİB şifresi Anahtar Zinciri’ne kaydedilemedi', error),
          { cause: error },
        );
      } finally {
        syncPasswordSaved(entityId);
      }
      updateCreds(entityId, withoutPassword);
    },
    [syncPasswordSaved, updateCreds],
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

  const setSavedItems: React.Dispatch<React.SetStateAction<Array<Service>>> = useCallback(
    (value) => {
      updateActiveEntity((entity) => ({
        ...entity,
        savedItems: typeof value === 'function' ? value(entity.savedItems) : value,
      }));
    },
    [updateActiveEntity],
  );

  const storedCreds = activeEntity?.creds ?? DEFAULT_CREDS;
  const creds: CredentialsInfo = {
    username: storedCreds.username,
    hasPassword: Boolean(storedCreds.password) || passwordSaved[activeEntity?.id] === true,
  };
  const hasCredentials = Boolean(creds.username && creds.hasPassword);
  const companyInfo = activeEntity?.companyInfo ?? DEFAULT_COMPANY_INFO;
  const savedRecipients = activeEntity?.savedRecipients ?? NO_RECIPIENTS;
  const savedItems = activeEntity?.savedItems ?? [];

  /** Replaces the whole invoice form; a mounted form starts over from it. */
  const replaceInvoiceForm = useCallback(
    (values: InvoiceFormValues, source: InvoiceSource | null, started: boolean) => {
      setRecipient(values.recipient);
      setInvoiceSettings(values.invoiceSettings);
      setItems(values.items);
      setNote(values.note);
      setAdvancedFields(values.advancedFields);
      setInvoiceStarted(started);
      setInvoiceSource(source);
      setInvoiceFormRevision((revision) => revision + 1);
    },
    [],
  );

  const resetInvoiceForm = useCallback(
    () => replaceInvoiceForm(blankForm(), null, false),
    [replaceInvoiceForm],
  );

  const startBlankInvoice = useCallback(
    () => replaceInvoiceForm(blankForm(), null, true),
    [replaceInvoiceForm],
  );

  const startInvoiceFor = useCallback(
    (customer: Recipient) => replaceInvoiceForm(applyCustomer(blankForm(), customer), null, true),
    [replaceInvoiceForm],
  );

  const loadFromGIBInvoice = useCallback(
    (data: Record<string, unknown>) => {
      const { items, note, recipient, settings } = parseGIBInvoice(data);
      const blank = blankForm();
      const dueDays = findCustomer(
        savedRecipients,
        recipient.taxIDOrTRID,
        customerName(recipient),
      )?.dueDays;
      replaceInvoiceForm(
        {
          advancedFields: {
            ...blank.advancedFields,
            dueDate: dueDays === undefined ? '' : toGIB(addDays(new Date(), dueDays)),
            dueDays,
          },
          invoiceSettings: settings,
          items: items.length > 0 ? items.map((item) => ({ ...item, id: newId() })) : blank.items,
          note,
          recipient: { ...recipient, id: newId() },
        },
        {
          kind: 'invoice',
          label: str(data.belgeNumarasi) || str(data.aliciUnvan) || 'GİB faturası',
        },
        true,
      );
    },
    [replaceInvoiceForm, savedRecipients],
  );

  const restoreInvoiceDraft = useCallback(
    (values: InvoiceFormValues, source: InvoiceSource | null) =>
      replaceInvoiceForm(values, source, true),
    [replaceInvoiceForm],
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
        flushCredentials: vault.flush,
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
        advancedFields,
        setAdvancedFields,
        invoiceDateRange,
        setInvoiceDateRange,
        invoiceStarted,
        invoiceFormRevision,
        invoiceSource,
        restoreInvoiceDraft,
        resetInvoiceForm,
        startBlankInvoice,
        startInvoiceFor,
        loadFromGIBInvoice,
        newId,
        defaultItemAdvanced: DEFAULT_ITEM_ADVANCED,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}
