// @vitest-environment jsdom
import { act, StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, test, vi } from 'vitest';
import { vaultRead } from '../src/lib/native.ts';
import { StoreProvider, useStore } from '../src/lib/store.tsx';

vi.mock('@angaria/ui', () => ({ toast: { error: vi.fn(), success: vi.fn(), warning: vi.fn() } }));
vi.mock('../src/lib/native.ts', () => ({
  secretDelete: vi.fn(async () => {}),
  secretGet: vi.fn(async () => null),
  vaultRead: vi.fn(async () => null),
  vaultWrite: vi.fn(async () => {}),
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

// Newer Node versions define their own localStorage global, which hides jsdom's.
const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
  getItem: (key: string) => storage.get(key) ?? null,
  setItem: (key: string, value: string) => {
    storage.set(key, value);
  },
});

// Lets the store's startup vault read and any pending effects settle.
const settle = () => act(() => new Promise((resolve) => setTimeout(resolve, 0)));

// Reads the active company's password whenever the active company changes,
// like Ayarlar › GİB hesabı.
function PasswordReader({ onError }: { onError: (message: string) => void }) {
  const { activeEntityId, createEntity, getCredentials } = useStore();

  useEffect(() => {
    getCredentials(activeEntityId).catch((error: Error) => onError(error.message));
  }, [activeEntityId, getCredentials, onError]);

  return (
    <button onClick={createEntity} type="button">
      Şirket ekle
    </button>
  );
}

test("a new company's password is read once it is active, not reported missing", async () => {
  const errors: Array<string> = [];
  const container = document.createElement('div');
  const root = createRoot(container);

  await act(async () =>
    root.render(
      <StrictMode>
        <StoreProvider>
          <PasswordReader onError={(message) => errors.push(message)} />
        </StoreProvider>
      </StrictMode>,
    ),
  );
  await settle();
  await act(async () => container.querySelector('button')?.click());
  await settle();

  const entities: Array<{ id: string }> = JSON.parse(storage.get('fatura-entities') ?? '[]');
  expect(entities).toHaveLength(2);
  expect(errors).toEqual([]);
  // Both companies' passwords came from memory: one read for the launch.
  expect(vaultRead).toHaveBeenCalledTimes(1);
  act(() => root.unmount());
});
