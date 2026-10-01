import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { createFileRoute, Link } from '@tanstack/react-router';
import { AppHosts } from '../components/app-hosts.tsx';
import { CheckoutButton, DownloadButton } from '../components/cta.tsx';
import { PRICES_TRY, Pricing } from '../components/pricing.tsx';
import { WindowFrame } from '../components/window-frame.tsx';
import { SITE_URL } from '../lib/canonical.ts';
import type { Plan } from '../lib/config.ts';
import { layout } from '../lib/layout.ts';
import { Sentence } from '../lib/slot.tsx';
import { m } from '../paraglide/messages.js';

/** UN/CEFACT codes for the unit each plan's price is per. */
const BILLING_UNITS: Record<Plan, 'ANN' | 'MON'> = { monthly: 'MON', yearly: 'ANN' };

/** One plan as an offer: its price, billed once per year or month. */
const offer = (plan: Plan, name: string) => ({
  '@type': 'Offer',
  name,
  price: String(PRICES_TRY[plan]),
  priceCurrency: 'TRY',
  priceSpecification: {
    '@type': 'UnitPriceSpecification',
    billingIncrement: 1,
    price: PRICES_TRY[plan],
    priceCurrency: 'TRY',
    unitCode: BILLING_UNITS[plan],
  },
  url: `${SITE_URL}/#fiyat`,
});

/** What search engines read about the app: a macOS business app with a yearly and a monthly offer. */
const structuredData = () => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  applicationCategory: 'BusinessApplication',
  description: m.meta_description(),
  inLanguage: 'tr',
  name: 'Angaria',
  offers: [offer('yearly', m.pricing_yearly()), offer('monthly', m.pricing_monthly())],
  operatingSystem: 'macOS',
  publisher: { '@type': 'Organization', name: 'Vinena Studio', url: 'https://vinena.studio' },
  url: `${SITE_URL}/`,
});

export const Route = createFileRoute('/')({
  component: Landing,
  head: () => ({
    links: [{ href: `${SITE_URL}/`, rel: 'canonical' }],
    meta: [{ content: `${SITE_URL}/`, property: 'og:url' }],
    scripts: [{ children: JSON.stringify(structuredData()), type: 'application/ld+json' }],
  }),
});

const WIDE = '@media (min-width: 640px)';

const styles = create({
  actions: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s3,
  },
  caption: {
    color: colors.muted,
    fontSize: font.sizeSm,
  },
  figure: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    margin: 0,
  },
  grid: {
    columnGap: spacing.s8,
    display: 'grid',
    gridTemplateColumns: {
      default: '1fr',
      [WIDE]: '1fr 1fr',
    },
    margin: 0,
    rowGap: spacing.s6,
  },
  hero: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s6,
  },
  heroCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
  },
  item: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
    margin: 0,
  },
  lead: {
    fontSize: 17,
  },
  privacyLead: {
    fontSize: font.sizeLg,
    fontWeight: font.weightMedium,
    letterSpacing: '-0.01em',
    lineHeight: 1.4,
  },
  term: {
    fontWeight: font.weightMedium,
  },
});

function Landing() {
  return (
    <>
      <section {...props(styles.hero)}>
        <div {...props(styles.heroCopy)}>
          <h1 {...props(layout.title)}>{m.hero_title()}</h1>
          <p {...props(layout.text, styles.lead)}>{m.hero_lead()}</p>
          <div {...props(styles.actions)}>
            <DownloadButton location="hero" />
            <CheckoutButton location="hero" />
          </div>
          <p {...props(layout.text, layout.muted, layout.small)}>{m.hero_note()}</p>
        </div>
        {/* TODO(screenshot): replace with the real app screenshot, 16:10, a light and a
            dark variant (picture + prefers-color-scheme), and a Turkish alt text. */}
        <WindowFrame label={m.hero_screenshot()} />
      </section>

      <section aria-labelledby="karsilastirma" {...props(layout.section)}>
        <h2 id="karsilastirma" {...props(layout.heading)}>
          {m.compare_title()}
        </h2>
        <p {...props(layout.text, layout.muted)}>{m.compare_lead()}</p>
        {/* TODO(screenshot): Mert sends the GİB portal and Angaria screenshots of the
            same invoice; swap both frames for them. */}
        <div {...props(styles.grid)}>
          <figure {...props(styles.figure)}>
            <WindowFrame label={m.compare_placeholder()} />
            <figcaption {...props(styles.caption)}>{m.compare_gib()}</figcaption>
          </figure>
          <figure {...props(styles.figure)}>
            <WindowFrame label={m.compare_placeholder()} />
            <figcaption {...props(styles.caption)}>{m.compare_angaria()}</figcaption>
          </figure>
        </div>
        <ul {...props(layout.list)}>
          <PainPoint body={m.compare_saved_body()} title={m.compare_saved_title()} />
          <PainPoint body={m.compare_repeat_body()} title={m.compare_repeat_title()} />
          <PainPoint body={m.compare_time_body()} title={m.compare_time_title()} />
        </ul>
      </section>

      <section aria-labelledby="ozellikler" {...props(layout.section)}>
        <h2 id="ozellikler" {...props(layout.heading)}>
          {m.features_title()}
        </h2>
        <dl {...props(styles.grid)}>
          <Feature body={m.feature_start_body()} title={m.feature_start_title()} />
          <Feature body={m.feature_repeat_body()} title={m.feature_repeat_title()} />
          <Feature body={m.feature_customers_body()} title={m.feature_customers_title()} />
          <Feature body={m.feature_companies_body()} title={m.feature_companies_title()} />
          <Feature body={m.feature_pdf_body()} title={m.feature_pdf_title()} />
          <Feature body={m.feature_rates_body()} title={m.feature_rates_title()} />
        </dl>
      </section>

      <section aria-labelledby="gizlilik" {...props(layout.section)}>
        <h2 id="gizlilik" {...props(layout.heading)}>
          {m.privacy_title()}
        </h2>
        <p {...props(layout.text, styles.privacyLead)}>{m.privacy_lead()}</p>
        <p {...props(layout.text)}>{m.privacy_body()}</p>
        <p {...props(layout.text)}>{m.privacy_hosts()}</p>
        <AppHosts />
        <p {...props(layout.text, layout.muted, layout.small)}>
          <Sentence
            message={(link) => m.privacy_site_note({ link })}
            slot={<Link to="/gizlilik">{m.privacy_site_note_link()}</Link>}
          />
        </p>
      </section>

      <section aria-labelledby="fiyat" {...props(layout.section)}>
        <h2 id="fiyat" {...props(layout.heading)}>
          {m.pricing_title()}
        </h2>
        <Pricing />
      </section>

      <section aria-labelledby="sss" {...props(layout.section)}>
        <h2 id="sss" {...props(layout.heading)}>
          {m.faq_title()}
        </h2>
        <dl {...props(layout.list)}>
          <Feature body={m.faq_connect_a()} title={m.faq_connect_q()} />
          <Feature body={m.faq_audience_a()} title={m.faq_audience_q()} />
          <Feature body={m.faq_windows_a()} title={m.faq_windows_q()} />
          <Feature body={m.faq_data_a()} title={m.faq_data_q()} />
          <Feature body={m.faq_price_a()} title={m.faq_price_q()} />
          <Feature body={m.faq_cancel_a()} title={m.faq_cancel_q()} />
          <Feature body={m.faq_efatura_a()} title={m.faq_efatura_q()} />
        </dl>
      </section>
    </>
  );
}

function PainPoint({ body, title }: { body: string; title: string }) {
  return (
    <li {...props(styles.item)}>
      <span {...props(styles.term)}>{title}</span>
      <span {...props(layout.muted)}>{body}</span>
    </li>
  );
}

/** A term and its explanation: the features grid and the questions share it. */
function Feature({ body, title }: { body: string; title: string }) {
  return (
    <div {...props(styles.item)}>
      <dt {...props(styles.term)}>{title}</dt>
      <dd {...props(layout.text, layout.muted)}>{body}</dd>
    </div>
  );
}
