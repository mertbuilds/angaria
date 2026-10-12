// @vitest-environment jsdom
import { FieldError, FieldWarning } from '@angaria/ui';
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import capabilities from '../src-tauri/capabilities/default.json';
import { INVOICE_WINDOW_WARNING, ISTISNA_VAT_ERROR } from '../src/lib/invoice-form.ts';
import { RULE_SOURCE_HOSTS, RULE_SOURCES } from '../src/lib/rule-sources.ts';
import { findRuleMessage, MessageText } from '../src/lib/rule-text.tsx';

const opener = vi.hoisted(() => ({ openUrl: vi.fn(async (_url: string) => {}) }));
vi.mock('@tauri-apps/plugin-opener', () => opener);

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

/** The official sites a rule may cite, as the hosts their pages live on. */
const OFFICIAL_HOSTS = [
  'www.gib.gov.tr',
  'www.mevzuat.gov.tr',
  'www.resmigazete.gov.tr',
  'www.tcmb.gov.tr',
];

let root: Root | null = null;
let host: HTMLElement | null = null;

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  opener.openUrl.mockClear();
});

const openURLs = () => {
  const permission = capabilities.permissions.find(
    (entry) => typeof entry === 'object' && entry.identifier === 'opener:allow-open-url',
  );
  return typeof permission === 'object'
    ? permission.allow.flatMap((entry) => ('url' in entry ? [entry.url] : []))
    : [];
};

test('every rule source is an https page on an allowed official host, verified on a date', () => {
  expect(RULE_SOURCE_HOSTS.every((name) => OFFICIAL_HOSTS.includes(name))).toBe(true);
  for (const source of Object.values(RULE_SOURCES)) {
    const url = new URL(source.url);
    expect(url.protocol).toBe('https:');
    expect(RULE_SOURCE_HOSTS).toContain(url.hostname);
    expect(source.label).not.toBe('');
    expect(source.verifiedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  }
});

test('the opener may open exactly the rule hosts besides the site and the source code', () => {
  const official = openURLs().filter((url) => url.includes('.gov.tr'));
  expect(official.toSorted()).toEqual(
    RULE_SOURCE_HOSTS.map((name) => `https://${name}/*`).toSorted(),
  );
  // Hakkında's source code link, the AGPL's source offer.
  expect(openURLs()).toContain('https://github.com/vinenastudio/angaria');
  // Exact hosts: no wildcard subdomain, no plain http.
  expect(openURLs().every((url) => url.startsWith('https://') && !url.includes('*.'))).toBe(true);
  const used = new Set(Object.values(RULE_SOURCES).map(({ url }) => new URL(url).hostname));
  expect([...used].toSorted()).toEqual([...RULE_SOURCE_HOSTS].toSorted());
});

/** A message's citing words, each with the full name of its rule. */
const cited = (message: string) =>
  findRuleMessage(message)?.parts.flatMap((part) =>
    typeof part === 'string' ? [] : [[part.text, RULE_SOURCES[part.rule].label]],
  );

test('the rule messages cite their sources, other messages none', () => {
  expect(cited(INVOICE_WINDOW_WARNING)).toEqual([['VUK 231/5', 'VUK md. 231/5']]);
  expect(cited(ISTISNA_VAT_ERROR)).toEqual([['KDV Kanunu 11/1-a', 'KDV Kanunu md. 11/1-a']]);
  expect(findRuleMessage('Hizmet adını yaz')).toBeUndefined();
  // Not cited until verified against the official text: see the rule-sources table.
  expect(
    findRuleMessage('%0 KDV için fatura tipi İstisna olmalı ya da KDV oranını seç.'),
  ).toBeUndefined();
});

test('a warning links the words that cite its rule and opens them in the system browser', () => {
  act(() =>
    root?.render(
      <FieldWarning>
        <MessageText>{INVOICE_WINDOW_WARNING}</MessageText>
      </FieldWarning>,
    ),
  );
  expect(host?.textContent).toBe(INVOICE_WINDOW_WARNING);
  const link = host?.querySelector('a');
  expect(link?.textContent).toBe('VUK 231/5');
  expect(link?.getAttribute('aria-label')).toBe('VUK 231/5 (VUK md. 231/5), resmî metni aç');
  expect(link?.getAttribute('href')).toBe(RULE_SOURCES.invoiceWindow.url);

  const click = new MouseEvent('click', { bubbles: true, cancelable: true });
  act(() => link?.dispatchEvent(click));
  expect(click.defaultPrevented).toBe(true);
  expect(opener.openUrl).toHaveBeenCalledWith(RULE_SOURCES.invoiceWindow.url);
});

test('an error that cites a rule links its words; another error has no link', () => {
  act(() =>
    root?.render(
      <>
        <FieldError>
          <MessageText>{ISTISNA_VAT_ERROR}</MessageText>
        </FieldError>
        <FieldError>
          <MessageText>Hizmet adını yaz</MessageText>
        </FieldError>
      </>,
    ),
  );
  const links = host?.querySelectorAll('a') ?? [];
  expect(links).toHaveLength(1);
  expect(links[0]?.textContent).toBe('KDV Kanunu 11/1-a');
  // A real link: reachable by Tab and opened by Enter.
  expect(links[0]?.tabIndex).toBe(0);
});
