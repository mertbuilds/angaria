// GİB allows one open session per user: a second login while the first is
// open fails ("Sisteme aynı anda birden fazla giriş yapamazsınız"). Every GİB
// call therefore goes through one queue that runs tasks one at a time on a
// shared session, logs in when the first task arrives and logs out once the
// queue has been empty for `lingerMs`, so calls close together share a login.
// With a `store`, the open session is kept there until its logout, so a run
// that died with it open (crash, force quit, a dev rebuild) is logged out on
// the next launch instead of locking its login.
// No Tauri imports, so tests can inject a fake client.

import { GibError, type SessionInfo } from 'angaria-earsiv-sdk';
import type { Credentials } from './types.ts';

export interface SessionClient {
  /**
   * Ends whatever session is open for the user, without its token, as
   * Ayarlar' Oturumu kapat does. Without it only the queue's own session closes.
   */
  forceLogout?: (username: string, password: string) => Promise<void>;
  login: (username: string, password: string) => Promise<SessionInfo>;
  logout: (session: SessionInfo) => Promise<void>;
}

/** Where open sessions are kept by account key, outside the app's memory (the vault). */
export interface SessionStore {
  read: () => Promise<Record<string, SessionInfo>>;
  /** null forgets the account's session. */
  write: (key: string, session: SessionInfo | null) => Promise<void>;
}

/** Whose session a task needs. Tasks with another key get a fresh login. */
export interface GIBAccount {
  /** Read only when the queue has to log in. */
  credentials: () => Promise<Credentials>;
  key: string;
}

export interface RunOptions {
  /**
   * Runs after every waiting foreground task, so prefetches (list totals)
   * never hold up what the user just asked for.
   */
  background?: boolean;
  /**
   * A task still waiting when this aborts is dropped and rejects. A running
   * task gets it as its second argument.
   */
  signal?: AbortSignal;
}

export interface SessionLease {
  /** Hands the session back. Pass the error that broke it to force a new login. */
  release: (error?: unknown) => void;
  session: SessionInfo;
}

type Job = {
  background: boolean;
  reject: (reason: unknown) => void;
  signal?: AbortSignal;
} & (
  | { account: GIBAccount; run: (session: SessionInfo) => Promise<void> }
  /** A task that needs no login (closing sessions). */
  | { account: null; run: () => Promise<void> }
);

/** What a task waiting while the app quits rejects with. */
const QUITTING = 'Angaria kapanıyor.';

/** How long the app's GİB session stays open after the queue empties. */
export const SESSION_LINGER_MS = 45_000;

/** GİB refused because the user has a session open (on the portal, in a browser, or left by a crash). */
export const isSessionLocked = (error: unknown): error is GibError =>
  error instanceof GibError && error.code === 'session-locked';

// A call refused for an open session, and what ends that session.
const closers = new WeakMap<object, () => Promise<void>>();

/**
 * For an error a queue rejected with because GİB had a session open: ends
 * that session as Ayarlar' Oturumu kapat does, for the account that hit it.
 */
export const sessionCloser = (error: unknown) =>
  typeof error === 'object' && error !== null ? closers.get(error) : undefined;

export function createSessionQueue(
  client: SessionClient,
  {
    lingerMs = 0,
    store,
  }: {
    /** 0 logs out as soon as the queue is empty. */
    lingerMs?: number;
    store?: SessionStore;
  } = {},
) {
  const jobs: Array<Job> = [];
  let open: { key: string; session: SessionInfo } | null = null;
  let draining = false;
  let closing: Promise<void> = Promise.resolve();
  let linger: ReturnType<typeof setTimeout> | null = null;
  // close() asked while a task ran: no later task uses this session.
  let stale = false;
  // The app is quitting: no task logs in again.
  let quitting = false;
  // A login on its way: settles once its session is open, or logged out for a quit.
  let opening: Promise<void> | null = null;
  // The store's sessions, read once; then kept in step with every write.
  let stored: Promise<Map<string, SessionInfo>> | null = null;
  let writes: Promise<void> = Promise.resolve();
  // Accounts with a session left open by an earlier run, until a login works.
  const leftovers = new Set<string>();

  const storedSessions = () =>
    (stored ??= (store?.read() ?? Promise.resolve({})).then(
      (sessions) => new Map(Object.entries(sessions)),
      () => new Map<string, SessionInfo>(),
    ));

  /** Keeps `session` as the account's open one (null forgets it). Never rejects. */
  function remember(key: string, session: SessionInfo | null): Promise<void> {
    if (!store) {
      return Promise.resolve();
    }
    writes = writes.then(async () => {
      const sessions = await storedSessions();
      if (session) {
        sessions.set(key, session);
      } else if (sessions.has(key)) {
        sessions.delete(key);
      } else {
        return;
      }
      await store.write(key, session).catch(() => {});
    });
    return writes;
  }

  /** Logs out the account's session an earlier run left open, quietly. */
  async function endLeftover(key: string) {
    const left = (await storedSessions()).get(key);
    if (!left) {
      return;
    }
    leftovers.add(key);
    await client.logout(left).catch(() => {});
    await remember(key, null);
  }

  /**
   * Logs in after ending the account's leftover session. When GİB still
   * refuses for an open session after that, the leftover was not logged out
   * by its token: end it as Oturumu kapat does and log in again, once.
   */
  async function signIn(account: GIBAccount) {
    await endLeftover(account.key);
    const { password, username } = await account.credentials();
    let session: SessionInfo;
    try {
      session = await client.login(username, password);
    } catch (error) {
      if (!isSessionLocked(error) || !client.forceLogout || !leftovers.has(account.key)) {
        throw error;
      }
      leftovers.delete(account.key);
      await client.forceLogout(username, password).catch(() => {});
      session = await client.login(username, password);
    }
    leftovers.delete(account.key);
    void remember(account.key, session);
    return session;
  }

  /** Opens the account's session; one that arrives after quit() is logged out at once. */
  async function openSession(account: GIBAccount) {
    const session = await signIn(account);
    if (quitting) {
      await client.logout(session).then(
        () => remember(account.key, null),
        () => {},
      );
      throw new Error(QUITTING);
    }
    open = { key: account.key, session };
    return session;
  }

  function stopLinger() {
    if (linger !== null) {
      clearTimeout(linger);
      linger = null;
    }
  }

  function close() {
    stopLinger();
    stale = false;
    const current = open;
    open = null;
    if (current) {
      // The next login waits for this logout, so GİB never sees two sessions.
      // A failed logout keeps the session stored, for the next launch to end.
      closing = closing.then(() =>
        client.logout(current.session).then(
          () => remember(current.key, null),
          () => {},
        ),
      );
    }
    return closing;
  }

  /** The queue is empty: log out now, or after `lingerMs` unless a task comes. */
  async function idle() {
    if (lingerMs <= 0 || stale) {
      await close();
      return;
    }
    if (open) {
      stopLinger();
      linger = setTimeout(() => {
        linger = null;
        if (!draining) {
          void close();
        }
      }, lingerMs);
    }
  }

  function take(): Job | undefined {
    for (const job of jobs.filter((job) => job.signal?.aborted)) {
      jobs.splice(jobs.indexOf(job), 1);
      job.reject(job.signal?.reason);
    }
    const foreground = jobs.findIndex((job) => !job.background);
    return jobs.splice(foreground === -1 ? 0 : foreground, 1)[0];
  }

  async function drain() {
    if (draining) {
      return;
    }
    draining = true;
    stopLinger();
    while (jobs.length > 0) {
      for (let job = take(); job; job = take()) {
        if (quitting) {
          job.reject(new Error(QUITTING));
          continue;
        }
        if (job.account === null) {
          await job.run().catch(job.reject);
          continue;
        }
        const { account } = job;
        try {
          if (open && (stale || open.key !== account.key)) {
            await close();
          }
          let session = open?.session;
          if (!session) {
            await closing;
            const signingIn = openSession(account);
            opening = signingIn.then(
              () => {},
              () => {},
            );
            session = await signingIn.finally(() => {
              opening = null;
            });
          }
          await job.run(session);
        } catch (error) {
          if (isSessionLocked(error)) {
            closers.set(error, () => forceClose(account));
          }
          job.reject(error);
          // The failure may have ended the session on GİB's side. A task that
          // stopped for its abort (between requests) left it open.
          if (!job.signal?.aborted || error !== job.signal.reason) {
            await close();
          }
        }
      }
      await idle();
    }
    draining = false;
  }

  /** Queues a task that needs no login. */
  function runBare(task: () => Promise<void>, background: boolean): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      jobs.push({ account: null, background, reject, run: async () => resolve(await task()) });
      void drain();
    });
  }

  /**
   * Ends the account's open session on GİB, also one this app does not hold
   * (a browser's, one an earlier run left), as Ayarlar' Oturumu kapat does:
   * the queue's own session first, then GİB's force logout. Queued, so no
   * call logs in meanwhile.
   */
  function forceClose(account: GIBAccount): Promise<void> {
    return runBare(async () => {
      await close();
      await endLeftover(account.key);
      const { password, username } = await account.credentials();
      await client.forceLogout?.(username, password);
    }, false);
  }

  /**
   * Logs out every session an earlier run left open (launch), after the
   * calls the user asked for: one background task per account, so a call
   * asked for meanwhile runs before the next logout. Never rejects.
   */
  async function endLeftovers(): Promise<void> {
    const keys = [...(await storedSessions()).keys()];
    await Promise.all(
      keys.map((key) =>
        runBare(async () => {
          if (open?.key !== key) {
            await endLeftover(key);
          }
        }, true).catch(() => {}),
      ),
    );
  }

  /**
   * Runs `task` with a logged-in session, after the tasks queued before it.
   * The task gets the run's `signal` to stop early (between GİB requests).
   */
  function run<T>(
    account: GIBAccount,
    task: (session: SessionInfo, signal?: AbortSignal) => Promise<T>,
    { background = false, signal }: RunOptions = {},
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      if (signal?.aborted) {
        reject(signal.reason);
        return;
      }
      // A waiting task leaves the queue as soon as its signal aborts, not
      // only when the task ahead of it (an SMS lease, say) is done.
      const leave = () => {
        const index = jobs.indexOf(job);
        if (index !== -1) {
          jobs.splice(index, 1);
          reject(signal?.reason);
        }
      };
      const job: Job = {
        account,
        background,
        reject,
        run: async (session) => {
          signal?.removeEventListener('abort', leave);
          resolve(await task(session, signal));
        },
        signal,
      };
      signal?.addEventListener('abort', leave, { once: true });
      jobs.push(job);
      void drain();
    });
  }

  /**
   * Holds the session until `release` is called, for flows that span user
   * input (SMS signing). Other tasks wait meanwhile. A lease whose `signal`
   * aborts before it is granted is dropped and rejects.
   */
  function lease(
    account: GIBAccount,
    { signal }: { signal?: AbortSignal } = {},
  ): Promise<SessionLease> {
    return new Promise<SessionLease>((resolveLease, rejectLease) => {
      run(
        account,
        (session) =>
          new Promise<void>((done, fail) => {
            if (signal?.aborted) {
              rejectLease(signal.reason);
              done();
              return;
            }
            resolveLease({
              release: (error) => (error === undefined ? done() : fail(error)),
              session,
            });
          }),
        { signal },
      ).catch(rejectLease);
    });
  }

  /**
   * Leases the session and runs `start` on it, the first step of a flow that
   * then waits on the user (SMS signing: send the code, then verify it).
   * `signal` belongs to the screen that asked: once it aborts, the session
   * goes back to the queue as soon as no call runs on it, and a lease not
   * handed out yet resolves null. A screen that closes mid-flow never blocks
   * the queue. A failed `start` hands the session back and rejects.
   */
  async function leaseWith<T>(
    account: GIBAccount,
    start: (session: SessionInfo) => Promise<T>,
    signal: AbortSignal,
  ): Promise<{ lease: SessionLease; value: T } | null> {
    let held: SessionLease;
    try {
      held = await lease(account, { signal });
    } catch (error) {
      if (signal.aborted) {
        return null;
      }
      throw error;
    }
    let value: T;
    try {
      value = await start(held.session);
    } catch (error) {
      held.release(error);
      throw error;
    }
    if (signal.aborted) {
      held.release();
      return null;
    }
    const onAbort = () => held.release();
    signal.addEventListener('abort', onAbort, { once: true });
    return {
      lease: {
        release: (error) => {
          signal.removeEventListener('abort', onAbort);
          held.release(error);
        },
        session: held.session,
      },
      value,
    };
  }

  /**
   * Logs out of the open session now instead of after the linger (app quit,
   * changed credentials, Oturumu kapat). A task running, or a lease holding
   * the session, keeps it to its end; the next task logs in again.
   */
  function closeSession(): Promise<void> {
    if (draining) {
      stale = open !== null;
      return Promise.resolve();
    }
    return close();
  }

  /**
   * The app quits: logs out of the open session at once, even under a running
   * task or a lease (the SMS dialog, an MCP signing operation, an import's
   * request), which fail as the app goes; drops the waiting tasks and logs in
   * no more. A login on its way is waited for and logged out. Settles when the
   * logout does; a failed one keeps the session stored for the next launch to end.
   */
  function quit(): Promise<void> {
    quitting = true;
    stopLinger();
    for (const job of jobs.splice(0)) {
      job.reject(new Error(QUITTING));
    }
    const current = open;
    open = null;
    stale = false;
    if (current) {
      closing = closing.then(() =>
        client.logout(current.session).then(
          () => remember(current.key, null),
          () => {},
        ),
      );
    }
    return Promise.all([closing, opening]).then(() => {});
  }

  return { close: closeSession, endLeftovers, forceClose, lease, leaseWith, quit, run };
}
