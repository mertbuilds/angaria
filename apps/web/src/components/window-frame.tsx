import { colors, font, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';

const DOT_SIZE = 12;

const styles = create({
  body: {
    alignItems: 'center',
    backgroundColor: colors.subtle,
    color: colors.muted,
    display: 'flex',
    fontSize: font.sizeSm,
    justifyContent: 'center',
    padding: spacing.s4,
    textAlign: 'center',
  },
  // The traffic lights in the canon's gray: the only chroma on the site is
  // the destructive red and the warning amber.
  dot: {
    backgroundColor: colors.border,
    borderRadius: radius.full,
    height: DOT_SIZE,
    width: DOT_SIZE,
  },
  frame: {
    aspectRatio: '16 / 10',
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    display: 'grid',
    gridTemplateRows: 'auto 1fr',
    overflow: 'hidden',
    width: '100%',
  },
  titlebar: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomStyle: 'solid',
    borderBottomWidth: 1,
    display: 'flex',
    gap: spacing.s2,
    paddingBlock: spacing.s3,
    paddingInline: spacing.s3,
  },
});

/**
 * A macOS window, 16:10, standing in for a screenshot until the real one
 * lands. The label says what goes inside.
 */
export function WindowFrame({ label }: { label: string }) {
  return (
    <div {...props(styles.frame)}>
      <div aria-hidden="true" {...props(styles.titlebar)}>
        <span {...props(styles.dot)} />
        <span {...props(styles.dot)} />
        <span {...props(styles.dot)} />
      </div>
      <div {...props(styles.body)}>{label}</div>
    </div>
  );
}
