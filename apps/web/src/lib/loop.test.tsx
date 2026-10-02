import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { stubAnimate } from '../test/animations.ts';
import { stubObservers } from '../test/observers.ts';
import { EASE, toKeyframes, useLoop, type Loop } from './loop.ts';

const loop: Loop = {
  duration: 1000,
  tracks: [
    {
      frames: [
        [200, { opacity: 0 }, 'linear'],
        [600, { opacity: 1 }],
      ],
      part: 'dot',
    },
  ],
};

function Probe() {
  const ref = useLoop<HTMLDivElement>(loop);
  return (
    <div ref={ref}>
      <span data-part="dot" />
      <span data-part="dot" />
      <span data-part="other" />
    </div>
  );
}

let restore = () => true;

afterEach(() => {
  restore();
  vi.unstubAllGlobals();
});

describe('toKeyframes', () => {
  test('holds the first and last looks out to both ends of the loop', () => {
    expect(toKeyframes(loop.tracks[0]?.frames ?? [], loop.duration)).toEqual([
      { easing: EASE, offset: 0, opacity: 0 },
      { easing: 'linear', offset: 0.2, opacity: 0 },
      { easing: EASE, offset: 0.6, opacity: 1 },
      { easing: EASE, offset: 1, opacity: 1 },
    ]);
  });

  test('leaves frames that already start and end the loop alone', () => {
    expect(
      toKeyframes(
        [
          [0, { opacity: 1 }],
          [1000, { opacity: 0 }],
        ],
        1000,
      ),
    ).toEqual([
      { easing: EASE, offset: 0, opacity: 1 },
      { easing: EASE, offset: 1, opacity: 0 },
    ]);
  });
});

describe('useLoop', () => {
  test('holds every part on its first frame until the scene comes into view', () => {
    const observers = stubObservers();
    const stub = stubAnimate();
    restore = stub.restore;
    render(<Probe />);

    expect(stub.animations).toHaveLength(2);
    for (const animation of stub.animations) {
      expect(animation.target).toHaveAttribute('data-part', 'dot');
      expect(animation.options).toEqual({ duration: 1000, fill: 'both', iterations: Infinity });
      expect(animation.keyframes).toHaveLength(4);
      expect(animation.pause).toHaveBeenCalled();
      expect(animation.play).not.toHaveBeenCalled();
    }

    act(() => observers.intersect(true));
    for (const animation of stub.animations) {
      expect(animation.play).toHaveBeenCalledTimes(1);
    }
  });

  test('pauses off screen, plays on from there back on screen, and stops on unmount', () => {
    const observers = stubObservers();
    const stub = stubAnimate();
    restore = stub.restore;
    const { unmount } = render(<Probe />);

    act(() => observers.intersect(true));
    const [animation] = stub.animations;
    animation?.pause.mockClear();
    act(() => observers.intersect(false));
    expect(animation?.pause).toHaveBeenCalledTimes(1);
    act(() => observers.intersect(true));
    expect(animation?.play).toHaveBeenCalledTimes(2);
    // Resumed, never started over.
    expect(stub.animate).toHaveBeenCalledTimes(2);

    unmount();
    for (const each of stub.animations) {
      expect(each.cancel).toHaveBeenCalled();
    }
  });

  test('with reduced motion, never animates', () => {
    const observers = stubObservers({ reducedMotion: true });
    const stub = stubAnimate();
    restore = stub.restore;
    render(<Probe />);

    act(() => observers.intersect(true));
    expect(stub.animate).not.toHaveBeenCalled();
  });
});
