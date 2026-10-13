// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, test, vi } from 'vitest';
import { useAppForm } from '../src/lib/form.tsx';
import { formatRate } from '../src/lib/invoice-form.ts';
import { DecimalTextField } from '../src/pages/decimal-text-field.tsx';
import { formatNumber } from '../src/shell/searchable-list.tsx';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
vi.stubGlobal(
  'ResizeObserver',
  class {
    disconnect() {}
    observe() {}
    unobserve() {}
  },
);

let root: Root | undefined;
afterEach(() => {
  act(() => root?.unmount());
  root = undefined;
  document.body.replaceChildren();
});

let values: { quantity: number; rate: string } = { quantity: 1, rate: '' };

function Form() {
  const form = useAppForm({
    defaultValues: { quantity: 1, rate: '' },
    listeners: {
      onChange: ({ formApi }) => {
        values = formApi.state.values;
      },
    },
  });
  return (
    <>
      <form.AppField name="rate">
        {() => <DecimalTextField format={formatRate} label="Döviz kuru" />}
      </form.AppField>
      <form.AppField name="quantity">
        {(field) => <field.NumberField format={formatNumber} label="Miktar" />}
      </form.AppField>
    </>
  );
}

function mount() {
  const container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  act(() => root?.render(<Form />));
  return (name: string) => container.querySelector<HTMLInputElement>(`input[name="${name}"]`)!;
}

function type(input: HTMLInputElement, text: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  act(() => {
    setter.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

const blur = (input: HTMLInputElement) =>
  act(() => input.dispatchEvent(new FocusEvent('focusout', { bubbles: true })));

test('a negative rate stays in the field for the form to report', () => {
  const input = mount();
  type(input('rate'), '-5');
  expect(input('rate').value).toBe('-5');
  expect(values.rate).toBe('-5');
  blur(input('rate'));
  expect(input('rate').value).not.toBe('');
  expect(values.rate).toBe('-5');
});

test('a number left with more decimals than it shows stores what it shows', () => {
  const input = mount();
  type(input('quantity'), '0,33333');
  expect(values.quantity).toBe(0.33333);
  blur(input('quantity'));
  expect(input('quantity').value).toBe('0,3333');
  expect(values.quantity).toBe(0.3333);
});
