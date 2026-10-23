// TODO(lawyer): these terms are a plain-language draft, not reviewed. Before
// go-live a lawyer checks them against Turkish consumer law (6502 sayılı Kanun,
// mesafeli sözleşmeler, cayma hakkı) and Polar's merchant-of-record terms, and
// fills in the publisher's (Mert Düzgün) legal details and address.
import { createFileRoute } from '@tanstack/react-router';
import { LegalPage, LegalSection, Paragraph } from '../components/legal.tsx';
import { SITE_URL } from '../lib/canonical.ts';
import { m } from '../paraglide/messages.js';

const PAGE_URL = `${SITE_URL}/kosullar`;

export const Route = createFileRoute('/kosullar')({
  component: Terms,
  head: () => ({
    links: [{ href: PAGE_URL, rel: 'canonical' }],
    meta: [
      { title: m.terms_page_meta_title() },
      { content: m.terms_page_meta_description(), name: 'description' },
      { content: m.terms_page_meta_description(), property: 'og:description' },
      { content: m.terms_page_meta_title(), property: 'og:title' },
      { content: PAGE_URL, property: 'og:url' },
    ],
  }),
});

function Terms() {
  return (
    <LegalPage intro={m.terms_page_intro()} title={m.terms_page_title()}>
      <LegalSection title={m.terms_seller_title()}>
        <Paragraph>{m.terms_seller_body()}</Paragraph>
      </LegalSection>
      <LegalSection title={m.terms_subscription_title()}>
        <Paragraph>{m.terms_subscription_body()}</Paragraph>
      </LegalSection>
      <LegalSection title={m.terms_trial_title()}>
        <Paragraph>{m.terms_trial_body()}</Paragraph>
      </LegalSection>
      <LegalSection title={m.terms_cancel_title()}>
        <Paragraph>{m.terms_cancel_body()}</Paragraph>
      </LegalSection>
      <LegalSection title={m.terms_license_title()}>
        <Paragraph>{m.terms_license_body()}</Paragraph>
      </LegalSection>
      <LegalSection title={m.terms_use_title()}>
        <Paragraph>{m.terms_use_body()}</Paragraph>
      </LegalSection>
      <LegalSection title={m.terms_gib_title()}>
        <Paragraph>{m.terms_gib_body()}</Paragraph>
      </LegalSection>
      <LegalSection title={m.terms_liability_title()}>
        <Paragraph>{m.terms_liability_body()}</Paragraph>
      </LegalSection>
      <LegalSection title={m.terms_changes_title()}>
        <Paragraph>{m.terms_changes_body()}</Paragraph>
      </LegalSection>
      <LegalSection title={m.terms_law_title()}>
        <Paragraph>{m.terms_law_body()}</Paragraph>
      </LegalSection>
      <LegalSection title={m.terms_contact_title()}>
        <Paragraph>{m.terms_contact_body()}</Paragraph>
      </LegalSection>
    </LegalPage>
  );
}
