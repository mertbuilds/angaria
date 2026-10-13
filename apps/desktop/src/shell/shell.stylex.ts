import { defineConsts } from '@stylexjs/stylex';

/**
 * Shell geometry. The toolbar height also clears the macOS traffic lights:
 * the sidebar header uses it as its top padding, so the wordmark sits on the
 * toolbar's bottom edge. `trafficLightsInset` is the width they take at the
 * window's left edge (Tauri's default position under the overlay titlebar):
 * a bar across the whole window starts its content after it.
 *
 * The content floats as a panel `panelInset` from the window's edges and the
 * sidebar, rounded by `panelRadius`. A rounded element in one of its corners
 * takes the panel's radius minus its own inset, so the curves stay concentric.
 */
export const shell = defineConsts({
  panelInset: '8px',
  panelRadius: '12px',
  toolbarHeight: '52px',
  trafficLightsInset: '80px',
});
