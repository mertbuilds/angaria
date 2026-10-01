// TODO(lawyer): this privacy policy is a plain-language draft, not reviewed.
// Before go-live a lawyer checks it against KVKK (aydınlatma metni, açık rıza
// for the analytics, yurt dışına aktarım under the 2024 amendment to article 9),
// and fills in the controller's legal name, address and MERSİS/VKN.
import { createFileRoute } from '@tanstack/react-router';
import { AppHosts } from '../components/app-hosts.tsx';
import { LegalPage, LegalSection, Paragraph } from '../components/legal.tsx';
import { SITE_URL } from '../lib/canonical.ts';
import { m } from '../paraglide/messages.js';

const PAGE_URL = `${SITE_URL}/gizlilik`;

export const Route = createFileRoute('/gizlilik')({
  component: PrivacyPolicy,
  head: () => ({
    links: [{ href: PAGE_URL, rel: 'canonical' }],
    meta: [
      { title: m.privacy_page_meta_title() },
      { content: m.privacy_page_meta_description(), name: 'description' },
      { content: m.privacy_page_meta_description(), property: 'og:description' },
      { content: m.privacy_page_meta_title(), property: 'og:title' },
      { content: PAGE_URL, property: 'og:url' },
    ],
  }),
});

function PrivacyPolicy() {
  return (
    <LegalPage intro={m.privacy_page_intro()} title={m.privacy_page_title()}>
      <LegalSection title={m.privacy_page_controller_title()}>
        <Paragraph>{m.privacy_page_controller_body()}</Paragraph>
      </LegalSection>
      <LegalSection title={m.privacy_page_app_title()}>
        <Paragraph>{m.privacy_page_app_body()}</Paragraph>
        <Paragraph>{m.privacy_hosts()}</Paragraph>
        <AppHosts />
        <Paragraph>{m.privacy_page_app_gib()}</Paragraph>
        <Paragraph>{m.privacy_page_app_tcmb()}</Paragraph>
        <Paragraph>{m.privacy_page_app_polar()}</Paragraph>
        <Paragraph>{m.privacy_page_app_updates()}</Paragraph>
      </LegalSection>
      <LegalSection title={m.privacy_page_site_title()}>
        <Paragraph>{m.privacy_page_site_body()}</Paragraph>
        <Paragraph>{m.privacy_page_site_storage()}</Paragraph>
        <Paragraph>{m.privacy_page_site_hosting()}</Paragraph>
      </LegalSection>
      <LegalSection title={m.privacy_page_payment_title()}>
        <Paragraph>{m.privacy_page_payment_body()}</Paragraph>
        <Paragraph>{m.privacy_page_payment_shared()}</Paragraph>
      </LegalSection>
      <LegalSection title={m.privacy_page_email_title()}>
        <Paragraph>{m.privacy_page_email_body()}</Paragraph>
      </LegalSection>
      <LegalSection title={m.privacy_page_transfer_title()}>
        <Paragraph>{m.privacy_page_transfer_body()}</Paragraph>
      </LegalSection>
      <LegalSection title={m.privacy_page_retention_title()}>
        <Paragraph>{m.privacy_page_retention_body()}</Paragraph>
      </LegalSection>
      <LegalSection title={m.privacy_page_rights_title()}>
        <Paragraph>{m.privacy_page_rights_body()}</Paragraph>
      </LegalSection>
      <LegalSection title={m.privacy_page_changes_title()}>
        <Paragraph>{m.privacy_page_changes_body()}</Paragraph>
      </LegalSection>
    </LegalPage>
  );
}
