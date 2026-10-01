import { describe, expect, test, vi } from 'vitest';
import { startAnalytics, track } from './analytics.ts';

vi.mock('posthog-js', () => ({ default: { capture: vi.fn(), init: vi.fn() } }));

describe('analytics', () => {
  test('does nothing without a PostHog key', async () => {
    const { default: posthog } = await import('posthog-js');
    await startAnalytics(null);
    track('download_click', { location: 'hero' });
    expect(posthog.init).not.toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  test('starts cookieless and sends named events with a key', async () => {
    const { default: posthog } = await import('posthog-js');
    await startAnalytics('phc_test');
    expect(posthog.init).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({ autocapture: false, persistence: 'memory' }),
    );
    track('checkout_click', { location: 'pricing', plan: 'monthly' });
    expect(posthog.capture).toHaveBeenCalledWith(
      'checkout_click',
      { location: 'pricing', plan: 'monthly' },
      expect.objectContaining({ transport: 'sendBeacon' }),
    );
  });
});
