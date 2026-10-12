import { create, props } from '@stylexjs/stylex';
import { useMemo } from 'react';
import { useLoop, type Frame, type Loop, type Values } from '../lib/loop.ts';

/** How long each word stays. */
const HOLD_MS = 2000;
/** The swap: the motion tokens' 260ms on the loop's ease-out. */
const SWAP_MS = 260;
const STEP = HOLD_MS + SWAP_MS;

const shown: Values = { opacity: 1, transform: 'none' };
const below: Values = { opacity: 0, transform: 'translateY(0.4em)' };
const above: Values = { opacity: 0, transform: 'translateY(-0.4em)' };

/**
 * One track per word, each word in its turn: it rises in from below as the
 * one before it rises away, stays, then rises away itself. The first word is
 * back in place when the loop ends. One word has nothing to swap: it stays.
 */
export function cycleLoop(part: string, count: number): Loop {
  if (count < 2) {
    return { duration: STEP, tracks: [] };
  }
  const duration = count * STEP;
  return {
    duration,
    tracks: Array.from({ length: count }, (_, index) => {
      const into = index * STEP;
      const away = (index + 1) * STEP;
      const frames: Array<Frame> =
        index === 0
          ? [
              [0, shown],
              [away - SWAP_MS, shown],
              [away, above],
              [duration - SWAP_MS, below],
              [duration, shown],
            ]
          : [
              [0, below],
              [into - SWAP_MS, below],
              [into, shown],
              [away - SWAP_MS, shown],
              [away, above],
            ];
      return { frames, part: `${part}-${index}` };
    }),
  };
}

const styles = create({
  // Every word in the same cell: the widest sets the width, so the words
  // around it never move.
  cell: {
    display: 'inline-grid',
    verticalAlign: 'bottom',
  },
  waiting: {
    opacity: 0,
  },
  word: {
    gridArea: '1 / 1',
    whiteSpace: 'nowrap',
  },
});

/**
 * `words` in turn, in one place, while it is on screen. Still, it shows the
 * first. Decorative: the caller gives the full sentence to assistive tech.
 */
export function CyclingWord({ part, words }: { part: string; words: ReadonlyArray<string> }) {
  const loop = useMemo(() => cycleLoop(part, words.length), [part, words.length]);
  const ref = useLoop<HTMLSpanElement>(loop);
  return (
    <span aria-hidden="true" ref={ref} {...props(styles.cell)}>
      {words.map((word, index) => (
        <span
          data-part={`${part}-${index}`}
          key={word}
          {...props(styles.word, index > 0 && styles.waiting)}
        >
          {word}
        </span>
      ))}
    </span>
  );
}
