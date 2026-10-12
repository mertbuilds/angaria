import { fail, type PortalContext, type Reply } from './gib.ts';
import { invoiceHTML } from './invoice-html.ts';
import { messages } from './messages.ts';

// GET /earsiv-services/download?token=&ettn=&belgeTip=FATURA&onayDurumu=&cmd=EARSIV_PORTAL_BELGE_INDIR,
// the portal's İndir button: a zip with the invoice page that
// EARSIV_PORTAL_FATURA_GOSTER shows, as {ettn}.html. The live portal adds the
// UBL XML where it has one; the emulator does not.

/** What the portal answers a download without a valid token (mlevent/fatura). */
export const DOWNLOAD_NO_SESSION = 'Oturum geçersiz, token yok';

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xed_b8_83_20 ^ (c >>> 1) : c >>> 1;
  }
  return c >>> 0;
});

function crc32(bytes: Uint8Array) {
  let crc = 0xff_ff_ff_ff;
  for (const byte of bytes) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xff_ff_ff_ff) >>> 0;
}

/** Files stored uncompressed, names in UTF-8, dated `date`. */
export function zip(files: Array<{ data: Uint8Array; name: string }>, date: Date): Uint8Array {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1);
  const day = ((date.getFullYear() - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  const locals: Array<Buffer> = [];
  const centrals: Array<Buffer> = [];
  let offset = 0;
  for (const file of files) {
    const name = Buffer.from(file.name, 'utf8');
    const crc = crc32(file.data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04_03_4b_50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x08_00, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(day, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(file.data.length, 18);
    local.writeUInt32LE(file.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02_01_4b_50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x08_00, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(day, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(file.data.length, 20);
    central.writeUInt32LE(file.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    locals.push(local, name, Buffer.from(file.data));
    centrals.push(central, name);
    offset += local.length + name.length + file.data.length;
  }
  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06_05_4b_50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}

export function downloadReply(ctx: PortalContext, query: URLSearchParams): Reply {
  const session = ctx.state.sessions.get(query.get('token') ?? '');
  const user =
    session && !session.foreign && session.expiresAt > ctx.now()
      ? ctx.state.users.get(session.userid)
      : undefined;
  if (!session || !user) {
    return {
      body: DOWNLOAD_NO_SESSION,
      contentType: 'text/plain;charset=UTF-8',
      status: 200,
    };
  }
  session.expiresAt = ctx.now() + ctx.config.sessionTtlSeconds * 1000;
  const invoice = ctx.state.invoices.get(query.get('ettn') ?? '');
  if (invoice?.userid !== user.userid || query.get('cmd') !== 'EARSIV_PORTAL_BELGE_INDIR') {
    return fail(ctx, messages.invoiceNotFound);
  }
  if (invoice.onayDurumu === 'Silinmiş') {
    return fail(ctx, messages.deletedNotShown);
  }
  ctx.log(`${user.userid}: ${invoice.belgeNumarasi} downloaded`);
  return {
    body: zip(
      [{ data: Buffer.from(invoiceHTML(invoice, user), 'utf8'), name: `${invoice.ettn}.html` }],
      new Date(invoice.createdAt),
    ),
    contentType: 'application/zip',
    status: 200,
  };
}
