import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { SCREENS } from '../lib/screens.ts';
import { stubObservers } from '../test/observers.ts';
import { CompareSlider, positionAt } from './compare-slider.tsx';
import { Screenshot } from './screenshot.tsx';

const renderSlider = () =>
  render(<CompareSlider after={null} afterLabel="Angaria" before={null} beforeLabel="GİB" />);

const slider = () => screen.getByRole('slider');

/**
 * jsdom has no layout and no pointer capture: the frame spans 0 to 200px and
 * holds one captured pointer at a time.
 */
function stubFrame(frame: HTMLElement) {
  let captured: number | null = null;
  frame.getBoundingClientRect = () => DOMRect.fromRect({ height: 125, width: 200, x: 0, y: 0 });
  frame.setPointerCapture = (pointerId) => {
    captured = pointerId;
  };
  frame.hasPointerCapture = (pointerId) => captured === pointerId;
  frame.releasePointerCapture = () => {
    captured = null;
  };
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('positionAt', () => {
  test('is the pointer position along the frame, kept inside it', () => {
    expect(positionAt(150, 100, 200)).toBe(25);
    expect(positionAt(50, 100, 200)).toBe(0);
    expect(positionAt(400, 100, 200)).toBe(100);
    expect(positionAt(150, 100, 0)).toBe(50);
  });
});

describe('CompareSlider', () => {
  test('moves the divider with the range input', () => {
    stubObservers();
    renderSlider();
    expect(slider()).toHaveValue('50');

    fireEvent.change(slider(), { target: { value: '70' } });
    expect(slider()).toHaveValue('70');
  });

  test('follows a drag that starts on a screenshot, which never drags itself', () => {
    stubObservers();
    render(
      <CompareSlider
        after={<Screenshot screen={SCREENS.compare} sizes="100vw" />}
        afterLabel="Angaria"
        before={<Screenshot screen={SCREENS.gib} sizes="100vw" />}
        beforeLabel="GİB"
      />,
    );
    const frame = slider().parentElement;
    if (!frame) {
      throw new Error('No slider frame');
    }
    stubFrame(frame);
    const gib = screen.getByAltText(SCREENS.gib.alt());

    expect(gib).toHaveAttribute('draggable', 'false');
    expect(fireEvent.dragStart(gib)).toBe(false);

    expect(fireEvent.pointerDown(gib, { clientX: 40, pointerId: 1 })).toBe(false);
    expect(slider()).toHaveValue('20');
    fireEvent.pointerMove(frame, { clientX: 150, pointerId: 1 });
    expect(slider()).toHaveValue('75');

    fireEvent.pointerUp(frame, { pointerId: 1 });
    fireEvent.pointerMove(frame, { clientX: 10, pointerId: 1 });
    expect(slider()).toHaveValue('75');
  });

  test('nudges the divider once when it comes into view', () => {
    vi.useFakeTimers();
    const observers = stubObservers();
    renderSlider();

    act(() => observers.intersect(true));
    act(() => vi.advanceTimersByTime(0));
    expect(slider()).toHaveValue('34');
    act(() => vi.advanceTimersByTime(700));
    expect(slider()).toHaveValue('50');
  });

  test('with reduced motion, never nudges', () => {
    vi.useFakeTimers();
    const observers = stubObservers({ reducedMotion: true });
    renderSlider();

    act(() => observers.intersect(true));
    act(() => vi.runAllTimers());
    expect(slider()).toHaveValue('50');
  });
});
