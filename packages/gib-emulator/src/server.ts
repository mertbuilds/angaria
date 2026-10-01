import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import type { AddressInfo } from 'node:net';
import { setTimeout as sleep } from 'node:timers/promises';
import { adminReply, type AdminContext, type Fault } from './admin.ts';
import { defaultConfig, type EmulatorConfig, mergeConfig, type PartialConfig } from './config.ts';
import { assosLogin, dispatch, fail, ok, type PortalContext, type Reply } from './gib.ts';
import { messages } from './messages.ts';
import { indexHTML, maintenanceHTML, notFoundHTML, serverErrorHTML } from './pages.ts';
import { initialState, loadSnapshot, saveSnapshot, type State } from './state.ts';
import { tcmbReply } from './tcmb.ts';

export interface EmulatorOptions {
  config?: PartialConfig;
  /** One line per event (logins, drafts, SMS codes). Silent when absent. */
  log?: (line: string) => void;
  /** Epoch milliseconds; injectable for tests. */
  now?: () => number;
  /** 0 to 1; drives the chaos rates and random SMS codes. */
  random?: () => number;
}

export interface Emulator {
  readonly config: EmulatorConfig;
  /** One-shot failures, as queued with POST /__emulator/faults. */
  readonly faults: Array<Fault>;
  handle: (request: IncomingMessage, response: ServerResponse) => void;
  reset: () => void;
  readonly state: State;
}

export interface RunningEmulator extends Emulator {
  close: () => Promise<void>;
  port: number;
  /** http://host:port, the base URL for the SDK and for TCMB. */
  url: string;
}

const html = (body: string, status = 200): Reply => ({
  body,
  contentType: 'text/html;charset=UTF-8',
  status,
});

const MAX_BODY = 2 * 1024 * 1024;

async function readBody(request: IncomingMessage): Promise<string> {
  const chunks: Array<Buffer> = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
    size += buffer.length;
    if (size > MAX_BODY) {
      throw new Error('Request body too large');
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function parseCookies(header: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  for (const part of (header ?? '').split(';')) {
    const index = part.indexOf('=');
    if (index > 0) {
      cookies[part.slice(0, index).trim()] = part.slice(index + 1).trim();
    }
  }
  return cookies;
}

function send(request: IncomingMessage, response: ServerResponse, reply: Reply) {
  response.statusCode = reply.status;
  response.setHeader('content-type', reply.contentType);
  // A plain browser (the desktop frontend outside Tauri) calls the emulator
  // cross-origin; GİB itself sends no CORS headers.
  response.setHeader('access-control-allow-origin', request.headers.origin ?? '*');
  response.setHeader('vary', 'origin');
  if (reply.setCookies?.length) {
    response.setHeader('set-cookie', reply.setCookies);
  }
  response.end(reply.body);
}

export function createEmulator(options: EmulatorOptions = {}): Emulator {
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const log = options.log ?? (() => {});
  const startConfig = mergeConfig(defaultConfig(), options.config);
  let config = startConfig;
  let state = initialState(config, now());
  const faults: Array<Fault> = [];

  if (loadSnapshot(state, config.stateFile)) {
    log(`state loaded from ${config.stateFile}`);
  }

  // Getters, so a reset or a config change mid-request is seen at once.
  const context: AdminContext = {
    get config() {
      return config;
    },
    faults,
    log,
    now,
    persist: () => saveSnapshot(state, config.stateFile),
    random,
    reset: () => {
      config = startConfig;
      state = initialState(config, now());
      faults.length = 0;
      saveSnapshot(state, config.stateFile);
    },
    setConfig: (next) => {
      config = next;
    },
    get state() {
      return state;
    },
  };

  /** The next queued fault for `cmd`, used up by one. */
  function takeFault(cmd: string): Fault | undefined {
    const index = faults.findIndex((fault) => !fault.cmd || fault.cmd === cmd);
    if (index === -1) {
      return undefined;
    }
    const fault = faults[index];
    fault.count = (fault.count ?? 1) - 1;
    if (fault.count <= 0) {
      faults.splice(index, 1);
    }
    return fault;
  }

  /** The chaos reply for a portal or TCMB request, or null to answer normally. */
  async function chaos(ctx: PortalContext, cmd: string, portal: boolean): Promise<Reply | null> {
    const { errorRate, jitterMs, latencyMs, maintenance } = ctx.config.chaos;
    const delay = latencyMs + random() * jitterMs;
    if (delay > 0) {
      await sleep(delay);
    }
    const fault = takeFault(cmd);
    if (fault) {
      log(`fault ${fault.kind} on ${cmd}`);
      switch (fault.kind) {
        case '5xx':
          return html(serverErrorHTML(fault.status ?? 503), fault.status ?? 503);
        case 'error':
          return fail(ctx, fault.text ?? messages.textError);
        case 'maintenance':
          return html(maintenanceHTML);
        case 'text':
          return ok(ctx, fault.text ?? messages.textError);
      }
    }
    if (random() < errorRate) {
      const status = [500, 502, 503, 504][Math.floor(random() * 4)];
      log(`chaos ${status} on ${cmd}`);
      return html(serverErrorHTML(status), status);
    }
    if (portal && maintenance) {
      return html(maintenanceHTML);
    }
    return null;
  }

  async function route(request: IncomingMessage): Promise<Reply> {
    const method = request.method ?? 'GET';
    const path = new URL(request.url ?? '/', 'http://emulator').pathname;
    const ctx = context;

    if (path === '/__emulator' || path.startsWith('/__emulator/')) {
      const text = method === 'GET' || method === 'DELETE' ? '' : await readBody(request);
      let body: unknown = {};
      try {
        body = text ? JSON.parse(text) : {};
      } catch {
        return { ...html('Body must be JSON.'), status: 400 };
      }
      return adminReply(ctx, method, path, body);
    }

    if (method === 'GET' && path.startsWith('/kurlar/')) {
      const reply = await chaos(ctx, 'tcmb', false);
      if (reply) {
        return reply;
      }
      const { body, status } = tcmbReply(path, new Date(now()), config.tcmbHolidays);
      return status === 200 ? { body, contentType: 'text/xml', status } : html(body, status);
    }

    if (method === 'POST' && path === '/earsiv-services/assos-login') {
      const form = new URLSearchParams(await readBody(request));
      return (
        (await chaos(ctx, form.get('assoscmd') ?? '', true)) ??
        assosLogin(ctx, form, parseCookies(request.headers.cookie))
      );
    }

    if (method === 'POST' && path === '/earsiv-services/dispatch') {
      const form = new URLSearchParams(await readBody(request));
      const cmd = form.get('cmd') ?? '';
      const reply = (await chaos(ctx, cmd, true)) ?? dispatch(ctx, form);
      log(`dispatch ${cmd} -> ${reply.status}`);
      return reply;
    }

    if (method === 'GET' && ['/', '/index.jsp', '/intragiris.html'].includes(path)) {
      return html(indexHTML([...state.users.values()]));
    }

    return html(notFoundHTML, 404);
  }

  function handle(request: IncomingMessage, response: ServerResponse) {
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'access-control-allow-headers':
          request.headers['access-control-request-headers'] ?? 'content-type',
        'access-control-allow-methods': 'GET, POST, PATCH, DELETE, OPTIONS',
        'access-control-allow-origin': request.headers.origin ?? '*',
        'access-control-max-age': '600',
        vary: 'origin',
      });
      response.end();
      return;
    }
    route(request).then(
      (reply) => send(request, response, reply),
      (error: unknown) => {
        log(`error: ${error instanceof Error ? error.message : String(error)}`);
        send(request, response, html(serverErrorHTML(500), 500));
      },
    );
  }

  return {
    get config() {
      return config;
    },
    faults,
    handle,
    reset: context.reset,
    get state() {
      return state;
    },
  };
}

/** Starts the emulator on `host:port` (port 0 picks a free one). */
export async function startEmulator(
  options: EmulatorOptions & { host?: string; port?: number } = {},
): Promise<RunningEmulator> {
  const emulator = createEmulator(options);
  const server = createServer(emulator.handle);
  const host = options.host ?? '127.0.0.1';
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(options.port ?? 0, host, () => resolve());
  });
  const { port } = server.address() as AddressInfo;
  return Object.assign(emulator, {
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections();
        server.close((error) => (error ? reject(error) : resolve()));
      }),
    port,
    url: `http://${host.includes(':') ? `[${host}]` : host}:${port}`,
  });
}
