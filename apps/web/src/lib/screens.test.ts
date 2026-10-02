import { expect, test } from 'vitest';
import { SCREENS, screenSources } from './screens.ts';

/** Every export in public/screens, as the page links it. */
const EXPORTS = new Set(
  Object.keys(import.meta.glob('../../public/screens/*.webp')).map((file) =>
    file.replace('../../public', ''),
  ),
);

test('every screen the page shows has an export at every width and theme', () => {
  const linked = Object.values(SCREENS).flatMap((screen) =>
    (['light', 'dark'] as const).flatMap((theme) =>
      screenSources(screen, theme)
        .srcSet.split(', ')
        .map((entry) => entry.split(' ')[0]),
    ),
  );
  expect(linked.filter((file) => !file || !EXPORTS.has(file))).toEqual([]);
  expect(linked).toContain('/screens/gib-portal-2880.webp');
});
