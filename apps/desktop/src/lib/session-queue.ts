// GİB allows one open session per user: a second login while the first is
// open fails ("Sisteme aynı anda birden fazla giriş yapamazsınız"). Every GİB
// call therefore goes through one queue that runs tasks one at a time on a
// shared session, logs in when the first task arrives and logs out once the
// queue is empty. No Tauri imports, so tests can inject a fake client.

import type { SessionInfo } from 'angaria-earsiv-sdk';
import type { Credentials } from './types.ts';

export interface SessionClient {
  login: (username: string, password: string, testMode: boolean) => Promise<SessionInfo>;
  logout: (session: SessionInfo) => Promise<void>;
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

interface Job {
  account: GIBAccount;
  background: boolean;
  reject: (reason: unknown) => void;
  run: (session: SessionInfo) => Promise<void>;
  signal?: AbortSignal;
}

export function createSessionQueue(client: SessionClient) {
  const jobs: Array<Job> = [];
  let open: { key: string; session: SessionInfo } | null = null;
  let draining = false;

  async function close() {
    const current = open;
    open = null;
    if (current) {
      await client.logout(current.session).catch(() => {});
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
    while (jobs.length > 0) {
      for (let job = take(); job; job = take()) {
        try {
          if (open && open.key !== job.account.key) {
            await close();
          }
          if (!open) {
            const { password, testMode, username } = await job.account.credentials();
            open = {
              key: job.account.key,
              session: await client.login(username, password, testMode),
            };
          }
          await job.run(open.session);
        } catch (error) {
          job.reject(error);
          // The failure may have ended the session on GİB's side. A task that
          // stopped for its abort (between requests) left it open.
          if (!job.signal?.aborted || error !== job.signal.reason) {
            await close();
          }
        }
      }
      await close();
    }
    draining = false;
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
      jobs.push({
        account,
        background,
        reject,
        run: async (session) => resolve(await task(session, signal)),
        signal,
      });
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

  return { lease, leaseWith, run };
}
