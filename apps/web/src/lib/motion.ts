import { useEffect, useRef, useState } from 'react';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** Whether the visitor asked for less motion. False on the server. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.(REDUCED_MOTION).matches === true;
}

/**
 * Whether the element is on screen. With `once`, it stays true after the first
 * time. Without IntersectionObserver it stays false: the browsers that lack it
 * also lack the `scripting` media feature the hidden styles wait behind, so
 * nothing stays hidden there.
 */
export function useInView<T extends Element>({
  once = false,
  rootMargin = '0px',
}: { once?: boolean; rootMargin?: string } = {}) {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === 'undefined') {
      return;
    }
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) {
          return;
        }
        setInView(entry.isIntersecting);
        if (once && entry.isIntersecting) {
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, [once, rootMargin]);

  return [ref, inView] as const;
}
