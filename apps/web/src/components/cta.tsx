import { Button, type ButtonVariant } from '@angaria/ui';
import { create, props } from '@stylexjs/stylex';
import { track, type CtaLocation } from '../lib/analytics.ts';
import { config, SOURCE_URL } from '../lib/config.ts';
import { m } from '../paraglide/messages.js';

const styles = create({
  // A step under the 1rem the theme gives icons in a button, so the mark
  // matches the label's cap height; nudged up to sit on its baseline.
  appleMark: {
    fill: 'currentColor',
    height: '0.875rem',
    transform: 'translateY(-1px)',
    width: '0.875rem',
  },
  mark: {
    fill: 'currentColor',
    height: '0.875rem',
    width: '0.875rem',
  },
});

/** The installer download, wherever the page offers it. */
export function DownloadButton({
  label = m.cta_download(),
  location,
  variant = 'default',
}: {
  label?: string | undefined;
  location: CtaLocation;
  variant?: ButtonVariant | undefined;
}) {
  return (
    <Button
      onClick={() => track('download_click', { location })}
      render={<a href={config.downloadUrl} />}
      variant={variant}
    >
      <svg aria-hidden="true" viewBox="0 0 384 512" {...props(styles.appleMark)}>
        <path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z" />
      </svg>
      {label}
    </Button>
  );
}

/** The source code on GitHub. */
export function SourceButton({
  location,
  variant = 'outline',
}: {
  location: CtaLocation;
  variant?: ButtonVariant | undefined;
}) {
  return (
    <Button
      onClick={() => track('source_click', { location })}
      render={<a href={SOURCE_URL} />}
      variant={variant}
    >
      <GitHubMark />
      {m.cta_source()}
    </Button>
  );
}

/** The GitHub mark, sized like the Apple mark beside its label. */
function GitHubMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" {...props(styles.mark)}>
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
