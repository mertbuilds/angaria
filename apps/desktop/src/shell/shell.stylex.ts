import { defineConsts } from '@stylexjs/stylex';

/**
 * Shell geometry. The toolbar height also clears the macOS traffic lights:
 * the sidebar header uses it as its top padding, so the wordmark sits on the
 * toolbar's bottom edge.
 */
export const shell = defineConsts({
  toolbarHeight: '52px',
});
