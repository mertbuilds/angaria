import { create, props, type StyleXStyles } from '@stylexjs/stylex';

const styles = create({
  icon: {
    display: 'block',
    flexShrink: 0,
    height: 'auto',
  },
  size: (size: number) => ({
    width: size,
  }),
});

/**
 * The Mac app's icon (public/app-icon.png, from `pnpm icons`), beside a
 * download. Decorative: the words next to it name the app.
 */
export function AppIcon({ size, style }: { size: number; style?: StyleXStyles | undefined }) {
  return (
    <img
      alt={''}
      height={256}
      src="/app-icon.png"
      width={256}
      {...props(styles.icon, styles.size(size), style)}
    />
  );
}
