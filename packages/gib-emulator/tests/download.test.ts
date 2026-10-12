import { crc32 } from 'node:zlib';
import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { DOWNLOAD_NO_SESSION, zip } from '../src/download.ts';
import { messages, type RunningEmulator, startEmulator } from '../src/index.ts';

// GET /earsiv-services/download: the portal's İndir button.

let emulator: RunningEmulator;

beforeAll(async () => {
  emulator = await startEmulator();
});

afterAll(() => emulator.close());

beforeEach(() => emulator.reset());

async function login() {
  const response = await fetch(`${emulator.url}/earsiv-services/assos-login`, {
    body: new URLSearchParams({
      assoscmd: 'anologin',
      parola: '1',
      rtype: 'json',
      sifre: '1',
      sifre2: '1',
      userid: '33333301',
    }).toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    method: 'POST',
  });
  return String(((await response.json()) as Record<string, unknown>).token);
}

async function seedSigned(status = 'Onaylandı') {
  const response = await fetch(`${emulator.url}/__emulator/seed`, {
    body: JSON.stringify({ invoices: [{ status, userid: '33333301' }] }),
    method: 'POST',
  });
  const { invoices } = (await response.json()) as { invoices: Array<{ ettn: string }> };
  return invoices[0].ettn;
}

const download = (fields: Record<string, string>) =>
  fetch(
    `${emulator.url}/earsiv-services/download?${new URLSearchParams({
      belgeTip: 'FATURA',
      cmd: 'EARSIV_PORTAL_BELGE_INDIR',
      onayDurumu: 'Onaylandı',
      ...fields,
    })}`,
  );

/** The stored files of a zip, read from its central directory. */
function unzip(bytes: Buffer) {
  const end = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = bytes.readUInt16LE(end + 10);
  let at = bytes.readUInt32LE(end + 16);
  const files: Array<{ crc: number; data: Buffer; name: string }> = [];
  for (let index = 0; index < count; index++) {
    const size = bytes.readUInt32LE(at + 24);
    const nameLength = bytes.readUInt16LE(at + 28);
    const offset = bytes.readUInt32LE(at + 42);
    const name = bytes.toString('utf8', at + 46, at + 46 + nameLength);
    const dataAt = offset + 30 + bytes.readUInt16LE(offset + 26) + bytes.readUInt16LE(offset + 28);
    files.push({
      crc: bytes.readUInt32LE(at + 16),
      data: bytes.subarray(dataAt, dataAt + size),
      name,
    });
    at += 46 + nameLength;
  }
  return files;
}

test('a signed invoice downloads as a zip with its HTML page', async () => {
  const ettn = await seedSigned();
  const token = await login();
  const response = await download({ ettn, token });
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('application/zip');

  const files = unzip(Buffer.from(await response.arrayBuffer()));
  expect(files.map((file) => file.name)).toEqual([`${ettn}.html`]);
  const [html] = files;
  expect(html.crc).toBe(crc32(html.data));
  const shown = await fetch(`${emulator.url}/earsiv-services/dispatch`, {
    body: new URLSearchParams({
      callid: 'test',
      cmd: 'EARSIV_PORTAL_FATURA_GOSTER',
      jp: JSON.stringify({ ettn, onayDurumu: 'Onaylandı' }),
      pageName: 'RG_BASITTASLAKLAR',
      token,
    }).toString(),
    headers: { 'content-type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    method: 'POST',
  });
  expect(html.data.toString('utf8')).toBe(((await shown.json()) as { data: string }).data);
});

test('without a valid token the portal answers its plain text', async () => {
  const ettn = await seedSigned();
  const response = await download({ ettn, token: 'nope' });
  expect(await response.text()).toBe(DOWNLOAD_NO_SESSION);
});

test('an unknown ETTN gets the error envelope', async () => {
  const token = await login();
  const response = await download({ ettn: 'unknown', token });
  expect(await response.json()).toMatchObject({
    error: '1',
    messages: [{ text: messages.invoiceNotFound }],
  });
});

test('a deleted draft does not download', async () => {
  const ettn = await seedSigned('Silinmiş');
  const token = await login();
  const response = await download({ ettn, onayDurumu: 'Silinmiş', token });
  expect(await response.json()).toMatchObject({
    error: '1',
    messages: [{ text: messages.deletedNotShown }],
  });
});

test('zip names files in UTF-8 and keeps their bytes', () => {
  const data = Buffer.from('Fatura ğüşıöç', 'utf8');
  const [file] = unzip(Buffer.from(zip([{ data, name: 'çğ.html' }], new Date(2026, 9, 3, 10, 0))));
  expect(file).toEqual({ crc: crc32(data), data, name: 'çğ.html' });
});
