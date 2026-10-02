// @vitest-environment jsdom
import { useStore as useFormState } from '@tanstack/react-form';
import { act, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, test, vi } from 'vitest';
import { StoreProvider } from '../src/lib/store.tsx';
import type { InvoiceItem } from '../src/lib/types.ts';
import { InvoiceItems } from '../src/pages/invoice-items.tsx';
import {
  useInvoiceForm,
  useStoredInvoiceForm,
  type InvoiceForm,
} from '../src/pages/use-invoice-form.ts';

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
});

async function mount(items: Array<InvoiceItem>) {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  await act(async () =>
    root?.render(
      <StoreProvider>
        <Harness items={items} />
      </StoreProvider>,
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
  expect(document.querySelector('[id="items[0].VATRate-description"]')?.textContent).toBe(
    'İstisna faturada KDV %0',
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
