import { Wordmark } from '@angaria/ui';
import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { Link, useMatchRoute } from '@tanstack/react-router';
import { brand } from '../lib/brand.stylex.ts';
import { m } from '../paraglide/messages.js';
import { CheckoutButton } from './cta.tsx';

const styles = create({
  actions: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s2,
  },
  header: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
    paddingBlock: spacing.s6,
  },
  home: {
    color: 'inherit',
    textDecorationLine: 'none',
  },
  // Plain text beside the trial button, padded to a comfortable hit area.
  link: {
    color: {
      ':hover': brand.ink,
      default: colors.muted,
    },
    display: 'block',
    fontSize: font.sizeSm,
    paddingBlock: spacing.s2,
    paddingInline: spacing.s2,
    textDecorationLine: 'none',
  },
  linkCurrent: {
    color: {
      ':hover': brand.ink,
      default: colors.fg,
    },
  },
  wordmark: {
    fontSize: 20,
  },
});

export function SiteHeader() {
  const matchRoute = useMatchRoute();
  const onMcp = matchRoute({ to: '/mcp' }) !== false;
  return (
    <header {...props(styles.header)}>
      <Link aria-label={m.header_home()} to="/" {...props(styles.home)}>
        <Wordmark style={styles.wordmark} />
      </Link>
      <div {...props(styles.actions)}>
        <nav aria-label={m.header_nav()}>
          <Link to="/mcp" {...props(styles.link, onMcp && styles.linkCurrent)}>
            {m.header_mcp()}
          </Link>
        </nav>
        <CheckoutButton label={m.header_trial()} location="header" />
      </div>
    </header>
  );
}
