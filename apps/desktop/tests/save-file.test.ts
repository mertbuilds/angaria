import { afterEach, expect, test, vi } from 'vitest';
import { saveFile } from '../src/lib/save-file.ts';

const core = vi.hoisted(() => ({
  invoke: vi.fn(async (..._args: Array<unknown>): Promise<unknown> => ''),
  isTauri: vi.fn(() => true),
}));
vi.mock('@tauri-apps/api/core', () => core);

afterEach(() => {
  core.invoke.mockReset();
});

const NAME = 'Fatura-2026-10-03-Ana-Varlık-Şükrü-Öztürk.pdf';

test('sends the bytes raw and the name as base64 of its UTF-8', async () => {
  core.invoke.mockResolvedValueOnce(`/Users/mert/Downloads/${NAME}`);

  await saveFile(new Blob([new Uint8Array([37, 80, 68, 70])]), NAME);

  const [command, body, options] = core.invoke.mock.calls[0] as [
    string,
    Uint8Array,
    { headers: Record<string, string> },
  ];
  expect(command).toBe('save_download');
  expect([...body]).toEqual([37, 80, 68, 70]);
  const header = options.headers['x-file-name'];
  expect(header).toMatch(/^[A-Za-z0-9+/]+=*$/);
  expect(Buffer.from(header, 'base64').toString('utf8')).toBe(NAME);
});

test('answers the name the file got, numbered when the name was taken', async () => {
  const path = '/Users/mert/Downloads/Fatura-2026-10-03-Ana-Varlık-Şükrü-Öztürk (2).pdf';
  core.invoke.mockResolvedValueOnce(path);

  expect(await saveFile(new Blob(['%PDF']), NAME)).toEqual({
    name: 'Fatura-2026-10-03-Ana-Varlık-Şükrü-Öztürk (2).pdf',
    path,
  });
});

test('a failed save says so in Turkish, keeping the cause', async () => {
  const cause = 'Permission denied (os error 13)';
  core.invoke.mockRejectedValueOnce(cause);

  const error = await saveFile(new Blob(['%PDF']), NAME).catch((error: unknown) => error);

  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toBe('Dosya İndirilenler klasörüne kaydedilemedi. Tekrar dene.');
  expect((error as Error).cause).toBe(cause);
});
