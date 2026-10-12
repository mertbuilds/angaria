import { colors, font, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, defaultMarker, props } from '@stylexjs/stylex';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { LinkHTMLAttributes, ReactNode } from 'react';
import { AppHosts } from '../components/app-hosts.tsx';
import { CompareSlider } from '../components/compare-slider.tsx';
import { FreeCard } from '../components/free-card.tsx';
import { Hero, HERO_SIZES } from '../components/hero.tsx';
import { Reveal, RevealSection } from '../components/reveal.tsx';
import { Screenshot, type Crop } from '../components/screenshot.tsx';
import { SectionHeading } from '../components/section-heading.tsx';
import { ConnectScene, InstallScene, SignScene } from '../components/step-scenes.tsx';
import { brand, reveal } from '../lib/brand.stylex.ts';
import { SITE_URL } from '../lib/canonical.ts';
import { LICENSE_URL, SOURCE_URL } from '../lib/config.ts';
import { layout } from '../lib/layout.ts';
import { SCREENS, screenSources, type Screen } from '../lib/screens.ts';
import { Sentence } from '../lib/slot.tsx';
import { m } from '../paraglide/messages.js';

/** What search engines read about the app: a free, open source macOS business app. */
const structuredData = () => ({
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  applicationCategory: 'BusinessApplication',
  description: m.meta_app_description(),
  inLanguage: 'tr',
  license: LICENSE_URL,
  name: 'Angaria',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'TRY' },
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
/** Where the wide blocks have room for three columns. */
const ROOMY = '@media (min-width: 960px)';
const HOVER = '@media (hover: hover)';

/**
 * How wide each screenshot is drawn, zoom included, for the browser's choice
 * of export: a card zooms its crop to about twice the card's width.
 */
const CARD_SIZES = '(min-width: 992px) 860px, (min-width: 640px) 90vw, 180vw';
const FEATURED_SIZES = '(min-width: 992px) 900px, (min-width: 640px) 95vw, 160vw';
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
  // Under a centered heading, the lead centers with it.
  leadCentered: {
    textAlign: 'center',
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
  // A step's scene above its words, in the features' card frame without the
  // hover: nothing here is a link.
  stepCard: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    overflow: 'hidden',
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
        <Reveal index={2} style={styles.wide}>
          <CompareSlider
            after={<Screenshot screen={SCREENS.compare} sizes={COMPARE_SIZES} />}
            afterLabel={m.compare_angaria()}
            before={<Screenshot screen={SCREENS.gib} sizes={COMPARE_SIZES} />}
            beforeLabel={m.compare_gib()}
          />
        </Reveal>
        <ul {...props(styles.columns, styles.wide)}>
          <PainPoint body={m.compare_saved_body()} index={3} title={m.compare_saved_title()} />
          <PainPoint body={m.compare_repeat_body()} index={4} title={m.compare_repeat_title()} />
          <PainPoint body={m.compare_sign_body()} index={5} title={m.compare_sign_title()} />
        </ul>
      </RevealSection>

      <RevealSection aria-labelledby="nasil" style={[layout.section, styles.section]}>
        <Reveal index={0}>
          <SectionHeading id="nasil">{m.steps_title()}</SectionHeading>
        </Reveal>
        <ol {...props(styles.columns, styles.wide)}>
          <Step
            body={m.step_install_body()}
            index={1}
            scene={<InstallScene />}
            title={m.step_install_title()}
          />
          <Step
            body={m.step_login_body()}
            index={2}
            scene={<ConnectScene />}
            title={m.step_login_title()}
          />
          <Step
            body={m.step_sign_body()}
            index={3}
            scene={<SignScene />}
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
          <p {...props(layout.text)}>
            <Sentence
              message={(link) => m.privacy_source({ link })}
              slot={<a href={SOURCE_URL}>{m.privacy_source_link()}</a>}
            />
          </p>
        </Reveal>
        <Reveal index={6}>
          <p {...props(layout.text, layout.muted, layout.small)}>
            <Sentence
              message={(link) => m.privacy_site_note({ link })}
              slot={<Link to="/gizlilik">{m.privacy_site_note_link()}</Link>}
            />
          </p>
        </Reveal>
      </RevealSection>

      <RevealSection aria-labelledby="ucretsiz" style={[layout.section, styles.section]}>
        <Reveal index={0}>
          <SectionHeading centered id="ucretsiz">
            {m.free_title()}
          </SectionHeading>
        </Reveal>
        <Reveal index={1}>
          <p {...props(layout.text, styles.leadCentered)}>{m.free_lead()}</p>
        </Reveal>
        <Reveal index={2}>
          <FreeCard />
        </Reveal>
      </RevealSection>

      <RevealSection aria-labelledby="sss" style={[layout.section, styles.section]}>
        <Reveal index={0}>
          <SectionHeading id="sss">{m.faq_title()}</SectionHeading>
        </Reveal>
        <dl {...props(layout.list)}>
          <Question body={m.faq_audience_a()} index={1} title={m.faq_audience_q()} />
          <Question body={m.faq_not_for_a()} index={2} title={m.faq_not_for_q()} />
          <Question body={m.faq_efatura_a()} index={3} title={m.faq_efatura_q()} />
          <Question body={m.faq_connect_a()} index={4} title={m.faq_connect_q()} />
          <Question body={m.faq_data_a()} index={5} title={m.faq_data_q()} />
          <Question body={m.faq_foreign_a()} index={6} title={m.faq_foreign_q()} />
          <Question body={m.faq_pdf_a()} index={7} title={m.faq_pdf_q()} />
          <Question body={m.faq_accountant_a()} index={8} title={m.faq_accountant_q()} />
          <Question body={m.faq_free_a()} index={9} title={m.faq_free_q()} />
          <Question body={m.faq_source_a()} index={10} title={m.faq_source_q()} />
          <Question body={m.faq_windows_a()} index={11} title={m.faq_windows_q()} />
        </dl>
      </RevealSection>
    </>
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

/** One step: its looping scene above the words that say what it shows. */
function Step({
  body,
  index,
  scene,
  title,
}: {
  body: string;
  index: number;
  scene: ReactNode;
  title: string;
}) {
  return (
    <Reveal as="li" index={index}>
      <article {...props(styles.stepCard)}>
        {scene}
        <div {...props(styles.cardBody)}>
          <h3 {...props(styles.stepTitle)}>
            <span {...props(styles.stepNumber)}>{index}</span>
            {title}
          </h3>
          <p {...props(layout.text, layout.muted)}>{body}</p>
        </div>
      </article>
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
