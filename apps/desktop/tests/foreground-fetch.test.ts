import { QueryClient, queryOptions } from '@tanstack/react-query';
import type { SessionInfo } from 'angaria-earsiv-sdk';
import { expect, test } from 'vitest';
import { fetchForeground } from '../src/lib/foreground-fetch.ts';
import { createSessionQueue, type GIBAccount } from '../src/lib/session-queue.ts';

const session: SessionInfo = { baseUrl: 'emulator', cookies: [], token: 't' };
const user: GIBAccount = {
  credentials: async () => ({ password: '1', testMode: true, username: '33333301' }),
  key: '33333301',
};

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A promise that settles when the test calls `resolve`. */
function deferred() {
  const handle: { resolve?: () => void } = {};
  const promise = new Promise<void>((resolve) => {
    handle.resolve = resolve;
  });
  return { promise, resolve: () => handle.resolve?.() };
}

test('a detail the user asks for runs ahead of its own background prefetch', async () => {
  const queue = createSessionQueue({ login: async () => session, logout: async () => {} });
  const queryClient = new QueryClient();
  const order: Array<string> = [];
  const preview = deferred();
  const busy = queue.run(user, () => preview.promise);
  const totals = ['row 1 total', 'row 2 total'].map((name) =>
    queue.run(user, async () => void order.push(name), { background: true }),
  );
  const detail = (background: boolean) =>
    queryOptions({
      queryFn: ({ signal }) =>
        queue.run(
          user,
          async () => {
            order.push(background ? 'detail in the background' : 'detail');
            return { ettn: 'e1' };
          },
          { background, signal },
        ),
      queryKey: ['invoice-detail', user.key, 'e1'],
    });

  void queryClient.prefetchQuery(detail(true));
  await tick();
  const pdf = fetchForeground(queryClient, detail(false));
  await tick();
  preview.resolve();

  expect(await pdf).toEqual({ ettn: 'e1' });
  await busy;
  await Promise.all(totals);
  expect(order).toEqual(['detail', 'row 1 total', 'row 2 total']);
});
