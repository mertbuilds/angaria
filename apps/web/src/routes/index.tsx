import { colors, font, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { createFileRoute, Link } from '@tanstack/react-router';
import { Check } from 'lucide-react';
import { AppHosts } from '../components/app-hosts.tsx';
import { CheckoutButton, DownloadButton } from '../components/cta.tsx';
import { WindowFrame } from '../components/window-frame.tsx';
import { SITE_URL } from '../lib/canonical.ts';
import { layout } from '../lib/layout.ts';
import { Sentence } from '../lib/slot.tsx';
import { m } from '../paraglide/messages.js';

/** The yearly price in lira, for the structured data. The page shows m.pricing_amount. */
const PRICE_TRY = 1499;

/** What search engines read about the app: a macOS business app with one offer. */
const structuredData = () => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  applicationCategory: 'BusinessApplication',
  description: m.meta_description(),
  inLanguage: 'tr',
  name: 'Angaria',
  offers: {
    '@type': 'Offer',
    price: String(PRICE_TRY),
    priceCurrency: 'TRY',
    url: `${SITE_URL}/#fiyat`,
  },
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
  check: {
    color: colors.fg,
    flexShrink: 0,
    height: 16,
    marginBlockStart: 4,
    width: 16,
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
  perk: {
    alignItems: 'flex-start',
    display: 'flex',
    gap: spacing.s2,
  },
  price: {
    alignItems: 'baseline',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  priceAmount: {
    fontSize: 36,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: font.weightMedium,
    letterSpacing: '-0.02em',
    lineHeight: 1.1,
  },
  pricing: {
    alignItems: 'flex-start',
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    padding: spacing.s6,
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
          <PainPoint body={m.compare_templates_body()} title={m.compare_templates_title()} />
          <PainPoint body={m.compare_repeat_body()} title={m.compare_repeat_title()} />
          <PainPoint body={m.compare_time_body()} title={m.compare_time_title()} />
        </ul>
      </section>

      <section aria-labelledby="ozellikler" {...props(layout.section)}>
        <h2 id="ozellikler" {...props(layout.heading)}>
          {m.features_title()}
        </h2>
        <dl {...props(styles.grid)}>
          <Feature body={m.feature_templates_body()} title={m.feature_templates_title()} />
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
        <div {...props(styles.pricing)}>
          <p {...props(layout.text, styles.price)}>
            <span {...props(styles.priceAmount)}>{m.pricing_amount()}</span>
            <span {...props(layout.muted)}>{m.pricing_period()}</span>
          </p>
          <ul {...props(layout.list)}>
            <Perk>{m.pricing_trial()}</Perk>
            <Perk>{m.pricing_cancel()}</Perk>
            <Perk>{m.pricing_devices()}</Perk>
          </ul>
          <CheckoutButton location="pricing" variant="default" />
          <p {...props(layout.text, layout.muted, layout.small)}>{m.pricing_note()}</p>
        </div>
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

function Perk({ children }: { children: string }) {
  return (
    <li {...props(styles.perk)}>
      <Check aria-hidden="true" {...props(styles.check)} />
      <span>{children}</span>
    </li>
  );
}
