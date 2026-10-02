import { colors, spacing } from '@angaria/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import { useEffect, useRef } from 'react';
import { brand, media, reveal } from '../lib/brand.stylex.ts';
import { layout } from '../lib/layout.ts';
import { prefersReducedMotion } from '../lib/motion.ts';
import { SCREENS } from '../lib/screens.ts';
import { m } from '../paraglide/messages.js';
import { CheckoutButton, DownloadButton } from './cta.tsx';
import { Screenshot } from './screenshot.tsx';

const WIDE = '@media (min-width: 640px)';
const MOTION = '@media (prefers-reduced-motion: no-preference)';

/** How the hero screenshot is laid out, for the browser's choice of export. */
export const HERO_SIZES = '(min-width: 1112px) 1080px, calc(100vw - 32px)';

/**
 * How far the hero screenshot leans back, from 1 (fully) to 0 (flat), by where
 * its top edge sits in a viewport `viewport` pixels tall: leaning while it is
 * low on the screen, flat by the time it reaches the top fifth.
 */
export function tiltProgress(top: number, viewport: number): number {
  const start = viewport * 0.85;
  const end = viewport * 0.2;
  return Math.min(1, Math.max(0, (top - end) / (start - end)));
}

/**
 * Writes `--tilt` on the element while it is on screen and the page scrolls.
 * The element itself never moves; a child reads the variable and leans. With
 * reduced motion nothing is written and the child stays flat.
 */
function useScrollTilt<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      return;
    }
    let frame = 0;
    const update = () => {
      frame = 0;
      const { top } = element.getBoundingClientRect();
      element.style.setProperty('--tilt', tiltProgress(top, window.innerHeight).toFixed(3));
    };
    const schedule = () => {
      frame ||= requestAnimationFrame(update);
    };
    const observer = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) {
        schedule();
        window.addEventListener('scroll', schedule, { passive: true });
        window.addEventListener('resize', schedule, { passive: true });
      } else {
        window.removeEventListener('scroll', schedule);
        window.removeEventListener('resize', schedule);
      }
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);

  return ref;
}

const rise = keyframes({
  from: { opacity: 0, translate: `0 ${reveal.distance}` },
  to: { opacity: 1, translate: 'none' },
});

// The screenshot is the page's largest paint, so it only moves, never fades.
const lift = keyframes({
  from: { translate: '0 48px' },
  to: { translate: 'none' },
});

const styles = create({
  actions: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s3,
    justifyContent: 'center',
  },
  // A still grid of dots behind the header and the hero, across the whole
  // viewport: no ancestor is positioned, so it is placed against the page
  // itself, and z-index -1 keeps it under every in-flow box. The dots are
  // the text color, faint, so they follow the theme.
  backdrop: {
    backgroundImage: `radial-gradient(circle, color-mix(in oklab, ${colors.fg} 24%, transparent) 1px, transparent 1.5px)`,
    backgroundPosition: '50% 0',
    backgroundSize: '22px 22px',
    height: {
      default: 560,
      [WIDE]: 760,
    },
    insetInline: 0,
    // Fades out toward the screenshot and the side edges, and almost away
    // behind the words so they stay easy to read.
    maskComposite: 'intersect',
    maskImage:
      'linear-gradient(to bottom, #000 30%, transparent 92%), linear-gradient(to right, transparent, #000 20%, #000 80%, transparent), radial-gradient(48% 42% at 50% 28%, rgb(0 0 0 / 0.12), #000)',
    pointerEvents: 'none',
    position: 'absolute',
    top: 0,
    zIndex: -1,
  },
  copy: {
    alignItems: 'center',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    textAlign: 'center',
  },
  enter: {
    animationDuration: reveal.duration,
    animationFillMode: 'both',
    animationName: {
      default: 'none',
      [MOTION]: rise,
    },
    animationTimingFunction: reveal.ease,
  },
  enterAfter: (step: number) => ({
    animationDelay: `calc(${step} * ${reveal.stagger})`,
  }),
  hero: {
    display: 'flex',
    flexDirection: 'column',
    gap: {
      default: spacing.s8,
      [WIDE]: spacing.s12,
    },
  },
  lead: {
    fontSize: 17,
    maxWidth: 560,
  },
  // Wider than the 720px column: up to 1080px, keeping the 16px gutter.
  media: {
    animationDelay: '240ms',
    animationDuration: '1100ms',
    animationFillMode: 'both',
    animationName: {
      default: 'none',
      [MOTION]: lift,
    },
    animationTimingFunction: reveal.ease,
    marginInline: 'calc(50% - min(50vw - 16px, 540px))',
  },
  shot: {
    boxShadow: brand.shotShadow,
  },
  // Leans back while low on the screen and settles flat as it rises (--tilt
  // from useScrollTilt). Before the script runs it starts fully leaned, so
  // the first measurement only eases it partway up.
  tilt: {
    transform: {
      default: null,
      [media.motionOk]:
        'perspective(1800px) rotateX(calc(var(--tilt, 1) * 9deg)) scale(calc(1 - var(--tilt, 1) * 0.03))',
    },
    transformOrigin: '50% 100%',
    transitionDuration: '400ms',
    transitionProperty: 'transform',
    transitionTimingFunction: reveal.ease,
  },
  title: {
    fontSize: 'clamp(32px, 6.4vw, 52px)',
    letterSpacing: '-0.03em',
    lineHeight: 1.08,
    maxWidth: 640,
  },
});

export function Hero() {
  const mediaRef = useScrollTilt<HTMLDivElement>();

  return (
    <section {...props(styles.hero)}>
      <div aria-hidden="true" {...props(styles.backdrop)} />
      <div {...props(styles.copy)}>
        <h1 {...props(layout.title, styles.title, styles.enter, styles.enterAfter(0))}>
          {m.hero_title()}
        </h1>
        <p {...props(layout.text, styles.lead, styles.enter, styles.enterAfter(1))}>
          {m.hero_lead()}
        </p>
        <div {...props(styles.actions, styles.enter, styles.enterAfter(2))}>
          <DownloadButton location="hero" />
          <CheckoutButton location="hero" />
        </div>
        <p {...props(layout.text, layout.muted, layout.small, styles.enter, styles.enterAfter(3))}>
          {m.hero_note()}
        </p>
      </div>
      <div ref={mediaRef} {...props(styles.media)}>
        <div {...props(styles.tilt)}>
          <Screenshot priority screen={SCREENS.hero} sizes={HERO_SIZES} style={styles.shot} />
        </div>
      </div>
    </section>
  );
}
