// GİB e-Arşiv API smoke test: login → taslak oluştur → listede doğrula →
// önizleme HTML'i çek → oluşturulan taslağı sil → logout.
//
// Kullanım:
//   node scripts/smoke.ts
//     → TEST portalı, herkese açık demo hesap (33333301/1)
//
//   EARSIV_MODE=prod EARSIV_USER=<kullanıcı> EARSIV_PASS=<şifre> node scripts/smoke.ts
//     → GERÇEK portal, kendi hesabınla. 1 TL'lik bir taslak oluşturur,
//       doğrular ve sonunda SİLER (hiçbir belge imzalanmaz/kesinleşmez).
//       Oluşan taslağı incelemek için silmeyi atla: EARSIV_KEEP=1
//
//   EARSIV_MODE=emulator NODE_EXTRA_CA_CERTS=~/.portless/ca.pem node scripts/smoke.ts
//     → yerel GİB emülatörü (`pnpm emulate`), https://gib.angaria.localhost.
//       Node portless CA'sına kendiliğinden güvenmez, bu yüzden NODE_EXTRA_CA_CERTS.
//       Başka bir adres için: EARSIV_EMULATOR_URL=http://127.0.0.1:5180
import { createClient, type SessionInfo } from '../src/index.ts';

const MODE = ['prod', 'emulator'].includes(process.env.EARSIV_MODE ?? '')
  ? (process.env.EARSIV_MODE as 'emulator' | 'prod')
  : 'test';
const USER = process.env.EARSIV_USER ?? (MODE === 'prod' ? '' : '33333301');
const PASS = process.env.EARSIV_PASS ?? (MODE === 'prod' ? '' : '1');
const EMULATOR_URL = process.env.EARSIV_EMULATOR_URL ?? 'https://gib.angaria.localhost';
const TEST_MODE = MODE !== 'prod';
const KEEP = process.env.EARSIV_KEEP === '1';

if (!USER || !PASS) {
  console.error('prod modunda EARSIV_USER ve EARSIV_PASS zorunludur.');
  process.exit(1);
}
if (MODE === 'emulator') {
  console.log(`emülatör: ${EMULATOR_URL}`);
}
console.log(`mod: ${MODE} — kullanıcı: ${USER}\n`);

const fetchWithTimeout: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: AbortSignal.timeout(30_000) });

const client = createClient({
  baseUrl: MODE === 'emulator' ? EMULATOR_URL : undefined,
  fetch: fetchWithTimeout,
});

const ok = (step: string, extra = '') => console.log(`✓ ${step}${extra ? ` — ${extra}` : ''}`);
const fail = (step: string, err: unknown) => {
  console.error(`✗ ${step} — ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
};
const field = (row: Record<string, unknown>, key: string) =>
  typeof row[key] === 'string' ? (row[key] as string) : '';

const now = new Date();
const p = (n: number) => String(n).padStart(2, '0');
const date = `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()}`;
const time = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;

async function loginWithRetry(): Promise<SessionInfo> {
  try {
    const s = await client.login(USER, PASS, TEST_MODE);
    ok('login', `token=${s.token.slice(0, 10)}…`);
    return s;
  } catch (error) {
    if (error instanceof Error && error.message.includes('birden fazla giriş')) {
      try {
        console.log('… açık oturum var, kapatılıp tekrar deneniyor');
        await client.forceLogout(USER, PASS, TEST_MODE);
        const s = await client.login(USER, PASS, TEST_MODE);
        ok('login (2. deneme)', `token=${s.token.slice(0, 10)}…`);
        return s;
      } catch (error) {
        fail('login (2. deneme)', error);
        if (MODE === 'test') {
          console.error(
            'Demo hesap meşgul olabilir; başka bir hesap deneyin: EARSIV_USER=33333315 EARSIV_PASS=1',
          );
        }
        process.exit(1);
      }
    }
    fail('login', error);
    process.exit(1);
  }
}

const session = await loginWithRetry();

let uuid = '';

try {
  const draft = await client.createDraftInvoice(session, {
    date,
    time,
    currency: 'TRY',
    invoiceType: 'SATIS',
    taxIDOrTRID: '11111111111',
    title: 'Smoke Test Alıcı',
    name: 'Smoke',
    surname: 'Test',
    fullAddress: 'Test Mah. Deneme Cad. No:1 Çankaya',
    country: 'Türkiye',
    city: 'Ankara',
    district: 'Çankaya',
    items: [
      {
        name: 'Smoke test hizmeti',
        quantity: 1,
        unitPrice: 1,
        price: 1,
        unitType: 'C62',
        VATRate: 20,
        VATAmount: 0.2,
      },
    ],
    grandTotal: 1,
    totalVAT: 0.2,
    grandTotalInclVAT: 1.2,
    paymentTotal: 1.2,
    note: 'smoke test',
  });
  uuid = draft.uuid;
  ok('createDraftInvoice', `GİB yanıtı: ${JSON.stringify(draft.response.data)}`);
  if (uuid) {
    ok('ETTN bulundu', uuid);
  } else {
    fail('ETTN bulunamadı', 'GİB başarı dedi ama taslak listesinde eşleşen kayıt yok');
  }
} catch (error) {
  fail('createDraftInvoice', error);
}

let createdRow: Record<string, unknown> | undefined;

try {
  const drafts = await client.getDrafts(session, date, date);
  console.log(`\nBugünkü belgeler (${drafts.length} adet, son 5):`);
  for (const d of drafts.slice(-5)) {
    console.log(
      `  - ${field(d, 'belgeNumarasi')} | ${field(d, 'aliciUnvanAdSoyad')} | ${field(d, 'belgeTarihi')} | ${field(d, 'onayDurumu')} | ${field(d, 'ettn')}`,
    );
  }
  createdRow = drafts.find((d) => d.ettn === uuid);
  if (uuid && createdRow) {
    ok('getDrafts', `yeni taslak listede (belgeNumarasi=${field(createdRow, 'belgeNumarasi')})`);
  } else if (uuid) {
    fail('getDrafts', 'oluşturulan taslak listede YOK');
  }
} catch (error) {
  fail('getDrafts', error);
}

if (uuid) {
  try {
    const html = await client.getInvoiceHTML(session, uuid, 'Onaylanmadı');
    ok('getInvoiceHTML (önizleme)', `${html.length} karakter`);
  } catch (error) {
    fail('getInvoiceHTML (önizleme)', error);
  }
}

if (createdRow && !KEEP) {
  try {
    await client.cancelInvoice(session, 'smoke test temizliği', createdRow);
    ok('cancelInvoice (temizlik)', 'test taslağı silindi');
  } catch (error) {
    fail('cancelInvoice (temizlik)', error);
  }
} else if (createdRow && KEEP) {
  console.log('EARSIV_KEEP=1 — test taslağı silinmedi, portalda inceleyebilirsiniz.');
}

try {
  await client.logout(session);
  ok('logout');
} catch (error) {
  fail('logout', error);
}
