import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { stubObservers } from '../test/observers.ts';
import { CompareSlider, positionAt } from './compare-slider.tsx';

const renderSlider = () =>
  render(<CompareSlider after={null} afterLabel="Angaria" before={null} beforeLabel="GİB" />);

const slider = () => screen.getByRole('slider');

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
