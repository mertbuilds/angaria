import { colors } from '@angaria/ui/tokens.stylex';
import { create, props, when, type StyleXStyles } from '@stylexjs/stylex';
import { reveal } from '../lib/brand.stylex.ts';
import { screenSources, type Screen } from '../lib/screens.ts';

const HOVER = '@media (hover: hover) and (prefers-reduced-motion: no-preference)';

/**
 * The part of a screenshot a card shows: the point to keep in view, as
 * percentages from the top left, and how far to zoom in on it.
 */
export interface Crop {
  x: number;
  y: number;
  zoom: number;
}

const styles = create({
  box: {
    aspectRatio: '16 / 10',
    backgroundColor: colors.subtle,
    overflow: 'hidden',
    position: 'relative',
  },
  cropAt: (crop: Crop) => ({
    '--crop-zoom': String(crop.zoom),
    objectPosition: `${crop.x}% ${crop.y}%`,
    transformOrigin: `${crop.x}% ${crop.y}%`,
  }),
  croppedImage: {
    height: '100%',
    inset: 0,
    objectFit: 'cover',
    position: 'absolute',
    // Cards mark themselves with defaultMarker(), so hovering the card, not
    // just the picture, leans in a little closer.
    scale: {
      default: 'var(--crop-zoom)',
      [HOVER]: {
        default: 'var(--crop-zoom)',
        [when.ancestor(':hover')]: 'calc(var(--crop-zoom) * 1.04)',
      },
    },
    transitionDuration: reveal.duration,
    transitionProperty: 'scale',
    transitionTimingFunction: reveal.ease,
    width: '100%',
  },
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
 * system, the light one otherwise. With `crop`, it fills a 16:10 box zoomed in
 * on one part of the screen, and `style` goes on the box; without, on the image.
 */
export function Screenshot({
  crop,
  priority = false,
  screen,
  sizes,
  style,
}: {
  crop?: Crop | undefined;
  /** The page's largest image: fetched first, never lazily. */
  priority?: boolean;
  screen: Screen;
  sizes: string;
  style?: StyleXStyles | undefined;
}) {
  const light = screenSources(screen, 'light');
  const picture = (
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
        {...props(
          crop
            ? [styles.croppedImage, styles.cropAt(crop)]
            : [styles.image, screen.framed && styles.framed, style],
        )}
      />
    </picture>
  );

  return crop ? <div {...props(styles.box, style)}>{picture}</div> : picture;
}
