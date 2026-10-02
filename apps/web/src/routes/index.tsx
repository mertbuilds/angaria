import { colors, font, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, defaultMarker, props } from '@stylexjs/stylex';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { LinkHTMLAttributes, ReactNode } from 'react';
import { AppHosts } from '../components/app-hosts.tsx';
import { CompareSlider } from '../components/compare-slider.tsx';
import { Hero, HERO_SIZES } from '../components/hero.tsx';
import { PRICES_TRY, Pricing } from '../components/pricing.tsx';
import { Reveal, RevealSection } from '../components/reveal.tsx';
import { Screenshot, type Crop } from '../components/screenshot.tsx';
import { brand, reveal } from '../lib/brand.stylex.ts';
import { SITE_URL } from '../lib/canonical.ts';
import type { Plan } from '../lib/config.ts';
import { layout } from '../lib/layout.ts';
import { SCREENS, screenSources, type Screen } from '../lib/screens.ts';
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

/**
 * The hero screenshot is the largest paint: preload the export the <picture>
 * will pick, by the same color scheme test.
 */
const preloadScreen = (screen: Screen, sizes: string) =>
  (['light', 'dark'] as const).map((theme): LinkHTMLAttributes<HTMLLinkElement> => ({
    as: 'image',
    fetchPriority: 'high',
    href: screenSources(screen, theme).src,
    imageSizes: sizes,
    imageSrcSet: screenSources(screen, theme).srcSet,
    media:
      theme === 'dark'
        ? '(prefers-color-scheme: dark)'
        : 'not all and (prefers-color-scheme: dark)',
    rel: 'preload',
  }));

export const Route = createFileRoute('/')({
  component: Landing,
  head: () => ({
    links: [{ href: `${SITE_URL}/`, rel: 'canonical' }, ...preloadScreen(SCREENS.hero, HERO_SIZES)],
    meta: [{ content: `${SITE_URL}/`, property: 'og:url' }],
    scripts: [{ children: JSON.stringify(structuredData()), type: 'application/ld+json' }],
  }),
});

const WIDE = '@media (min-width: 640px)';
/** Where the gutter has room for a heading's marker to hang outside the column. */
const HANG = '@media (min-width: 800px)';
/** Where the wide blocks have room for three columns. */
const ROOMY = '@media (min-width: 960px)';
const HOVER = '@media (hover: hover)';

/**
 * How wide each screenshot is drawn, zoom included, for the browser's choice
 * of export: a card zooms its crop to about twice the card's width.
 */
const CARD_SIZES = '(min-width: 992px) 860px, (min-width: 640px) 90vw, 180vw';
const FEATURED_SIZES = '(min-width: 992px) 900px, (min-width: 640px) 95vw, 160vw';
const STEP_SIZES = '(min-width: 992px) 600px, 200vw';
const COMPARE_SIZES = '(min-width: 992px) 960px, calc(100vw - 32px)';

const styles = create({
  card: {
    backgroundColor: colors.bg,
    borderColor: {
      default: colors.border,
      [HOVER]: {
        ':hover': `color-mix(in oklab, ${brand.fill} 55%, ${colors.border})`,
        default: colors.border,
      },
    },
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    margin: 0,
    overflow: 'hidden',
    transitionDuration: '260ms',
    transitionProperty: 'border-color',
    transitionTimingFunction: reveal.ease,
  },
  cardBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
    padding: {
      default: spacing.s4,
      [WIDE]: spacing.s6,
    },
  },
  // The first feature leads across both columns, its screenshot beside the
  // words instead of above them.
  cardFeatured: {
    flexDirection: {
      default: 'column',
      [WIDE]: 'row',
    },
  },
  cardFeaturedBody: {
    justifyContent: 'center',
  },
  cardMedia: {
    borderBottomColor: colors.border,
    borderBottomStyle: 'solid',
    borderBottomWidth: 1,
  },
  cardMediaSide: {
    borderBottomWidth: {
      default: 1,
      [WIDE]: 0,
    },
    borderRightColor: colors.border,
    borderRightStyle: 'solid',
    borderRightWidth: {
      default: 0,
      [WIDE]: 1,
    },
    flexBasis: {
      default: null,
      [WIDE]: '58%',
    },
    flexShrink: 0,
  },
  cards: {
    display: 'grid',
    gap: spacing.s4,
    gridTemplateColumns: {
      default: '1fr',
      [WIDE]: '1fr 1fr',
    },
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  cardTitle: {
    fontSize: font.sizeMd,
    fontWeight: font.weightMedium,
    margin: 0,
  },
  // Across both columns: the leading feature and the one without a screenshot.
  cardWide: {
    gridColumn: {
      default: null,
      [WIDE]: '1 / -1',
    },
  },
  // Three across where there is room, one under another otherwise.
  columns: {
    display: 'grid',
    gap: {
      default: spacing.s6,
      [ROOMY]: spacing.s8,
    },
    gridTemplateColumns: {
      default: '1fr',
      [ROOMY]: 'repeat(3, 1fr)',
    },
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  // Hatched until Mert's screenshot of the GİB portal lands.
  gibPlaceholder: {
    backgroundColor: colors.bg,
    backgroundImage: `repeating-linear-gradient(135deg, ${colors.subtle} 0 8px, transparent 8px 16px)`,
    height: '100%',
  },
  heading: {
    '::before': {
      backgroundColor: brand.fill,
      borderRadius: 2,
      content: '',
      flexShrink: 0,
      height: 8,
      width: 8,
    },
    alignItems: 'center',
    display: 'flex',
    fontSize: 'clamp(22px, 3.2vw, 28px)',
    gap: spacing.s3,
    letterSpacing: '-0.02em',
    // The marker hangs in the gutter, so the words line up with the column.
    marginInlineStart: {
      default: null,
      [HANG]: `calc(-8px - ${spacing.s3})`,
    },
  },
  item: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
    margin: 0,
  },
  // A section's own lead under its heading.
  lead: {
    maxWidth: 600,
  },
  privacyLead: {
    fontSize: font.sizeLg,
    fontWeight: font.weightMedium,
    letterSpacing: '-0.01em',
    lineHeight: 1.4,
  },
  // More air between the landing's sections than the base page gap.
  section: {
    gap: {
      default: spacing.s4,
      [WIDE]: spacing.s6,
    },
    paddingBlockStart: {
      default: null,
      [WIDE]: spacing.s12,
    },
  },
  step: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
  },
  stepMedia: {
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: 1,
  },
  // Steps are a real sequence, so they carry their number.
  stepNumber: {
    alignItems: 'center',
    backgroundColor: brand.tint,
    borderRadius: radius.full,
    color: brand.ink,
    display: 'inline-flex',
    flexShrink: 0,
    fontSize: font.sizeSm,
    fontVariantNumeric: 'tabular-nums',
    fontWeight: font.weightMedium,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  stepTitle: {
    alignItems: 'center',
    display: 'flex',
    fontSize: font.sizeMd,
    fontWeight: font.weightMedium,
    gap: spacing.s2,
    margin: 0,
  },
  term: {
    fontWeight: font.weightMedium,
  },
  // Up to 960px, wider than the 720px column, keeping the 16px gutter.
  wide: {
    marginInline: 'calc(50% - min(50vw - 16px, 480px))',
  },
});

function Landing() {
  return (
    <>
      <Hero />

      <RevealSection aria-labelledby="karsilastirma" style={[layout.section, styles.section]}>
        <Reveal index={0}>
          <SectionHeading id="karsilastirma">{m.compare_title()}</SectionHeading>
        </Reveal>
        <Reveal index={1}>
          <p {...props(layout.text, layout.muted, styles.lead)}>{m.compare_lead()}</p>
        </Reveal>
        {/* TODO(screenshot): Mert sends the GİB portal screenshot of the same
            invoice; it replaces the GİB placeholder. */}
        <Reveal index={2} style={styles.wide}>
          <CompareSlider
            after={<Screenshot screen={SCREENS.compare} sizes={COMPARE_SIZES} />}
            afterLabel={m.compare_angaria()}
            before={<div {...props(styles.gibPlaceholder)} />}
            beforeLabel={m.compare_gib()}
          />
        </Reveal>
        <ul {...props(styles.columns, styles.wide)}>
          <PainPoint body={m.compare_saved_body()} index={3} title={m.compare_saved_title()} />
          <PainPoint body={m.compare_repeat_body()} index={4} title={m.compare_repeat_title()} />
          <PainPoint body={m.compare_time_body()} index={5} title={m.compare_time_title()} />
        </ul>
      </RevealSection>

      <RevealSection aria-labelledby="nasil" style={[layout.section, styles.section]}>
        <Reveal index={0}>
          <SectionHeading id="nasil">{m.steps_title()}</SectionHeading>
        </Reveal>
        <ol {...props(styles.columns, styles.wide)}>
          <Step
            body={m.step_install_body()}
            crop={{ x: 50, y: 50, zoom: 2.4 }}
            index={1}
            screen={SCREENS.license}
            title={m.step_install_title()}
          />
          <Step
            body={m.step_login_body()}
            crop={{ x: 27, y: 0, zoom: 1.8 }}
            index={2}
            screen={SCREENS.invoices}
            title={m.step_login_title()}
          />
          <Step
            body={m.step_sign_body()}
            crop={{ x: 50, y: 50, zoom: 2 }}
            index={3}
            screen={SCREENS.sign}
            title={m.step_sign_title()}
          />
        </ol>
      </RevealSection>

      <RevealSection aria-labelledby="ozellikler" style={[layout.section, styles.section]}>
        <Reveal index={0}>
          <SectionHeading id="ozellikler">{m.features_title()}</SectionHeading>
        </Reveal>
        <ul {...props(styles.cards, styles.wide)}>
          <FeatureCard
            body={m.feature_start_body()}
            crop={{ x: 60, y: 18, zoom: 1.6 }}
            featured
            index={1}
            screen={SCREENS.start}
            title={m.feature_start_title()}
          />
          <FeatureCard
            body={m.feature_repeat_body()}
            crop={{ x: 50, y: 38, zoom: 1.8 }}
            index={2}
            screen={SCREENS.palette}
            title={m.feature_repeat_title()}
          />
          <FeatureCard
            body={m.feature_customers_body()}
            crop={{ x: 74, y: 100, zoom: 1.8 }}
            index={3}
            screen={SCREENS.customers}
            title={m.feature_customers_title()}
          />
          <FeatureCard
            body={m.feature_pdf_body()}
            crop={{ x: 50, y: 0, zoom: 1 }}
            index={4}
            screen={SCREENS.pdf}
            title={m.feature_pdf_title()}
          />
          <FeatureCard
            body={m.feature_rates_body()}
            crop={{ x: 40, y: 26, zoom: 1.8 }}
            index={5}
            screen={SCREENS.rates}
            title={m.feature_rates_title()}
          />
          <FeatureCard
            body={m.feature_companies_body()}
            index={6}
            title={m.feature_companies_title()}
          />
        </ul>
      </RevealSection>

      <RevealSection aria-labelledby="gizlilik" style={[layout.section, styles.section]}>
        <Reveal index={0}>
          <SectionHeading id="gizlilik">{m.privacy_title()}</SectionHeading>
        </Reveal>
        <Reveal index={1}>
          <p {...props(layout.text, styles.privacyLead)}>{m.privacy_lead()}</p>
        </Reveal>
        <Reveal index={2}>
          <p {...props(layout.text)}>{m.privacy_body()}</p>
        </Reveal>
        <Reveal index={3}>
          <p {...props(layout.text)}>{m.privacy_hosts()}</p>
        </Reveal>
        <Reveal index={4}>
          <AppHosts />
        </Reveal>
        <Reveal index={5}>
          <p {...props(layout.text, layout.muted, layout.small)}>
            <Sentence
              message={(link) => m.privacy_site_note({ link })}
              slot={<Link to="/gizlilik">{m.privacy_site_note_link()}</Link>}
            />
          </p>
        </Reveal>
      </RevealSection>

      <RevealSection aria-labelledby="fiyat" style={[layout.section, styles.section]}>
        <Reveal index={0}>
          <SectionHeading id="fiyat">{m.pricing_title()}</SectionHeading>
        </Reveal>
        <Reveal index={1}>
          <Pricing />
        </Reveal>
      </RevealSection>

      <RevealSection aria-labelledby="sss" style={[layout.section, styles.section]}>
        <Reveal index={0}>
          <SectionHeading id="sss">{m.faq_title()}</SectionHeading>
        </Reveal>
        <dl {...props(layout.list)}>
          <Question body={m.faq_connect_a()} index={1} title={m.faq_connect_q()} />
          <Question body={m.faq_audience_a()} index={2} title={m.faq_audience_q()} />
          <Question body={m.faq_windows_a()} index={3} title={m.faq_windows_q()} />
          <Question body={m.faq_data_a()} index={4} title={m.faq_data_q()} />
          <Question body={m.faq_price_a()} index={5} title={m.faq_price_q()} />
          <Question body={m.faq_cancel_a()} index={6} title={m.faq_cancel_q()} />
          <Question body={m.faq_efatura_a()} index={7} title={m.faq_efatura_q()} />
        </dl>
      </RevealSection>
    </>
  );
}

/** A section's title, led by the blue square the page repeats as its marker. */
function SectionHeading({ children, id }: { children: ReactNode; id: string }) {
  return (
    <h2 id={id} {...props(layout.heading, styles.heading)}>
      {children}
    </h2>
  );
}

function PainPoint({ body, index, title }: { body: string; index: number; title: string }) {
  return (
    <Reveal as="li" index={index} style={styles.item}>
      <span {...props(styles.term)}>{title}</span>
      <span {...props(layout.muted)}>{body}</span>
    </Reveal>
  );
}

function Step({
  body,
  crop,
  index,
  screen,
  title,
}: {
  body: string;
  crop: Crop;
  index: number;
  screen: Screen;
  title: string;
}) {
  return (
    <Reveal as="li" index={index} style={styles.step}>
      <Screenshot crop={crop} screen={screen} sizes={STEP_SIZES} style={styles.stepMedia} />
      <div {...props(styles.item)}>
        <h3 {...props(styles.stepTitle)}>
          <span {...props(styles.stepNumber)}>{index}</span>
          {title}
        </h3>
        <p {...props(layout.text, layout.muted)}>{body}</p>
      </div>
    </Reveal>
  );
}

function FeatureCard({
  body,
  crop,
  featured = false,
  index,
  screen,
  title,
}: {
  body: string;
  crop?: Crop;
  featured?: boolean;
  index: number;
  screen?: Screen;
  title: string;
}) {
  return (
    <Reveal as="li" index={index} style={featured || !screen ? styles.cardWide : undefined}>
      <article {...props(styles.card, featured && styles.cardFeatured, defaultMarker())}>
        {screen ? (
          <Screenshot
            crop={crop}
            screen={screen}
            sizes={featured ? FEATURED_SIZES : CARD_SIZES}
            style={[styles.cardMedia, featured && styles.cardMediaSide]}
          />
        ) : null}
        <div {...props(styles.cardBody, featured && styles.cardFeaturedBody)}>
          <h3 {...props(styles.cardTitle)}>{title}</h3>
          <p {...props(layout.text, layout.muted)}>{body}</p>
        </div>
      </article>
    </Reveal>
  );
}

/** A question and its answer. */
function Question({ body, index, title }: { body: string; index: number; title: string }) {
  return (
    <Reveal index={index} style={styles.item}>
      <dt {...props(styles.term)}>{title}</dt>
      <dd {...props(layout.text, layout.muted)}>{body}</dd>
    </Reveal>
  );
}
