import { toast, type FieldSourceProps } from '@angaria/ui';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { ReactNode } from 'react';
import { INVOICE_WINDOW_WARNING, ISTISNA_VAT_ERROR } from './invoice-form.ts';

// The official texts Yeni fatura's rules come from, each read against the rule
// on `verifiedAt`. A message that cites a rule shows its source as a Kaynak link,
// opened in the system browser. Only these hosts are in the opener's scope
// (src-tauri/capabilities/default.json).

export interface RuleSource {
  /** Short name of the rule, shown on the link. */
  label: string;
  url: string;
  /** When the rule was last read against the official text, YYYY-MM-DD. */
  verifiedAt: string;
}

export const RULE_SOURCES = {
  /** Fatura, hizmetten sonra en geç yedi gün içinde. */
  invoiceWindow: {
    label: 'VUK md. 231/5',
    url: 'https://www.gib.gov.tr/mevzuat/kanun/434',
    verifiedAt: '2026-10-10',
  },
  /** Mal ve hizmet ihracatı KDV'den müstesna: 301 and 302, and a 0% rate. */
  exportExemption: {
    label: 'KDV Kanunu md. 11/1-a',
    url: 'https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=3065&MevzuatTur=1&MevzuatTertip=5',
    verifiedAt: '2026-10-10',
  },
  /** Döviz, vergiyi doğuran olay günkü Resmî Gazete'deki TCMB döviz alış kuruyla çevrilir. */
  exchangeRate: {
    label: 'KDV Genel Uygulama Tebliği III/A-1.1',
    url: 'https://www.mevzuat.gov.tr/mevzuat?MevzuatNo=19631&MevzuatTur=9&MevzuatTertip=5',
    verifiedAt: '2026-10-10',
  },
  /** e-Arşiv'de gerçek numara gerekmeyen alıcıya TCKN 11111111111, VKN 2222222222. */
  placeholderIDs: {
    label: 'GİB özelgesi, 04.05.2023',
    url: 'https://www.gib.gov.tr/mevzuat/kanun/434/ozelge/25748',
    verifiedAt: '2026-10-10',
  },
} as const satisfies Record<string, RuleSource>;

export type RuleSourceID = keyof typeof RULE_SOURCES;

/** The hosts a rule source may link to, exactly, no subdomains. */
export const RULE_SOURCE_HOSTS: ReadonlyArray<string> = ['www.gib.gov.tr', 'www.mevzuat.gov.tr'];

function openRuleSource(url: string) {
  openUrl(url).catch(() => toast.error('Sayfa tarayıcıda açılamadı. Tekrar dene.'));
}

/** A rule's source as a FieldWarning, FieldError or FieldSource takes it. */
export function ruleSourceLink(id: RuleSourceID): FieldSourceProps {
  const { label, url } = RULE_SOURCES[id];
  return { href: url, label, onOpen: openRuleSource };
}

// invoiceWarnings' and validateInvoice's messages that cite a rule.
const MESSAGE_SOURCES: ReadonlyMap<string, RuleSourceID> = new Map([
  [INVOICE_WINDOW_WARNING, 'invoiceWindow'],
  [ISTISNA_VAT_ERROR, 'exportExemption'],
]);

/** The source of a warning or error that cites a rule, else undefined. */
export function messageSource(message: ReactNode): FieldSourceProps | undefined {
  const id = typeof message === 'string' ? MESSAGE_SOURCES.get(message) : undefined;
  return id && ruleSourceLink(id);
}
