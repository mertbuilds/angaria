import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { track } from '../lib/analytics.ts';
import { PRICES_TRY, Pricing } from './pricing.tsx';

vi.mock('../lib/analytics.ts', () => ({ track: vi.fn() }));
vi.mock('../lib/config.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/config.ts')>();
  return {
    ...actual,
    config: actual.readConfig({
      VITE_CHECKOUT_URL_MONTHLY: 'https://polar.test/monthly',
      VITE_CHECKOUT_URL_YEARLY: 'https://polar.test/yearly',
    }),
  };
});

const checkout = () => screen.getByRole('link', { name: '14 gün ücretsiz dene' });

describe('Pricing', () => {
  test('starts on the yearly plan and its checkout', () => {
    render(<Pricing />);

    expect(screen.getByRole('tab', { name: 'Yıllık' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('yıllık 1.499 TL + KDV');
    expect(screen.getByText('Ayda yaklaşık 125 TL + KDV, aylık plandan %37 ucuz')).toBeVisible();
    expect(checkout()).toHaveAttribute('href', 'https://polar.test/yearly');
  });

  test('switches to the monthly plan and its checkout', () => {
    render(<Pricing />);

    fireEvent.click(screen.getByRole('tab', { name: 'Aylık' }));

    expect(screen.getByRole('tab', { name: 'Aylık' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('aylık 199 TL + KDV');
    expect(
      screen.queryByText('Ayda yaklaşık 125 TL + KDV, aylık plandan %37 ucuz'),
    ).not.toBeVisible();
    expect(checkout()).toHaveAttribute('href', 'https://polar.test/monthly');

    fireEvent.click(checkout());
    expect(track).toHaveBeenCalledWith('checkout_click', { location: 'pricing', plan: 'monthly' });
  });

  // The arrows move focus between the plans; Enter and Space pick one, which
  // the tabs get from being buttons.
  test('moves between plans with the arrow keys', async () => {
    render(<Pricing />);

    const yearly = screen.getByRole('tab', { name: 'Yıllık' });
    const monthly = screen.getByRole('tab', { name: 'Aylık' });
    expect(monthly.tagName).toBe('BUTTON');
    yearly.focus();
    fireEvent.keyDown(yearly, { key: 'ArrowRight' });
    await waitFor(() => expect(monthly).toHaveFocus());
    fireEvent.keyDown(monthly, { key: 'ArrowLeft' });
    await waitFor(() => expect(yearly).toHaveFocus());
  });

  test('the yearly saving note matches the prices', () => {
    const saving = 1 - PRICES_TRY.yearly / (PRICES_TRY.monthly * 12);
    expect(Math.round(saving * 100)).toBe(37);
    expect(Math.round(PRICES_TRY.yearly / 12)).toBe(125);
  });
});
