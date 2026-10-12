import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { stubObservers } from '../test/observers.ts';
import { prefersReducedMotion, useInView } from './motion.ts';

function Probe({ once = false, rootMargin = '0px' }: { once?: boolean; rootMargin?: string }) {
  const [ref, inView] = useInView<HTMLDivElement>({ once, rootMargin });
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

  test('with once, a new rootMargin keeps it in view', () => {
    const observers = stubObservers();
    const { rerender } = render(<Probe once />);

    act(() => observers.intersect(true));
    rerender(<Probe once rootMargin="-10% 0px" />);
    act(() => observers.intersect(false));
    expect(screen.getByText('in')).toBeInTheDocument();
  });
});
