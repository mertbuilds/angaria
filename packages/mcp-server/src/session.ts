import type { EarsivClient, SessionInfo } from 'angaria-earsiv-sdk';

export interface Credentials {
  password: string;
  testMode: boolean;
  username: string;
}

export type WithSession = <T>(fn: (session: SessionInfo) => Promise<T>) => Promise<T>;

export interface ToolContext {
  client: EarsivClient;
  withSession: WithSession;
}

/** GIB_TEST_MODE defaults to false: the production portal unless it is exactly "true". */
export function readCredentials(env: NodeJS.ProcessEnv = process.env): Credentials {
  const username = env.GIB_USERNAME;
  const password = env.GIB_PASSWORD;
  if (!username || !password) {
    throw new Error(
      'Missing GIB_USERNAME or GIB_PASSWORD environment variables. ' +
        'Set them in your MCP client configuration.',
    );
  }
  return { password, testMode: env.GIB_TEST_MODE === 'true', username };
}

/** Logs in for one tool call and always logs out after it, so sequential
 * calls do not trip GİB's single-session limit. */
export function createSessionRunner(
  client: EarsivClient,
  credentials: () => Credentials,
): WithSession {
  return async (fn) => {
    const { password, testMode, username } = credentials();
    const session = await client.login(username, password, testMode);
    try {
      return await fn(session);
    } finally {
      await client.logout(session).catch(() => {});
    }
  };
}
