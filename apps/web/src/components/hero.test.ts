import { expect, test } from 'vitest';
import { tiltProgress } from './hero.tsx';

test('the hero screenshot leans while low on the screen and lies flat near the top', () => {
  const viewport = 1000;
  expect(tiltProgress(900, viewport)).toBe(1);
  expect(tiltProgress(850, viewport)).toBe(1);
  expect(tiltProgress(525, viewport)).toBeCloseTo(0.5);
  expect(tiltProgress(200, viewport)).toBe(0);
  expect(tiltProgress(-400, viewport)).toBe(0);
});
