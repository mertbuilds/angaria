import { SourceLink, toast } from '@angaria/ui';
import { openUrl } from '@tauri-apps/plugin-opener';
import type { ReactNode } from 'react';
import { INVOICE_WINDOW_RULE, ISTISNA_VAT_RULE } from './invoice-form.ts';
import { RULE_SOURCES, type RuleMessage } from './rule-sources.ts';

function openRuleSource(url: string) {
  openUrl(url).catch(() => toast.error('Sayfa tarayıcıda açılamadı. Tekrar dene.'));
}

/** A rule message, its citing words linked to the official text. */
export function RuleText({ message }: { message: RuleMessage }) {
  return message.parts.map((part) =>
    typeof part === 'string' ? (
      part
    ) : (
      <SourceLink
        href={RULE_SOURCES[part.rule].url}
        key={part.text}
        label={RULE_SOURCES[part.rule].label}
        onOpen={openRuleSource}
      >
        {part.text}
      </SourceLink>
    ),
  );
}

// invoiceWarnings' and validateInvoice's messages that cite a rule, by their text.
const RULE_MESSAGES: ReadonlyMap<string, RuleMessage> = new Map(
  [INVOICE_WINDOW_RULE, ISTISNA_VAT_RULE].map((message) => [message.text, message]),
);

/** The rule message with this text, else undefined. */
export const findRuleMessage = (message: ReactNode) =>
  typeof message === 'string' ? RULE_MESSAGES.get(message) : undefined;

/** A warning or error as it reads, its citing words linked when it cites a rule. */
export function MessageText({ children }: { children: ReactNode }) {
  const message = findRuleMessage(children);
  return message ? <RuleText message={message} /> : children;
}
