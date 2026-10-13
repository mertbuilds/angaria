import { render } from '@testing-library/react';
import { expect, test } from 'vitest';
import { SCREENS } from '../lib/screens.ts';
import { Screenshot } from './screenshot.tsx';

test('a priority screenshot fetches only its light export eagerly', () => {
  const { container } = render(<Screenshot priority screen={SCREENS.hero} sizes="100vw" />);
  const light = container.querySelector('[data-shot="light"] img');
  const dark = container.querySelector('[data-shot="dark"] img');
  expect(light).toHaveAttribute('loading', 'eager');
  expect(light).toHaveAttribute('fetchpriority', 'high');
  expect(dark).toHaveAttribute('loading', 'lazy');
  expect(dark).toHaveAttribute('fetchpriority', 'auto');
});
