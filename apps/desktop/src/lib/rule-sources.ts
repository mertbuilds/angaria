// The official texts Yeni fatura's rules come from, each read against the rule
// on `verifiedAt`. A message that cites a rule marks the words that cite it,
// and those words link to the official text, opened in the system browser
// (src/lib/rule-text.tsx). Only these hosts are in the opener's scope
// (src-tauri/capabilities/default.json).

export interface RuleSource {
  /** Full name of the rule, in the link's accessible name. */
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

/** The words of a message that cite `rule`. */
export interface RuleCitation {
  rule: RuleSourceID;
  text: string;
}

/** A message whose citing words link to the rule's official text. */
export interface RuleMessage {
  parts: ReadonlyArray<RuleCitation | string>;
  /** The plain text, as validators, warnings and MCP tools carry it. */
  text: string;
}

/** Marks `text` as the words that cite `rule`. */
export const cite = (rule: RuleSourceID, text: string): RuleCitation => ({ rule, text });

/** A message from plain text and citations, in reading order. */
export function ruleMessage(...parts: Array<RuleCitation | string>): RuleMessage {
  return {
    parts,
    text: parts.map((part) => (typeof part === 'string' ? part : part.text)).join(''),
  };
}
