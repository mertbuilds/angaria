import { act, render } from '@testing-library/react';
import type { ComponentType } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { Loop } from '../lib/loop.ts';
import { stubAnimate } from '../test/animations.ts';
import { stubObservers } from '../test/observers.ts';
import {
  connectLoop,
  ConnectScene,
  installLoop,
  InstallScene,
  signLoop,
  SignScene,
} from './step-scenes.tsx';

const SCENES: Array<[name: string, Scene: ComponentType, loop: Loop]> = [
  ['install', InstallScene, installLoop],
  ['connect', ConnectScene, connectLoop],
  ['sign', SignScene, signLoop],
];

let restore = () => true;

afterEach(() => {
  restore();
  vi.unstubAllGlobals();
});

describe.each(SCENES)('%s scene', (_, Scene, loop) => {
  test('draws every part its loop moves', () => {
    stubObservers();
    const { container } = render(<Scene />);
    const missing = loop.tracks.filter(
      ({ part }) => !container.querySelector(`[data-part="${part}"]`),
    );
    expect(missing.map(({ part }) => part)).toEqual([]);
  });

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

  test('is decorative: the step text carries the meaning', () => {
    stubObservers();
    const { container } = render(<Scene />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  test('starts its loop in view and pauses it out of view', () => {
    const observers = stubObservers();
    const stub = stubAnimate();
    restore = stub.restore;
    render(<Scene />);

    expect(stub.animations.length).toBeGreaterThanOrEqual(loop.tracks.length);
    expect(stub.animations.every(({ play }) => play.mock.calls.length === 0)).toBe(true);
    act(() => observers.intersect(true));
    expect(stub.animations.every(({ play }) => play.mock.calls.length === 1)).toBe(true);
    for (const { pause } of stub.animations) {
      pause.mockClear();
    }
    act(() => observers.intersect(false));
    expect(stub.animations.every(({ pause }) => pause.mock.calls.length === 1)).toBe(true);
  });
});

describe('with reduced motion', () => {
  test('every scene shows its last frame, still', () => {
    const observers = stubObservers({ reducedMotion: true });
    const stub = stubAnimate();
    restore = stub.restore;
    const install = render(<InstallScene />).container;
    const connect = render(<ConnectScene />).container;
    const sign = render(<SignScene />).container;
    act(() => observers.intersect(true));

    expect(stub.animate).not.toHaveBeenCalled();
    expect(install).toHaveTextContent('Uygulamalar');
    expect(install.querySelector('[data-part="check"]')).toBeInTheDocument();
    expect(connect).toHaveTextContent("GİB'den geldi");
    expect(connect).toHaveTextContent('Kestrel Analytics');
    expect(sign).toHaveTextContent('Onaylandı');
    expect(sign).toHaveTextContent('Northwind Labs');
    expect(sign.querySelector('[data-part="digit-5"]')).toHaveTextContent('6');
  });
});
