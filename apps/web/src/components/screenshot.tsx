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
 * An app screenshot that follows the page's theme: the dark export for a dark
 * page, the light one otherwise. A themed screen renders both exports, each in
 * a `data-shot` box that `app.css` shows for its theme, so a theme chosen in
 * the footer switches them too (a `<picture>` media query follows only the
 * system). A lazy image in a hidden box is never fetched.
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
  const image = (theme: 'dark' | 'light', alt: string) => {
    const sources = screenSources(screen, theme);
    return (
      <img
        alt={alt}
        decoding="async"
        draggable={false}
        fetchPriority={priority ? 'high' : 'auto'}
        height={screen.height}
        loading={priority ? 'eager' : 'lazy'}
        sizes={sizes}
        src={sources.src}
        srcSet={sources.srcSet}
        width={screen.width}
        {...props(styles.image, screen.framed && styles.framed, style)}
      />
    );
  };
  if (!screen.themed) {
    return image('light', screen.alt());
  }
  return (
    <>
      <span data-shot="light">{image('light', screen.alt())}</span>
      <span data-shot="dark">{image('dark', screen.alt())}</span>
    </>
  );
}
