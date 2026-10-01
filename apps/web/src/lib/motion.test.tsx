import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { stubObservers } from '../test/observers.ts';
import { prefersReducedMotion, useInView } from './motion.ts';

function Probe({ once = false }: { once?: boolean }) {
  const [ref, inView] = useInView<HTMLDivElement>({ once });
  return <div ref={ref}>{inView ? 'in' : 'out'}</div>;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('prefersReducedMotion', () => {
  test('follows the reduced motion preference', () => {
    stubObservers({ reducedMotion: true });
    expect(prefersReducedMotion()).toBe(true);
    stubObservers({ reducedMotion: false });
    expect(prefersReducedMotion()).toBe(false);
  });
});

describe('useInView', () => {
  test('follows the element in and out of view', () => {
    const observers = stubObservers();
    render(<Probe />);
    expect(screen.getByText('out')).toBeInTheDocument();

    act(() => observers.intersect(true));
    expect(screen.getByText('in')).toBeInTheDocument();
    act(() => observers.intersect(false));
    expect(screen.getByText('out')).toBeInTheDocument();
  });

  test('with once, stays in view and stops observing', () => {
    const observers = stubObservers();
    render(<Probe once />);

    act(() => observers.intersect(true));
    expect(screen.getByText('in')).toBeInTheDocument();
    expect(observers.observerCount).toBe(0);
  });
});
