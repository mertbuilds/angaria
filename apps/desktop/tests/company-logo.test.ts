import { expect, test } from 'vitest';
import { fitLogoSize } from '../src/lib/company-logo.ts';

test('fitLogoSize scales the longest side down to the limit, keeping the ratio', () => {
  expect(fitLogoSize(1600, 400)).toEqual({ height: 200, width: 800 });
  expect(fitLogoSize(300, 1200)).toEqual({ height: 800, width: 200 });
  expect(fitLogoSize(400, 100)).toEqual({ height: 100, width: 400 });
  expect(fitLogoSize(4000, 1)).toEqual({ height: 1, width: 800 });
});

test('fitLogoSize scales up when asked (an SVG drawn sharp)', () => {
  expect(fitLogoSize(120, 30, { upscale: true })).toEqual({ height: 200, width: 800 });
  expect(fitLogoSize(120, 30, { max: 240, upscale: true })).toEqual({ height: 60, width: 240 });
});
