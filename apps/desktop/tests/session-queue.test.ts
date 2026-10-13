import { GibError, type SessionInfo } from 'angaria-earsiv-sdk';
import { describe, expect, test, vi } from 'vitest';
import {
  createSessionQueue,
  sessionCloser,
  type GIBAccount,
  type SessionStore,
} from '../src/lib/session-queue.ts';

function fakeClient() {
  const log: Array<string> = [];
  let logins = 0;
  const client = {
    login: vi.fn(async (username: string): Promise<SessionInfo> => {
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

  test('quit logs out at once, even under a lease, and logs in no more', async () => {
    const { client, log } = fakeClient();
    const queue = createSessionQueue(client, { lingerMs: 45_000 });
    const user = account('33333301');

    const lease = await queue.lease(user);
    const waiting = queue.run(user, async () => {});
    await queue.quit();
    expect(log).toEqual(['login 33333301', 'logout t1']);
    await expect(waiting).rejects.toThrow('Angaria kapanıyor.');
    lease.release();
    await expect(queue.run(user, async () => {})).rejects.toThrow('Angaria kapanıyor.');
    await tick();
    expect(log).toEqual(['login 33333301', 'logout t1']);
  });

  test('quit during a running call logs out without waiting for it', async () => {
    const { client, log } = fakeClient();
    const queue = createSessionQueue(client);
    const call = deferred<void>();
    const running = queue.run(account('33333301'), () => call.promise);
    await tick();
    await tick();
    await queue.quit();
    expect(log).toEqual(['login 33333301', 'logout t1']);
    call.resolve();
    await running;
    await tick();
    expect(log).toEqual(['login 33333301', 'logout t1']);
  });

  test('quit during a login waits for it and logs it out, and its task never runs', async () => {
    const { client, log } = fakeClient();
    const signedIn = deferred<SessionInfo>();
    client.login.mockImplementationOnce(async (username: string) => {
      log.push(`login ${username}`);
      return signedIn.promise;
    });
    const queue = createSessionQueue(client, { lingerMs: 45_000 });
    const task = vi.fn(async () => {});
    const running = queue.run(account('33333301'), task);
    await tick();

    let quit = false;
    const quitting = queue.quit().then(() => {
      quit = true;
    });
    await tick();
    expect(quit).toBe(false);
    signedIn.resolve({ baseUrl: 'gib', cookies: [], token: 't1' });
    await quitting;
    expect(log).toEqual(['login 33333301', 'logout t1']);
    await expect(running).rejects.toThrow('Angaria kapanıyor.');
    expect(task).not.toHaveBeenCalled();
  });

  test('quit while another account waits on a logout logs that account in no more', async () => {
    const { client, log } = fakeClient();
    const loggedOut = deferred<void>();
    client.logout.mockImplementationOnce(async (session: SessionInfo) => {
      log.push(`logout ${session.token}`);
      return loggedOut.promise;
    });
    const queue = createSessionQueue(client, { lingerMs: 45_000 });
    await queue.run(account('33333301'), async () => {});
    const task = vi.fn(async () => {});
    const running = queue.run(account('33333302'), task);
    await tick();

    const quitting = queue.quit();
    await tick();
    loggedOut.resolve();
    await quitting;
    await expect(running).rejects.toThrow('Angaria kapanıyor.');
    await tick();
    expect(log).toEqual(['login 33333301', 'logout t1']);
    expect(task).not.toHaveBeenCalled();
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

const locked = () =>
  new GibError('session-locked', 'Sisteme aynı anda birden fazla giriş yapamazsınız');

/** The vault's sessions: what a crashed run left, and every write since. */
function memoryStore(left: Record<string, SessionInfo> = {}) {
  const sessions = { ...left };
  const writes: Array<string> = [];
  const store: SessionStore = {
    read: async () => ({ ...sessions }),
    write: async (key, session) => {
      writes.push(`${key} ${session?.token ?? '-'}`);
      if (session) {
        sessions[key] = session;
      } else {
        delete sessions[key];
      }
    },
  };
  return { sessions, store, writes };
}

const leftover = (token: string): SessionInfo => ({ baseUrl: 'gib', cookies: [], token });

describe('sessions an earlier run left open', () => {
  test('keeps the open session until its logout, never per call', async () => {
    vi.useFakeTimers();
    try {
      const { client } = fakeClient();
      const { sessions, store, writes } = memoryStore();
      const queue = createSessionQueue(client, { lingerMs: 45_000, store });
      const user = account('33333301');

      await queue.run(user, async () => {});
      await queue.run(user, async () => {});
      await vi.advanceTimersByTimeAsync(0);
      expect(sessions).toEqual({ '33333301': { baseUrl: '33333301', cookies: [], token: 't1' } });
      await queue.close();
      expect(sessions).toEqual({});
      expect(writes).toEqual(['33333301 t1', '33333301 -']);
    } finally {
      vi.useRealTimers();
    }
  });

  test('a failed logout keeps the session for the next launch', async () => {
    const { client } = fakeClient();
    client.logout.mockRejectedValueOnce(new Error('GİB’e ulaşılamadı'));
    const { sessions, store } = memoryStore();
    const queue = createSessionQueue(client, { store });

    await queue.run(account('33333301'), async () => {});
    await tick();
    expect(Object.keys(sessions)).toEqual(['33333301']);
  });

  test('a launch logs them out quietly, after the calls the user asked for', async () => {
    const { client, log } = fakeClient();
    client.logout.mockImplementation(async (session) => {
      log.push(`logout ${session.token}`);
      if (session.token === 'old-b') {
        throw new GibError('session-expired', 'Oturum zaman aşımına uğradı');
      }
    });
    const { sessions, store } = memoryStore({ a: leftover('old-a'), b: leftover('old-b') });
    const queue = createSessionQueue(client, { store });

    const list = queue.run(account('33333301'), async () => {
      log.push('list');
    });
    await queue.endLeftovers();
    await list;
    await tick();
    expect(log).toEqual(['login 33333301', 'list', 'logout old-a', 'logout old-b', 'logout t1']);
    expect(sessions).toEqual({});
  });

  test('a call the user asks for runs between two leftover logouts', async () => {
    const { client, log } = fakeClient();
    const firstLogout = deferred<void>();
    client.logout.mockImplementation(async (session) => {
      log.push(`logout ${session.token}`);
      if (session.token === 'old-a') {
        await firstLogout.promise;
      }
    });
    const { store } = memoryStore({ a: leftover('old-a'), b: leftover('old-b') });
    const queue = createSessionQueue(client, { store });

    const ended = queue.endLeftovers();
    await tick();
    expect(log).toEqual(['logout old-a']);
    const list = queue.run(account('33333301'), async () => {
      log.push('list');
    });
    firstLogout.resolve();
    await list;
    await ended;
    await tick();
    expect(log).toEqual(['logout old-a', 'login 33333301', 'list', 'logout old-b', 'logout t1']);
  });

  test('the first login of an account logs its leftover out first', async () => {
    const { client, log } = fakeClient();
    const { sessions, store } = memoryStore({ '33333301': leftover('old') });
    const queue = createSessionQueue(client, { store });

    expect(await queue.run(account('33333301'), async (session) => session.token)).toBe('t1');
    expect(log.slice(0, 2)).toEqual(['logout old', 'login 33333301']);
    await tick();
    expect(sessions).toEqual({});
  });

  test('a leftover GİB still holds is ended as Oturumu kapat does, then one more login', async () => {
    const { client, log } = fakeClient();
    const forceLogout = vi.fn(async (username: string) => {
      log.push(`force logout ${username}`);
    });
    client.login.mockRejectedValueOnce(locked());
    const { store } = memoryStore({ '33333301': leftover('old') });
    const queue = createSessionQueue({ ...client, forceLogout }, { store });

    expect(await queue.run(account('33333301'), async (session) => session.token)).toBe('t1');
    expect(log.slice(0, 3)).toEqual(['logout old', 'force logout 33333301', 'login 33333301']);
  });

  test('never loops: one forced logout, then the refusal is the error', async () => {
    const { client } = fakeClient();
    const forceLogout = vi.fn(async () => {});
    client.login.mockRejectedValue(locked());
    const { store } = memoryStore({ '33333301': leftover('old') });
    const queue = createSessionQueue({ ...client, forceLogout }, { store });
    const user = account('33333301');

    await expect(queue.run(user, async () => {})).rejects.toThrow('birden fazla giriş');
    await expect(queue.run(user, async () => {})).rejects.toThrow('birden fazla giriş');
    expect(forceLogout).toHaveBeenCalledOnce();
    expect(client.login).toHaveBeenCalledTimes(3);
  });

  test('without a leftover of its own, the queue never ends a session it did not open', async () => {
    const { client } = fakeClient();
    const forceLogout = vi.fn(async () => {});
    client.login.mockRejectedValueOnce(locked());
    const queue = createSessionQueue({ ...client, forceLogout }, { store: memoryStore().store });

    await expect(queue.run(account('33333301'), async () => {})).rejects.toThrow(
      'birden fazla giriş',
    );
    expect(forceLogout).not.toHaveBeenCalled();
  });
});

describe('sessionCloser', () => {
  test('a refusal for an open session carries what closes it, as Oturumu kapat does', async () => {
    const { client, log } = fakeClient();
    const forceLogout = vi.fn(async (username: string) => {
      log.push(`force logout ${username}`);
    });
    client.login.mockRejectedValueOnce(locked());
    const queue = createSessionQueue({ ...client, forceLogout });

    const error = await queue.run(account('33333301'), async () => {}).catch((error) => error);
    const close = sessionCloser(error);
    expect(close).toBeTypeOf('function');
    await close?.();
    expect(log).toEqual(['force logout 33333301']);
    expect(sessionCloser(new GibError('auth', 'Giriş başarısız'))).toBeUndefined();
  });

  test('forceClose logs out the queue’s own session first, then forces the rest', async () => {
    const { client, log } = fakeClient();
    const forceLogout = vi.fn(async (username: string) => {
      log.push(`force logout ${username}`);
    });
    const queue = createSessionQueue({ ...client, forceLogout }, { lingerMs: 45_000 });
    const user = account('33333301');

    await queue.run(user, async () => {});
    await queue.forceClose(user);
    expect(log).toEqual(['login 33333301', 'logout t1', 'force logout 33333301']);
    expect(await queue.run(user, async (session) => session.token)).toBe('t2');
    await queue.close();
  });
});
