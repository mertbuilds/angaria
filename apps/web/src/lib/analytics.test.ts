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
    track('source_click', { location: 'free' });
    expect(posthog.capture).toHaveBeenCalledWith(
      'source_click',
      { location: 'free' },
      expect.objectContaining({ transport: 'sendBeacon' }),
    );
  });

  test('sends events tracked while PostHog loads once it starts', async () => {
    vi.resetModules();
    const { default: posthog } = await import('posthog-js');
    vi.mocked(posthog.capture).mockClear();
    const analytics = await import('./analytics.ts');
    const started = analytics.startAnalytics('phc_test');
    analytics.track('download_click', { location: 'hero' });
    expect(posthog.capture).not.toHaveBeenCalled();
    await started;
    expect(posthog.capture).toHaveBeenCalledWith(
      'download_click',
      { location: 'hero' },
      expect.objectContaining({ transport: 'sendBeacon' }),
    );
  });
});
