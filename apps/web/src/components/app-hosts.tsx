import { colors, font, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import { Laptop, X } from 'lucide-react';
import { brand } from '../lib/brand.stylex.ts';
import { useInView } from '../lib/motion.ts';
import { m } from '../paraglide/messages.js';

const WIDE = '@media (min-width: 640px)';
const MOTION = '@media (prefers-reduced-motion: no-preference)';

/**
 * Every host the desktop app talks to, and nothing else. Keep it in step with
 * the app's CSP and http allowlist (docs/relaunch.md); the Polar sandbox is in
 * dev builds only and stays off this list.
 */
export const APP_HOSTS = [
  { host: 'earsivportal.efatura.gov.tr', purpose: m.host_gib },
  { host: 'www.tcmb.gov.tr', purpose: m.host_tcmb },
  { host: 'api.polar.sh', purpose: m.host_polar },
  { host: 'dl.angaria.app', purpose: m.host_updates },
] as const;

/** Every row is one 24px line tall at its first line; lines and markers center on it. */
const LINE = 24;
/** The trunk runs down the middle of the first 24px column. */
const TRUNK_X = 11;
/** The branch from the trunk to a host's marker, in pixels. */
const BRANCH = 15;
const PACKET = 4;
/** One request every this long per host, offset row by row. */
const CYCLE = '3.2s';
const ROW_OFFSET_S = 0.45;

// A request leaves the trunk and arrives at the host's marker.
const travel = keyframes({
  '0%': { opacity: 0, translate: '0 -50%' },
  '12%': { opacity: 1 },
  '45%': { opacity: 1, translate: `${BRANCH - PACKET}px -50%` },
  '55%, 100%': { opacity: 0, translate: `${BRANCH - PACKET}px -50%` },
});

// A request to anything else stops halfway and fades.
const refused = keyframes({
  '0%': { opacity: 0, translate: '0 -50%' },
  '12%': { opacity: 1 },
  '35%': { opacity: 1, translate: `${(BRANCH - PACKET) / 2}px -50%` },
  '50%, 100%': { opacity: 0, translate: `${(BRANCH - PACKET) / 2}px -50%` },
});

// The marker answers when the request arrives.
const answer = keyframes({
  '0%, 40%': { boxShadow: `0 0 0 0 ${brand.fill}` },
  '75%, 100%': { boxShadow: '0 0 0 6px transparent' },
});

const styles = create({
  allowlist: {
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: 1,
    paddingBlock: spacing.s3,
    paddingInline: spacing.s4,
  },
  animated: {
    animationDuration: CYCLE,
    animationIterationCount: 'infinite',
    animationTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
  },
  // A row's place in the cycle.
  at: (row: number) => ({
    animationDelay: `${row * ROW_OFFSET_S}s`,
  }),
  branch: {
    backgroundColor: colors.border,
    height: 1,
    left: TRUNK_X,
    position: 'absolute',
    top: LINE / 2,
    width: BRANCH,
  },
  connector: {
    alignSelf: 'stretch',
    position: 'relative',
  },
  content: {
    alignItems: {
      default: 'flex-start',
      [WIDE]: 'baseline',
    },
    display: 'flex',
    flexDirection: {
      default: 'column',
      [WIDE]: 'row',
    },
    gap: {
      default: 0,
      [WIDE]: spacing.s4,
    },
    justifyContent: 'space-between',
    marginInlineStart: spacing.s3,
    minWidth: 0,
  },
  device: {
    fontWeight: font.weightMedium,
    marginInlineStart: spacing.s3,
  },
  deviceIcon: {
    color: colors.fg,
    display: 'block',
    height: 16,
    left: TRUNK_X + 0.5 - 8,
    position: 'absolute',
    top: (LINE - 16) / 2,
    width: 16,
  },
  host: {
    fontFamily: "ui-monospace, 'SF Mono', Menlo, Consolas, monospace",
    fontSize: 13,
    overflowWrap: 'anywhere',
  },
  list: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
  },
  marker: {
    backgroundColor: brand.fill,
    borderRadius: 1.5,
    height: 6,
    width: 6,
  },
  markerAnswer: {
    animationName: {
      default: 'none',
      [MOTION]: answer,
    },
  },
  markerCell: {
    alignItems: 'center',
    display: 'flex',
    height: LINE,
    justifyContent: 'center',
  },
  muted: {
    color: colors.muted,
  },
  packet: {
    backgroundColor: brand.fill,
    borderRadius: 1,
    height: PACKET,
    left: TRUNK_X + 1,
    opacity: 0,
    position: 'absolute',
    top: LINE / 2,
    width: PACKET,
  },
  packetRefused: {
    animationName: {
      default: 'none',
      [MOTION]: refused,
    },
    backgroundColor: colors.muted,
  },
  packetTravel: {
    animationName: {
      default: 'none',
      [MOTION]: travel,
    },
  },
  paused: {
    animationPlayState: 'paused',
  },
  purpose: {
    color: colors.muted,
    fontSize: font.sizeSm,
  },
  refusedIcon: {
    color: colors.muted,
    height: 10,
    width: 10,
  },
  row: {
    display: 'grid',
    gridTemplateColumns: '24px 10px 1fr',
    lineHeight: `${LINE}px`,
    paddingBlock: spacing.s2,
  },
  // The vertical line every row hangs from. It reaches through the row's
  // padding so the rows join into one line.
  trunk: {
    backgroundColor: colors.border,
    bottom: `calc(-1 * ${spacing.s2})`,
    left: TRUNK_X,
    position: 'absolute',
    top: `calc(-1 * ${spacing.s2})`,
    width: 1,
  },
  // The last row's line stops at its branch.
  trunkEnd: {
    bottom: `calc(100% - ${LINE / 2}px)`,
  },
  // The device's line starts under its icon.
  trunkStart: {
    top: LINE - 4,
  },
});

/**
 * The app's network allowlist, drawn as one: the Mac at the top, a line to
 * every host it may reach, a small request traveling to each in turn, and
 * the rest of the internet refused at the end.
 */
export function AppHosts() {
  const [ref, inView] = useInView<HTMLDivElement>();

  return (
    <div ref={ref} {...props(styles.allowlist)}>
      <div {...props(styles.row)}>
        <span aria-hidden="true" {...props(styles.connector)}>
          <Laptop {...props(styles.deviceIcon)} />
          <span {...props(styles.trunk, styles.trunkStart)} />
        </span>
        <span />
        <span {...props(styles.device)}>{m.privacy_device()}</span>
      </div>
      <ul {...props(styles.list)}>
        {APP_HOSTS.map(({ host, purpose }, row) => (
          <li key={host} {...props(styles.row)}>
            <span aria-hidden="true" {...props(styles.connector)}>
              <span {...props(styles.trunk)} />
              <span {...props(styles.branch)} />
              <span
                {...props(
                  styles.packet,
                  styles.packetTravel,
                  styles.animated,
                  styles.at(row),
                  !inView && styles.paused,
                )}
              />
            </span>
            <span aria-hidden="true" {...props(styles.markerCell)}>
              <span
                {...props(
                  styles.marker,
                  styles.markerAnswer,
                  styles.animated,
                  styles.at(row),
                  !inView && styles.paused,
                )}
              />
            </span>
            <span {...props(styles.content)}>
              <span {...props(styles.host)}>{host}</span>
              <span {...props(styles.purpose)}>{purpose()}</span>
            </span>
          </li>
        ))}
        <li {...props(styles.row)}>
          <span aria-hidden="true" {...props(styles.connector)}>
            <span {...props(styles.trunk, styles.trunkEnd)} />
            <span {...props(styles.branch)} />
            <span
              {...props(
                styles.packet,
                styles.packetRefused,
                styles.animated,
                styles.at(APP_HOSTS.length),
                !inView && styles.paused,
              )}
            />
          </span>
          <span aria-hidden="true" {...props(styles.markerCell)}>
            <X {...props(styles.refusedIcon)} />
          </span>
          <span {...props(styles.content)}>
            <span {...props(styles.muted)}>{m.privacy_blocked_host()}</span>
            <span {...props(styles.purpose)}>{m.privacy_blocked()}</span>
          </span>
        </li>
      </ul>
    </div>
  );
}
