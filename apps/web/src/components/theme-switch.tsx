import { colors, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useSyncExternalStore } from 'react';
import {
  applyTheme,
  readTheme,
  serverTheme,
  subscribeTheme,
  themeChoices,
  type ThemeChoice,
} from '../lib/theme.ts';
import { m } from '../paraglide/messages.js';

const THEME_NAMES: Record<ThemeChoice, () => string> = {
  dark: m.theme_dark,
  light: m.theme_light,
  system: m.theme_system,
};

const styles = create({
  // One choice: a pill inside the track's pill. On a phone the pseudo-element
  // takes the touch a finger's height around it. The picked one is drawn by
  // `app.css`, from the choice on `<html>`.
  segment: {
    '::before': {
      content: '',
      insetBlock: {
        '@media (max-width: 767px)': -10,
        default: 0,
      },
      insetInline: 0,
      position: 'absolute',
    },
    backgroundColor: 'transparent',
    borderRadius: 999,
    borderStyle: 'none',
    borderWidth: 0,
    boxSizing: 'border-box',
    color: {
      ':hover': {
        '@media (hover: hover)': colors.fg,
        default: null,
      },
      default: colors.muted,
    },
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 12,
    height: 24,
    lineHeight: 1,
    outlineColor: colors.muted,
    outlineOffset: 2,
    outlineStyle: {
      ':focus-visible': 'solid',
      default: 'none',
    },
    outlineWidth: 1,
    paddingBlock: 5,
    paddingInline: spacing.s2,
    position: 'relative',
  },
  // The track: a pill, as the site's buttons are.
  segmented: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderColor: colors.border,
    borderRadius: 999,
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    display: 'flex',
    gap: 2,
    height: 28,
    padding: 1,
  },
});

/**
 * The theme control at the foot of every page. The picked segment is drawn
 * by CSS from the choice the head's script put on `<html>`, right from the
 * first paint; only `aria-pressed` waits for the page to come alive.
 */
export function ThemeSwitch() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, serverTheme);

  return (
    <div aria-label={m.theme_label()} role="group" {...props(styles.segmented)}>
      {themeChoices.map((choice) => (
        <button
          aria-pressed={choice === theme}
          data-theme-pick={choice}
          key={choice}
          onClick={() => applyTheme(choice)}
          type="button"
          {...props(styles.segment)}
        >
          {THEME_NAMES[choice]()}
        </button>
      ))}
    </div>
  );
}
