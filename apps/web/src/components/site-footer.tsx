import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { Link } from '@tanstack/react-router';
import { brand } from '../lib/brand.stylex.ts';
import { Sentence } from '../lib/slot.tsx';
import { m } from '../paraglide/messages.js';

export const CONTACT_EMAIL = 'mert@vinena.studio';
/** Every link to one of our own sites carries utm tags, so the visit is traced to this one. */
const STUDIO_URL =
  'https://vinena.studio/?utm_source=angaria.app&utm_medium=referral&utm_campaign=footer';
/** Read once per load, not per render: the copyright line only moves at New Year. */
const YEAR = new Date().getFullYear();

const styles = create({
  footer: {
    borderTopColor: colors.border,
    borderTopStyle: 'solid',
    borderTopWidth: 1,
    color: colors.muted,
    display: 'flex',
    flexDirection: 'column',
    fontSize: font.sizeSm,
    gap: spacing.s3,
    marginBlockStart: spacing.s16,
    paddingBlock: spacing.s6,
  },
  line: {
    margin: 0,
  },
  link: {
    color: {
      ':hover': brand.ink,
      default: 'inherit',
    },
  },
  links: {
    columnGap: spacing.s6,
    display: 'flex',
    flexWrap: 'wrap',
    listStyle: 'none',
    margin: 0,
    padding: 0,
    rowGap: spacing.s2,
  },
});

export function SiteFooter() {
  return (
    <footer {...props(styles.footer)}>
      <p {...props(styles.line)}>
        <Sentence
          message={(studio) => m.footer_made_by({ studio })}
          slot={
            <a href={STUDIO_URL} {...props(styles.link)}>
              {m.footer_studio()}
            </a>
          }
        />
      </p>
      <p {...props(styles.line)}>{m.footer_disclaimer()}</p>
      <nav aria-label={m.footer_links()}>
        <ul {...props(styles.links)}>
          <li>
            <Link to="/gizlilik" {...props(styles.link)}>
              {m.footer_privacy()}
            </Link>
          </li>
          <li>
            <Link to="/kosullar" {...props(styles.link)}>
              {m.footer_terms()}
            </Link>
          </li>
          <li>
            <a href={`mailto:${CONTACT_EMAIL}`} {...props(styles.link)}>
              {CONTACT_EMAIL}
            </a>
          </li>
        </ul>
      </nav>
      <p {...props(styles.line)}>{m.footer_copyright({ year: YEAR })}</p>
    </footer>
  );
}
