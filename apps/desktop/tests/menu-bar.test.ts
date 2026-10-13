import { toast } from '@angaria/ui';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { mcpSetSettings } from '../src/lib/mcp-native.ts';
import { connectMenuBar, FIRST_SAVE_RETRY_MS } from '../src/lib/menu-bar.ts';

vi.mock('@angaria/ui', () => ({ toast: { error: vi.fn() } }));
vi.mock('@tauri-apps/api/core', () => ({ isTauri: () => true }));
vi.mock('../src/lib/mcp-native.ts', () => ({
  mcpSetSettings: vi.fn(),
  // The first launch after 0012: Rust has no settings yet.
  mcpSettings: vi.fn(async () => null),
  onAppNavigate: vi.fn(async () => () => {}),
  onMcpSettings: vi.fn(async () => () => {}),
  traySetActivity: vi.fn(async () => {}),
}));

beforeEach(() => {
  vi.useFakeTimers();
  vi.mocked(mcpSetSettings).mockReset();
  vi.mocked(toast.error).mockClear();
});

afterEach(() => {
  vi.useRealTimers();
});

const failed = new Error('mcp.json yazılamadı');

test('a failed first save of the settings goes again after the first render', async () => {
  vi.mocked(mcpSetSettings).mockRejectedValueOnce(failed).mockResolvedValueOnce(undefined);
  await connectMenuBar(() => {});
  expect(mcpSetSettings).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(FIRST_SAVE_RETRY_MS);
  expect(mcpSetSettings).toHaveBeenCalledTimes(2);
  expect(toast.error).not.toHaveBeenCalled();
});

test('a second failure shows a toast', async () => {
  vi.mocked(mcpSetSettings).mockRejectedValue(failed);
  await connectMenuBar(() => {});
  await vi.advanceTimersByTimeAsync(FIRST_SAVE_RETRY_MS);
  expect(toast.error).toHaveBeenCalledWith('MCP ayarı kaydedilemedi', expect.anything());
});
