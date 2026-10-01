import type { SessionInfo } from 'angaria-earsiv-sdk';
import { describe, expect, test, vi } from 'vitest';
import { createSessionQueue, type GIBAccount } from '../src/lib/session-queue.ts';

function fakeClient() {
  const log: Array<string> = [];
  let logins = 0;
  const client = {
    login: vi.fn(async (username: string) => {
      logins++;
      log.push(`login ${username}`);
      return { baseUrl: username, cookies: [], token: `t${logins}` } satisfies SessionInfo;
    }),
    logout: vi.fn(async (session: SessionInfo) => {
      log.push(`logout ${session.token}`);
    }),
  };
  return { client, log };
}

const account = (username: string): GIBAccount => ({
  credentials: async () => ({ password: '1', testMode: true, username }),
  key: username,
});

const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

/** A promise that settles when the test calls `resolve`. */
function deferred<T>() {
  const handle: { resolve?: (value: T) => void } = {};
  const promise = new Promise<T>((resolve) => {
    handle.resolve = resolve;
  });
  return { promise, resolve: (value: T) => handle.resolve?.(value) };
}

describe('createSessionQueue', () => {
  test('runs queued tasks one at a time on one login, then logs out', async () => {
    const { client, log } = fakeClient();
    const queue = createSessionQueue(client);
    const user = account('33333301');
    const task = (name: string) => async (session: SessionInfo) => {
      log.push(`start ${name} ${session.token}`);
      await tick();
      log.push(`end ${name}`);
      return name;
    };

    const results = await Promise.all([
      queue.run(user, task('a')),
      queue.run(user, task('b')),
      queue.run(user, task('c')),
    ]);

    expect(results).toEqual(['a', 'b', 'c']);
    await tick();
    expect(log).toEqual([
      'login 33333301',
      'start a t1',
      'end a',
      'start b t1',
      'end b',
      'start c t1',
      'end c',
      'logout t1',
    ]);
  });

  test('runs foreground tasks before waiting background ones', async () => {
    const { client } = fakeClient();
    const queue = createSessionQueue(client);
    const user = account('33333301');
    const order: Array<string> = [];
    const task = (name: string) => async () => {
      order.push(name);
      await tick();
    };

    await Promise.all([
      queue.run(user, task('list')),
      queue.run(user, task('total 1'), { background: true }),
      queue.run(user, task('total 2'), { background: true }),
      queue.run(user, task('preview')),
    ]);

    expect(order).toEqual(['list', 'preview', 'total 1', 'total 2']);
  });

  test('drops a waiting task whose signal aborts', async () => {
    const { client } = fakeClient();
    const queue = createSessionQueue(client);
    const user = account('33333301');
    const controller = new AbortController();
    const skipped = vi.fn(async () => 'skipped');

    const first = queue.run(user, async () => tick());
    const second = queue.run(user, skipped, { signal: controller.signal });
    controller.abort(new Error('cancelled'));

    await first;
    await expect(second).rejects.toThrow('cancelled');
    expect(skipped).not.toHaveBeenCalled();
  });

  test('logs in again after a failed task and for another account', async () => {
    const { client, log } = fakeClient();
    const queue = createSessionQueue(client);

    const failing = queue.run(account('33333301'), async () => {
      throw new Error('Oturum zaman aşımına uğradı');
    });
    const next = queue.run(account('33333301'), async (session) => session.token);
    const other = queue.run(account('33333302'), async (session) => session.token);

    await expect(failing).rejects.toThrow('Oturum zaman aşımına uğradı');
    expect(await next).toBe('t2');
    expect(await other).toBe('t3');
    await tick();
    expect(log).toEqual([
      'login 33333301',
      'logout t1',
      'login 33333301',
      'logout t2',
      'login 33333302',
      'logout t3',
    ]);
  });

  test('a lease holds the session until it is released', async () => {
    const { client, log } = fakeClient();
    const queue = createSessionQueue(client);
    const user = account('33333301');

    const lease = await queue.lease(user);
    const waiting = queue.run(user, async (session) => {
      log.push(`task ${session.token}`);
    });
    await tick();
    expect(log).toEqual(['login 33333301']);

    lease.release();
    await waiting;
    await tick();
    expect(log).toEqual(['login 33333301', 'task t1', 'logout t1']);
  });

  test('a lease that fails to log in rejects', async () => {
    const queue = createSessionQueue({
      login: async () => {
        throw new Error('Kullanıcı adı veya şifre hatalı');
      },
      logout: async () => {},
    });

    await expect(queue.lease(account('33333301'))).rejects.toThrow(
      'Kullanıcı adı veya şifre hatalı',
    );
  });
});

describe('leaseWith', () => {
  test('a screen that closes mid-start hands the session back once start settles', async () => {
    const { client, log } = fakeClient();
    const queue = createSessionQueue(client);
    const user = account('33333301');
    const screen = new AbortController();
    const sms = deferred<string>();
    const start = vi.fn(() => sms.promise);

    const starting = queue.leaseWith(user, start, screen.signal);
    const next = queue.run(user, async (session) => {
      log.push(`task ${session.token}`);
    });
    await tick();
    expect(start).toHaveBeenCalledOnce();

    screen.abort();
    await tick();
    // The SMS request is still running on the session: nothing else may.
    expect(log).toEqual(['login 33333301']);

    sms.resolve('5xx xxx xx 01');
    expect(await starting).toBeNull();
    await next;
    await tick();
    expect(log).toEqual(['login 33333301', 'task t1', 'logout t1']);
  });

  test('a screen that closes while its lease waits never logs in for it', async () => {
    const { client } = fakeClient();
    const queue = createSessionQueue(client);
    const user = account('33333301');
    const screen = new AbortController();
    const start = vi.fn(async () => 'phone');
    const list = deferred<void>();

    const busy = queue.run(user, () => list.promise);
    const starting = queue.leaseWith(user, start, screen.signal);
    await tick();
    screen.abort();
    list.resolve();

    await busy;
    expect(await starting).toBeNull();
    expect(start).not.toHaveBeenCalled();
    expect(await queue.run(user, async (session) => session.token)).toBe('t2');
  });

  test('closing the screen releases a lease that waits on the user', async () => {
    const { client, log } = fakeClient();
    const queue = createSessionQueue(client);
    const user = account('33333301');
    const screen = new AbortController();

    const started = await queue.leaseWith(user, async () => 'phone', screen.signal);
    expect(started?.value).toBe('phone');
    const next = queue.run(user, async (session) => {
      log.push(`task ${session.token}`);
    });
    await tick();
    expect(log).toEqual(['login 33333301']);

    screen.abort();
    await next;
    await tick();
    expect(log).toEqual(['login 33333301', 'task t1', 'logout t1']);
  });

  test('a failed start hands the session back and rejects', async () => {
    const { client, log } = fakeClient();
    const queue = createSessionQueue(client);
    const user = account('33333301');

    await expect(
      queue.leaseWith(
        user,
        async () => {
          throw new Error('SMS gönderimi başarısız');
        },
        new AbortController().signal,
      ),
    ).rejects.toThrow('SMS gönderimi başarısız');
    expect(await queue.run(user, async (session) => session.token)).toBe('t2');
    await tick();
    expect(log).toEqual(['login 33333301', 'logout t1', 'login 33333301', 'logout t2']);
  });
});
