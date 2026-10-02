import { act, render } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { stubAnimate } from '../test/animations.ts';
import { stubObservers } from '../test/observers.ts';
import { mcpLoop, McpScene } from './mcp-scene.tsx';

let restore = () => true;

afterEach(() => {
  restore();
  vi.unstubAllGlobals();
});

describe('MCP scene', () => {
  test('draws every part its loop moves', () => {
    stubObservers();
    const { container } = render(<McpScene />);
    const missing = mcpLoop.tracks.filter(
      ({ part }) => !container.querySelector(`[data-part="${part}"]`),
    );
    expect(missing.map(({ part }) => part)).toEqual([]);
  });

  test('runs every track forward, inside the loop', () => {
    for (const { frames, part } of mcpLoop.tracks) {
      const times = frames.map(([at]) => at);
      expect(times, part).toEqual(times.toSorted((a, b) => a - b));
      expect(
        times.every((at) => at >= 0 && at <= mcpLoop.duration),
        part,
      ).toBe(true);
    }
  });

  test('is decorative: the page text carries the meaning', () => {
    stubObservers();
    const { container } = render(<McpScene />);
    expect(container.firstElementChild).toHaveAttribute('aria-hidden', 'true');
  });

  test('with reduced motion shows the draft and the reply, still', () => {
    const observers = stubObservers({ reducedMotion: true });
    const stub = stubAnimate();
    restore = stub.restore;
    const { container } = render(<McpScene />);
    act(() => observers.intersect(true));

    expect(stub.animate).not.toHaveBeenCalled();
    expect(container).toHaveTextContent('Acme için 4.500 USD taslak hazırla');
    expect(container).toHaveTextContent('Taslak oluştur');
    expect(container).toHaveTextContent('Acme Corp');
    expect(container).toHaveTextContent("Taslak oluşturuldu, Angaria'da SMS ile onayla.");
  });
});
