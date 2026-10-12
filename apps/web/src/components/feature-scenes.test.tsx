import { act, render } from '@testing-library/react';
import type { ComponentType } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import type { Loop } from '../lib/loop.ts';
import { stubAnimate } from '../test/animations.ts';
import { stubObservers } from '../test/observers.ts';
import { cycleLoop } from './cycling-word.tsx';
import {
  companiesLoop,
  CompaniesScene,
  customersLoop,
  CustomersScene,
  pdfLoop,
  PdfScene,
  ratesLoop,
  RatesScene,
  repeatLoop,
  RepeatScene,
  rulesLoop,
  RulesScene,
  startLoop,
  StartScene,
} from './feature-scenes.tsx';

const SCENES: Array<[name: string, Scene: ComponentType, loop: Loop]> = [
  ['rules', RulesScene, rulesLoop],
  ['start', StartScene, startLoop],
  ['repeat', RepeatScene, repeatLoop],
  ['customers', CustomersScene, customersLoop],
  ['pdf', PdfScene, pdfLoop],
  ['rates', RatesScene, ratesLoop],
  ['companies', CompaniesScene, companiesLoop],
];

let restore = () => true;

afterEach(() => {
  restore();
  vi.unstubAllGlobals();
});

describe.each(SCENES)('%s scene', (_, Scene, loop) => {
  test('draws every part its loop moves', () => {
    stubObservers();
    const { container } = render(<Scene />);
    const missing = loop.tracks.filter(
      ({ part }) => !container.querySelector(`[data-part="${part}"]`),
    );
    expect(missing.map(({ part }) => part)).toEqual([]);
  });

  test('runs every track forward, inside the loop', () => {
    for (const { frames, part } of loop.tracks) {
      const times = frames.map(([at]) => at);
      expect(times, part).toEqual(times.toSorted((a, b) => a - b));
      expect(
        times.every((at) => at >= 0 && at <= loop.duration),
        part,
      ).toBe(true);
    }
  });

  test('draws no progress line', () => {
    stubObservers();
    const { container } = render(<Scene />);
    expect(container.querySelector('[data-part="progress"]')).not.toBeInTheDocument();
  });

  test('is decorative: the card text carries the meaning', () => {
    stubObservers();
    const { container } = render(<Scene />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  test('waits on its first frame until it is in view, and pauses out of view', () => {
    const observers = stubObservers();
    const stub = stubAnimate();
    restore = stub.restore;
    render(<Scene />);

    expect(stub.animations.length).toBeGreaterThanOrEqual(loop.tracks.length);
    expect(stub.animations.every(({ play }) => play.mock.calls.length === 0)).toBe(true);
    act(() => observers.intersect(true));
    expect(stub.animations.every(({ play }) => play.mock.calls.length === 1)).toBe(true);
    for (const { pause } of stub.animations) {
      pause.mockClear();
    }
    act(() => observers.intersect(false));
    expect(stub.animations.every(({ pause }) => pause.mock.calls.length === 1)).toBe(true);
  });
});

test('no two scenes, nor the MCP heading, move the same part', () => {
  const loops = [...SCENES.map(([, , loop]) => loop), cycleLoop('mcp-app', 3)];
  const parts = loops.flatMap((loop) => loop.tracks.map(({ part }) => part));
  expect(parts.filter((part, index) => parts.indexOf(part) !== index)).toEqual([]);
});

describe('with reduced motion', () => {
  test('every scene shows its last frame, still', () => {
    const observers = stubObservers({ reducedMotion: true });
    const stub = stubAnimate();
    restore = stub.restore;
    const [rules, start, repeat, customers, pdf, rates, companies] = SCENES.map(
      ([, Scene]) => render(<Scene />).container,
    );
    act(() => observers.intersect(true));

    expect(stub.animate).not.toHaveBeenCalled();
    expect(rules).toHaveTextContent('VUK 231/5');
    expect(start).toHaveTextContent('₺22.200,00');
    expect(repeat).toHaveTextContent('12.10.2026');
    expect(customers).toHaveTextContent('14 gün vade');
    expect(pdf).toHaveTextContent('INVOICE');
    expect(rates).toHaveTextContent('₺315.417,40');
    expect(companies).toHaveTextContent('Deniz Yılmaz Yazılım');
  });
});

// The rules card shows the app's own messages, word for word: a change in the
// app's wording fails here until the scene follows it.
test('the rules scene shows the app’s messages and the laws they cite', async () => {
  // Loaded at run time only: the desktop's types follow its own compiler settings.
  const desktop = new URL('../../../desktop/src/lib/invoice-form.ts', import.meta.url).pathname;
  const { INVOICE_WINDOW_WARNING, ISTISNA_VAT_ERROR } = (await import(
    /* @vite-ignore */ desktop
  )) as Record<'INVOICE_WINDOW_WARNING' | 'ISTISNA_VAT_ERROR', string>;
  stubObservers();
  const { container } = render(<RulesScene />);
  const [warning, error] = ['rules-warning', 'rules-error'].map(
    (part) => container.querySelector(`[data-part="${part}"]`)?.textContent,
  );
  expect(warning).toBe(INVOICE_WINDOW_WARNING);
  expect(error).toBe(ISTISNA_VAT_ERROR);
});
