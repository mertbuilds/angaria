import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { DEFAULT_PALETTE, paletteChoices } from '../src/lib/palette.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const css = read('../src/palettes.css').replaceAll(/\/\*[\s\S]*?\*\//g, '');

const escape = (text: string) => text.replaceAll(/[[\]()]/g, (char) => `\\${char}`);

/** The variables a rule sets, by name. */
function block(selector: string) {
  const match = new RegExp(`${escape(selector)}[^{]*\\{([^}]*)\\}`).exec(css);
  if (!match) {
    throw new Error(`No rule for ${selector}`);
  }
  return Object.fromEntries(
    [...match[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value]),
  );
}

describe('palettes.css', () => {
  test('index.html starts on the default palette', () => {
    expect(read('../index.html')).toContain(`data-palette="${DEFAULT_PALETTE}"`);
  });

  test.each(paletteChoices)(
    '%s writes the same variables light and dark, both dark blocks alike',
    (palette) => {
      const light = block(`:root[data-palette='${palette}'],`);
      const systemDark = block(`:root[data-palette='${palette}']:not([data-theme='light'])`);
      const forcedDark = block(`[data-palette='${palette}'][data-theme='dark'],`);

      expect(Object.keys(light).length).toBeGreaterThan(0);
      expect(Object.keys(systemDark).toSorted()).toEqual(Object.keys(light).toSorted());
      expect(forcedDark).toEqual(systemDark);
    },
  );
});
