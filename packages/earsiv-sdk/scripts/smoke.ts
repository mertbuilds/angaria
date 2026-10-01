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
import { createClient, type SessionInfo } from "../src/index.ts";

const MODE = process.env.EARSIV_MODE === "prod" ? "prod" : "test";
const USER = process.env.EARSIV_USER ?? (MODE === "test" ? "33333301" : "");
const PASS = process.env.EARSIV_PASS ?? (MODE === "test" ? "1" : "");
const KEEP = process.env.EARSIV_KEEP === "1";

if (!USER || !PASS) {
  console.error("prod modunda EARSIV_USER ve EARSIV_PASS zorunludur.");
  process.exit(1);
}
console.log(`mod: ${MODE} — kullanıcı: ${USER}\n`);

const fetchWithTimeout: typeof fetch = (input, init) =>
  fetch(input, { ...init, signal: AbortSignal.timeout(30_000) });

const client = createClient({ fetch: fetchWithTimeout });

const ok = (step: string, extra = "") => console.log(`✓ ${step}${extra ? ` — ${extra}` : ""}`);
const fail = (step: string, err: unknown) => {
  console.error(`✗ ${step} — ${err instanceof Error ? err.message : String(err)}`);
  process.exitCode = 1;
};
const field = (row: Record<string, unknown>, key: string) =>
  typeof row[key] === "string" ? (row[key] as string) : "";

const now = new Date();
const p = (n: number) => String(n).padStart(2, "0");
const date = `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()}`;
const time = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;

async function loginWithRetry(): Promise<SessionInfo> {
  try {
    const s = await client.login(USER, PASS, MODE === "test");
    ok("login", `token=${s.token.slice(0, 10)}…`);
    return s;
  } catch (err) {
    if (err instanceof Error && err.message.includes("birden fazla giriş")) {
      try {
        console.log("… açık oturum var, kapatılıp tekrar deneniyor");
        await client.forceLogout(USER, PASS, MODE === "test");
        const s = await client.login(USER, PASS, MODE === "test");
        ok("login (2. deneme)", `token=${s.token.slice(0, 10)}…`);
        return s;
      } catch (retryErr) {
        fail("login (2. deneme)", retryErr);
        if (MODE === "test") {
          console.error(
            "Demo hesap meşgul olabilir; başka bir hesap deneyin: EARSIV_USER=33333315 EARSIV_PASS=1",
          );
        }
        process.exit(1);
      }
    }
    fail("login", err);
    process.exit(1);
  }
}

const session = await loginWithRetry();

let uuid = "";

try {
  const draft = await client.createDraftInvoice(session, {
    date,
    time,
    currency: "TRY",
    invoiceType: "SATIS",
    taxIDOrTRID: "11111111111",
    title: "Smoke Test Alıcı",
    name: "Smoke",
    surname: "Test",
    fullAddress: "Test Mah. Deneme Cad. No:1 Çankaya",
    country: "Türkiye",
    city: "Ankara",
    district: "Çankaya",
    items: [
      {
        name: "Smoke test hizmeti",
        quantity: 1,
        unitPrice: 1,
        price: 1,
        unitType: "C62",
        VATRate: 20,
        VATAmount: 0.2,
      },
    ],
    grandTotal: 1,
    totalVAT: 0.2,
    grandTotalInclVAT: 1.2,
    paymentTotal: 1.2,
    note: "smoke test",
  });
  uuid = draft.uuid;
  ok("createDraftInvoice", `GİB yanıtı: ${JSON.stringify(draft.response.data)}`);
  if (uuid) ok("ETTN bulundu", uuid);
  else fail("ETTN bulunamadı", "GİB başarı dedi ama taslak listesinde eşleşen kayıt yok");
} catch (err) {
  fail("createDraftInvoice", err);
}

let createdRow: Record<string, unknown> | undefined;

try {
  const drafts = (await client.getDrafts(session, date, date)) as Array<Record<string, unknown>>;
  console.log(`\nBugünkü belgeler (${drafts.length} adet, son 5):`);
  for (const d of drafts.slice(-5)) {
    console.log(
      `  - ${field(d, "belgeNumarasi")} | ${field(d, "aliciUnvanAdSoyad")} | ${field(d, "belgeTarihi")} | ${field(d, "onayDurumu")} | ${field(d, "ettn")}`,
    );
  }
  createdRow = drafts.find((d) => d.ettn === uuid);
  if (uuid && createdRow) {
    ok("getDrafts", `yeni taslak listede (belgeNumarasi=${field(createdRow, "belgeNumarasi")})`);
  } else if (uuid) {
    fail("getDrafts", "oluşturulan taslak listede YOK");
  }
} catch (err) {
  fail("getDrafts", err);
}

if (uuid) {
  try {
    const html = await client.getInvoiceHTML(session, uuid, "Onaylanmadı");
    ok("getInvoiceHTML (önizleme)", `${html.length} karakter`);
  } catch (err) {
    fail("getInvoiceHTML (önizleme)", err);
  }
}

if (createdRow && !KEEP) {
  try {
    await client.cancelInvoice(session, "smoke test temizliği", createdRow);
    ok("cancelInvoice (temizlik)", "test taslağı silindi");
  } catch (err) {
    fail("cancelInvoice (temizlik)", err);
  }
} else if (createdRow && KEEP) {
  console.log("EARSIV_KEEP=1 — test taslağı silinmedi, portalda inceleyebilirsiniz.");
}

try {
  await client.logout(session);
  ok("logout");
} catch (err) {
  fail("logout", err);
}
