import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { shell } from './shell.stylex.ts';

const styles = create({
  actions: {
    alignItems: 'center',
    display: 'flex',
    flexShrink: 0,
    gap: spacing.s2,
  },
  content: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    minHeight: 0,
    minWidth: 0,
  },
  root: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    minHeight: 0,
    minWidth: 0,
  },
  scroll: {
    overflowY: 'auto',
  },
  spacer: {
    alignSelf: 'stretch',
    flex: 1,
    minWidth: spacing.s4,
  },
  title: {
    color: colors.fg,
    flexShrink: 0,
    fontSize: font.sizeSm,
    fontWeight: font.weightMedium,
    margin: 0,
    whiteSpace: 'nowrap',
  },
  toolbar: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderBottomColor: colors.border,
    borderBottomStyle: 'solid',
    borderBottomWidth: '1px',
    boxSizing: 'border-box',
    display: 'flex',
    flexShrink: 0,
    gap: spacing.s3,
    height: shell.toolbarHeight,
    paddingInline: spacing.s4,
    userSelect: 'none',
  },
});

export interface ScreenProps {
  /** Right end of the toolbar: this screen's buttons. */
  actions?: ReactNode;
  children: ReactNode;
  /**
   * The content area scrolls by default. Pass false when the content handles
   * its own scrolling or fills the pane (ListDetail, an iframe).
   */
  scroll?: boolean;
  /** Left end of the toolbar. */
  title: ReactNode;
  /** After the title: tabs, a segmented control, filters. */
  toolbar?: ReactNode;
}

/**
 * One route's main area: a 52px toolbar (title, toolbar slot, actions) over
 * the content. The toolbar is the window's drag region under the macOS
 * overlay titlebar; its empty parts and the title drag, its controls do not.
 */
export function Screen({ actions, children, scroll = true, title, toolbar }: ScreenProps) {
  return (
    <section {...props(styles.root)}>
      <header data-tauri-drag-region {...props(styles.toolbar)}>
        <h1 data-tauri-drag-region {...props(styles.title)}>
          {title}
        </h1>
        {toolbar}
        <div data-tauri-drag-region {...props(styles.spacer)} />
        {actions && <div {...props(styles.actions)}>{actions}</div>}
      </header>
      <div {...props(styles.content, scroll && styles.scroll)}>{children}</div>
    </section>
  );
}
