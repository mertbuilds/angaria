import { colors, font, radius } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { brand } from '../lib/brand.stylex.ts';
import { EASE, type Frame, type Loop, type Track } from '../lib/loop.ts';
import { m } from '../paraglide/messages.js';
import {
  blink,
  enter,
  hidden,
  pointer,
  Pointer,
  progress,
  shown,
  Stage,
  styles as scene,
  tip,
  Typed,
  typedAt,
  typing,
  Window,
} from './scene.tsx';

/*
 * The three "Nasıl çalışır" scenes. Every part is drawn in its last frame,
 * which is what reduced motion (and the server) shows; each loop starts from
 * its own first frame and plays back to it.
 */

/** A pointer's move from one point to the next. */
const GLIDE = 'cubic-bezier(0.45, 0, 0.2, 1)';
/** Leaving the screen: slow at first, then away. */
const AWAY = 'cubic-bezier(0.4, 0, 1, 1)';
/** A small overshoot, for things that snap shut. */
const SNAP = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

const translateY = (y: number) => `translateY(${y}px)`;
const translateX = (x: number) => `translateX(${x}px)`;

/** A press at a stage point: the pointer dips, the control under it dips with it. */
function press(at: number, x: number, y: number): Array<Frame> {
  return [
    [at, { opacity: 1, ...tip(x, y) }],
    [at + 60, { opacity: 1, ...tip(x, y, 0.88) }],
    [at + 150, { opacity: 1, ...tip(x, y) }],
  ];
}

/** The control a `press` at `at` lands on: pressed in, and out again. */
const pressed = (at: number): Array<Frame> => [
  [at, { opacity: 1, transform: 'scale(1)' }],
  [at + 60, { opacity: 1, transform: 'scale(0.96)' }],
  [at + 150, { opacity: 1, transform: 'scale(1)' }],
];

const styles = create({
  activeDot: {
    backgroundColor: brand.fill,
    borderRadius: radius.full,
    height: 3,
    left: 100,
    position: 'absolute',
    top: 30,
    width: 3,
  },
  amount: {
    fontSize: 13,
    fontWeight: font.weightMedium,
    lineHeight: '16px',
  },
  appIcon: {
    alignItems: 'center',
    backgroundColor: colors.fg,
    color: colors.bg,
    fontSize: 14,
    fontWeight: font.weightMedium,
    lineHeight: 1,
    // The lowercase a sits low in its line box; up a pixel it looks centered.
    paddingBlockEnd: 2,
  },
  between: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
  },
  bubble: {
    alignItems: 'center',
    backgroundColor: colors.subtle,
    borderColor: colors.border,
    // The corner nearest the sender stays tight, like a message bubble.
    borderRadius: '15px 15px 15px 4px',
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    display: 'flex',
    height: 30,
    opacity: 0,
    paddingInline: 12,
    transformOrigin: '0 100%',
    whiteSpace: 'nowrap',
  },
  check: {
    alignItems: 'center',
    backgroundColor: brand.fill,
    borderRadius: radius.full,
    color: '#000000',
    display: 'flex',
    height: 16,
    justifyContent: 'center',
    width: 16,
  },
  chip: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.full,
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    display: 'flex',
    gap: 6,
    height: 26,
    paddingInlineEnd: 10,
    paddingInlineStart: 8,
  },
  codeBox: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: 6,
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    display: 'flex',
    fontSize: 13,
    fontWeight: font.weightMedium,
    height: 28,
    justifyContent: 'center',
    width: 20,
  },
  codeBoxes: {
    display: 'flex',
    gap: 5,
  },
  codeFocus: {
    borderColor: brand.fill,
    borderRadius: 6,
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    opacity: 0,
  },
  dock: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderColor: colors.border,
    // Concentric with the icons: their 6px corners plus the 6px around them.
    borderRadius: 12,
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    display: 'flex',
    gap: 6,
    justifyContent: 'center',
  },
  dockIcon: {
    backgroundColor: colors.subtle,
    borderColor: colors.border,
    borderRadius: 6,
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    display: 'flex',
    flexShrink: 0,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  done: {
    alignItems: 'center',
    display: 'flex',
    fontSize: 12,
    fontWeight: font.weightMedium,
    gap: 6,
    height: 28,
    position: 'absolute',
    right: 16,
    top: 94,
  },
  fill: {
    inset: 0,
    position: 'absolute',
  },
  label: {
    fontSize: 12,
    fontWeight: font.weightMedium,
  },
  lock: {
    flexShrink: 0,
    height: 14,
    position: 'relative',
    width: 12,
  },
  lockLayer: {
    display: 'block',
    height: 14,
    left: 0,
    position: 'absolute',
    top: 0,
    width: 12,
  },
  lockOn: {
    color: brand.ink,
    inset: 0,
    opacity: 0,
    position: 'absolute',
  },
  // The PDF is paper: white with gray ink in either theme.
  paper: {
    backgroundColor: '#ffffff',
    borderColor: '#d4d4d4',
    borderRadius: 4,
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    padding: 8,
    rotate: '5deg',
  },
  paperLine: (width: number) => ({
    backgroundColor: '#d4d4d4',
    borderRadius: 1,
    height: 3,
    width: `${width}px`,
  }),
  paperQR: {
    backgroundImage: 'repeating-conic-gradient(#1a1a1a 0 25%, transparent 0 50%)',
    backgroundSize: '4px 4px',
    height: 14,
    marginBlockStart: 'auto',
    marginInlineStart: 'auto',
    width: 14,
  },
  paperTitle: {
    backgroundColor: '#1a1a1a',
    borderRadius: 1,
    height: 4,
    width: 22,
  },
  pill: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.full,
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    display: 'flex',
    fontSize: 10,
    justifyContent: 'center',
    position: 'absolute',
  },
  placeholder: {
    alignItems: 'center',
    bottom: 0,
    color: colors.muted,
    display: 'flex',
    left: 12,
    opacity: 0,
    position: 'absolute',
    top: 0,
  },
  reel: {
    display: 'inline-block',
    height: 16,
    overflow: 'hidden',
    verticalAlign: 'top',
  },
  reelAt: (digit: number) => ({
    transform: `translateY(${-digit * 16}px)`,
  }),
  reelDigits: {
    display: 'flex',
    flexDirection: 'column',
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
  secret: {
    backgroundColor: colors.fg,
    borderRadius: radius.full,
    height: 6,
    width: 6,
  },
  secrets: {
    display: 'flex',
    gap: 4,
  },
  stamp: {
    backgroundColor: colors.bg,
    borderColor: brand.ink,
    borderRadius: radius.full,
    borderStyle: 'solid',
    borderWidth: 1,
    color: brand.ink,
    fontSize: 11,
    fontWeight: font.weightMedium,
    paddingBlock: 3,
    paddingInline: 9,
    rotate: '-8deg',
  },
  stretch: {
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
  },
  value: {
    fontSize: 11,
  },
});

/** Check mark for the blue badge. */
function CheckIcon() {
  return (
    <svg fill="none" height="10" viewBox="0 0 10 10" width="10">
      <path
        d="M2 5.2l2 2 4-4.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  );
}

/**
 * A padlock whose shackle (part `shackle`) lifts open and drops shut. The
 * shackle moves in a span of its own: Chrome runs an html element's transform
 * off the main thread, not an svg's.
 */
function LockIcon() {
  return (
    <>
      <span data-part="shackle" {...props(styles.lockLayer)}>
        <svg fill="none" height="14" viewBox="0 0 12 14" width="12">
          <path
            d="M3.5 6V4.2a2.5 2.5 0 0 1 5 0V6"
            stroke="currentColor"
            strokeLinecap="round"
            strokeWidth="1.2"
          />
        </svg>
      </span>
      <svg fill="none" height="14" viewBox="0 0 12 14" width="12" {...props(styles.lockLayer)}>
        <rect height="7" rx="2" stroke="currentColor" strokeWidth="1.2" width="9" x="1.5" y="6" />
      </svg>
    </>
  );
}

/* 1. İndir ve etkinleştir: the app bounces in the Dock, its window opens, the
   license key is typed in and Etkinleştir turns into Etkin. */

const LICENSE_KEY = '7Q4K-M2XD-9PLW-3HTR';
const KEY_AT = 1500;
const KEY_EVERY = 50;
const KEY_DONE = typedAt(KEY_AT, KEY_EVERY, LICENSE_KEY.length - 1);
/** Etkinleştir's center on the stage. */
const ACTIVATE = { x: 184, y: 114 } as const;
const ACTIVATE_AT = 3030;

export const installLoop: Loop = {
  duration: 5600,
  tracks: [
    {
      frames: [
        [0, { transform: translateY(0) }],
        [200, { transform: translateY(0) }, 'cubic-bezier(0.25, 0.6, 0.4, 1)'],
        [380, { transform: translateY(-9) }, 'cubic-bezier(0.6, 0, 0.75, 0.4)'],
        [560, { transform: translateY(0) }, 'cubic-bezier(0.25, 0.6, 0.4, 1)'],
        [660, { transform: translateY(-3) }, 'cubic-bezier(0.6, 0, 0.75, 0.4)'],
        [760, { transform: translateY(0) }],
      ],
      part: 'app',
    },
    {
      frames: [
        [0, hidden],
        [600, hidden],
        [800, shown],
        [5000, shown],
        [5300, hidden],
      ],
      part: 'running',
    },
    {
      frames: [
        [0, { opacity: 0, transform: 'scale(0.9)' }],
        [700, { opacity: 0, transform: 'scale(0.9)' }],
        [1100, { opacity: 1, transform: 'scale(1)' }],
        [4900, { opacity: 1, transform: 'scale(1)' }, AWAY],
        [5250, { opacity: 0, transform: 'scale(0.97)' }],
      ],
      part: 'window',
    },
    {
      frames: [
        [0, hidden],
        [1150, hidden],
        [1300, shown],
        [ACTIVATE_AT + 60, shown],
        [ACTIVATE_AT + 200, hidden],
      ],
      part: 'focus',
    },
    blink('caret-start', 1200, KEY_AT),
    ...typing('key', LICENSE_KEY, KEY_AT, KEY_EVERY),
    blink('caret-end', KEY_DONE, ACTIVATE_AT + 60),
    pointer([
      [0, { opacity: 0, ...tip(244, 206) }],
      [2300, { opacity: 0, ...tip(244, 206) }, 'linear'],
      [2450, { opacity: 1, ...tip(232, 188) }, GLIDE],
      [2950, { opacity: 1, ...tip(ACTIVATE.x, ACTIVATE.y) }],
      ...press(ACTIVATE_AT, ACTIVATE.x, ACTIVATE.y),
      [3450, { opacity: 1, ...tip(ACTIVATE.x, ACTIVATE.y) }, AWAY],
      [3750, { opacity: 0, ...tip(ACTIVATE.x + 14, ACTIVATE.y + 16) }],
    ]),
    {
      frames: [
        ...pressed(ACTIVATE_AT),
        [ACTIVATE_AT + 230, { opacity: 1, transform: 'scale(1)' }, AWAY],
        [ACTIVATE_AT + 370, { opacity: 0, transform: 'scale(0.96)' }],
      ],
      part: 'activate',
    },
    {
      frames: [
        [0, hidden],
        [ACTIVATE_AT, hidden],
        [ACTIVATE_AT + 50, shown],
      ],
      part: 'activate-on',
    },
    enter('done', ACTIVATE_AT + 320, { opacity: 0, transform: translateY(4) }, 350),
    enter('check', ACTIVATE_AT + 420, { opacity: 0, transform: 'scale(0.25)' }, 300),
    progress(4900),
  ],
};

export function InstallScene() {
  return (
    <Stage loop={installLoop}>
      <div {...props(scene.at(73, 158), scene.size(118, 36), styles.dock)}>
        <span {...props(styles.dockIcon)} />
        <span {...props(styles.dockIcon)} />
        <span {...props(styles.dockIcon)} />
        <span data-part="app" {...props(styles.dockIcon, styles.appIcon)}>
          {'a'}
        </span>
        <span data-part="running" {...props(styles.activeDot)} />
      </div>
      {/* Opens from the Dock icon: 174, 176 on the stage. */}
      <Window height={142} part="window" style={scene.origin(154, 170)} width={224} x={20} y={6}>
        <span {...props(scene.at(16, 28), styles.label)}>{m.scene_install_label()}</span>
        <div {...props(scene.at(16, 50), scene.size(192, 30), scene.input)}>
          <span data-part="focus" {...props(scene.focus)} />
          <span data-part="caret-start" {...props(scene.caret)} />
          <Typed part="key" text={LICENSE_KEY} />
          <span data-part="caret-end" {...props(scene.caret)} />
        </div>
        <span
          data-part="activate"
          {...props(scene.at(120, 94), scene.size(88, 28), scene.button, scene.hidden)}
        >
          {m.scene_install_activate()}
          <span data-part="activate-on" {...props(scene.pressed)}>
            {m.scene_install_activate()}
          </span>
        </span>
        <span data-part="done" {...props(styles.done)}>
          <span data-part="check" {...props(styles.check)}>
            <CheckIcon />
          </span>
          {m.scene_install_active()}
        </span>
      </Window>
      <Pointer />
    </Stage>
  );
}

/* 2. GİB hesabını bağla: the user code and password fill in, the password
   drops into Anahtar Zinciri, and the invoices come from GİB row by row. */

const USER = '48172936';
const SECRET_LENGTH = 8;
const SECRET_AT = 1080;
/** The first password dot's center in the window, then every 10px. */
const SECRET = { x: 30, y: 87 } as const;
/** The padlock's center in the window. */
const LOCK = { x: 29, y: 163 } as const;
const FLY_AT = 1650;
const INVOICES = [
  ['Northwind Labs', '$7.640,00'],
  ['Hafenblick Studio', '€4.200,00'],
  ['Atlas Dijital', '₺18.500,00'],
  ['Kestrel Analytics', '£3.150,00'],
] as const;

export const connectLoop: Loop = {
  duration: 6000,
  tracks: [
    {
      frames: [
        [0, { opacity: 0, transform: translateY(0) }],
        [300, { opacity: 1, transform: translateY(0) }],
        [2450, { opacity: 1, transform: translateY(0) }, AWAY],
        [2700, { opacity: 0, transform: translateY(-6) }],
      ],
      part: 'form',
    },
    blink('user-ph', 0, 420),
    {
      frames: [
        [0, hidden],
        [300, hidden],
        [420, shown],
        [950, shown],
        [1050, hidden],
      ],
      part: 'user-focus',
    },
    ...typing('user', USER, 420, 55),
    blink('pass-ph', 0, SECRET_AT),
    {
      frames: [
        [0, hidden],
        [950, hidden],
        [1070, shown],
        [FLY_AT - 50, shown],
        [FLY_AT + 70, hidden],
      ],
      part: 'pass-focus',
    },
    ...Array.from({ length: SECRET_LENGTH }, (_, index): Track => {
      const start = SECRET_AT + index * 45;
      const fly = FLY_AT + index * 35;
      const to = `translate(${LOCK.x - SECRET.x - index * 10}px, ${LOCK.y - SECRET.y}px)`;
      return {
        frames: [
          [0, { opacity: 0, transform: 'none' }],
          [start, { opacity: 0, transform: 'none' }, 'linear'],
          [start + 40, { opacity: 1, transform: 'none' }],
          [fly, { opacity: 1, transform: 'none' }, GLIDE],
          [fly + 380, { opacity: 1, transform: `${to} scale(0.5)` }, 'linear'],
          [fly + 460, { opacity: 0, transform: `${to} scale(0.3)` }],
        ],
        part: `secret-${index}`,
      };
    }),
    {
      frames: [
        [0, hidden],
        [1700, hidden],
        [1900, shown],
        [2900, shown],
        [3200, hidden],
      ],
      part: 'keychain-on',
    },
    {
      frames: [
        [0, { transform: 'scale(1)' }],
        [2280, { transform: 'scale(1)' }],
        [2400, { transform: 'scale(1.06)' }],
        [2650, { transform: 'scale(1)' }],
      ],
      part: 'keychain',
    },
    {
      frames: [
        [0, { transform: translateY(-2.5) }],
        [2250, { transform: translateY(-2.5) }, SNAP],
        [2450, { transform: translateY(0) }],
        [5450, { transform: translateY(0) }],
        [5700, { transform: translateY(-2.5) }],
      ],
      part: 'shackle',
    },
    enter('fetched', 2750, { opacity: 0, transform: translateY(6) }),
    ...INVOICES.map((_, index) =>
      enter(`invoice-${index}`, 2850 + index * 90, { opacity: 0, transform: translateY(8) }, 450),
    ),
    {
      frames: [
        [0, shown],
        [5400, shown, AWAY],
        [5750, hidden],
      ],
      part: 'list',
    },
    progress(5400),
  ],
};

export function ConnectScene() {
  return (
    <Stage loop={connectLoop}>
      <Window height={188} width={240} x={12} y={6}>
        <div data-part="form" {...props(styles.fill, scene.hidden)}>
          <div {...props(scene.at(14, 34), scene.size(210, 30), scene.input)}>
            <span data-part="user-focus" {...props(scene.focus)} />
            <span data-part="user-ph" {...props(styles.placeholder)}>
              {m.scene_login_user()}
            </span>
            <Typed part="user" text={USER} />
          </div>
          <div {...props(scene.at(14, 72), scene.size(210, 30), scene.input)}>
            <span data-part="pass-focus" {...props(scene.focus)} />
            <span data-part="pass-ph" {...props(styles.placeholder)}>
              {m.scene_login_password()}
            </span>
            <span {...props(styles.secrets)}>
              {Array.from({ length: SECRET_LENGTH }, (_, index) => (
                <span data-part={`secret-${index}`} key={index} {...props(styles.secret)} />
              ))}
            </span>
          </div>
        </div>
        <div data-part="list" {...props(styles.fill)}>
          <span data-part="fetched" {...props(scene.at(14, 30), scene.muted)}>
            {m.scene_login_fetched()}
          </span>
          {INVOICES.map(([customer, amount], index) => (
            <div
              data-part={`invoice-${index}`}
              key={customer}
              {...props(
                scene.at(14, 50 + index * 22),
                scene.size(210, 22),
                styles.row,
                styles.between,
              )}
            >
              <span>{customer}</span>
              <span>{amount}</span>
            </div>
          ))}
        </div>
        <div data-part="keychain" {...props(scene.at(14, 150), styles.chip)}>
          <span data-part="keychain-on" {...props(scene.focus)} />
          <span {...props(styles.lock)}>
            <LockIcon />
            <span data-part="keychain-on" {...props(styles.lockOn)}>
              <LockIcon />
            </span>
          </span>
          {m.scene_login_keychain()}
        </div>
      </Window>
    </Stage>
  );
}

/* 3. Kes ve onayla: Tekrar kes on last month's invoice fills the form, the
   total rolls up, the SMS code fills in, Onaylandı stamps down and the PDF
   slides out from behind the window. */

/** Where the window stands until the PDF needs the room on its right. */
const CENTERED = translateX(32);
/** Tekrar kes and Oluştur ve onayla on the stage, while the window is centered. */
const REPEAT = { x: 186, y: 74 } as const;
const SUBMIT = { x: 160, y: 169 } as const;
const REPEAT_AT = 1000;
const SUBMIT_AT = 2300;
const CODE = '482916';
const CODE_AT = 3200;
const CODE_EVERY = 90;
/** One code box and the gap after it. */
const CODE_STEP = 25;
/** The total's rolling digits, $7.640,00: each reel stops on its digit (10 is a zero after a full turn). */
const REELS = [7, 6, 4, 10] as const;
const RECENT = [
  ['Northwind Labs', '$7.640,00'],
  ['Atlas Dijital', '₺18.500,00'],
  ['Hafenblick Studio', '€4.200,00'],
] as const;
const LINES = [
  [m.scene_sign_line_development, '$6.500,00'],
  [m.scene_sign_line_consulting, '$1.140,00'],
] as const;

export const signLoop: Loop = {
  duration: 6400,
  tracks: [
    {
      frames: [
        [0, { opacity: 0, transform: CENTERED }],
        [300, { opacity: 1, transform: CENTERED }],
        [4300, { opacity: 1, transform: CENTERED }, GLIDE],
        [4750, { opacity: 1, transform: translateX(0) }],
        [5900, { opacity: 1, transform: translateX(0) }, AWAY],
        [6250, { opacity: 0, transform: translateX(0) }],
      ],
      part: 'window',
    },
    {
      frames: [
        [0, { opacity: 1, transform: translateX(0) }],
        [1250, { opacity: 1, transform: translateX(0) }, AWAY],
        [1450, { opacity: 0, transform: translateX(-8) }],
      ],
      part: 'recent',
    },
    {
      frames: [
        [0, hidden],
        [REPEAT_AT, hidden],
        [REPEAT_AT + 50, shown],
      ],
      part: 'repeat-on',
    },
    enter('form', 1400, { opacity: 0, transform: translateX(8) }, 350),
    enter('customer', 1550, { opacity: 0, transform: translateY(3) }, 300),
    ...LINES.map((_, index) =>
      enter(`line-${index}`, 1650 + index * 100, { opacity: 0, transform: translateY(3) }, 300),
    ),
    ...REELS.map((digit, index): Track => ({
      frames: [
        [0, { transform: translateY(0) }],
        [1800 + index * 70, { transform: translateY(0) }],
        [2700 + index * 70, { transform: translateY(-digit * 16) }],
      ],
      part: `reel-${index}`,
    })),
    pointer([
      [0, { opacity: 0, ...tip(252, 200) }],
      [350, { opacity: 0, ...tip(252, 200) }, 'linear'],
      [500, { opacity: 1, ...tip(238, 176) }, GLIDE],
      [950, { opacity: 1, ...tip(REPEAT.x, REPEAT.y) }],
      ...press(REPEAT_AT, REPEAT.x, REPEAT.y),
      [1700, { opacity: 1, ...tip(REPEAT.x, REPEAT.y) }, GLIDE],
      [2250, { opacity: 1, ...tip(SUBMIT.x, SUBMIT.y) }],
      ...press(SUBMIT_AT, SUBMIT.x, SUBMIT.y),
      [2700, { opacity: 1, ...tip(SUBMIT.x, SUBMIT.y) }, AWAY],
      [2950, { opacity: 0, ...tip(SUBMIT.x + 14, SUBMIT.y + 16) }],
    ]),
    {
      frames: [
        ...pressed(SUBMIT_AT),
        [SUBMIT_AT + 250, { opacity: 1, transform: 'scale(1)' }, AWAY],
        [SUBMIT_AT + 400, { opacity: 0, transform: 'scale(0.96)' }],
      ],
      part: 'submit',
    },
    {
      frames: [
        [0, hidden],
        [SUBMIT_AT, hidden],
        [SUBMIT_AT + 50, shown],
      ],
      part: 'submit-on',
    },
    enter('code', SUBMIT_AT + 350, { opacity: 0, transform: translateY(4) }, 300),
    {
      frames: [
        [0, { opacity: 0, transform: 'translateY(-8px) scale(0.96)' }],
        [2750, { opacity: 0, transform: 'translateY(-8px) scale(0.96)' }],
        [3050, { opacity: 1, transform: 'none' }],
        [3900, { opacity: 1, transform: 'none' }, AWAY],
        [4100, { opacity: 0, transform: translateY(-6) }],
      ],
      part: 'sms',
    },
    ...typing('digit', CODE, CODE_AT, CODE_EVERY),
    {
      // The focus ring hops to the next box as each digit lands.
      frames: [
        [0, { opacity: 0, transform: translateX(0) }],
        [3050, { opacity: 0, transform: translateX(0) }],
        [3150, { opacity: 1, transform: translateX(0) }],
        ...Array.from({ length: CODE.length - 1 }, (_, index): Array<Frame> => [
          [
            typedAt(CODE_AT, CODE_EVERY, index),
            { opacity: 1, transform: translateX(index * CODE_STEP) },
          ],
          [
            CODE_AT + (index + 1) * CODE_EVERY,
            { opacity: 1, transform: translateX((index + 1) * CODE_STEP) },
          ],
        ]).flat(),
        [3800, { opacity: 1, transform: translateX((CODE.length - 1) * CODE_STEP) }],
        [3950, { opacity: 0, transform: translateX((CODE.length - 1) * CODE_STEP) }],
      ],
      part: 'code-focus',
    },
    {
      frames: [
        [0, { opacity: 0, transform: 'scale(1.6)' }],
        [3950, { opacity: 0, transform: 'scale(1.6)' }, 'cubic-bezier(0.5, 0, 0.9, 0.5)'],
        [4120, { opacity: 1, transform: 'scale(0.97)' }, EASE],
        [4300, { opacity: 1, transform: 'scale(1)' }],
      ],
      part: 'stamp',
    },
    {
      // Behind the window until it moves aside, then out to the right.
      frames: [
        [0, { opacity: 0, transform: 'translateX(-56px) rotate(-5deg)' }],
        [4300, { opacity: 0, transform: 'translateX(-56px) rotate(-5deg)' }, 'linear'],
        [4320, { opacity: 1, transform: 'translateX(-56px) rotate(-5deg)' }, GLIDE],
        [4900, { opacity: 1, transform: 'translateX(0px) rotate(0deg)' }],
        [5900, { opacity: 1, transform: 'translateX(0px) rotate(0deg)' }, AWAY],
        [6250, { opacity: 0, transform: 'translateX(0px) rotate(0deg)' }],
      ],
      part: 'pdf',
    },
    progress(5900),
  ],
};

export function SignScene() {
  return (
    <Stage loop={signLoop}>
      <div data-part="pdf" {...props(scene.at(184, 56), scene.size(64, 84), styles.paper)}>
        <span {...props(styles.paperTitle)} />
        <span {...props(styles.paperLine(36))} />
        <span {...props(styles.paperLine(28))} />
        <span {...props(styles.paperLine(40))} />
        <span {...props(styles.paperQR)} />
      </div>
      <Window height={188} part="window" width={200} x={0} y={6}>
        <div data-part="recent" {...props(styles.fill, scene.hidden)}>
          <span {...props(scene.at(13, 28), scene.muted)}>{m.scene_sign_recent()}</span>
          {RECENT.map(([customer, amount], index) => (
            <div
              key={customer}
              {...props(scene.at(13, 48 + index * 38), scene.size(172, 38), styles.row)}
            >
              <div {...props(styles.fill, styles.stretch)}>
                <span>{customer}</span>
                <span {...props(scene.muted)}>{amount}</span>
              </div>
              <span {...props(styles.pill, scene.at(108, 8), scene.size(64, 22))}>
                {m.scene_sign_repeat()}
                {index === 0 ? (
                  <span data-part="repeat-on" {...props(scene.pressed)}>
                    {m.scene_sign_repeat()}
                  </span>
                ) : null}
              </span>
            </div>
          ))}
        </div>
        <div data-part="form" {...props(styles.fill)}>
          <div {...props(scene.at(13, 32), scene.size(172, 26), scene.input)}>
            <span data-part="customer">{RECENT[0][0]}</span>
          </div>
          {LINES.map(([service, amount], index) => (
            <div
              data-part={`line-${index}`}
              key={amount}
              {...props(scene.at(13, 70 + index * 20), scene.size(172, 16), styles.between)}
            >
              <span>{service()}</span>
              <span>{amount}</span>
            </div>
          ))}
          <div {...props(scene.at(13, 112), scene.size(172, 1), styles.row)} />
          <div {...props(scene.at(13, 122), scene.size(172, 18), styles.between)}>
            <span {...props(scene.muted)}>{m.scene_sign_total()}</span>
            <span {...props(styles.amount)}>
              {'$'}
              <Reel digit={REELS[0]} index={0} />
              {'.'}
              <Reel digit={REELS[1]} index={1} />
              <Reel digit={REELS[2]} index={2} />
              <Reel digit={REELS[3]} index={3} />
              {',00'}
            </span>
          </div>
          <span
            data-part="submit"
            {...props(scene.at(69, 148), scene.size(116, 28), scene.button, scene.hidden)}
          >
            {m.scene_sign_submit()}
            <span data-part="submit-on" {...props(scene.pressed)}>
              {m.scene_sign_submit()}
            </span>
          </span>
          <div data-part="code" {...props(scene.at(13, 148), styles.codeBoxes)}>
            {Array.from(CODE, (digit, index) => (
              <span key={index} {...props(styles.codeBox)}>
                <span data-part={`digit-${index}`}>{digit}</span>
              </span>
            ))}
            <span
              data-part="code-focus"
              {...props(scene.at(0, 0), scene.size(20, 28), styles.codeFocus)}
            />
          </div>
          <span data-part="stamp" {...props(scene.at(112, 22), styles.stamp)}>
            {m.scene_sign_signed()}
          </span>
        </div>
      </Window>
      <span {...props(scene.at(100, 4), styles.bubble)} data-part="sms">
        {m.scene_sign_sms({ code: CODE })}
      </span>
      <Pointer />
    </Stage>
  );
}

/** One rolling digit of the total, at rest on `digit`. */
function Reel({ digit, index }: { digit: number; index: number }) {
  return (
    <span {...props(styles.reel)}>
      <span data-part={`reel-${index}`} {...props(styles.reelDigits, styles.reelAt(digit))}>
        {Array.from({ length: 11 }, (_, value) => (
          <span key={value}>{value % 10}</span>
        ))}
      </span>
    </span>
  );
}
