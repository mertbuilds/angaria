import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { toKeyframes } from '../lib/loop.ts';
import { stubAnimate } from '../test/animations.ts';
import { stubObservers } from '../test/observers.ts';
import { cycleLoop, CyclingWord } from './cycling-word.tsx';

const WORDS = ["Claude'a", "Codex'e", "Cursor'a"];
const loop = cycleLoop('app', WORDS.length);

let restore = () => true;

afterEach(() => {
  restore();
  vi.unstubAllGlobals();
});

/** A track's opacity at `at`: the last frame at or before it. */
function opacityAt(index: number, at: number) {
  const frames = toKeyframes(loop.tracks[index]?.frames ?? [], loop.duration);
  const offset = at / loop.duration;
  return frames.filter((frame) => (frame.offset ?? 0) <= offset).at(-1)?.opacity;
}

describe('cycleLoop', () => {
  test('runs every track forward, inside the loop', () => {
    for (const { frames, part } of loop.tracks) {
      const times = frames.map(([at]) => at);
      expect(times, part).toEqual(times.toSorted((a, b) => a - b));
      expect(
        times.every((at) => at >= 0 && at <= loop.duration),
        part,
      ).toBe(true);
    }
  });

  test('shows one word at a time, in order, and the first again at the end', () => {
    const step = loop.duration / WORDS.length;
    for (const [turn] of WORDS.entries()) {
      const shown = WORDS.map((_, index) => opacityAt(index, turn * step + step / 2));
      expect(shown).toEqual(WORDS.map((_, index) => (index === turn ? 1 : 0)));
    }
    expect(WORDS.map((_, index) => opacityAt(index, loop.duration))).toEqual([1, 0, 0]);
  });
});

describe('CyclingWord', () => {
  test('draws every word in one cell, hidden from assistive tech', () => {
    stubObservers();
    const { container } = render(<CyclingWord part="app" words={WORDS} />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
    const missing = loop.tracks.filter(
      ({ part }) => !container.querySelector(`[data-part="${part}"]`),
    );
    expect(missing).toEqual([]);
  });

  test('starts in view and pauses out of view', () => {
    const observers = stubObservers();
    const stub = stubAnimate();
    restore = stub.restore;
    render(<CyclingWord part="app" words={WORDS} />);

    expect(stub.animations).toHaveLength(WORDS.length);
    expect(stub.animations.every(({ playState }) => playState === 'paused')).toBe(true);
    act(() => observers.intersect(true));
    expect(stub.animations.every(({ playState }) => playState === 'running')).toBe(true);
    act(() => observers.intersect(false));
    expect(stub.animations.every(({ playState }) => playState === 'paused')).toBe(true);
  });

  test('with reduced motion shows the first word, still', () => {
    const observers = stubObservers({ reducedMotion: true });
    const stub = stubAnimate();
    restore = stub.restore;
    const { container } = render(<CyclingWord part="app" words={WORDS} />);
    act(() => observers.intersect(true));

    expect(stub.animate).not.toHaveBeenCalled();
    expect(container.querySelector('[data-part]')).toHaveTextContent("Claude'a");
  });
});
