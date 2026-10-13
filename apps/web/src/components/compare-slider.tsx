import { colors, font, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { ChevronsLeftRight } from 'lucide-react';
import { useEffect, useRef, useState, type PointerEvent, type ReactNode } from 'react';
import { brand, reveal } from '../lib/brand.stylex.ts';
import { prefersReducedMotion, useInView } from '../lib/motion.ts';
import { m } from '../paraglide/messages.js';

const START = 50;
/** The one-time nudge that shows the divider moves: there and back. */
const HINT = [34, START] as const;
const HINT_STEP_MS = 700;

/** Where along the frame a pointer at `clientX` sits, as a percentage kept inside 0 to 100. */
export function positionAt(clientX: number, left: number, width: number): number {
  if (width <= 0) {
    return START;
  }
  return Math.min(100, Math.max(0, ((clientX - left) / width) * 100));
}

/** Ends a drag: the frame lets go of the pointer when it lifts or the browser takes it. */
function release(event: PointerEvent<HTMLDivElement>) {
  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
    event.currentTarget.releasePointerCapture(event.pointerId);
  }
}

const styles = create({
  // The frame takes every pointer, so a drag never grabs a screenshot.
  after: {
    inset: 0,
    pointerEvents: 'none',
    position: 'absolute',
  },
  // The left side shows up to the divider.
  before: (position: number) => ({
    clipPath: `inset(0 ${100 - position}% 0 0)`,
  }),
  chip: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.full,
    borderStyle: 'solid',
    borderWidth: 1,
    fontSize: font.sizeXs,
    lineHeight: 1,
    paddingBlock: 6,
    paddingInline: 10,
    pointerEvents: 'none',
    position: 'absolute',
    top: spacing.s3,
    transitionDuration: '200ms',
    transitionProperty: 'opacity',
  },
  chipAfter: {
    right: spacing.s3,
  },
  chipBefore: {
    left: spacing.s3,
  },
  chipHidden: {
    opacity: 0,
  },
  divider: (position: number) => ({
    left: `${position}%`,
  }),
  frame: {
    aspectRatio: '16 / 10',
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: 1,
    cursor: 'ew-resize',
    overflow: 'hidden',
    position: 'relative',
    // Vertical swipes still scroll the page on touch screens.
    touchAction: 'pan-y',
    userSelect: 'none',
  },
  // Only the nudge glides; a drag follows the pointer at once.
  gliding: {
    transitionDuration: `${HINT_STEP_MS}ms`,
    transitionProperty: 'clip-path, left',
    transitionTimingFunction: reveal.ease,
  },
  // The range input does the keyboard and screen reader work, unseen.
  input: {
    clipPath: 'inset(50%)',
    height: 1,
    margin: 0,
    overflow: 'hidden',
    position: 'absolute',
    whiteSpace: 'nowrap',
    width: 1,
  },
  knob: {
    alignItems: 'center',
    backgroundColor: brand.fill,
    borderRadius: radius.full,
    color: '#000000',
    display: 'flex',
    height: 32,
    justifyContent: 'center',
    left: '50%',
    position: 'absolute',
    top: '50%',
    translate: '-50% -50%',
    width: 32,
  },
  // The range input has the keyboard focus; its ring shows on the knob.
  knobFocused: {
    boxShadow: `0 0 0 2px ${colors.bg}, 0 0 0 3px ${brand.ink}`,
  },
  knobIcon: {
    height: 16,
    width: 16,
  },
  line: {
    backgroundColor: brand.fill,
    bottom: 0,
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    translate: '-50% 0',
    width: 2,
  },
});

/**
 * Two screens on top of each other, split by a divider you drag (or move
 * with the arrow keys): `before` on the left of it, `after` on the right. The
 * first time it comes into view the divider nudges once to show it moves.
 */
export function CompareSlider({
  after,
  afterLabel,
  before,
  beforeLabel,
}: {
  after: ReactNode;
  afterLabel: string;
  before: ReactNode;
  beforeLabel: string;
}) {
  const [position, setPosition] = useState(START);
  const [gliding, setGliding] = useState(false);
  const [focused, setFocused] = useState(false);
  const [frameRef, inView] = useInView<HTMLDivElement>({
    once: true,
    rootMargin: '0px 0px -25% 0px',
  });
  const touched = useRef(false);

  useEffect(() => {
    if (!inView || touched.current || prefersReducedMotion()) {
      return;
    }
    setGliding(true);
    const timers = HINT.map((value, step) =>
      setTimeout(() => {
        if (!touched.current) {
          setPosition(value);
        }
      }, step * HINT_STEP_MS),
    );
    timers.push(setTimeout(() => setGliding(false), HINT.length * HINT_STEP_MS));
    return () => timers.forEach(clearTimeout);
  }, [inView]);

  const take = () => {
    touched.current = true;
    setGliding(false);
  };

  const follow = (event: PointerEvent<HTMLDivElement>) => {
    const { left, width } = event.currentTarget.getBoundingClientRect();
    setPosition(positionAt(event.clientX, left, width));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    // No native image drag or text selection takes the pointer from us.
    event.preventDefault();
    take();
    event.currentTarget.setPointerCapture(event.pointerId);
    follow(event);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      follow(event);
    }
  };

  return (
    <div
      onDragStart={(event) => event.preventDefault()}
      onPointerCancel={release}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={release}
      ref={frameRef}
      {...props(styles.frame)}
    >
      <div {...props(styles.after)}>{after}</div>
      <div {...props(styles.after, styles.before(position), gliding && styles.gliding)}>
        {before}
      </div>
      <span {...props(styles.chip, styles.chipBefore, position < 15 && styles.chipHidden)}>
        {beforeLabel}
      </span>
      <span {...props(styles.chip, styles.chipAfter, position > 85 && styles.chipHidden)}>
        {afterLabel}
      </span>
      <div
        aria-hidden="true"
        {...props(styles.line, styles.divider(position), gliding && styles.gliding)}
      >
        <span {...props(styles.knob, focused && styles.knobFocused)}>
          <ChevronsLeftRight {...props(styles.knobIcon)} />
        </span>
      </div>
      <input
        aria-label={m.compare_slider()}
        max={100}
        min={0}
        onBlur={() => setFocused(false)}
        onChange={(event) => {
          take();
          setPosition(Number(event.currentTarget.value));
        }}
        onFocus={(event) => setFocused(event.currentTarget.matches(':focus-visible'))}
        type="range"
        value={Math.round(position)}
        {...props(styles.input)}
      />
    </div>
  );
}
