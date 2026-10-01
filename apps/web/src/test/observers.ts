import { vi } from 'vitest';

/**
 * Stand-ins for the browser APIs jsdom lacks. `intersect` plays an
 * IntersectionObserver entry to every observer; `reducedMotion` answers the
 * prefers-reduced-motion query.
 */
export function stubObservers({ reducedMotion = false } = {}) {
  const observers = new Set<{
    callback: IntersectionObserverCallback;
    disconnect: () => void;
  }>();

  class StubIntersectionObserver {
    callback: IntersectionObserverCallback;
    disconnect = vi.fn(() => observers.delete(this));
    observe = vi.fn();
    unobserve = vi.fn();
    constructor(callback: IntersectionObserverCallback) {
      this.callback = callback;
      observers.add(this);
    }
  }

  vi.stubGlobal('IntersectionObserver', StubIntersectionObserver);
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      addEventListener: vi.fn(),
      matches: reducedMotion && query.includes('reduce'),
      media: query,
      removeEventListener: vi.fn(),
    })),
  );

  return {
    intersect(isIntersecting: boolean) {
      for (const observer of observers) {
        observer.callback(
          [{ isIntersecting } as IntersectionObserverEntry],
          observer as unknown as IntersectionObserver,
        );
      }
    },
    get observerCount() {
      return observers.size;
    },
  };
}
