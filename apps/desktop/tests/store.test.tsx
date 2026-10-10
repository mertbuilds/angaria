// @vitest-environment jsdom
import { act, StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, test, vi } from 'vitest';
import { companyKeys, taxIDOwner } from '../src/lib/company-identity.ts';
import { vaultRead } from '../src/lib/native.ts';
import { StoreProvider, useStore } from '../src/lib/store.tsx';

vi.mock('@angaria/ui', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock('../src/lib/native.ts', () => ({
  secretDelete: vi.fn(async () => {}),
  secretGet: vi.fn(async () => null),
  vaultRead: vi.fn(async () => null),
  vaultWrite: vi.fn(async () => {}),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

// Newer Node versions define their own localStorage global, which hides jsdom's.
const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
});

// Lets the store's startup vault read and any pending effects settle.
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

// Reads the active company's password whenever the active company changes,
// like Ayarlar › GİB hesabı.
function PasswordReader({ onError }: { onError: (message: string) => void }) {
  const { activeEntityId, createEntity, getCredentials } = useStore();

  useEffect(() => {
    getCredentials(activeEntityId).catch((error: Error) => onError(error.message));
  }, [activeEntityId, getCredentials, onError]);

  return (
    <button onClick={createEntity} type="button">
      Şirket ekle
    </button>
  );
}

test("a new company's password is read once it is active, not reported missing", async () => {
  const errors: Array<string> = [];
  const container = document.createElement('div');
  const root = createRoot(container);

  await act(async () =>
    root.render(
      <StrictMode>
        <StoreProvider>
          <PasswordReader onError={(message) => errors.push(message)} />
        </StoreProvider>
      </StrictMode>,
    ),
  );
  await settle();
  await act(async () => container.querySelector('button')?.click());
  await settle();

  const entities: Array<{ id: string }> = JSON.parse(storage.get('fatura-entities') ?? '[]');
  expect(entities).toHaveLength(2);
  expect(errors).toEqual([]);
  // Both companies' passwords came from memory: one read for the launch.
  expect(vaultRead).toHaveBeenCalledTimes(1);
  act(() => root.unmount());
});

function CredsReader({ onCreds }: { onCreds: (creds: unknown) => void }) {
  const { creds } = useStore();

  useEffect(() => {
    onCreds(creds);
  }, [creds, onCreds]);

  return null;
}

test('a login saved with the removed test mode loads without it', async () => {
  storage.clear();
  storage.set(
    'fatura-entities',
    JSON.stringify([{ creds: { testMode: true, username: 'u' }, id: 'a', name: 'Ana şirket' }]),
  );
  const seen: Array<unknown> = [];
  const container = document.createElement('div');
  const root = createRoot(container);

  await act(async () =>
    root.render(
      <StoreProvider>
        <CredsReader onCreds={(creds) => seen.push(creds)} />
      </StoreProvider>,
    ),
  );
  await settle();

  expect(seen.at(-1)).toEqual({ hasPassword: false, username: 'u' });
  const [entity] = JSON.parse(storage.get('fatura-entities') ?? '[]');
  expect(entity.creds).toEqual({ username: 'u' });
  act(() => root.unmount());
});

const service = (id: string, currency?: string) => ({
  currency,
  discountAmount: 0,
  discountRate: 0,
  discountReason: '',
  gtip: '',
  id,
  name: id,
  quantity: 1,
  unitPrice: 100,
  unitType: 'C62',
  VATRate: 0,
});

test('services saved before they had a currency take the one the invoices were in', async () => {
  storage.clear();
  const invoiced = { currency: 'USD', lastInvoicedAt: '2026-09-01T10:00:00.000Z' };
  storage.set(
    'fatura-entities',
    JSON.stringify([
      {
        creds: { username: '' },
        id: 'a',
        name: 'Ana şirket',
        savedItems: [service('legacy'), service('priced', 'TRY')],
        savedRecipients: [{ ...invoiced, id: 'acme' }],
      },
      {
        creds: { username: '' },
        id: 'b',
        name: 'Şirket 2',
        savedItems: [service('unknown')],
        savedRecipients: [
          { ...invoiced, id: 'acme' },
          { ...invoiced, currency: 'EUR', id: 'gmbh' },
        ],
      },
    ]),
  );
  const container = document.createElement('div');
  const root = createRoot(container);

  await act(async () => root.render(<StoreProvider>{null}</StoreProvider>));
  await settle();

  const [first, second] = JSON.parse(storage.get('fatura-entities') ?? '[]');
  expect(first.savedItems.map((item: { currency?: string }) => item.currency)).toEqual([
    'USD',
    'TRY',
  ]);
  // The customers disagree: the service keeps no currency until edited.
  expect(second.savedItems[0]).not.toHaveProperty('currency');
  act(() => root.unmount());
});

function SharedReader({ onLoad }: { onLoad: (shared: Array<string>) => void }) {
  const { entities } = useStore();

  useEffect(() => {
    const companies = companyKeys(entities);
    onLoad(
      companies
        .filter((company) => taxIDOwner(companies, company.id, company.taxID))
        .map((company) => company.id),
    );
  }, [entities, onLoad]);

  return null;
}

const details = (taxID: string) => ({ name: 'Deniz Yılmaz Yazılım', taxID });

test('companies stored with one VKN load as they are, both found sharing it', async () => {
  storage.clear();
  storage.set(
    'fatura-entities',
    JSON.stringify([
      { companyInfo: details('10000000146'), creds: { username: '' }, id: 'a', name: 'Ana Varlık' },
      {
        companyInfo: details('100 000 001 46'),
        creds: { username: '' },
        id: 'b',
        name: 'Şirket 2',
      },
      { companyInfo: details('1234567890'), creds: { username: '' }, id: 'c', name: 'Şirket 3' },
    ]),
  );
  let shared: Array<string> = [];
  const container = document.createElement('div');
  const root = createRoot(container);

  await act(async () =>
    root.render(
      <StoreProvider>
        <SharedReader onLoad={(ids) => (shared = ids)} />
      </StoreProvider>,
    ),
  );
  await settle();

  expect(shared).toEqual(['a', 'b']);
  const stored = JSON.parse(storage.get('fatura-entities') ?? '[]');
  expect(
    stored.map((entity: { companyInfo: { taxID: string } }) => entity.companyInfo.taxID),
  ).toEqual(['10000000146', '100 000 001 46', '1234567890']);
  act(() => root.unmount());
});
