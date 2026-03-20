import { login, logout } from "./angaria-sdk.ts";
import type { SessionInfo } from "./angaria-sdk.ts";

// Re-export for use in tool files
export type { SessionInfo };

function getCredentials(): { username: string; password: string; testMode: boolean } {
  const username = process.env.GIB_USERNAME;
  const password = process.env.GIB_PASSWORD;
  if (!username || !password) {
    throw new Error(
      "Missing GIB_USERNAME or GIB_PASSWORD environment variables. " +
        "Set them in your MCP client configuration.",
    );
  }
  return {
    username,
    password,
    testMode: process.env.GIB_TEST_MODE !== "false",
  };
}

export async function withSession<T>(fn: (session: SessionInfo) => Promise<T>): Promise<T> {
  const { username, password, testMode } = getCredentials();
  const session = await login(username, password, testMode);
  try {
    return await fn(session);
  } finally {
    logout(session).catch(() => {});
  }
}
