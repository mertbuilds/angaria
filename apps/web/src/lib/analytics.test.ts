import { beforeEach, describe, expect, test, vi } from 'vitest';
import { resetAnalyticsForTests, startAnalytics, track } from './analytics.ts';

const instance = { track: vi.fn() };
const OpenPanel = vi.fn(function OpenPanel(_options: Record<string, unknown>) {
  return instance;
});
vi.mock('@openpanel/web', () => ({ OpenPanel }));

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('analytics', () => {
  beforeEach(() => {
    resetAnalyticsForTests();
    OpenPanel.mockClear();
    instance.track.mockClear();
  });

  test('does nothing without a client id or off the live host', async () => {
    startAnalytics(null, 'angaria.app');
    startAnalytics('client-id', 'angaria.localhost');
    track('download_click', { location: 'hero' });
    await flush();
    expect(OpenPanel).not.toHaveBeenCalled();
    expect(instance.track).not.toHaveBeenCalled();
  });

  test('starts through the proxy without replay or attribute tracking', async () => {
    startAnalytics('client-id', 'angaria.app');
    track('source_click', { location: 'free' });
    await vi.waitFor(() => expect(instance.track).toHaveBeenCalled());
    expect(OpenPanel).toHaveBeenCalledWith(
      expect.objectContaining({
        apiUrl: '/api/op',
        clientId: 'client-id',
        trackAttributes: false,
        trackOutgoingLinks: false,
        trackScreenViews: true,
      }),
    );
    expect(OpenPanel.mock.calls[0]?.[0]).not.toHaveProperty('sessionReplay');
    expect(instance.track).toHaveBeenCalledWith('source_click', { location: 'free' });
    // Once loaded, a click sends at once, within the same task.
    instance.track.mockClear();
    track('download_click', { location: 'hero' });
    expect(instance.track).toHaveBeenCalledWith('download_click', { location: 'hero' });
  });
});
