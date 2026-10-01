import { colors, font, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { m } from '../paraglide/messages.js';

const WIDE = '@media (min-width: 640px)';

/**
 * Every host the desktop app talks to, and nothing else. Keep it in step with
 * the app's CSP and http allowlist (docs/relaunch.md); the Polar sandbox is in
 * dev builds only and stays off this list.
 */
export const APP_HOSTS = [
  { host: 'earsivportal.efatura.gov.tr', purpose: m.host_gib },
  { host: 'earsivportaltest.efatura.gov.tr', purpose: m.host_gib_test },
  { host: 'www.tcmb.gov.tr', purpose: m.host_tcmb },
  { host: 'api.polar.sh', purpose: m.host_polar },
  { host: 'dl.angaria.app', purpose: m.host_updates },
] as const;

const styles = create({
  host: {
    fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
    fontSize: 13,
    overflowWrap: 'anywhere',
  },
  list: {
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: 1,
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  purpose: {
    color: colors.muted,
    fontSize: font.sizeSm,
  },
  row: {
    alignItems: {
      default: 'flex-start',
      [WIDE]: 'baseline',
    },
    borderTopColor: colors.border,
    borderTopStyle: {
      ':first-child': 'none',
      default: 'solid',
    },
    borderTopWidth: 1,
    display: 'flex',
    flexDirection: {
      default: 'column',
      [WIDE]: 'row',
    },
    gap: {
      default: spacing.s1,
      [WIDE]: spacing.s4,
    },
    justifyContent: 'space-between',
    paddingBlock: spacing.s3,
    paddingInline: spacing.s4,
  },
});

export function AppHosts() {
  return (
    <ul {...props(styles.list)}>
      {APP_HOSTS.map(({ host, purpose }) => (
        <li key={host} {...props(styles.row)}>
          <span {...props(styles.host)}>{host}</span>
          <span {...props(styles.purpose)}>{purpose()}</span>
        </li>
      ))}
    </ul>
  );
}
