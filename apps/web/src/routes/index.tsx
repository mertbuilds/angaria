import { Accordion, AccordionItem, AccordionPanel, AccordionTrigger } from '@angaria/ui';
import { colors, font, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { Laptop, MessagesSquare, MousePointerClick, PanelTop, type LucideIcon } from 'lucide-react';
import type { LinkHTMLAttributes, ReactNode } from 'react';
import { AppHosts } from '../components/app-hosts.tsx';
import { CompareSlider } from '../components/compare-slider.tsx';
import { CyclingWord } from '../components/cycling-word.tsx';
import {
  CompaniesScene,
  CustomersScene,
  PdfScene,
  RatesScene,
  RepeatScene,
  RulesScene,
  StartScene,
} from '../components/feature-scenes.tsx';
import { FreeCard } from '../components/free-card.tsx';
import { Hero, HERO_SIZES } from '../components/hero.tsx';
import { McpScene } from '../components/mcp-scene.tsx';
import { Reveal, RevealSection } from '../components/reveal.tsx';
import { Sequence } from '../components/scene.tsx';
import { Screenshot } from '../components/screenshot.tsx';
import { SectionHeading } from '../components/section-heading.tsx';
import { ConnectScene, InstallScene, SignScene } from '../components/step-scenes.tsx';
import { brand } from '../lib/brand.stylex.ts';
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
  author: { '@type': 'Person', name: 'Mert Düzgün', url: 'https://mertbuilds.com' },
  description: m.meta_app_description(),
  inLanguage: 'tr',
  license: LICENSE_URL,
  name: 'Angaria',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'TRY' },
  operatingSystem: 'macOS',
  url: `${SITE_URL}/`,
});

/** The questions SSS answers, in its order. */
const QUESTIONS = [
  [m.faq_audience_q, m.faq_audience_a],
  [m.faq_not_for_q, m.faq_not_for_a],
  [m.faq_efatura_q, m.faq_efatura_a],
  [m.faq_connect_q, m.faq_connect_a],
  [m.faq_data_q, m.faq_data_a],
  [m.faq_foreign_q, m.faq_foreign_a],
  [m.faq_pdf_q, m.faq_pdf_a],
  [m.faq_accountant_q, m.faq_accountant_a],
  [m.faq_free_q, m.faq_free_a],
  [m.faq_source_q, m.faq_source_a],
  [m.faq_windows_q, m.faq_windows_a],
] as const;

/** SSS for search engines, the same questions and answers the page shows. */
const faqData = () => ({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  inLanguage: 'tr',
  mainEntity: QUESTIONS.map(([question, answer]) => ({
    '@type': 'Question',
    acceptedAnswer: { '@type': 'Answer', text: answer() },
    name: question(),
  })),
});

/** What the MCP section says about the built-in MCP server, each with its icon. */
const MCP_POINTS: ReadonlyArray<{ body: () => string; icon: LucideIcon; title: () => string }> = [
  { body: m.mcp_point_ask_body, icon: MessagesSquare, title: m.mcp_point_ask_title },
  { body: m.mcp_point_background_body, icon: PanelTop, title: m.mcp_point_background_title },
  { body: m.mcp_point_setup_body, icon: MousePointerClick, title: m.mcp_point_setup_title },
  { body: m.mcp_point_local_body, icon: Laptop, title: m.mcp_point_local_title },
];

/** The apps the MCP heading names in turn, each with its own suffix. */
const MCP_APPS = [m.mcp_app_claude, m.mcp_app_codex, m.mcp_app_cursor] as const;

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
    scripts: [
      { children: JSON.stringify(structuredData()), type: 'application/ld+json' },
      { children: JSON.stringify(faqData()), type: 'application/ld+json' },
    ],
  }),
});

const WIDE = '@media (min-width: 640px)';
/** Where the wide blocks have room for three columns. */
const ROOMY = '@media (min-width: 960px)';
/** WIDE up to ROOMY: apart from it, so the two never compete whatever their order. */
const TWO_UP = '@media (min-width: 640px) and (max-width: 959.98px)';

/** How wide the compare slider's screenshots are drawn, for the browser's choice of export. */
const COMPARE_SIZES = '(min-width: 992px) 960px, calc(100vw - 32px)';

const styles = create({
  // A scene above its words, in a 1px frame. Nothing here is a link, so it
  // has no hover.
  card: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: 1,
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    margin: 0,
    overflow: 'hidden',
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
  // The card across the whole row: its scene beside the words.
  cardRow: {
    flexDirection: {
      default: 'column',
      [WIDE]: 'row',
    },
  },
  cardRowBody: {
    flexBasis: {
      default: null,
      [WIDE]: '45%',
    },
    justifyContent: 'center',
  },
  cardRowScene: {
    flexBasis: {
      default: null,
      [WIDE]: '55%',
    },
    flexShrink: 0,
  },
  cards: {
    display: 'grid',
    gap: spacing.s4,
    gridTemplateColumns: {
      default: '1fr',
      [ROOMY]: 'repeat(3, 1fr)',
      [TWO_UP]: '1fr 1fr',
    },
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  cardTitle: {
    alignItems: 'center',
    display: 'flex',
    fontSize: font.sizeMd,
    fontWeight: font.weightMedium,
    gap: spacing.s2,
    margin: 0,
  },
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
  // The MCP scene beside what MCP does where there is room.
  mcp: {
    alignItems: 'stretch',
    display: 'grid',
    gap: {
      default: spacing.s6,
      [ROOMY]: spacing.s8,
    },
    gridTemplateColumns: {
      default: '1fr',
      [ROOMY]: '1fr 1fr',
    },
  },
  mcpPoints: {
    display: 'grid',
    gap: spacing.s6,
    gridTemplateColumns: {
      default: '1fr',
      [WIDE]: '1fr 1fr',
    },
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  pointIcon: {
    alignItems: 'center',
    backgroundColor: brand.tint,
    borderRadius: radius.base,
    color: brand.ink,
    display: 'flex',
    height: 32,
    justifyContent: 'center',
    marginBlockEnd: spacing.s2,
    width: 32,
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
  // For assistive tech only: the heading's full sentence, its moving word aside.
  srOnly: {
    borderWidth: 0,
    clip: 'rect(0, 0, 0, 0)',
    height: 1,
    margin: -1,
    overflow: 'hidden',
    padding: 0,
    position: 'absolute',
    whiteSpace: 'nowrap',
    width: 1,
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

      <RevealSection aria-labelledby="mcp" style={[layout.section, styles.section]}>
        <Reveal index={0}>
          <SectionHeading id="mcp">
            <span {...props(styles.srOnly)}>{m.mcp_title_all()}</span>
            <span aria-hidden="true">
              <Sentence
                message={(app) => m.mcp_title({ app })}
                slot={<CyclingWord part="mcp-app" words={MCP_APPS.map((app) => app())} />}
              />
            </span>
          </SectionHeading>
        </Reveal>
        <Reveal index={1}>
          <p {...props(layout.text, layout.muted, styles.lead)}>{m.mcp_lead()}</p>
        </Reveal>
        <div {...props(styles.mcp, styles.wide)}>
          <Reveal index={2}>
            <div {...props(styles.card)}>
              <McpScene />
            </div>
          </Reveal>
          <ul {...props(styles.mcpPoints)}>
            {MCP_POINTS.map(({ body, icon: Icon, title }, index) => (
              <Reveal as="li" index={index + 3} key={title()} style={styles.item}>
                <span {...props(styles.pointIcon)}>
                  <Icon aria-hidden="true" size={16} />
                </span>
                <span {...props(styles.term)}>{title()}</span>
                <span {...props(layout.muted)}>{body()}</span>
              </Reveal>
            ))}
          </ul>
        </div>
        <Reveal index={7}>
          <p {...props(layout.text, layout.muted, layout.small)}>{m.mcp_shared()}</p>
        </Reveal>
      </RevealSection>

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
          <Sequence>
            <Card
              body={m.step_install_body()}
              index={1}
              scene={<InstallScene />}
              step
              title={m.step_install_title()}
            />
            <Card
              body={m.step_login_body()}
              index={2}
              scene={<ConnectScene />}
              step
              title={m.step_login_title()}
            />
            <Card
              body={m.step_sign_body()}
              index={3}
              scene={<SignScene />}
              step
              title={m.step_sign_title()}
            />
          </Sequence>
        </ol>
      </RevealSection>

      <RevealSection aria-labelledby="ozellikler" style={[layout.section, styles.section]}>
        <Reveal index={0}>
          <SectionHeading id="ozellikler">{m.features_title()}</SectionHeading>
        </Reveal>
        <ul {...props(styles.cards, styles.wide)}>
          <Card
            body={m.feature_rules_body()}
            index={1}
            scene={<RulesScene />}
            title={m.feature_rules_title()}
            wide
          />
          <Card
            body={m.feature_start_body()}
            index={2}
            scene={<StartScene />}
            title={m.feature_start_title()}
          />
          <Card
            body={m.feature_repeat_body()}
            index={3}
            scene={<RepeatScene />}
            title={m.feature_repeat_title()}
          />
          <Card
            body={m.feature_customers_body()}
            index={4}
            scene={<CustomersScene />}
            title={m.feature_customers_title()}
          />
          <Card
            body={m.feature_pdf_body()}
            index={5}
            scene={<PdfScene />}
            title={m.feature_pdf_title()}
          />
          <Card
            body={m.feature_rates_body()}
            index={6}
            scene={<RatesScene />}
            title={m.feature_rates_title()}
          />
          <Card
            body={m.feature_companies_body()}
            index={7}
            scene={<CompaniesScene />}
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
        <Reveal index={1}>
          <Accordion>
            {QUESTIONS.map(([question, answer]) => (
              <AccordionItem key={question()}>
                <AccordionTrigger>{question()}</AccordionTrigger>
                <AccordionPanel>{answer()}</AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
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

/**
 * A step or a feature: its looping scene above the words that say what it
 * shows, or beside them across a whole row (`wide`). A step carries its number.
 */
function Card({
  body,
  index,
  scene,
  step = false,
  title,
  wide = false,
}: {
  body: string;
  index: number;
  scene: ReactNode;
  step?: boolean;
  title: string;
  wide?: boolean;
}) {
  return (
    <Reveal as="li" index={index} style={wide ? styles.cardWide : undefined}>
      <article {...props(styles.card, wide && styles.cardRow)}>
        <div {...props(wide && styles.cardRowScene)}>{scene}</div>
        <div {...props(styles.cardBody, wide && styles.cardRowBody)}>
          <h3 {...props(styles.cardTitle)}>
            {step ? <span {...props(styles.stepNumber)}>{index}</span> : null}
            {title}
          </h3>
          <p {...props(layout.text, layout.muted)}>{body}</p>
        </div>
      </article>
    </Reveal>
  );
}
