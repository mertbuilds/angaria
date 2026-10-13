import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { paletteChoices } from '../src/lib/palette.ts';

// WCAG 1.4.11: a field's border is at least 3:1 against what it touches, its
// own fill and the canvas and card it sits on, in every palette and mode.

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8').replaceAll(/\/\*[\s\S]*?\*\//g, '');
const palettes = read('../src/palettes.css');
const theme = read('../../../packages/ui/src/theme.css');

const escape = (text: string) => text.replaceAll(/[[\]()]/g, (char) => `\\${char}`);

/** The variables the first rule whose selector starts with `selector` sets. */
function block(css: string, selector: string) {
  const match = new RegExp(`${escape(selector)}[^{]*\\{([^}]*)\\}`).exec(css);
  if (!match?.[1]) {
    throw new Error(`No rule for ${selector}`);
  }
  return Object.fromEntries(
    [...match[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value]),
  ) as Record<string, string | undefined>;
}

function luminance(hex: string) {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim());
  if (!match) {
    throw new Error(`Not a #rrggbb color: ${hex}`);
  }
  const [red, green, blue] = match.slice(1).map((channel) => {
    const value = Number.parseInt(channel, 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * red! + 0.7152 * green! + 0.0722 * blue!;
}

function contrast(a: string, b: string) {
  const [light, dark] = [luminance(a), luminance(b)].toSorted((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

const kitLight = block(theme, ':root,');
const kitDark = block(theme, "[data-theme='dark']");

const modes = [
  { dark: false, name: 'kit light', vars: kitLight },
  { dark: true, name: 'kit dark', vars: kitDark },
  ...paletteChoices.flatMap((palette) => [
    {
      dark: false,
      name: `${palette} light`,
      vars: { ...kitLight, ...block(palettes, `:root[data-palette='${palette}'],`) },
    },
    {
      dark: true,
      name: `${palette} dark`,
      vars: { ...kitDark, ...block(palettes, `[data-palette='${palette}'][data-theme='dark'],`) },
    },
  ]),
];

describe('field borders', () => {
  test('cover the kit and every palette in both modes', () => {
    expect(modes.map((mode) => mode.name)).toEqual([
      'kit light',
      'kit dark',
      ...paletteChoices.flatMap((palette) => [`${palette} light`, `${palette} dark`]),
    ]);
  });

  test.each(modes)('$name: --input is at least 3:1 against fill, canvas and card', ({ vars }) => {
    const border = vars['--input']!;
    // Without --input-background the fill is transparent: the surface shows through.
    const surfaces = [vars['--input-background'], vars['--background'], vars['--card']].filter(
      (color): color is string => color !== undefined,
    );
    for (const surface of surfaces) {
      expect(contrast(border, surface), `${border} on ${surface}`).toBeGreaterThanOrEqual(3);
    }
    const hover = vars['--input-hover'];
    if (hover) {
      for (const surface of surfaces) {
        expect(contrast(hover, surface), `${hover} on ${surface}`).toBeGreaterThan(
          contrast(border, surface),
        );
      }
    }
  });

  test.each(modes.filter((mode) => mode.dark && mode.vars['--input-background']))(
    '$name: the field fill is lifted above the card',
    ({ vars }) => {
      expect(luminance(vars['--input-background']!)).toBeGreaterThan(luminance(vars['--card']!));
    },
  );
});
