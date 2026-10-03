import type { EmulatorConfig, EmulatorUser } from './config.ts';
import { dashDate, dayNumber, optime, parseGIBDate } from './dates.ts';
import { invoiceHTML } from './invoice-html.ts';
import { messages } from './messages.ts';
import {
  nextDocumentNumber,
  randomHex,
  recipientName,
  type Session,
  type State,
  type StoredInvoice,
  timeUUID,
} from './state.ts';

// The two portal endpoints the SDK talks to: /earsiv-services/assos-login
// (login, logout) and /earsiv-services/dispatch (every `cmd`). Both take a
// form-encoded POST; dispatch carries its arguments as JSON in `jp`.

export interface PortalContext {
  config: EmulatorConfig;
  log: (line: string) => void;
  now: () => number;
  /** Writes the snapshot file, if there is one. */
  persist: () => void;
  random: () => number;
  state: State;
}

export interface Reply {
  body: string;
  contentType: string;
  setCookies?: Array<string>;
  status: number;
}

/** How long the cookie from a refused login can still force a logout. */
const FORCE_LOGOUT_TTL_MS = 5 * 60_000;
const SMS_HISTORY = 50;

export const jsonReply = (body: unknown, setCookies?: Array<string>): Reply => ({
  body: JSON.stringify(body),
  contentType: 'application/json;charset=UTF-8',
  setCookies,
  status: 200,
});

const metadata = (ctx: PortalContext) => ({ optime: optime(new Date(ctx.now())) });

/** GİB's success envelope. */
export const ok = (ctx: PortalContext, data: unknown) =>
  jsonReply({ data, metadata: metadata(ctx) });

/** GİB's error envelope: the SDK reads `error` and `messages[0].text`. */
export const fail = (ctx: PortalContext, text: string, type = '4') =>
  jsonReply({ error: '1', messages: [{ text, type }], metadata: metadata(ctx) });

const sessionCookie = (value: string) => `JSESSIONID=${value}; Path=/; HttpOnly`;

const str = (value: unknown) => (typeof value === 'string' ? value : '');

const records = (value: unknown) =>
  Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> => typeof item === 'object' && item !== null,
      )
    : [];

/** Drops expired sessions, force-logout cookies and old SMS codes. */
function purgeExpired(ctx: PortalContext) {
  const now = ctx.now();
  for (const [token, session] of ctx.state.sessions) {
    if (session.expiresAt <= now) {
      ctx.state.sessions.delete(token);
      ctx.log(`session of ${session.userid} expired`);
    }
  }
  for (const [cookie, handle] of ctx.state.forceLogouts) {
    if (handle.expiresAt <= now) {
      ctx.state.forceLogouts.delete(cookie);
    }
  }
  ctx.state.sms = ctx.state.sms.slice(-SMS_HISTORY);
}

/** Ends every session of `userid`, its own and foreign ones. */
export function endSessions(ctx: PortalContext, userid?: string) {
  let count = 0;
  for (const [token, session] of ctx.state.sessions) {
    if (!userid || session.userid === userid) {
      ctx.state.sessions.delete(token);
      count++;
    }
  }
  return count;
}

function login(ctx: PortalContext, form: URLSearchParams): Reply {
  const userid = form.get('userid') ?? '';
  const user = ctx.state.users.get(userid);
  if (!user || user.password !== form.get('sifre')) {
    ctx.log(`login ${userid}: wrong user or password`);
    return fail(ctx, messages.invalidCredentials);
  }
  purgeExpired(ctx);
  const now = ctx.now();
  if ([...ctx.state.sessions.values()].some((session) => session.userid === userid)) {
    const cookie = randomHex(16);
    ctx.state.forceLogouts.set(cookie, { expiresAt: now + FORCE_LOGOUT_TTL_MS, userid });
    ctx.log(`login ${userid}: refused, a session is already open (force logout to end it)`);
    return { ...fail(ctx, messages.sessionLocked), setCookies: [sessionCookie(cookie)] };
  }
  const session: Session = {
    cookie: randomHex(16),
    createdAt: now,
    expiresAt: now + ctx.config.sessionTtlSeconds * 1000,
    foreign: false,
    token: randomHex(48),
    userid,
  };
  ctx.state.sessions.set(session.token, session);
  ctx.log(`login ${userid}`);
  return jsonReply(
    { redirectUrl: `/index.jsp?token=${session.token}&v=${now}`, token: session.token },
    [sessionCookie(session.cookie)],
  );
}

function logout(ctx: PortalContext, form: URLSearchParams, cookies: Record<string, string>) {
  const session = ctx.state.sessions.get(form.get('token') ?? '');
  const cookie = cookies.JSESSIONID ?? '';
  const handle = ctx.state.forceLogouts.get(cookie);
  if (session && !session.foreign) {
    ctx.state.sessions.delete(session.token);
    ctx.log(`logout ${session.userid}`);
  } else if (handle) {
    ctx.state.forceLogouts.delete(cookie);
    endSessions(ctx, handle.userid);
    ctx.log(`force logout ${handle.userid}: open session ended`);
  } else {
    for (const [token, item] of ctx.state.sessions) {
      if (item.cookie === cookie && !item.foreign) {
        ctx.state.sessions.delete(token);
        ctx.log(`logout ${item.userid}`);
      }
    }
  }
  return jsonReply({ data: { redirectUrl: 'login.html' } });
}

/**
 * assos-login: `login` (test portal) and `anologin` (production) with a
 * userid log in; `logout` logs out on both portals. `anologin` without a
 * userid is a login with missing fields, not a logout.
 */
export function assosLogin(
  ctx: PortalContext,
  form: URLSearchParams,
  cookies: Record<string, string>,
): Reply {
  const command = form.get('assoscmd');
  if ((command === 'login' || command === 'anologin') && form.get('userid')) {
    return login(ctx, form);
  }
  if (command === 'anologin') {
    return fail(ctx, messages.loginFieldsMissing, '5');
  }
  if (command === 'logout') {
    return logout(ctx, form, cookies);
  }
  return fail(ctx, messages.invalidCommand);
}

interface CommandContext extends PortalContext {
  session: Session;
  user: EmulatorUser;
}

type Command = (ctx: CommandContext, data: Record<string, unknown>) => Reply;

const findInvoice = (ctx: CommandContext, ettn: unknown) => {
  const invoice = ctx.state.invoices.get(str(ettn));
  return invoice?.userid === ctx.user.userid ? invoice : undefined;
};

/**
 * A cancellation request as a row's İptal/İtiraz Durumu, in the codes of the
 * portal's incoming request list: `iptalItiraz` 0 is a cancellation (1 an
 * objection), `iptalItirazDurumu` 0 waiting, 1 accepted, 2 rejected.
 */
const CANCELLATION_STATUS = { accepted: '1', pending: '0', rejected: '2' } as const;

const listRow = (invoice: StoredInvoice) => ({
  aliciUnvanAdSoyad: invoice.aliciUnvanAdSoyad,
  aliciVknTckn: invoice.aliciVknTckn,
  belgeNumarasi: invoice.belgeNumarasi,
  belgeTarihi: invoice.belgeTarihi,
  belgeTuru: 'FATURA',
  ettn: invoice.ettn,
  onayDurumu: invoice.onayDurumu,
  ...(invoice.cancellation && {
    iptalItiraz: '0',
    iptalItirazDurumu: CANCELLATION_STATUS[invoice.cancellation],
  }),
});

function createDraft(ctx: CommandContext, data: Record<string, unknown>): Reply {
  // GİB assigns the ETTN; a client-sent one is refused with HTTP 200 and no
  // error flag, like every outcome of this command.
  if (str(data.faturaUuid)) {
    ctx.log(`${ctx.user.userid}: draft refused, faturaUuid was sent`);
    return ok(ctx, messages.ettnRejected);
  }
  if (ctx.random() < ctx.config.chaos.textErrorRate) {
    ctx.log(`${ctx.user.userid}: draft refused by chaos.textErrorRate`);
    return ok(ctx, messages.textError);
  }
  const day = parseGIBDate(data.faturaTarihi);
  if (!day) {
    return ok(ctx, messages.invalidDate);
  }
  if (!/^\d{10,11}$/.test(str(data.vknTckn))) {
    return ok(ctx, messages.invalidRecipientID);
  }
  if (records(data.malHizmetTable).length === 0) {
    return ok(ctx, messages.itemsMissing);
  }
  const now = ctx.now();
  const ettn = timeUUID(now);
  const belgeNumarasi = nextDocumentNumber(ctx.state, ctx.user.userid, day.year);
  const payload = { ...data, belgeNumarasi, faturaUuid: ettn };
  ctx.state.invoices.set(ettn, {
    aliciUnvanAdSoyad: recipientName(payload),
    aliciVknTckn: str(data.vknTckn),
    belgeNumarasi,
    belgeTarihi: dashDate(day),
    createdAt: now,
    ettn,
    onayDurumu: 'Onaylanmadı',
    payload,
    userid: ctx.user.userid,
  });
  ctx.persist();
  ctx.log(`${ctx.user.userid}: draft ${belgeNumarasi} created, ETTN ${ettn}`);
  return ok(ctx, messages.draftCreated);
}

function listDrafts(ctx: CommandContext, data: Record<string, unknown>): Reply {
  const start = parseGIBDate(data.baslangic);
  const end = parseGIBDate(data.bitis);
  if (!start || !end) {
    return fail(ctx, messages.invalidDate);
  }
  // A refused range comes back as a data row, not as an error envelope.
  if (dayNumber(start) > dayNumber(end)) {
    return ok(ctx, [{ error: messages.rangeReversed }]);
  }
  // Both ends count: 01/09 to 07/09 is seven days.
  if (dayNumber(end) - dayNumber(start) + 1 > ctx.config.maxRangeDays) {
    return ok(ctx, [{ error: messages.rangeTooLong(ctx.config.maxRangeDays) }]);
  }
  const rows = [...ctx.state.invoices.values()]
    .filter((invoice) => {
      const day = parseGIBDate(invoice.belgeTarihi);
      return (
        invoice.userid === ctx.user.userid &&
        day &&
        dayNumber(day) >= dayNumber(start) &&
        dayNumber(day) <= dayNumber(end)
      );
    })
    .toSorted((a, b) => a.createdAt - b.createdAt || a.belgeNumarasi.localeCompare(b.belgeNumarasi))
    .map(listRow);
  return ok(ctx, rows);
}

function sendSMS(ctx: CommandContext, data: Record<string, unknown>): Reply {
  const phone = str(data.CEPTEL);
  if (!ctx.user.telefon || phone !== ctx.user.telefon) {
    return fail(ctx, messages.phoneMismatch);
  }
  const now = ctx.now();
  const code =
    ctx.config.smsCode === 'random'
      ? String(Math.floor(ctx.random() * 1_000_000)).padStart(6, '0')
      : ctx.config.smsCode;
  const oid = randomHex(10);
  ctx.state.sms.push({
    code,
    expiresAt: now + ctx.config.smsTtlSeconds * 1000,
    oid,
    phone,
    sentAt: now,
    used: false,
    userid: ctx.user.userid,
  });
  ctx.log(`SMS to ${phone} (${ctx.user.userid}): code ${code}, oid ${oid}`);
  return ok(ctx, { oid });
}

/** 0lhozfib5410mp: checks the SMS code and, with OPR 1, signs the drafts in DATA. */
function verifySMS(ctx: CommandContext, data: Record<string, unknown>): Reply {
  const now = ctx.now();
  const operation = ctx.state.sms.find(
    (item) =>
      item.oid === str(data.OID) &&
      item.userid === ctx.user.userid &&
      !item.used &&
      item.expiresAt > now,
  );
  if (!operation) {
    return ok(ctx, { msg: messages.smsOperationUnknown, sonuc: '0' });
  }
  if (str(data.SIFRE) !== operation.code) {
    ctx.log(`${ctx.user.userid}: wrong SMS code ${str(data.SIFRE)}`);
    return ok(ctx, { msg: messages.smsCodeWrong, sonuc: '0' });
  }
  operation.used = true;
  const signed: Array<string> = [];
  if (data.OPR === 1) {
    for (const item of records(data.DATA)) {
      const invoice = findInvoice(ctx, item.ettn);
      if (invoice?.onayDurumu === 'Onaylanmadı') {
        invoice.onayDurumu = 'Onaylandı';
        signed.push(invoice.belgeNumarasi);
      }
    }
    ctx.persist();
  }
  ctx.log(`${ctx.user.userid}: SMS code accepted, signed ${signed.join(', ') || 'nothing'}`);
  return ok(ctx, { msg: messages.smsSigned, sonuc: '1' });
}

function signHSM(ctx: CommandContext, data: Record<string, unknown>): Reply {
  if (!ctx.user.hsm) {
    return fail(ctx, messages.hsmNotAllowed);
  }
  let count = 0;
  for (const item of records(data.imzalanacaklar)) {
    const invoice = findInvoice(ctx, item.ettn);
    if (invoice?.onayDurumu === 'Onaylanmadı') {
      invoice.onayDurumu = 'Onaylandı';
      count++;
    }
  }
  ctx.persist();
  return ok(ctx, messages.hsmSigned(count));
}

function deleteDrafts(ctx: CommandContext, data: Record<string, unknown>): Reply {
  const reason = str(data.aciklama).trim();
  if (!reason) {
    return fail(ctx, messages.deleteReasonMissing);
  }
  const invoices = records(data.silinecekler)
    .map((item) => findInvoice(ctx, item.ettn))
    .filter((invoice) => invoice !== undefined);
  if (invoices.some((invoice) => invoice.onayDurumu === 'Onaylandı')) {
    return fail(ctx, messages.notDeletable);
  }
  let count = 0;
  for (const invoice of invoices) {
    if (invoice.onayDurumu === 'Onaylanmadı') {
      invoice.onayDurumu = 'Silinmiş';
      invoice.silmeNedeni = reason;
      count++;
    }
  }
  ctx.persist();
  ctx.log(`${ctx.user.userid}: ${count} draft(s) deleted (${reason})`);
  return ok(ctx, messages.deleted(count));
}

const userInfo = (user: EmulatorUser) => ({
  ad: user.ad,
  apartmanAdi: '',
  apartmanNo: '',
  cadde: user.cadde,
  ePostaAdresi: user.ePostaAdresi,
  faksNo: '',
  il: user.il,
  ilce: user.ilce,
  isMerkezi: '',
  kapiNo: '',
  kasaba: '',
  mersisNo: '',
  postaKodu: '',
  sicilNo: '',
  soyad: user.soyad,
  telNo: user.telefon,
  ulke: 'Türkiye',
  unvan: user.unvan,
  vergiDairesi: user.vergiDairesi,
  vknTckn: user.vknTckn,
  webSitesiAdresi: '',
});

const EDITABLE_USER_FIELDS = [
  'ad',
  'cadde',
  'ePostaAdresi',
  'il',
  'ilce',
  'soyad',
  'unvan',
  'vergiDairesi',
] as const;

function saveUser(ctx: CommandContext, data: Record<string, unknown>): Reply {
  for (const field of EDITABLE_USER_FIELDS) {
    if (typeof data[field] === 'string') {
      ctx.user[field] = data[field];
    }
  }
  ctx.persist();
  return ok(ctx, messages.userSaved);
}

function lookupRecipient(ctx: CommandContext, data: Record<string, unknown>): Reply {
  const id = str(data.vknTcknn);
  const user = [...ctx.state.users.values()].find((item) => item.vknTckn === id);
  return ok(ctx, {
    adi: user?.ad ?? '',
    soyadi: user?.soyad ?? '',
    unvan: user?.unvan ?? '',
    vergiDairesi: user?.vergiDairesi ?? '',
  });
}

const COMMANDS: Record<string, Command> = {
  '0lhozfib5410mp': verifySMS,
  EARSIV_PORTAL_FATURA_GETIR: (ctx, data) => {
    const invoice = findInvoice(ctx, data.ettn);
    return invoice ? ok(ctx, invoice.payload) : fail(ctx, messages.invoiceNotFound);
  },
  EARSIV_PORTAL_FATURA_GOSTER: (ctx, data) => {
    const invoice = findInvoice(ctx, data.ettn);
    if (!invoice) {
      return fail(ctx, messages.invoiceNotFound);
    }
    return invoice.onayDurumu === 'Silinmiş'
      ? fail(ctx, messages.deletedNotShown)
      : ok(ctx, invoiceHTML(invoice, ctx.user));
  },
  EARSIV_PORTAL_FATURA_HSM_CIHAZI_ILE_IMZALA: signHSM,
  EARSIV_PORTAL_FATURA_OLUSTUR: createDraft,
  EARSIV_PORTAL_FATURA_SIL: deleteDrafts,
  EARSIV_PORTAL_KULLANICI_BILGILERI_GETIR: (ctx) => ok(ctx, userInfo(ctx.user)),
  EARSIV_PORTAL_KULLANICI_BILGILERI_KAYDET: saveUser,
  EARSIV_PORTAL_SMSSIFRE_GONDER: sendSMS,
  EARSIV_PORTAL_TASLAKLARI_GETIR: listDrafts,
  EARSIV_PORTAL_TELEFONNO_SORGULA: (ctx) =>
    ok(ctx, ctx.user.telefon ? { telefon: ctx.user.telefon } : {}),
  EARSIV_PORTAL_UUID_GETIR: (ctx) => ok(ctx, timeUUID(ctx.now())),
  SICIL_VEYA_MERNISTEN_BILGILERI_GETIR: lookupRecipient,
};

export function dispatch(ctx: PortalContext, form: URLSearchParams): Reply {
  purgeExpired(ctx);
  const session = ctx.state.sessions.get(form.get('token') ?? '');
  const user = session && !session.foreign ? ctx.state.users.get(session.userid) : undefined;
  if (!session || !user) {
    return fail(ctx, messages.sessionExpired);
  }
  session.expiresAt = ctx.now() + ctx.config.sessionTtlSeconds * 1000;
  const command = COMMANDS[form.get('cmd') ?? ''];
  if (!command) {
    return fail(ctx, messages.serviceNotFound);
  }
  let data: unknown;
  try {
    data = JSON.parse(form.get('jp') ?? '{}');
  } catch {
    data = null;
  }
  return command(
    { ...ctx, session, user },
    typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {},
  );
}
