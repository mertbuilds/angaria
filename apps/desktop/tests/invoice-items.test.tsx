// @vitest-environment jsdom
import { useStore as useFormState } from '@tanstack/react-form';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchTCMBRateTable } from '../src/lib/angaria.ts';
import { cleanItems, upsertSavedItems } from '../src/lib/invoice-form.ts';
import { StoreProvider } from '../src/lib/store.tsx';
import type { InvoiceItem, Service } from '../src/lib/types.ts';
import { InvoiceItems } from '../src/pages/invoice-items.tsx';
import {
  useInvoiceForm,
  useStoredInvoiceForm,
  type InvoiceForm,
} from '../src/pages/use-invoice-form.ts';

// TCMB's bulletin never comes unless a test says so.
vi.mock('../src/lib/angaria.ts', () => ({
  fetchTCMBRateTable: vi.fn(() => new Promise(() => {})),
}));
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
  removeItem: (key: string) => storage.delete(key),
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
});
vi.stubGlobal(
  'ResizeObserver',
  class {
    disconnect() {}
    observe() {}
    unobserve() {}
  },
);

const row = (patch: Partial<InvoiceItem>): InvoiceItem => ({
  discountAmount: 0,
  discountRate: 0,
  discountReason: '',
  gtip: '',
  id: crypto.randomUUID(),
  name: 'Danışmanlık',
  quantity: 1,
  unitPrice: 1000,
  unitType: 'C62',
  VATRate: 20,
  ...patch,
});

let form: InvoiceForm;

function Harness({ items }: { items: Array<InvoiceItem> }) {
  const stored = useStoredInvoiceForm();
  const harnessForm = useInvoiceForm({
    defaultValues: { ...stored, items },
    onSubmit: async () => {},
    onSubmitInvalid: () => {},
  });
  // Like Yeni fatura, which renders again on every change: the item rows
  // re-render only through it, or when a row is added or removed.
  useFormState(harnessForm.store, (state) => state.values);
  useEffect(() => {
    form = harnessForm;
  }, [harnessForm]);
  return <InvoiceItems form={harnessForm} />;
}

let root: Root | undefined;

afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  storage.clear();
  document.body.replaceChildren();
  vi.mocked(fetchTCMBRateTable).mockReset();
});

async function mount(items: Array<InvoiceItem>, queryClient = new QueryClient()) {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root?.render(
      <QueryClientProvider client={queryClient}>
        <StoreProvider>
          <Harness items={items} />
        </StoreProvider>
      </QueryClientProvider>,
    ),
  );
  return container;
}

const items = () => form.getFieldValue('items');

const press = (target: Element, key: string, init: KeyboardEventInit = {}) =>
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key, ...init }));
  });

const byId = (id: string) => document.getElementById(id) as HTMLElement;

const discountKinds = () => [
  ...document.querySelectorAll<HTMLElement>('[aria-label="İskonto türü"] [role="radio"]'),
];

test('İstisna sets every VAT rate to 0 and locks the chips; Satış gives the rates back', async () => {
  await mount([row({ VATRate: 20 }), row({ VATRate: 10 })]);

  await act(async () => form.setFieldValue('invoiceSettings.invoiceType', 'ISTISNA'));
  expect(items().map((item) => item.VATRate)).toEqual([0, 0]);
  expect(byId('items[0].VATRate').textContent).toContain('%0');
  const description = document.querySelector('[id="items[0].VATRate-description"]');
  expect(description?.textContent).toBe('İstisna faturada KDV %0 (KDV Kanunu 11/1-a)');
  expect(description?.querySelector('a')?.textContent).toBe('KDV Kanunu 11/1-a');
  expect(description?.querySelector('a')?.getAttribute('href')).toMatch(
    /^https:\/\/www\.mevzuat\.gov\.tr\/mevzuat\?MevzuatNo=3065&/,
  );
  expect(byId('items[0].gtip')).toBeTruthy();

  await act(async () => form.setFieldValue('invoiceSettings.invoiceType', 'SATIS'));
  expect(items().map((item) => item.VATRate)).toEqual([20, 10]);
  expect(document.getElementById('items[0].gtip')).toBeNull();
});

test('Ctrl D duplicates a row, Ctrl Shift ⌫ deletes it, Enter on a chip adds one', async () => {
  await mount([row({ name: 'Barındırma', unitType: 'MON', VATRate: 10 })]);

  await press(byId('items[0].unitPrice'), 'd', { ctrlKey: true });
  expect(items()).toHaveLength(2);
  expect({ ...items()[1], id: '' }).toEqual({ ...items()[0], id: '' });
  expect(items()[1].id).not.toBe(items()[0].id);
  expect(document.activeElement?.id).toBe('items[1].unitPrice');

  await press(byId('items[1].unitPrice'), 'Backspace', { ctrlKey: true, shiftKey: true });
  expect(items()).toHaveLength(1);

  // The last row stays.
  await press(byId('items[0].unitPrice'), 'Backspace', { ctrlKey: true, shiftKey: true });
  expect(items()).toHaveLength(1);

  const chip = byId('items[0].VATRate').querySelector('[role="radio"]') as HTMLElement;
  await press(chip, 'Enter');
  expect(items()).toHaveLength(2);
  expect(items()[1]).toMatchObject({ name: '', unitType: 'MON', VATRate: 10 });
  expect(document.activeElement?.id).toBe('items[1].name');
});

test('switching the discount between amount and rate keeps it consistent', async () => {
  await mount([row({ discountAmount: 150, unitPrice: 1234 })]);
  expect(byId('items[0].discountAmount')).toBeTruthy();

  await act(async () => discountKinds().at(0)?.click());
  // 150 of 1.234 is %12,16, which comes to 150,05.
  expect(items()[0]).toMatchObject({ discountAmount: 150.05, discountRate: 12.16 });
  expect(byId('items[0].discountRate')).toBeTruthy();

  // The amount follows the rate.
  await act(async () => form.setFieldValue('items[0].quantity', 2));
  expect(items()[0].discountAmount).toBe(300.11);

  await act(async () => discountKinds().at(1)?.click());
  expect(items()[0]).toMatchObject({ discountAmount: 300.11, discountRate: 0 });
});

const TCMB = {
  publishedOn: new Date(new Date().getFullYear(), 9, 1),
  rates: new Map([['USD', 41.1032]]),
  validFor: new Date(new Date().getFullYear(), 9, 2),
};

const service = (patch: Partial<Service>): Service => ({
  ...row({ name: 'Engineering Services', unitPrice: 100, VATRate: 0 }),
  ...patch,
});

/** The store's company with these services. */
const saveServices = (services: Array<Service>) =>
  storage.set(
    'fatura-entities',
    JSON.stringify([
      {
        companyInfo: {},
        creds: { username: '' },
        id: 'a',
        name: 'Ana şirket',
        savedItems: services,
        savedRecipients: [],
      },
    ]),
  );

/** Types `text` into the row's Hizmet adı and opens its suggestions. */
async function suggest(index: number, text: string) {
  const input = byId(`items[${index}].name`) as HTMLInputElement;
  const setValue = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set;
  await act(async () => {
    input.focus();
    setValue?.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await press(input, 'ArrowDown');
  return [...document.querySelectorAll<HTMLElement>('[role="option"]')];
}

/** Picks the service `name` from the row's suggestions. */
async function pick(index: number, name: string) {
  const options = await suggest(index, name.slice(0, 5));
  const option = options.find((element) => element.textContent?.includes(name));
  expect(option).toBeTruthy();
  await act(async () => option?.click());
}

// React Query tells its observers on a timer.
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

const priceHint = (index = 0) =>
  document.getElementById(`items[${index}].unitPrice-description`)?.textContent;

/** `saved` after a draft of the form's rows in `currency`, as Yeni fatura learns it. */
const learn = (saved: Array<Service>, currency: string) =>
  upsertSavedItems(saved, cleanItems(items()), () => 'new', currency);

describe('a saved service in another currency', () => {
  test('lists each service with the currency of its price', async () => {
    saveServices([service({ currency: 'USD' }), service({ name: 'Eski hizmet', unitPrice: 750 })]);
    await mount([row({ name: '' })]);
    const options = await suggest(0, 'e');
    expect(options.map((option) => option.textContent)).toEqual([
      'Engineering Services100,00 USD · Adet · %0',
      'Eski hizmet750,00 · Adet · %0',
    ]);
  });

  test('fills the price as is on an invoice in the same currency', async () => {
    saveServices([service({ currency: 'USD' })]);
    await mount([row({ name: '' })]);
    await act(async () => {
      form.setFieldValue('invoiceSettings.currency', 'USD');
      form.setFieldValue('invoiceSettings.currencyRate', '41,1032');
    });
    await pick(0, 'Engineering Services');
    expect(items()[0]).toMatchObject({ name: 'Engineering Services', unitPrice: 100 });
    expect(items()[0]).not.toHaveProperty('currency');
    expect(priceHint()).toBeUndefined();
  });

  test('a service without a currency counts in the invoice’s, as before', async () => {
    const legacy = service({});
    saveServices([legacy]);
    await mount([row({ name: '' })]);
    await pick(0, 'Engineering Services');
    expect(items()[0].unitPrice).toBe(100);
    expect(priceHint()).toBeUndefined();

    // The draft gives it the invoice's currency.
    await act(async () => form.setFieldValue('items[0].unitPrice', 120));
    expect(learn([legacy], 'TRY')).toEqual([{ ...legacy, currency: 'TRY', unitPrice: 120 }]);
  });

  test('converts at TCMB’s rate on a lira invoice and says so until typed over', async () => {
    saveServices([service({ currency: 'USD', discountAmount: 10 })]);
    const queryClient = new QueryClient();
    queryClient.setQueryData(['tcmb-rates', ''], TCMB);
    await mount([row({ name: '' })], queryClient);

    await pick(0, 'Engineering Services');
    expect(items()[0]).toMatchObject({ discountAmount: 411.03, unitPrice: 4110.32 });
    expect(priceHint()).toBe('100,00 USD → 4.110,32 TL (TCMB 1 Eki)');

    await act(async () => form.setFieldValue('items[0].unitPrice', 4000));
    expect(priceHint()).toBeUndefined();
  });

  test('a draft with a converted row leaves the service as it is, typed over or not', async () => {
    const usd = service({ currency: 'USD' });
    saveServices([usd]);
    const queryClient = new QueryClient();
    queryClient.setQueryData(['tcmb-rates', ''], TCMB);
    await mount([row({ name: '' })], queryClient);

    await pick(0, 'Engineering Services');
    expect(items()[0].pickedFrom).toEqual({ converted: true, currency: 'USD', id: usd.id });
    expect(learn([usd], 'TRY')).toEqual([usd]);

    await act(async () => form.setFieldValue('items[0].unitPrice', 4000));
    expect(learn([usd], 'TRY')).toEqual([usd]);
  });

  test('a draft in the service’s currency updates its price', async () => {
    const usd = service({ currency: 'USD' });
    saveServices([usd]);
    await mount([row({ name: '' })]);
    await act(async () => {
      form.setFieldValue('invoiceSettings.currency', 'USD');
      form.setFieldValue('invoiceSettings.currencyRate', '41,1032');
    });

    await pick(0, 'Engineering Services');
    expect(items()[0].pickedFrom).toEqual({ converted: false, currency: 'USD', id: usd.id });
    await act(async () => form.setFieldValue('items[0].unitPrice', 120));
    expect(learn([usd], 'USD')).toEqual([{ ...usd, unitPrice: 120 }]);
  });

  test('waits for the rate with the price empty, then converts', async () => {
    let resolve: ((table: typeof TCMB) => void) | undefined;
    vi.mocked(fetchTCMBRateTable).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    saveServices([service({ currency: 'USD' })]);
    await mount([row({ name: '' })]);

    await pick(0, 'Engineering Services');
    expect(items()[0]).toMatchObject({ name: 'Engineering Services', unitPrice: 0 });
    expect(priceHint()).toBe('100,00 USD. Kur gelince dönüştürülecek.');

    await act(async () => resolve?.(TCMB));
    await settle();
    expect(items()[0].unitPrice).toBe(4110.32);
    expect(priceHint()).toBe('100,00 USD → 4.110,32 TL (TCMB 1 Eki)');
  });

  test('asks for the price when TCMB has no rate', async () => {
    vi.mocked(fetchTCMBRateTable).mockRejectedValue(new Error('TCMB'));
    saveServices([service({ currency: 'USD' })]);
    await mount(
      [row({ name: '' })],
      new QueryClient({ defaultOptions: { queries: { retry: false } } }),
    );

    await pick(0, 'Engineering Services');
    await settle();
    expect(items()[0].unitPrice).toBe(0);
    expect(priceHint()).toBe('100,00 USD. TCMB kuru alınamadı, fiyatı TL olarak yaz.');
  });
});
