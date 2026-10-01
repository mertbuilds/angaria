import { Wordmark } from '@angaria/ui';
import { spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { Link } from '@tanstack/react-router';
import { m } from '../paraglide/messages.js';
import { CheckoutButton } from './cta.tsx';

const styles = create({
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
  wordmark: {
    fontSize: 20,
  },
});

export function SiteHeader() {
  return (
    <header {...props(styles.header)}>
      <Link aria-label={m.header_home()} to="/" {...props(styles.home)}>
        <Wordmark style={styles.wordmark} />
      </Link>
      <CheckoutButton label={m.header_buy()} location="header" />
    </header>
  );
}
