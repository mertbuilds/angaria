import { colors, font, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { KeyRound, Laptop, MessageSquareLock, Power, type LucideIcon } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { AppIcon } from '../components/app-icon.tsx';
import { DownloadButton, SourceButton } from '../components/cta.tsx';
import { McpScene } from '../components/mcp-scene.tsx';
import { Reveal, RevealSection } from '../components/reveal.tsx';
import { Screenshot } from '../components/screenshot.tsx';
import { SectionHeading } from '../components/section-heading.tsx';
import { brand } from '../lib/brand.stylex.ts';
import { SITE_URL } from '../lib/canonical.ts';
import { layout } from '../lib/layout.ts';
import { CLAUDE_CODE_COMMAND, MCP_TOOLS, mcpToolTitle, type McpToolName } from '../lib/mcp.ts';
import { SCREENS } from '../lib/screens.ts';
import { m } from '../paraglide/messages.js';

const PAGE_URL = `${SITE_URL}/mcp`;

export const Route = createFileRoute('/mcp')({
  component: McpPage,
  head: () => ({
    links: [{ href: PAGE_URL, rel: 'canonical' }],
    meta: [
      { title: m.mcp_meta_title() },
      { content: m.mcp_meta_description(), name: 'description' },
      { content: m.mcp_meta_description(), property: 'og:description' },
      { content: m.mcp_og_title(), property: 'og:title' },
      { content: PAGE_URL, property: 'og:url' },
    ],
  }),
});

/** What a visitor might ask, and the tools Claude reaches for to answer it. */
const PROMPTS: ReadonlyArray<{ text: () => string; tools: ReadonlyArray<McpToolName> }> = [
  { text: m.mcp_prompt_list, tools: ['list_invoices'] },
  { text: m.mcp_prompt_create, tools: ['list_customers', 'create_invoice'] },
  { text: m.mcp_prompt_drafts, tools: ['list_invoices'] },
  { text: m.mcp_prompt_detail, tools: ['list_invoices', 'get_invoice'] },
  { text: m.mcp_prompt_services, tools: ['list_services'] },
  { text: m.mcp_prompt_sign, tools: ['request_signing_sms', 'sign_invoices'] },
  { text: m.mcp_prompt_company, tools: ['list_companies', 'list_invoices'] },
  { text: m.mcp_prompt_cancel, tools: ['delete_draft'] },
];

const SAFETY: ReadonlyArray<{ body: () => string; icon: LucideIcon; title: () => string }> = [
  { body: m.mcp_safety_local_body, icon: Laptop, title: m.mcp_safety_local_title },
  { body: m.mcp_safety_token_body, icon: KeyRound, title: m.mcp_safety_token_title },
  { body: m.mcp_safety_open_body, icon: Power, title: m.mcp_safety_open_title },
  { body: m.mcp_safety_sign_body, icon: MessageSquareLock, title: m.mcp_safety_sign_title },
];

const CLIENTS = [
  [m.mcp_client_claude_name, m.mcp_client_claude_how],
  [m.mcp_client_editors_name, m.mcp_client_editors_how],
  [m.mcp_client_more_name, m.mcp_client_more_how],
  [m.mcp_client_other_name, m.mcp_client_other_how],
] as const;

const QUESTIONS = [
  [m.mcp_faq_install_q, m.mcp_faq_install_a],
  [m.mcp_faq_password_q, m.mcp_faq_password_a],
  [m.mcp_faq_sign_q, m.mcp_faq_sign_a],
  [m.mcp_faq_closed_q, m.mcp_faq_closed_a],
  [m.mcp_faq_company_q, m.mcp_faq_company_a],
  [m.mcp_faq_queue_q, m.mcp_faq_queue_a],
  [m.mcp_faq_log_q, m.mcp_faq_log_a],
] as const;

const WIDE = '@media (min-width: 640px)';
const MONO = "ui-monospace, 'SF Mono', Menlo, Consolas, monospace";
/** How wide the MCP screenshot is drawn, for the browser's choice of export. */
const SHOT_SIZES = '(min-width: 992px) 960px, calc(100vw - 32px)';

const styles = create({
  actions: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s3,
  },
  actionsCentered: {
    justifyContent: 'center',
  },
  // A request as it sits in a chat: the corner nearest the sender stays tight.
  bubble: {
    backgroundColor: colors.subtle,
    borderRadius: '14px 14px 14px 4px',
    paddingBlock: spacing.s2,
    paddingInline: spacing.s3,
  },
  callout: {
    backgroundColor: colors.subtle,
    borderRadius: radius.base,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    padding: {
      default: spacing.s4,
      [WIDE]: spacing.s6,
    },
  },
  centered: {
    alignItems: 'center',
    textAlign: 'center',
  },
  chip: {
    borderColor: colors.border,
    borderRadius: radius.full,
    borderStyle: 'solid',
    borderWidth: 1,
    color: colors.muted,
    fontSize: font.sizeXs,
    lineHeight: '22px',
    paddingInline: spacing.s2,
  },
  chips: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  client: {
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: 'solid',
    borderBlockStartWidth: 1,
    columnGap: spacing.s6,
    display: 'flex',
    flexDirection: {
      default: 'column',
      [WIDE]: 'row',
    },
    justifyContent: 'space-between',
    paddingBlockStart: spacing.s3,
  },
  clientHow: {
    textAlign: {
      default: null,
      [WIDE]: 'end',
    },
  },
  code: {
    backgroundColor: colors.subtle,
    borderRadius: radius.base,
    fontFamily: MONO,
    fontSize: 13,
    lineHeight: 1.5,
    margin: 0,
    overflowWrap: 'break-word',
    paddingBlock: spacing.s3,
    paddingInline: spacing.s4,
    whiteSpace: 'pre-wrap',
  },
  eyebrow: {
    color: brand.ink,
    fontSize: font.sizeSm,
    fontWeight: font.weightMedium,
    margin: 0,
  },
  grid: {
    display: 'grid',
    gap: {
      default: spacing.s6,
      [WIDE]: spacing.s8,
    },
    gridTemplateColumns: {
      default: '1fr',
      [WIDE]: '1fr 1fr',
    },
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  intro: {
    alignItems: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    paddingBlockStart: {
      default: spacing.s4,
      [WIDE]: spacing.s8,
    },
  },
  item: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
    margin: 0,
  },
  lead: {
    fontSize: 17,
    maxWidth: 600,
  },
  nowrap: {
    whiteSpace: 'nowrap',
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
  promptCard: {
    alignItems: 'flex-start',
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
    height: '100%',
    justifyContent: 'space-between',
    padding: spacing.s4,
  },
  rows: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
    margin: 0,
  },
  // The scene's band: the step cards' frame, without words under it.
  sceneCard: {
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: 1,
    overflow: 'hidden',
  },
  // More air between sections than the base page gap, like the landing.
  section: {
    gap: {
      default: spacing.s4,
      [WIDE]: spacing.s6,
    },
    paddingBlockStart: {
      default: null,
      [WIDE]: spacing.s8,
    },
  },
  shot: {
    boxShadow: brand.shotShadow,
  },
  step: {
    display: 'flex',
    gap: spacing.s3,
  },
  stepBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    minWidth: 0,
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
  steps: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s6,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  term: {
    fontWeight: font.weightMedium,
  },
  tool: {
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: 'solid',
    borderBlockStartWidth: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
    paddingBlockStart: spacing.s3,
  },
  toolHead: {
    alignItems: 'baseline',
    columnGap: spacing.s4,
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  toolName: {
    color: colors.muted,
    fontFamily: MONO,
    fontSize: 13,
  },
  toolTitle: {
    alignItems: 'baseline',
    columnGap: spacing.s2,
    display: 'flex',
    flexWrap: 'wrap',
  },
  // Wider than the column, like the landing's compare slider, so the app's text stays legible.
  wide: {
    marginInline: 'calc(50% - min(50vw - 16px, 480px))',
  },
});

function McpPage() {
  return (
    <>
      <header {...props(styles.intro)}>
        <p {...props(styles.eyebrow)}>{m.mcp_eyebrow()}</p>
        <h1 {...props(layout.title)}>{m.mcp_title()}</h1>
        <p {...props(layout.text, styles.lead)}>{m.mcp_lead()}</p>
        <div {...props(styles.actions)}>
          <DownloadButton location="mcp" />
          <SourceButton location="mcp" />
        </div>
        <p {...props(layout.text, layout.muted, layout.small)}>{m.mcp_note()}</p>
      </header>

      <div {...props(styles.sceneCard)}>
        <McpScene />
      </div>

      <RevealSection aria-labelledby="nedir" style={[layout.section, styles.section]}>
        <Reveal index={0}>
          <SectionHeading id="nedir">{m.mcp_what_title()}</SectionHeading>
        </Reveal>
        <Reveal index={1}>
          <p {...props(layout.text, styles.lead)}>{m.mcp_what_body()}</p>
        </Reveal>
      </RevealSection>

      <RevealSection aria-labelledby="ornekler" style={[layout.section, styles.section]}>
        <Reveal index={0}>
          <SectionHeading id="ornekler">{m.mcp_prompts_title()}</SectionHeading>
        </Reveal>
        <Reveal index={1}>
          <p {...props(layout.text, layout.muted)}>{m.mcp_prompts_lead()}</p>
        </Reveal>
        <ul {...props(styles.grid)}>
          {PROMPTS.map(({ text, tools }, index) => (
            <Reveal as="li" index={index + 2} key={text()}>
              <article {...props(styles.promptCard)}>
                <p {...props(layout.text, styles.bubble)}>{text()}</p>
                <ul aria-label={m.mcp_prompt_tools()} {...props(styles.chips)}>
                  {tools.map((name) => (
                    <li key={name} {...props(styles.chip)}>
                      {mcpToolTitle(name)}
                    </li>
                  ))}
                </ul>
              </article>
            </Reveal>
          ))}
        </ul>
      </RevealSection>

      <RevealSection aria-labelledby="araclar" style={[layout.section, styles.section]}>
        <Reveal index={0}>
          <SectionHeading id="araclar">{m.mcp_tools_title()}</SectionHeading>
        </Reveal>
        <Reveal index={1}>
          <p {...props(layout.text, layout.muted)}>{m.mcp_tools_lead()}</p>
        </Reveal>
        <dl {...props(styles.rows)}>
          {MCP_TOOLS.map((tool, index) => (
            <Reveal index={Math.min(index, 6) + 2} key={tool.name} style={styles.tool}>
              <dt {...props(styles.toolHead)}>
                <span {...props(styles.toolTitle)}>
                  <span {...props(styles.term)}>{tool.title()}</span>
                  {'gated' in tool && <span {...props(styles.chip)}>{m.mcp_tool_gated()}</span>}
                </span>
                <code translate="no" {...props(styles.toolName)}>
                  {tool.name}
                </code>
              </dt>
              <dd {...props(layout.text, layout.muted, styles.item)}>{tool.body()}</dd>
            </Reveal>
          ))}
        </dl>
      </RevealSection>

      <RevealSection aria-labelledby="kontrol" style={[layout.section, styles.section]}>
        <Reveal index={0}>
          <SectionHeading id="kontrol">{m.mcp_safety_title()}</SectionHeading>
        </Reveal>
        <ul {...props(styles.grid)}>
          {SAFETY.map(({ body, icon: Icon, title }, index) => (
            <Reveal as="li" index={index + 1} key={title()} style={styles.item}>
              <span {...props(styles.pointIcon)}>
                <Icon aria-hidden="true" size={16} />
              </span>
              <span {...props(styles.term)}>{title()}</span>
              <span {...props(layout.muted)}>{body()}</span>
            </Reveal>
          ))}
        </ul>
        <Reveal index={5} style={styles.callout}>
          <h3 {...props(layout.text, styles.term)}>{m.mcp_limits_title()}</h3>
          <p {...props(layout.text)}>{m.mcp_limits_shared()}</p>
          <p {...props(layout.text)}>{m.mcp_limits_check()}</p>
        </Reveal>
      </RevealSection>

      <RevealSection aria-labelledby="kurulum" style={[layout.section, styles.section]}>
        <Reveal index={0}>
          <SectionHeading id="kurulum">{m.mcp_setup_title()}</SectionHeading>
        </Reveal>
        <Reveal index={1} style={styles.wide}>
          <Screenshot screen={SCREENS.mcp} sizes={SHOT_SIZES} style={styles.shot} />
        </Reveal>
        <ol {...props(styles.steps)}>
          <Step body={m.mcp_setup_open_body()} index={1} title={m.mcp_setup_open_title()} />
          <Step body={m.mcp_setup_add_body()} index={2} title={m.mcp_setup_add_title()}>
            <pre {...props(styles.code)}>
              <code translate="no">
                <Command text={CLAUDE_CODE_COMMAND} />
              </code>
            </pre>
            <p {...props(layout.text, layout.muted, layout.small)}>{m.mcp_setup_add_note()}</p>
          </Step>
          <Step body={m.mcp_setup_ask_body()} index={3} title={m.mcp_setup_ask_title()} />
        </ol>
      </RevealSection>

      <RevealSection aria-labelledby="uygulamalar" style={[layout.section, styles.section]}>
        <Reveal index={0}>
          <SectionHeading id="uygulamalar">{m.mcp_clients_title()}</SectionHeading>
        </Reveal>
        <dl {...props(styles.rows)}>
          {CLIENTS.map(([name, how], index) => (
            <Reveal index={index + 1} key={name()} style={styles.client}>
              <dt {...props(styles.term)}>{name()}</dt>
              <dd {...props(layout.text, layout.muted, styles.item, styles.clientHow)}>{how()}</dd>
            </Reveal>
          ))}
        </dl>
      </RevealSection>

      <RevealSection aria-labelledby="sss" style={[layout.section, styles.section]}>
        <Reveal index={0}>
          <SectionHeading id="sss">{m.mcp_faq_title()}</SectionHeading>
        </Reveal>
        <dl {...props(layout.list)}>
          {QUESTIONS.map(([question, answer], index) => (
            <Reveal index={index + 1} key={question()} style={styles.item}>
              <dt {...props(styles.term)}>{question()}</dt>
              <dd {...props(layout.text, layout.muted, styles.item)}>{answer()}</dd>
            </Reveal>
          ))}
        </dl>
      </RevealSection>

      <RevealSection
        aria-labelledby="basla"
        style={[layout.section, styles.section, styles.centered]}
      >
        <Reveal index={0}>
          <AppIcon size={64} />
        </Reveal>
        <Reveal index={0}>
          <SectionHeading centered id="basla">
            {m.mcp_cta_title()}
          </SectionHeading>
        </Reveal>
        <Reveal index={1} style={[styles.actions, styles.actionsCentered]}>
          <DownloadButton location="mcp" />
          <SourceButton location="mcp" />
        </Reveal>
        <Reveal index={2}>
          <p {...props(layout.text, layout.muted, layout.small)}>{m.hero_note()}</p>
        </Reveal>
      </RevealSection>
    </>
  );
}

/**
 * A shell command that wraps only between words and after a slash, so a long
 * path breaks between folders on a phone, never at a hyphen. Copying it adds
 * nothing.
 */
function Command({ text }: { text: string }) {
  return text.split(' ').map((word, wordIndex) => {
    const parts = word.split('/');
    return (
      <Fragment key={wordIndex}>
        {wordIndex > 0 && ' '}
        {parts.map((part, index) => (
          <Fragment key={index}>
            <span {...props(styles.nowrap)}>{index < parts.length - 1 ? `${part}/` : part}</span>
            {index < parts.length - 1 && <wbr />}
          </Fragment>
        ))}
      </Fragment>
    );
  });
}

/** One setup step: its number, what to do, and anything that shows how. */
function Step({
  body,
  children,
  index,
  title,
}: {
  body: string;
  children?: ReactNode;
  index: number;
  title: string;
}) {
  return (
    <Reveal as="li" index={index} style={styles.step}>
      <span {...props(styles.stepNumber)}>{index}</span>
      <div {...props(styles.stepBody)}>
        <h3 {...props(layout.text, styles.term)}>{title}</h3>
        <p {...props(layout.text, layout.muted)}>{body}</p>
        {children}
      </div>
    </Reveal>
  );
}
