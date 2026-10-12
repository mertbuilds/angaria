// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { clearMcpActivity, recordMcpActivity, type McpActivity } from '../src/lib/mcp.ts';
import { INPUT_PREVIEW_LINES, McpActivitySection } from '../src/pages/mcp-agent-sections.tsx';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

let root: Root | null = null;
let host: HTMLElement | null = null;

const entry = (id: string, extra: Partial<McpActivity> = {}): McpActivity => ({
  at: new Date(2026, 9, 12, 12, 0).toISOString(),
  company: 'Acme',
  id,
  ok: true,
  result: 'İmzalandı',
  summary: 'Faturaları onayla',
  tool: 'sign_invoices',
  ...extra,
});

const render = () => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(<McpActivitySection />));
  return host;
};

const buttonNamed = (name: string) =>
  [...(host?.querySelectorAll('button') ?? [])].find((button) => button.textContent === name);

beforeEach(() => {
  act(() => clearMcpActivity());
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

test('an entry saved before inputs were kept renders as before, with no Girdi', () => {
  recordMcpActivity(entry('old'));
  const page = render();
  expect(page.textContent).toContain('Acme · Faturaları onayla');
  expect(page.textContent).toContain('İmzalandı');
  expect(page.querySelector('details')).toBeNull();
  expect(page.querySelector('pre')).toBeNull();
});

test('an entry with input folds it under Girdi', () => {
  const input = JSON.stringify({ code: '••••••', operationId: 'op-1' }, null, 2);
  recordMcpActivity(entry('new', { input }));
  const page = render();
  const details = page.querySelector('details');
  expect(details?.open).toBe(false);
  expect(details?.querySelector('summary')?.textContent).toBe('Girdi');
  expect(details?.querySelector('pre')?.textContent).toBe(input);
  expect(page.textContent).not.toContain('123456');
});

test('a long input shows its first lines until Tümünü göster', () => {
  const lines = Array.from({ length: INPUT_PREVIEW_LINES + 8 }, (_, index) => `line ${index}`);
  recordMcpActivity(entry('long', { input: lines.join('\n') }));
  const page = render();
  const code = () => page.querySelector('pre')?.textContent ?? '';
  expect(code()).toContain(`line ${INPUT_PREVIEW_LINES - 1}`);
  expect(code()).not.toContain(`line ${INPUT_PREVIEW_LINES}`);
  act(() => buttonNamed('Tümünü göster')?.click());
  expect(code()).toBe(lines.join('\n'));
  act(() => buttonNamed('Daha az göster')?.click());
  expect(code()).not.toContain(`line ${INPUT_PREVIEW_LINES}`);
});
