import { colors, font, radius } from '@angaria/ui/tokens.stylex';
import { create, props, type StyleXStyles } from '@stylexjs/stylex';
import { CircleAlert, TriangleAlert } from 'lucide-react';
import { brand } from '../lib/brand.stylex.ts';
import type { Frame, Loop, Track, Values } from '../lib/loop.ts';
import { m } from '../paraglide/messages.js';
import { enter, hidden, progress, shown, Stage, styles as scene, Window } from './scene.tsx';

/*
 * The Özellikler scenes, one per feature, each with a motion of its own that
 * no other scene on the page uses: a selection that steps down a list by
 * keys, a command palette that pops open, a suggestion list that unfolds and
 * deals out a customer's defaults, a PDF that turns over to English, rows
 * marked as they change with TCMB's rate coming in, one company's invoices
 * pushing the other's aside, and a rule's message opening under its field
 * with the law it cites underlined. Every part is drawn in its last frame,
 * which is what reduced motion (and the server) shows.
 */

/** Leaving the screen: slow at first, then away. */
const AWAY = 'cubic-bezier(0.4, 0, 1, 1)';
/** A move from one place to the next. */
const GLIDE = 'cubic-bezier(0.45, 0, 0.2, 1)';
/** A small overshoot, for what springs open. */
const SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

const translateY = (y: number) => `translateY(${y}px)`;
const translateX = (x: number) => `translateX(${x}px)`;

/** The window shows from the start and fades away at `out`, ready for the next turn. */
function windowTrack(part: string, out: number): Track {
  return {
    frames: [
      [0, hidden],
      [250, shown],
      [out, shown, AWAY],
      [out + 300, hidden],
    ],
    part,
  };
}

/** Shown from the start until `at`, then gone: what the scene's first step leaves behind. */
function until(part: string, at: number, ms = 200): Track {
  return {
    frames: [
      [0, shown],
      [at, shown, AWAY],
      [at + ms, hidden],
    ],
    part,
  };
}

/** A key cap pressed at each of `at`: down a pixel and lit, then up. */
function keyPresses(part: string, at: ReadonlyArray<number>): Track {
  const up: Values = { opacity: 1, transform: translateY(0) };
  const down: Values = { opacity: 0.55, transform: translateY(1) };
  return {
    frames: at.flatMap((time): Array<Frame> => [
      [time, up],
      [time + 60, down],
      [time + 180, up],
    ]),
    part,
  };
}

const styles = create({
  amount: {
    fontWeight: font.weightMedium,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: brand.tint,
    borderRadius: radius.full,
    color: brand.ink,
    display: 'flex',
    flexShrink: 0,
    fontSize: 8,
    fontWeight: font.weightMedium,
    height: 16,
    justifyContent: 'center',
    width: 16,
  },
  // A value's earlier text, over the new one at its right edge until it goes.
  before: {
    position: 'absolute',
    right: 0,
    top: 0,
  },
  between: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
  },
  chip: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.full,
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    display: 'flex',
    fontSize: 10,
    height: 22,
    justifyContent: 'center',
    whiteSpace: 'nowrap',
  },
  // The rows the suggestion list and the palette offer, the chosen one tinted.
  choice: {
    alignItems: 'center',
    borderRadius: 6,
    boxSizing: 'border-box',
    display: 'flex',
    justifyContent: 'space-between',
    paddingInline: 8,
  },
  choiceOn: {
    backgroundColor: brand.tint,
  },
  cite: {
    display: 'inline-block',
    position: 'relative',
  },
  citeLine: {
    borderBlockEndColor: 'currentColor',
    borderBlockEndStyle: 'dashed',
    borderBlockEndWidth: 1,
    bottom: 0,
    insetInline: 0,
    position: 'absolute',
    transformOrigin: '0 50%',
  },
  company: {
    alignItems: 'center',
    display: 'flex',
    gap: 6,
    paddingInline: 6,
  },
  fill: {
    inset: 0,
    position: 'absolute',
  },
  kbd: {
    color: colors.muted,
    fontSize: 10,
  },
  key: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: 5,
    borderStyle: 'solid',
    borderWidth: 1,
    boxShadow: `0 1px 0 ${colors.border}`,
    boxSizing: 'border-box',
    display: 'flex',
    fontSize: 11,
    height: 20,
    justifyContent: 'center',
    width: 24,
  },
  label: {
    color: colors.muted,
    fontSize: 10,
  },
  // A field's message as the app shows it: an icon and the text, in the
  // message's color, the cited law with a dashed underline.
  message: {
    alignItems: 'flex-start',
    display: 'flex',
    fontSize: 10,
    gap: 4,
    lineHeight: 1.35,
  },
  messageError: {
    color: colors.error,
  },
  messageIcon: {
    display: 'flex',
    flexShrink: 0,
    paddingBlockStart: 1,
  },
  messageWarning: {
    color: colors.warning,
  },
  nowrap: {
    whiteSpace: 'nowrap',
  },
  originTop: {
    transformOrigin: '50% 0',
  },
  // A pane of the companies' carousel, side by side with the other.
  pane: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    width: 212,
  },
  paneRow: {
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: 'solid',
    borderBlockStartWidth: 1,
    boxSizing: 'border-box',
    height: 24,
  },
  panes: {
    display: 'flex',
    width: 424,
  },
  // The PDF is paper: white with dark ink in either theme.
  paper: {
    backgroundColor: '#ffffff',
    borderColor: '#d4d4d4',
    borderRadius: 4,
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    color: '#1a1a1a',
    display: 'flex',
    flexDirection: 'column',
    fontSize: 9,
    gap: 5,
    padding: 10,
  },
  paperMuted: {
    color: '#6b6b6b',
  },
  paperQR: {
    backgroundImage: 'repeating-conic-gradient(#1a1a1a 0 25%, transparent 0 50%)',
    backgroundSize: '4px 4px',
    height: 16,
    marginBlockStart: 'auto',
    marginInlineStart: 'auto',
    width: 16,
  },
  paperRule: {
    backgroundColor: '#d4d4d4',
    height: 1,
  },
  paperTitle: {
    fontSize: 11,
    fontWeight: font.weightMedium,
    letterSpacing: '0.04em',
  },
  // TCMB's rate arriving: a ring that spreads out from the dot and fades.
  ping: {
    borderColor: brand.fill,
    borderRadius: radius.full,
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    height: 6,
    inset: 0,
    opacity: 0,
    position: 'absolute',
    width: 6,
  },
  // A popup over the window: the app's command palette, the suggestion list.
  popup: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: 1,
    boxShadow: '0 12px 32px -12px rgb(0 0 0 / 0.25)',
    boxSizing: 'border-box',
  },
  rateDot: {
    backgroundColor: brand.fill,
    borderRadius: radius.full,
    height: 6,
    position: 'relative',
    width: 6,
  },
  rateSource: {
    alignItems: 'center',
    display: 'flex',
    gap: 6,
  },
  relative: {
    position: 'relative',
  },
  row: {
    borderBlockStartColor: colors.border,
    borderBlockStartStyle: 'solid',
    borderBlockStartWidth: 1,
    boxSizing: 'border-box',
  },
  // The segmented control over the PDF and the thumb that slides in it.
  segment: {
    alignItems: 'center',
    display: 'flex',
    fontSize: 10,
    height: 22,
    justifyContent: 'center',
    position: 'relative',
    width: 46,
  },
  segments: {
    backgroundColor: colors.subtle,
    borderRadius: radius.full,
    boxSizing: 'border-box',
    display: 'flex',
    padding: 2,
  },
  // A value that just changed, marked by a tint that sweeps in behind it and fades.
  sweep: {
    backgroundColor: brand.tint,
    borderRadius: 4,
    inset: '-2px -4px',
    opacity: 0,
    position: 'absolute',
    transformOrigin: '0 50%',
  },
  swept: {
    position: 'relative',
    zIndex: 0,
  },
  sweptText: {
    position: 'relative',
  },
  thumb: {
    backgroundColor: colors.bg,
    borderRadius: radius.full,
    boxShadow: '0 1px 2px rgb(0 0 0 / 0.15)',
    height: 22,
    left: 2,
    position: 'absolute',
    top: 2,
    width: 46,
  },
  thumbAt: (x: number) => ({
    transform: translateX(x),
  }),
  viewport: {
    overflow: 'hidden',
  },
});

/* 1. Geçen faturadan başla: the selection steps down the last invoices by ↓,
   ↵ picks one, and the form comes with its customer, lines and KDV. */

const LAST_INVOICES = [
  ['Northwind Labs', '$7.640,00'],
  ['Hafenblick Studio', '€4.200,00'],
  ['Atlas Dijital', '₺22.200,00'],
  ['Kestrel Analytics', '£3.150,00'],
  ['Mavi Kare Reklam', '₺9.600,00'],
] as const;
const ROW = 22;
const PICK_AT = 2050;

export const startLoop: Loop = {
  duration: 5800,
  tracks: [
    windowTrack('start-window', 5300),
    until('start-list', PICK_AT + 150),
    {
      frames: [
        [0, { opacity: 0, transform: translateY(0) }],
        [450, { opacity: 0, transform: translateY(0) }],
        [600, { opacity: 1, transform: translateY(0) }],
        [1000, { opacity: 1, transform: translateY(0) }, GLIDE],
        [1180, { opacity: 1, transform: translateY(ROW) }],
        [1500, { opacity: 1, transform: translateY(ROW) }, GLIDE],
        [1680, { opacity: 1, transform: translateY(2 * ROW) }],
      ],
      part: 'start-select',
    },
    keyPresses('start-down', [1000, 1500]),
    keyPresses('start-enter', [PICK_AT]),
    enter('start-form', PICK_AT + 250, hidden, 250),
    ...Array.from({ length: 5 }, (_, index) =>
      enter(`start-field-${index}`, PICK_AT + 350 + index * 90, hidden, 250),
    ),
    progress(5300),
  ],
};

export function StartScene() {
  return (
    <Stage loop={startLoop}>
      <Window height={188} part="start-window" width={240} x={12} y={6}>
        <div data-part="start-list" {...props(styles.fill, scene.hidden)}>
          <span {...props(scene.at(14, 26), scene.muted)}>{m.scene_sign_recent()}</span>
          <span
            data-part="start-select"
            {...props(scene.at(10, 44), scene.size(220, ROW), styles.choice, styles.choiceOn)}
          />
          {LAST_INVOICES.map(([customer, amount], index) => (
            <div
              key={customer}
              {...props(scene.at(18, 44 + index * ROW), scene.size(204, ROW), styles.between)}
            >
              <span>{customer}</span>
              <span {...props(scene.muted)}>{amount}</span>
            </div>
          ))}
          <span data-part="start-down" {...props(scene.at(176, 160), styles.key)}>
            {'↓'}
          </span>
          <span data-part="start-enter" {...props(scene.at(204, 160), styles.key)}>
            {'↵'}
          </span>
        </div>
        <div data-part="start-form" {...props(styles.fill)}>
          <div
            data-part="start-field-0"
            {...props(scene.at(14, 32), scene.size(212, 26), scene.input)}
          >
            {LAST_INVOICES[2][0]}
          </div>
          <div
            data-part="start-field-1"
            {...props(scene.at(14, 68), scene.size(212, 18), styles.between)}
          >
            <span>{m.scene_sign_line_development()}</span>
            <span>{'₺15.000,00'}</span>
          </div>
          <div
            data-part="start-field-2"
            {...props(scene.at(14, 88), scene.size(212, 18), styles.between)}
          >
            <span>{m.scene_sign_line_consulting()}</span>
            <span>{'₺3.500,00'}</span>
          </div>
          <div
            data-part="start-field-3"
            {...props(scene.at(14, 108), scene.size(212, 18), styles.between)}
          >
            <span {...props(scene.muted)}>{m.scene_feature_vat()}</span>
            <span>{'₺3.700,00'}</span>
          </div>
          <div {...props(scene.at(14, 132), scene.size(212, 1), styles.row)} />
          <div
            data-part="start-field-4"
            {...props(scene.at(14, 140), scene.size(212, 18), styles.between)}
          >
            <span {...props(scene.muted)}>{m.scene_sign_total()}</span>
            <span {...props(styles.amount)}>{LAST_INVOICES[2][1]}</span>
          </div>
        </div>
      </Window>
    </Stage>
  );
}

/* 2. Geçen ayın faturasını tekrar kes: ⌘K's palette pops open over
   Faturalar with the command, and the invoice comes back dated today. */

const OPEN_AT = 600;
const RUN_AT = 1900;

export const repeatLoop: Loop = {
  duration: 5600,
  tracks: [
    windowTrack('repeat-window', 5100),
    until('repeat-list', RUN_AT + 100, 150),
    {
      frames: [
        [0, { opacity: 0, transform: 'scale(0.9)' }],
        [OPEN_AT, { opacity: 0, transform: 'scale(0.9)' }, SPRING],
        [OPEN_AT + 320, { opacity: 1, transform: 'scale(1)' }],
        [RUN_AT, { opacity: 1, transform: 'scale(1)' }, AWAY],
        [RUN_AT + 150, { opacity: 0, transform: 'scale(0.98)' }],
      ],
      part: 'repeat-palette',
    },
    enter('repeat-form', RUN_AT + 150, hidden, 250),
    enter('repeat-today', RUN_AT + 650, hidden, 300),
    progress(5100),
  ],
};

const PALETTE = [
  [m.scene_feature_palette_repeat, null],
  [m.scene_feature_palette_new, '⌘N'],
  [m.scene_feature_palette_invoices, '⌘1'],
] as const;

export function RepeatScene() {
  return (
    <Stage loop={repeatLoop}>
      <Window height={188} part="repeat-window" width={240} x={12} y={6}>
        <div data-part="repeat-list" {...props(styles.fill, scene.hidden)}>
          <span {...props(scene.at(14, 26), scene.muted)}>
            {m.scene_feature_palette_invoices()}
          </span>
          {LAST_INVOICES.map(([customer, amount], index) => (
            <div
              key={customer}
              {...props(
                scene.at(14, 44 + index * ROW),
                scene.size(212, ROW),
                styles.row,
                styles.between,
              )}
            >
              <span>{customer}</span>
              <span {...props(scene.muted)}>{amount}</span>
            </div>
          ))}
        </div>
        <div data-part="repeat-form" {...props(styles.fill)}>
          <div {...props(scene.at(14, 32), scene.size(212, 26), scene.input)}>
            {LAST_INVOICES[0][0]}
          </div>
          <div {...props(scene.at(14, 68), scene.size(212, 22), styles.between)}>
            <span {...props(scene.muted)}>{m.scene_feature_date()}</span>
            <span {...props(styles.rateSource)}>
              <span data-part="repeat-today" {...props(styles.chip, scene.size(40, 18))}>
                {m.scene_feature_today()}
              </span>
              <span {...props(styles.amount)}>{'12.10.2026'}</span>
            </span>
          </div>
          <div {...props(scene.at(14, 98), scene.size(212, 18), styles.between)}>
            <span>{m.scene_sign_line_development()}</span>
            <span>{'$6.500,00'}</span>
          </div>
          <div {...props(scene.at(14, 118), scene.size(212, 18), styles.between)}>
            <span>{m.scene_sign_line_consulting()}</span>
            <span>{'$1.140,00'}</span>
          </div>
          <div {...props(scene.at(14, 142), scene.size(212, 1), styles.row)} />
          <div {...props(scene.at(14, 150), scene.size(212, 18), styles.between)}>
            <span {...props(scene.muted)}>{m.scene_sign_total()}</span>
            <span {...props(styles.amount)}>{LAST_INVOICES[0][1]}</span>
          </div>
        </div>
      </Window>
      <div
        data-part="repeat-palette"
        {...props(scene.at(26, 46), scene.size(212, 116), styles.popup, scene.hidden)}
      >
        <div {...props(scene.at(10, 0), scene.size(192, 30), styles.between)}>
          <span>{m.scene_feature_palette_query()}</span>
          <span {...props(styles.kbd)}>{'⌘K'}</span>
        </div>
        <div {...props(scene.at(0, 30), scene.size(210, 1), styles.row)} />
        {PALETTE.map(([label, shortcut], index) => (
          <div
            key={label()}
            {...props(
              scene.at(4, 36 + index * 25),
              scene.size(202, 24),
              styles.choice,
              index === 0 && styles.choiceOn,
            )}
          >
            <span>{label()}</span>
            {shortcut === null ? null : <span {...props(styles.kbd)}>{shortcut}</span>}
          </div>
        ))}
      </div>
    </Stage>
  );
}

/* 3. Müşterilerin ve hizmetlerin kayıtlı: the saved customer comes up under
   what was typed, and once picked its defaults are dealt out from the field. */

const SUGGEST_AT = 500;
const CHOSEN_AT = 1700;
const DEAL_AT = 1900;
/** Where the defaults are dealt from: the customer field's middle. */
const FIELD = { x: 120, y: 45 } as const;
/** Each default's chip: its stage box. */
const DEFAULTS = [
  { at: [14, 84], label: m.scene_feature_currency, width: 52 },
  { at: [72, 84], label: m.scene_feature_vat_zero, width: 60 },
  { at: [138, 84], label: m.scene_feature_due, width: 88 },
  { at: [14, 112], label: m.scene_feature_pdf_english, width: 96 },
] as const;

export const customersLoop: Loop = {
  duration: 5800,
  tracks: [
    windowTrack('customers-window', 5300),
    until('customers-query', CHOSEN_AT, 60),
    enter('customers-picked', CHOSEN_AT, hidden, 60),
    {
      frames: [
        [0, hidden],
        [250, hidden],
        [400, shown],
        [CHOSEN_AT + 100, shown],
        [CHOSEN_AT + 250, hidden],
      ],
      part: 'customers-focus',
    },
    {
      frames: [
        [0, { opacity: 0, transform: 'scaleY(0.4)' }],
        [SUGGEST_AT, { opacity: 0, transform: 'scaleY(0.4)' }],
        [SUGGEST_AT + 260, { opacity: 1, transform: 'scaleY(1)' }],
        [CHOSEN_AT - 50, { opacity: 1, transform: 'scaleY(1)' }, AWAY],
        [CHOSEN_AT + 150, { opacity: 0, transform: 'scaleY(0.6)' }],
      ],
      part: 'customers-suggest',
    },
    enter('customers-label', DEAL_AT, hidden, 250),
    ...DEFAULTS.map(({ at: [x, y], width }, index): Track => {
      const from = `translate(${FIELD.x - x - width / 2}px, ${FIELD.y - y - 11}px) scale(0.4)`;
      const start = DEAL_AT + 100 + index * 120;
      return {
        frames: [
          [0, { opacity: 0, transform: from }],
          [start, { opacity: 0, transform: from }, GLIDE],
          [start + 420, { opacity: 1, transform: 'none' }],
        ],
        part: `customers-default-${index}`,
      };
    }),
    enter('customers-service', DEAL_AT + 700, hidden, 300),
    progress(5300),
  ],
};

export function CustomersScene() {
  return (
    <Stage loop={customersLoop}>
      <Window height={188} part="customers-window" width={240} x={12} y={6}>
        <div {...props(scene.at(14, 32), scene.size(212, 26), scene.input)}>
          <span data-part="customers-focus" {...props(scene.focus)} />
          <span data-part="customers-query" {...props(scene.at(12, 7), scene.hidden)}>
            {'Nor'}
          </span>
          <span data-part="customers-picked">{'Northwind Labs Inc.'}</span>
        </div>
        <span data-part="customers-label" {...props(scene.at(14, 66), scene.muted)}>
          {m.scene_feature_defaults()}
        </span>
        {DEFAULTS.map(({ at: [x, y], label, width }, index) => (
          <span
            data-part={`customers-default-${index}`}
            key={label()}
            {...props(scene.at(x, y), scene.size(width, 22), styles.chip)}
          >
            {label()}
          </span>
        ))}
        <div
          data-part="customers-service"
          {...props(scene.at(14, 146), scene.size(212, 26), styles.row, styles.between)}
        >
          <span>{m.scene_sign_line_development()}</span>
          <span {...props(scene.muted)}>{'$6.500,00'}</span>
        </div>
      </Window>
      <div
        data-part="customers-suggest"
        {...props(
          scene.at(26, 68),
          scene.size(212, 60),
          styles.popup,
          styles.originTop,
          scene.hidden,
        )}
      >
        <div {...props(scene.at(4, 4), scene.size(202, 25), styles.choice, styles.choiceOn)}>
          <span>{'Northwind Labs Inc.'}</span>
          <span {...props(scene.muted)}>{'USD'}</span>
        </div>
        <div {...props(scene.at(4, 30), scene.size(202, 25), styles.choice)}>
          <span>{'Nordlys AS'}</span>
          <span {...props(scene.muted)}>{'NOK'}</span>
        </div>
      </div>
    </Stage>
  );
}

/* 4. Müşterine İngilizce PDF: the language switch slides from TR to EN and
   the PDF turns over to its English side. */

const SWITCH_AT = 1100;
const TURN_AT = 1250;
const TURN_MS = 220;
const turned = (deg: number) => `perspective(480px) rotateY(${deg}deg)`;

export const pdfLoop: Loop = {
  duration: 5600,
  tracks: [
    // Drawn on EN at rest, the side the card is about; the loop starts on TR.
    {
      frames: [
        [0, { transform: translateX(0) }],
        [SWITCH_AT, { transform: translateX(0) }, GLIDE],
        [SWITCH_AT + 300, { transform: translateX(46) }],
        [4900, { transform: translateX(46) }, GLIDE],
        [5200, { transform: translateX(0) }],
      ],
      part: 'pdf-thumb',
    },
    {
      frames: [
        [0, { opacity: 1, transform: turned(0) }],
        [TURN_AT, { opacity: 1, transform: turned(0) }, 'cubic-bezier(0.5, 0, 1, 1)'],
        [TURN_AT + TURN_MS, { opacity: 1, transform: turned(90) }, 'linear'],
        [TURN_AT + TURN_MS + 1, { opacity: 0, transform: turned(90) }],
        [4900, { opacity: 0, transform: turned(0) }, 'linear'],
        [5200, { opacity: 1, transform: turned(0) }],
      ],
      part: 'pdf-tr',
    },
    {
      frames: [
        [0, { opacity: 0, transform: turned(-90) }],
        [TURN_AT + TURN_MS, { opacity: 0, transform: turned(-90) }, 'linear'],
        [TURN_AT + TURN_MS + 1, { opacity: 1, transform: turned(-90) }],
        [TURN_AT + 2 * TURN_MS + 100, { opacity: 1, transform: turned(0) }],
        [4900, { opacity: 1, transform: turned(0) }, 'linear'],
        [5200, { opacity: 0, transform: turned(0) }],
      ],
      part: 'pdf-en',
    },
    progress(4900),
  ],
};

/** One face of the PDF: the same invoice in one language. */
function PdfFace({
  part,
  style,
  words,
}: {
  part: string;
  style?: StyleXStyles | undefined;
  words: { iban: string; service: string; title: string; total: string };
}) {
  return (
    <div data-part={part} {...props(scene.at(66, 40), scene.size(132, 154), styles.paper, style)}>
      <span {...props(styles.paperTitle)}>{words.title}</span>
      <span {...props(styles.paperMuted)}>{'Hafenblick Studio GmbH'}</span>
      <span {...props(styles.paperRule)} />
      <span {...props(styles.between)}>
        <span>{words.service}</span>
        <span>{'€4.200,00'}</span>
      </span>
      <span {...props(styles.between)}>
        <span>{words.total}</span>
        <span {...props(styles.amount)}>{'€4.200,00'}</span>
      </span>
      <span {...props(styles.paperRule)} />
      <span {...props(styles.paperMuted)}>{words.iban}</span>
      <span {...props(styles.paperMuted)}>{'SWIFT TGBATRIS'}</span>
      <span {...props(styles.paperQR)} />
    </div>
  );
}

export function PdfScene() {
  return (
    <Stage loop={pdfLoop}>
      <div {...props(scene.at(63, 4), styles.segments)}>
        <span data-part="pdf-thumb" {...props(styles.thumb, styles.thumbAt(46))} />
        <span {...props(styles.segment)}>{'TR'}</span>
        <span {...props(styles.segment)}>{'EN'}</span>
        <span {...props(styles.segment)}>{'TR + EN'}</span>
      </div>
      <PdfFace
        part="pdf-tr"
        style={scene.hidden}
        words={{
          iban: 'IBAN TR12 0006 4000',
          service: m.scene_feature_pdf_service_tr(),
          title: m.scene_feature_pdf_title_tr(),
          total: m.scene_feature_pdf_total_tr(),
        }}
      />
      <PdfFace
        part="pdf-en"
        words={{
          iban: 'IBAN TR12 0006 4000',
          service: m.scene_feature_pdf_service_en(),
          title: m.scene_feature_pdf_title_en(),
          total: m.scene_feature_pdf_total_en(),
        }}
      />
    </Stage>
  );
}

/* 5. Yurt dışındaki müşterin için hazır: a customer abroad turns the type
   to İSTİSNA and the PDF to English, each change marked as it lands, and
   TCMB's rate comes in for the lira total. */

const ABROAD = [
  [m.scene_feature_country, m.scene_feature_country_home, m.scene_feature_country_abroad],
  [m.scene_feature_type, m.scene_feature_type_sale, m.scene_feature_type_exempt],
  [m.scene_feature_pdf_language, m.scene_feature_turkish, m.scene_feature_english],
] as const;
const CHANGE_AT = 700;
const CHANGE_EVERY = 300;
const RATE_AT = 2000;

export const ratesLoop: Loop = {
  duration: 6000,
  tracks: [
    windowTrack('rates-window', 5500),
    ...ABROAD.flatMap((_, index): Array<Track> => {
      const at = CHANGE_AT + index * CHANGE_EVERY;
      return [
        until(`rates-old-${index}`, at, 120),
        enter(`rates-new-${index}`, at + 120, hidden, 200),
        {
          frames: [
            [0, { opacity: 0, transform: 'scaleX(0)' }],
            [at, { opacity: 0, transform: 'scaleX(0)' }],
            [at + 10, { opacity: 1, transform: 'scaleX(0)' }],
            [at + 320, { opacity: 1, transform: 'scaleX(1)' }],
            [at + 1000, { opacity: 1, transform: 'scaleX(1)' }],
            [at + 1400, { opacity: 0, transform: 'scaleX(1)' }],
          ],
          part: `rates-sweep-${index}`,
        },
      ];
    }),
    {
      frames: [
        [0, { opacity: 0, transform: 'scale(1)' }],
        [RATE_AT, { opacity: 0.9, transform: 'scale(1)' }, 'cubic-bezier(0.2, 0.6, 0.4, 1)'],
        [RATE_AT + 700, { opacity: 0, transform: 'scale(4)' }],
        [RATE_AT + 750, { opacity: 0.9, transform: 'scale(1)' }, 'cubic-bezier(0.2, 0.6, 0.4, 1)'],
        [RATE_AT + 1450, { opacity: 0, transform: 'scale(4)' }],
      ],
      part: 'rates-ping',
    },
    enter('rates-rate', RATE_AT + 150, hidden, 300),
    enter('rates-lira', RATE_AT + 450, { opacity: 0, transform: translateY(4) }, 300),
    progress(5500),
  ],
};

export function RatesScene() {
  return (
    <Stage loop={ratesLoop}>
      <Window height={188} part="rates-window" width={240} x={12} y={6}>
        {ABROAD.map(([label, before, after], index) => (
          <div
            key={label()}
            {...props(
              scene.at(14, 30 + index * 24),
              scene.size(212, 24),
              index > 0 && styles.row,
              styles.between,
            )}
          >
            <span {...props(scene.muted)}>{label()}</span>
            <span {...props(styles.swept)}>
              <span data-part={`rates-sweep-${index}`} {...props(styles.sweep)} />
              <span data-part={`rates-new-${index}`} {...props(styles.sweptText)}>
                {after()}
              </span>
              <span data-part={`rates-old-${index}`} {...props(styles.before, scene.hidden)}>
                {before()}
              </span>
            </span>
          </div>
        ))}
        <div {...props(scene.at(14, 108), scene.size(212, 1), styles.row)} />
        <div {...props(scene.at(14, 116), scene.size(212, 18), styles.between)}>
          <span {...props(scene.muted)}>{m.scene_feature_amount()}</span>
          <span {...props(styles.amount)}>{'$7.640,00'}</span>
        </div>
        <div {...props(scene.at(14, 138), scene.size(212, 18), styles.between)}>
          <span {...props(styles.rateSource, scene.muted)}>
            <span {...props(styles.rateDot)}>
              <span data-part="rates-ping" {...props(styles.ping)} />
            </span>
            {'TCMB'}
          </span>
          <span data-part="rates-rate">{'1 USD = 41,2850 ₺'}</span>
        </div>
        <div
          data-part="rates-lira"
          {...props(scene.at(14, 160), scene.size(212, 18), styles.between)}
        >
          <span {...props(scene.muted)}>{m.scene_feature_lira()}</span>
          <span {...props(styles.amount)}>{'₺315.417,40'}</span>
        </div>
      </Window>
    </Stage>
  );
}

/* 6. Birden fazla şirket: the other company's invoices push the first
   one's aside, each with its own GİB account, and back again. */

const COMPANIES = [
  {
    initials: 'DY',
    invoices: [
      ['Northwind Labs', '$7.640,00'],
      ['Hafenblick Studio', '€4.200,00'],
      ['Atlas Dijital', '₺22.200,00'],
    ],
    name: 'Deniz Yılmaz Yazılım',
    user: '48172936',
  },
  {
    initials: 'MK',
    invoices: [
      ['Lumen Mimarlık', '₺12.400,00'],
      ['Kestrel Analytics', '£3.150,00'],
      ['Ada Yayıncılık', '₺6.800,00'],
    ],
    name: 'Mavi Kare Reklam',
    user: '87654321',
  },
] as const;
const PUSH_AT = 1500;
const BACK_AT = 4000;
const PUSH_MS = 550;

export const companiesLoop: Loop = {
  duration: 5600,
  tracks: [
    {
      frames: [
        [0, { transform: translateX(0) }],
        [PUSH_AT, { transform: translateX(0) }, GLIDE],
        [PUSH_AT + PUSH_MS, { transform: translateX(-212) }],
        [BACK_AT, { transform: translateX(-212) }, GLIDE],
        [BACK_AT + PUSH_MS, { transform: translateX(0) }],
      ],
      part: 'companies-panes',
    },
    ...COMPANIES.map((_, index): Track => {
      const first = index === 0;
      const on: Values = shown;
      const off: Values = hidden;
      return {
        frames: [
          [0, first ? on : off],
          [PUSH_AT + 100, first ? on : off],
          [PUSH_AT + 300, first ? off : on],
          [BACK_AT + 100, first ? off : on],
          [BACK_AT + 300, first ? on : off],
        ],
        part: `companies-name-${index}`,
      };
    }),
    progress(5300),
  ],
};

export function CompaniesScene() {
  return (
    <Stage loop={companiesLoop}>
      <Window height={188} width={240} x={12} y={6}>
        <div {...props(scene.at(14, 28), scene.size(212, 28), scene.input, styles.relative)}>
          {COMPANIES.map(({ initials, name }, index) => (
            <span
              data-part={`companies-name-${index}`}
              key={name}
              {...props(styles.fill, styles.company, index > 0 && scene.hidden)}
            >
              <span {...props(styles.avatar)}>{initials}</span>
              <span>{name}</span>
            </span>
          ))}
        </div>
        <div {...props(scene.at(14, 66), scene.size(212, 116), styles.viewport)}>
          <div data-part="companies-panes" {...props(styles.panes)}>
            {COMPANIES.map(({ invoices, name, user }) => (
              <div key={name} {...props(styles.pane)}>
                <span {...props(scene.muted)}>{m.scene_feature_gib_user({ user })}</span>
                <div {...props(scene.size(212, 10))} />
                {invoices.map(([customer, amount]) => (
                  <div key={customer} {...props(styles.paneRow, styles.between)}>
                    <span>{customer}</span>
                    <span {...props(scene.muted)}>{amount}</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      </Window>
    </Stage>
  );
}

/* 7. Mevzuata göre uyarır: a date older than seven days opens VUK 231/5's
   warning under the field, pushing the form down, and an İstisna invoice
   with KDV %20 gets KDV Kanunu 11/1-a's error; each cited law underlines. */

const WARN_AT = 900;
const ERROR_AT = 2500;
/** How far the rows under the date move down to make room for its warning. */
const WARNING_ROOM = 44;
const underline = (part: string, at: number): Track => ({
  frames: [
    [0, { transform: 'scaleX(0)' }],
    [at, { transform: 'scaleX(0)' }],
    [at + 350, { transform: 'scaleX(1)' }],
  ],
  part,
});

export const rulesLoop: Loop = {
  duration: 6200,
  tracks: [
    windowTrack('rules-window', 5700),
    {
      frames: [
        [0, { transform: translateY(-WARNING_ROOM) }],
        [WARN_AT, { transform: translateY(-WARNING_ROOM) }, GLIDE],
        [WARN_AT + 350, { transform: translateY(0) }],
      ],
      part: 'rules-below',
    },
    enter('rules-warning', WARN_AT + 200, { opacity: 0, transform: translateY(-4) }, 300),
    underline('rules-warning-line', WARN_AT + 700),
    enter('rules-error', ERROR_AT, { opacity: 0, transform: translateY(-4) }, 300),
    underline('rules-error-line', ERROR_AT + 500),
    progress(5700),
  ],
};

/** Where a message's law goes: split on it, so the words keep their order. */
const LAW = '\u0000';

/**
 * A message with the words that cite its law underlined, as the app links
 * them. The law never breaks from the punctuation or suffix touching it.
 */
function Cited({
  law,
  line,
  message,
}: {
  law: string;
  line: string;
  message: (args: { law: string }) => string;
}) {
  const [before = '', after = ''] = message({ law: LAW }).split(LAW);
  const lead = /\S*$/.exec(before)?.[0] ?? '';
  const trail = /^\S*/.exec(after)?.[0] ?? '';
  return (
    <span>
      {before.slice(0, before.length - lead.length)}
      <span {...props(styles.nowrap)}>
        {lead}
        <span {...props(styles.cite)}>
          {law}
          <span data-part={line} {...props(styles.citeLine)} />
        </span>
        {trail}
      </span>
      {after.slice(trail.length)}
    </span>
  );
}

export function RulesScene() {
  return (
    <Stage loop={rulesLoop}>
      <Window height={188} part="rules-window" width={240} x={12} y={6}>
        <span {...props(scene.at(14, 26), styles.label)}>{m.scene_feature_date()}</span>
        <div {...props(scene.at(14, 40), scene.size(212, 26), scene.input)}>{'02.10.2026'}</div>
        <div
          data-part="rules-warning"
          {...props(scene.at(14, 72), scene.size(212, 40), styles.message, styles.messageWarning)}
        >
          <span {...props(styles.messageIcon)}>
            <TriangleAlert size={10} />
          </span>
          <Cited
            law={m.scene_feature_rules_window_law()}
            line="rules-warning-line"
            message={m.scene_feature_rules_window}
          />
        </div>
        <div data-part="rules-below" {...props(styles.fill)}>
          <div {...props(scene.at(14, 116), styles.rateSource)}>
            <span {...props(styles.chip, scene.size(60, 22))}>{m.scene_feature_type_exempt()}</span>
            <span {...props(styles.chip, scene.size(60, 22))}>{m.scene_feature_vat()}</span>
          </div>
        </div>
        <div
          data-part="rules-error"
          {...props(scene.at(14, 146), scene.size(212, 30), styles.message, styles.messageError)}
        >
          <span {...props(styles.messageIcon)}>
            <CircleAlert size={10} />
          </span>
          <Cited
            law={m.scene_feature_rules_exempt_law()}
            line="rules-error-line"
            message={m.scene_feature_rules_exempt}
          />
        </div>
      </Window>
    </Stage>
  );
}
