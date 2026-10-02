import { colors, font, radius } from '@angaria/ui/tokens.stylex';
import { create, props, type StyleXStyles } from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { brand } from '../lib/brand.stylex.ts';
import { useLoop, type Frame, type Loop, type Track, type Values } from '../lib/loop.ts';

/** The drawing area every scene lays itself out in, in CSS pixels. */
const STAGE = { height: 200, width: 264 } as const;

export const hidden = { opacity: 0 } as const;
export const shown = { opacity: 1 } as const;

/** How long a typed character takes to show. */
const KEYSTROKE_MS = 40;

/** How a part looks at rest: fully shown, in place. */
const rest = (from: Values): Values =>
  Object.fromEntries(Object.keys(from).map((key) => [key, key === 'opacity' ? 1 : 'none']));

/** Comes in at `at` over `ms` from `from`, then stays until the loop ends. */
export function enter(part: string, at: number, from: Values, ms = 400): Track {
  return {
    frames: [
      [0, from],
      [at, from],
      [at + ms, rest(from)],
    ],
    part,
  };
}

/** One track per character of `Typed` text: one every `every` milliseconds from `at`. */
export function typing(part: string, text: string, at: number, every: number): Array<Track> {
  return Array.from(text, (_, index) => {
    const start = at + index * every;
    return {
      frames: [
        [0, hidden],
        [start, hidden, 'linear'],
        [start + KEYSTROKE_MS, shown],
      ],
      part: `${part}-${index}`,
    };
  });
}

/** When the `index`th character of `typing(part, text, at, every)` has shown. */
export const typedAt = (at: number, every: number, index: number) =>
  at + index * every + KEYSTROKE_MS;

/** Visible from `from` to `to`, switched on and off without a fade. */
export function blink(part: string, from: number, to: number): Track {
  const on: Array<Frame> = [
    [from, shown],
    [to, shown],
    [to, hidden],
  ];
  return { frames: from > 0 ? [[0, hidden], [from, hidden], ...on] : on, part };
}

/**
 * The line under the stage fills with blue while the scene plays out, and
 * fades away while the scene resets.
 */
export function progress(until: number): Track {
  return {
    frames: [
      [0, { opacity: 1, transform: 'scaleX(0)' }, 'linear'],
      [until, { opacity: 1, transform: 'scaleX(1)' }],
      [until + 300, { opacity: 0, transform: 'scaleX(1)' }],
    ],
    part: 'progress',
  };
}

/** A pointer that glides between stage points and clicks. */
export function pointer(frames: ReadonlyArray<Frame>): Track {
  return { frames, part: 'pointer' };
}

/** The pointer's tip at a stage point, pressed in by `press` (1 is not pressed). */
export const tip = (x: number, y: number, press = 1): Values => ({
  transform: `translate(${x}px, ${y}px) scale(${press})`,
});

export const styles = create({
  at: (x: number, y: number) => ({
    left: `${x}px`,
    position: 'absolute',
    top: `${y}px`,
  }),
  caret: {
    backgroundColor: colors.fg,
    display: 'inline-block',
    height: 14,
    marginInlineStart: 1,
    opacity: 0,
    verticalAlign: 'middle',
    width: 1,
  },
  char: {
    display: 'inline-block',
    whiteSpace: 'pre',
  },
  // A filled pill: the app's primary button, black on white.
  button: {
    alignItems: 'center',
    backgroundColor: colors.fg,
    borderRadius: radius.full,
    boxSizing: 'border-box',
    color: colors.bg,
    display: 'flex',
    fontSize: 11,
    fontWeight: font.weightMedium,
    justifyContent: 'center',
  },
  // The blue a pressed control flashes: the site's fill, black text on it.
  pressed: {
    alignItems: 'center',
    backgroundColor: brand.fill,
    borderRadius: radius.full,
    color: '#000000',
    display: 'flex',
    inset: 0,
    justifyContent: 'center',
    opacity: 0,
    position: 'absolute',
  },
  // The ring of the field that has the focus.
  focus: {
    borderColor: brand.fill,
    borderRadius: radius.full,
    borderStyle: 'solid',
    borderWidth: 1,
    inset: -1,
    opacity: 0,
    position: 'absolute',
  },
  hidden: {
    opacity: 0,
  },
  input: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.full,
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    display: 'flex',
    fontSize: 11,
    paddingInline: 12,
  },
  // Sits on the line, under the scene: the stage's edge until it fills.
  line: {
    backgroundColor: colors.border,
    bottom: 0,
    height: 1,
    insetInline: 0,
    position: 'absolute',
  },
  lineFill: {
    backgroundColor: brand.fill,
    height: '100%',
    // Static, there is no progress: only the plain line shows.
    opacity: 0,
    transformOrigin: '0 50%',
  },
  muted: {
    color: colors.muted,
  },
  // The area above a step's words. A faint dot grid, like the hero's, on the
  // muted fill; the scene sits in the middle at its own fixed size.
  media: {
    alignItems: 'center',
    backgroundColor: colors.subtle,
    backgroundImage: `radial-gradient(circle, color-mix(in oklab, ${colors.fg} 12%, transparent) 1px, transparent 1.5px)`,
    backgroundPosition: '50% 50%',
    backgroundSize: '16px 16px',
    display: 'flex',
    flexShrink: 0,
    height: 240,
    justifyContent: 'center',
    overflow: 'hidden',
    position: 'relative',
  },
  origin: (x: number, y: number) => ({
    transformOrigin: `${x}px ${y}px`,
  }),
  pointer: {
    display: 'block',
    height: 19,
    left: -1,
    opacity: 0,
    position: 'absolute',
    top: -1,
    transformOrigin: '1px 1px',
    width: 13,
  },
  size: (width: number, height: number) => ({
    height: `${height}px`,
    width: `${width}px`,
  }),
  stage: {
    flexShrink: 0,
    fontSize: 11,
    fontVariantNumeric: 'tabular-nums',
    height: STAGE.height,
    lineHeight: 1.3,
    position: 'relative',
    width: STAGE.width,
  },
  titleDot: {
    backgroundColor: colors.border,
    borderRadius: radius.full,
    height: 6,
    width: 6,
  },
  titleDots: {
    display: 'flex',
    gap: 4,
    left: 10,
    position: 'absolute',
    top: 9,
  },
  window: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    position: 'absolute',
  },
});

/**
 * The fixed-size area a scene draws in, looping `loop` while it is on screen.
 * Decorative: the step's words beside it say what it shows.
 */
export function Stage({ children, loop }: { children: ReactNode; loop: Loop }) {
  const ref = useLoop<HTMLDivElement>(loop);
  return (
    <div aria-hidden="true" ref={ref} {...props(styles.media)}>
      <div {...props(styles.stage)}>{children}</div>
      <div {...props(styles.line)}>
        <div data-part="progress" {...props(styles.lineFill)} />
      </div>
    </div>
  );
}

/** A macOS window: a 1px frame with the three title bar dots. */
export function Window({
  children,
  height,
  part,
  style,
  width,
  x,
  y,
}: {
  children: ReactNode;
  height: number;
  part?: string;
  style?: StyleXStyles;
  width: number;
  x: number;
  y: number;
}) {
  return (
    <div
      data-part={part}
      {...props(styles.window, styles.at(x, y), styles.size(width, height), style)}
    >
      <div {...props(styles.titleDots)}>
        <span {...props(styles.titleDot)} />
        <span {...props(styles.titleDot)} />
        <span {...props(styles.titleDot)} />
      </div>
      {children}
    </div>
  );
}

/** `text`, one part per character, for `typing`. */
export function Typed({ part, text }: { part: string; text: string }) {
  return Array.from(text, (char, index) => (
    <span data-part={`${part}-${index}`} key={index} {...props(styles.char)}>
      {char}
    </span>
  ));
}

/**
 * The macOS arrow pointer. Its tip is the stage point `tip()` names. The span
 * moves, not the svg: Chrome cannot run an svg's transform off the main thread.
 */
export function Pointer() {
  return (
    <span data-part="pointer" {...props(styles.pointer)}>
      <svg height="19" viewBox="0 0 13 19" width="13">
        <path
          d="M1 1v15l3.5-3.5L7 18l2.5-1L7 11.5h5z"
          fill="#000000"
          stroke="#ffffff"
          strokeLinejoin="round"
          strokeWidth="1.2"
        />
      </svg>
    </span>
  );
}
