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
  credentials: async () => ({ password: '1', username }),
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
    // It rejects as the signal aborts, before the first task is done.
    const dropped = expect(second).rejects.toThrow('cancelled');
    controller.abort(new Error('cancelled'));

    await first;
    await dropped;
    expect(skipped).not.toHaveBeenCalled();
  });

  test('a waiting task rejects as soon as it aborts, while a lease still holds the session', async () => {
    const { client } = fakeClient();
    const queue = createSessionQueue(client);
    const user = account('33333301');
    const controller = new AbortController();
    const skipped = vi.fn(async () => 'skipped');

    const lease = await queue.lease(user);
    const waiting = queue.run(user, skipped, { signal: controller.signal });
    await tick();
    controller.abort(new Error('gave up'));

    await expect(waiting).rejects.toThrow('gave up');
    lease.release();
    await tick();
    expect(skipped).not.toHaveBeenCalled();
  });

  test('a running task gets its signal, and stopping for it keeps the session', async () => {
    const { client, log } = fakeClient();
    const queue = createSessionQueue(client);
    const user = account('33333301');
    const controller = new AbortController();
    const chunks: Array<string> = [];

    const list = queue.run(
      user,
      async (session, signal) => {
        for (const chunk of ['1-7 Eylül', '8-14 Eylül', '15-21 Eylül']) {
          signal?.throwIfAborted();
          chunks.push(chunk);
          controller.abort(new Error('Aralık değişti'));
          await tick();
        }
        return session.token;
      },
      { signal: controller.signal },
    );
    const next = queue.run(user, async (session) => session.token);

    await expect(list).rejects.toThrow('Aralık değişti');
    expect(chunks).toEqual(['1-7 Eylül']);
    expect(await next).toBe('t1');
    await tick();
    expect(log).toEqual(['login 33333301', 'logout t1']);
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

describe('the session after the queue empties', () => {
  test('stays open for lingerMs, so calls close together share one login', async () => {
    vi.useFakeTimers();
    try {
      const { client, log } = fakeClient();
      const queue = createSessionQueue(client, { lingerMs: 45_000 });
      const user = account('33333301');

      expect(await queue.run(user, async (session) => session.token)).toBe('t1');
      await vi.advanceTimersByTimeAsync(44_999);
      expect(await queue.run(user, async (session) => session.token)).toBe('t1');
      expect(log).toEqual(['login 33333301']);

      // The linger starts over after each call.
      await vi.advanceTimersByTimeAsync(44_999);
      expect(log).toEqual(['login 33333301']);
      await vi.advanceTimersByTimeAsync(1);
      expect(log).toEqual(['login 33333301', 'logout t1']);
      expect(await queue.run(user, async (session) => session.token)).toBe('t2');
    } finally {
      vi.useRealTimers();
    }
  });

  test('close logs out at once, and a login waits for that logout', async () => {
    vi.useFakeTimers();
    try {
      const { client, log } = fakeClient();
      const queue = createSessionQueue(client, { lingerMs: 45_000 });
      const user = account('33333301');

      await queue.run(user, async () => {});
      const closing = queue.close();
      const next = queue.run(user, async (session) => session.token);
      await closing;
      expect(await next).toBe('t2');
      expect(log.slice(0, 3)).toEqual(['login 33333301', 'logout t1', 'login 33333301']);
    } finally {
      vi.useRealTimers();
    }
  });

  test('close while a lease holds the session logs out once it is released', async () => {
    vi.useFakeTimers();
    try {
      const { client, log } = fakeClient();
      const queue = createSessionQueue(client, { lingerMs: 45_000 });
      const user = account('33333301');

      const lease = await queue.lease(user);
      await queue.close();
      expect(log).toEqual(['login 33333301']);
      lease.release();
      await vi.advanceTimersByTimeAsync(0);
      expect(log).toEqual(['login 33333301', 'logout t1']);
    } finally {
      vi.useRealTimers();
    }
  });

  test('another account logs out of the lingering session first', async () => {
    vi.useFakeTimers();
    try {
      const { client, log } = fakeClient();
      const queue = createSessionQueue(client, { lingerMs: 45_000 });

      await queue.run(account('33333301'), async () => {});
      await queue.run(account('33333302'), async () => {});
      expect(log).toEqual(['login 33333301', 'logout t1', 'login 33333302']);
    } finally {
      vi.useRealTimers();
    }
  });
});
