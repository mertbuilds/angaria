import { create, props, type StyleXStyles } from '@stylexjs/stylex';
import { createContext, use, type ComponentProps, type ReactNode } from 'react';
import { media, reveal } from '../lib/brand.stylex.ts';
import { useInView } from '../lib/motion.ts';

/** Parts past this one rise together, so a long list does not keep the last ones waiting. */
const MAX_STAGGER = 5;

const styles = create({
  delay: (index: number) => ({
    transitionDelay: `calc(${Math.min(index, MAX_STAGGER)} * ${reveal.stagger})`,
  }),
  // Hidden only where motion is welcome and scripts run (media.motionOk); for
  // everyone else the part is simply there.
  part: {
    opacity: {
      default: null,
      [media.motionOk]: 0,
    },
    transitionDuration: reveal.duration,
    transitionProperty: 'opacity, translate',
    transitionTimingFunction: reveal.ease,
    translate: {
      default: null,
      [media.motionOk]: `0 ${reveal.distance}`,
    },
  },
  shown: {
    opacity: 1,
    translate: 'none',
  },
});

/** Whether the section around a part has come into view. Outside a section, always. */
const RevealContext = createContext(true);

/**
 * A landing section that rises into view the first time it reaches the
 * screen. Its `Reveal` parts follow one after another.
 */
export function RevealSection({
  children,
  style,
  ...rest
}: Omit<ComponentProps<'section'>, 'className' | 'ref' | 'style'> & {
  style?: StyleXStyles | undefined;
}) {
  const [ref, inView] = useInView<HTMLElement>({ once: true, rootMargin: '0px 0px -10% 0px' });
  return (
    <RevealContext value={inView}>
      <section ref={ref} {...rest} {...props(style)}>
        {children}
      </section>
    </RevealContext>
  );
}

/** The `index`th part of a `RevealSection`: a short, slow rise, a step after the one before. */
export function Reveal({
  as: Tag = 'div',
  children,
  index,
  style,
}: {
  as?: 'div' | 'li';
  children: ReactNode;
  index: number;
  style?: StyleXStyles | undefined;
}) {
  const shown = use(RevealContext);
  return (
    <Tag {...props(styles.part, styles.delay(index), shown && styles.shown, style)}>{children}</Tag>
  );
}
