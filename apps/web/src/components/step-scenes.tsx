import { capStyles } from '@angaria/ui';
import { colors, font, radius } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { brand } from '../lib/brand.stylex.ts';
import { EASE, type Frame, type Loop, type Track } from '../lib/loop.ts';
import { m } from '../paraglide/messages.js';
import { AppIcon } from './app-icon.tsx';
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
  // The app's own icon in the Dock: no tile of its own behind it.
  appIcon: {
    backgroundColor: 'transparent',
    borderStyle: 'none',
  },
  arrow: {
    color: colors.muted,
    display: 'block',
    height: 14,
  },
  // The check that lands on the folder once the app is in it.
  badge: {
    bottom: 0,
    position: 'absolute',
    right: -4,
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
  caption: {
    fontSize: 11,
    textAlign: 'center',
    width: 80,
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
  fill: {
    inset: 0,
    position: 'absolute',
  },
  folder: {
    alignItems: 'center',
    color: brand.fill,
    display: 'flex',
    justifyContent: 'center',
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

/* 1. İndir ve kur: the disk image's window opens, the app is dragged onto
   Uygulamalar, the window closes and the app bounces in the Dock. */

/** The app's and the folder's centers on the stage. */
const APP = { x: 82, y: 66 } as const;
const FOLDER = { x: 182, y: 66 } as const;
const GRAB_AT = 1250;
const DROP_AT = 2300;
const DOCK_AT = 3400;

/** The window has come in: where the scene waits for its turn. */
const INSTALL_POSTER = 500;

export const installLoop: Loop = {
  duration: 5600,
  poster: INSTALL_POSTER,
  tracks: [
    {
      frames: [
        [0, { opacity: 0, transform: 'scale(0.96)' }],
        [100, { opacity: 0, transform: 'scale(0.96)' }],
        [500, { opacity: 1, transform: 'scale(1)' }],
        [3000, { opacity: 1, transform: 'scale(1)' }, AWAY],
        [3300, { opacity: 0, transform: 'scale(0.97)' }],
      ],
      part: 'window',
    },
    pointer([
      [0, { opacity: 0, ...tip(232, 186) }],
      [600, { opacity: 0, ...tip(232, 186) }, 'linear'],
      [750, { opacity: 1, ...tip(200, 160) }, GLIDE],
      [GRAB_AT - 150, { opacity: 1, ...tip(APP.x, APP.y) }],
      ...press(GRAB_AT - 150, APP.x, APP.y).slice(0, 2),
      [GRAB_AT, { opacity: 1, ...tip(APP.x, APP.y, 0.88) }, GLIDE],
      [DROP_AT, { opacity: 1, ...tip(FOLDER.x, FOLDER.y, 0.88) }],
      [DROP_AT + 90, { opacity: 1, ...tip(FOLDER.x, FOLDER.y) }],
      [DROP_AT + 400, { opacity: 1, ...tip(FOLDER.x, FOLDER.y) }, AWAY],
      [DROP_AT + 700, { opacity: 0, ...tip(FOLDER.x + 14, FOLDER.y + 16) }],
    ]),
    {
      frames: [
        [0, { opacity: 0, transform: 'translateX(0) scale(1)' }],
        [GRAB_AT - 60, { opacity: 0, transform: 'translateX(0) scale(1)' }],
        [GRAB_AT, { opacity: 0.9, transform: 'translateX(0) scale(1.06)' }, GLIDE],
        [
          DROP_AT,
          { opacity: 0.9, transform: `translateX(${FOLDER.x - APP.x}px) scale(1.06)` },
          AWAY,
        ],
        [DROP_AT + 200, { opacity: 0, transform: `translateX(${FOLDER.x - APP.x}px) scale(0.5)` }],
      ],
      part: 'ghost',
    },
    {
      frames: [
        [0, { transform: 'scale(1)' }],
        [DROP_AT + 60, { transform: 'scale(1)' }],
        [DROP_AT + 200, { transform: 'scale(1.1)' }, SNAP],
        [DROP_AT + 450, { transform: 'scale(1)' }],
      ],
      part: 'folder',
    },
    enter('check', DROP_AT + 250, { opacity: 0, transform: 'scale(0.25)' }, 300),
    {
      frames: [
        [0, { opacity: 0, transform: translateY(0) }],
        [DOCK_AT, { opacity: 0, transform: translateY(0) }],
        [
          DOCK_AT + 150,
          { opacity: 1, transform: translateY(0) },
          'cubic-bezier(0.25, 0.6, 0.4, 1)',
        ],
        [
          DOCK_AT + 330,
          { opacity: 1, transform: translateY(-9) },
          'cubic-bezier(0.6, 0, 0.75, 0.4)',
        ],
        [
          DOCK_AT + 510,
          { opacity: 1, transform: translateY(0) },
          'cubic-bezier(0.25, 0.6, 0.4, 1)',
        ],
        [
          DOCK_AT + 610,
          { opacity: 1, transform: translateY(-3) },
          'cubic-bezier(0.6, 0, 0.75, 0.4)',
        ],
        [DOCK_AT + 710, { opacity: 1, transform: translateY(0) }],
        [5000, { opacity: 1, transform: translateY(0) }],
        [5300, { opacity: 0, transform: translateY(0) }],
      ],
      part: 'app',
    },
    {
      frames: [
        [0, hidden],
        [DOCK_AT + 550, hidden],
        [DOCK_AT + 750, shown],
        [5000, shown],
        [5300, hidden],
      ],
      part: 'running',
    },
    progress(4900, INSTALL_POSTER),
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
          <AppIcon size={22} />
        </span>
        <span data-part="running" {...props(styles.activeDot)} />
      </div>
      <Window height={124} part="window" width={224} x={20} y={6}>
        <span {...props(scene.at(40, 38))}>
          <AppIcon size={44} />
        </span>
        <span {...props(scene.at(22, 90), styles.caption)}>{m.scene_install_app()}</span>
        <span {...props(scene.at(96, 59), styles.arrow)}>
          <ArrowIcon />
        </span>
        <span data-part="folder" {...props(scene.at(140, 38), scene.size(44, 44), styles.folder)}>
          <FolderIcon />
          <span data-part="check" {...props(styles.badge, styles.check)}>
            <CheckIcon />
          </span>
        </span>
        <span {...props(scene.at(122, 90), styles.caption)}>{m.scene_install_applications()}</span>
      </Window>
      <span data-part="ghost" {...props(scene.at(APP.x - 22, APP.y - 22), scene.hidden)}>
        <AppIcon size={44} />
      </span>
      <Pointer />
    </Stage>
  );
}

/** The dashed arrow from the app to the folder, as on the real disk image. */
function ArrowIcon() {
  return (
    <svg fill="none" height="14" viewBox="0 0 32 14" width="32">
      <path d="M1 7h26" stroke="currentColor" strokeDasharray="3 3" strokeWidth="1.2" />
      <path
        d="M24 3l4 4-4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.2"
      />
    </svg>
  );
}

/** The Applications folder. */
function FolderIcon() {
  return (
    <svg fill="none" height="36" viewBox="0 0 44 36" width="44">
      <path
        d="M2 6a3 3 0 0 1 3-3h11l4 4h19a3 3 0 0 1 3 3v21a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3z"
        fill="currentColor"
      />
    </svg>
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

/** The window has come in: where the scene waits for its turn. */
const CONNECT_POSTER = 300;

export const connectLoop: Loop = {
  duration: 6000,
  poster: CONNECT_POSTER,
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
    progress(5400, CONNECT_POSTER),
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
          <span {...props(capStyles.text)}>{m.scene_login_keychain()}</span>
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

/** The window has come in: where the scene waits for its turn. */
const SIGN_POSTER = 300;

export const signLoop: Loop = {
  duration: 6400,
  poster: SIGN_POSTER,
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
    progress(5900, SIGN_POSTER),
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
