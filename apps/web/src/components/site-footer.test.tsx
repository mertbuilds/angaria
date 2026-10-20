import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { track } from '../lib/analytics.ts';
import { SiteFooter } from './site-footer.tsx';

vi.mock('../lib/analytics.ts', () => ({ track: vi.fn() }));

describe('footer', () => {
  test('links GitHub and the star under the tagline, in a new tab, and counts the clicks', () => {
    render(<SiteFooter />);

    for (const name of ['GitHub', 'Bize yıldız ver']) {
      const link = screen.getByRole('link', { name });
      expect(link).toHaveAttribute('href', 'https://github.com/mertbuilds/angaria');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer');
      fireEvent.click(link);
    }
    expect(track).toHaveBeenCalledTimes(2);
    expect(track).toHaveBeenCalledWith('source_click', { location: 'footer' });
  });
});
