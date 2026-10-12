import { create, props, type StyleXStyles } from '@stylexjs/stylex';
import { screenSources, type Screen } from '../lib/screens.ts';

const styles = create({
  // A framed export has 20px corners at 1440 by 900 on a transparent
  // background: the same corners as percentages, so a shadow follows them.
  framed: {
    borderRadius: `${(20 / 1440) * 100}% / ${(20 / 900) * 100}%`,
  },
  image: {
    display: 'block',
    height: 'auto',
    width: '100%',
  },
});

/**
 * An app screenshot that follows the color scheme: the dark export for a dark
 * system, the light one otherwise.
 */
export function Screenshot({
  priority = false,
  screen,
  sizes,
  style,
}: {
  /** The page's largest image: fetched first, never lazily. */
  priority?: boolean;
  screen: Screen;
  sizes: string;
  style?: StyleXStyles | undefined;
}) {
  const light = screenSources(screen, 'light');
  return (
    <picture>
      {screen.themed ? (
        <source
          media="(prefers-color-scheme: dark)"
          sizes={sizes}
          srcSet={screenSources(screen, 'dark').srcSet}
        />
      ) : null}
      <img
        alt={screen.alt()}
        decoding="async"
        draggable={false}
        fetchPriority={priority ? 'high' : 'auto'}
        height={screen.height}
        loading={priority ? 'eager' : 'lazy'}
        sizes={sizes}
        src={light.src}
        srcSet={light.srcSet}
        width={screen.width}
        {...props(styles.image, screen.framed && styles.framed, style)}
      />
    </picture>
  );
}
