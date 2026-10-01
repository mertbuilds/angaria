import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { EarsivClient, SessionInfo } from 'angaria-earsiv-sdk';

export interface Credentials {
  password: string;
  testMode: boolean;
  username: string;
}

export type WithSession = (
  fn: (session: SessionInfo) => Promise<CallToolResult>,
) => Promise<CallToolResult>;

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

/**
 * Logs in for one tool call and always logs out after it, so sequential
 * calls do not trip GİB's single-session limit. Calls run one at a time: a
 * client may send several at once, and a second login while the first
 * session is open is refused. A failed logout goes to stderr and, after a
 * successful call, into the result as a `warning`.
 */
export function createSessionRunner(
  client: EarsivClient,
  credentials: () => Credentials,
): WithSession {
  let queue: Promise<unknown> = Promise.resolve();

  async function logout(session: SessionInfo): Promise<string | undefined> {
    try {
      await client.logout(session);
      return undefined;
    } catch (error) {
      const warning = `GİB logout failed (${error instanceof Error ? error.message : String(error)}). The portal session stays open until it times out, so the next call may be refused.`;
      process.stderr.write(`angaria-mcp: ${warning}\n`);
      return warning;
    }
  }

  async function run(
    fn: (session: SessionInfo) => Promise<CallToolResult>,
  ): Promise<CallToolResult> {
    const { password, testMode, username } = credentials();
    const session = await client.login(username, password, testMode);
    let result: CallToolResult;
    try {
      result = await fn(session);
    } catch (error) {
      await logout(session);
      throw error;
    }
    const warning = await logout(session);
    return warning
      ? {
          ...result,
          content: [...result.content, { text: JSON.stringify({ warning }), type: 'text' }],
        }
      : result;
  }

  return (fn) => {
    const next = queue.then(() => run(fn));
    queue = next.catch(() => {});
    return next;
  };
}
