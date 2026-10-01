// `pnpm emulate` (repo root) runs this with --portless. Plain flags:
//   --port 5180        GIB_EMULATOR_PORT; the desktop app expects 5180
//   --host 127.0.0.1   GIB_EMULATOR_HOST
//   --state file.json  GIB_EMULATOR_STATE; keep documents across restarts
//   --config file.json GIB_EMULATOR_CONFIG; a PartialConfig
//   --portless         register https://gib.angaria.localhost and
//                      https://tcmb.angaria.localhost as portless aliases
// Every other knob is a GIB_EMULATOR_* variable (see README.md) or a call to
// the /__emulator API while it runs.
import { execFileSync } from 'node:child_process';
import { parseArgs } from 'node:util';
import { configFromEnv } from './config.ts';
import { startEmulator } from './server.ts';

const ALIASES = ['gib.angaria', 'tcmb.angaria'];

const { values } = parseArgs({
  options: {
    config: { type: 'string' },
    host: { type: 'string' },
    port: { type: 'string' },
    portless: { type: 'boolean' },
    state: { type: 'string' },
  },
});

const print = (line: string) => process.stdout.write(`${line}\n`);
const time = () => new Date().toTimeString().slice(0, 8);

if (values.config) {
  process.env.GIB_EMULATOR_CONFIG = values.config;
}
const config = configFromEnv();
if (values.state) {
  config.stateFile = values.state;
}

const emulator = await startEmulator({
  config,
  host: values.host ?? process.env.GIB_EMULATOR_HOST ?? '127.0.0.1',
  log: (line) => print(`${time()} ${line}`),
  port: Number(values.port ?? process.env.GIB_EMULATOR_PORT ?? 5180),
});

function portless(args: Array<string>) {
  try {
    execFileSync('portless', args, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const aliased =
  values.portless &&
  ALIASES.every((name) => portless(['alias', name, String(emulator.port), '--force']));

const { smsCode, stateFile, users } = emulator.config;
print(`GİB e-Arşiv emulator on ${emulator.url}`);
if (aliased) {
  print(`  portless: ${ALIASES.map((name) => `https://${name}.localhost`).join(', ')}`);
} else if (values.portless) {
  print(
    '  portless aliases failed; is the proxy running? (pnpm exec portless proxy start --https)',
  );
}
print(`  users: ${users.map(({ password, userid }) => `${userid}/${password}`).join(', ')}`);
print(`  SMS code: ${smsCode}`);
print(`  state: ${stateFile || 'in memory'}; control API: ${emulator.url}/__emulator`);

let stopping = false;
function stop() {
  if (stopping) {
    return;
  }
  stopping = true;
  if (aliased) {
    for (const name of ALIASES) {
      portless(['alias', '--remove', name]);
    }
  }
  emulator.close().finally(() => process.exit(0));
}

process.on('SIGINT', stop);
process.on('SIGTERM', stop);
