import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, test, vi } from 'vitest';
import { track } from '../lib/analytics.ts';
import { CHECKOUT_URLS } from '../lib/config.ts';
import { m } from '../paraglide/messages.js';
import { PRICES_TRY, Pricing } from './pricing.tsx';

vi.mock('../lib/analytics.ts', () => ({ track: vi.fn() }));

/** A lira amount as the copy writes it: 1.499 TL. */
const tl = (n: number) => `${new Intl.NumberFormat('tr-TR').format(n)} TL`;

const checkout = () => screen.getByRole('link', { name: '7 gün ücretsiz dene' });

describe('Pricing', () => {
  test('starts on the yearly plan and its checkout', () => {
    render(<Pricing />);

    expect(screen.getByRole('tab', { name: 'Yıllık' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('yıllık 1.499 TL + KDV');
    expect(screen.getByText('Ayda yaklaşık 125 TL + KDV, aylık plandan %37 ucuz')).toBeVisible();
    expect(checkout()).toHaveAttribute('href', CHECKOUT_URLS.yearly);
  });

  test('switches to the monthly plan and its checkout', () => {
    render(<Pricing />);

    fireEvent.click(screen.getByRole('tab', { name: 'Aylık' }));

    expect(screen.getByRole('tab', { name: 'Aylık' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveTextContent('aylık 199 TL + KDV');
    expect(
      screen.queryByText('Ayda yaklaşık 125 TL + KDV, aylık plandan %37 ucuz'),
    ).not.toBeVisible();
    expect(checkout()).toHaveAttribute('href', CHECKOUT_URLS.monthly);

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

  test('every price and the 7-day trial in the copy match', () => {
    const saving = Math.round((1 - PRICES_TRY.yearly / (PRICES_TRY.monthly * 12)) * 100);
    expect(m.pricing_yearly_amount()).toBe(tl(PRICES_TRY.yearly));
    expect(m.pricing_monthly_amount()).toBe(tl(PRICES_TRY.monthly));
    expect(m.pricing_yearly_saving()).toContain(tl(Math.round(PRICES_TRY.yearly / 12)));
    expect(m.pricing_yearly_saving()).toContain(`%${saving}`);
    expect(m.hero_note()).toContain(tl(PRICES_TRY.yearly));
    for (const copy of [
      m.cta_trial(),
      m.meta_description(),
      m.hero_note(),
      m.pricing_trial(),
      m.pricing_note(),
      m.faq_price_a(),
      m.faq_cancel_a(),
      m.footer_tagline(),
      m.terms_trial_body(),
      m.thanks_lead(),
    ]) {
      expect(copy).toMatch(/\b7 gün/);
      expect(copy).not.toContain('14 gün');
    }
    for (const copy of [m.faq_price_a(), m.terms_subscription_body()]) {
      expect(copy).toContain(tl(PRICES_TRY.yearly));
      expect(copy).toContain(tl(PRICES_TRY.monthly));
    }
  });
});
