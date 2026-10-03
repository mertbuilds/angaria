# @angaria/gib-emulator

A local stand-in for the GİB e-Arşiv portal (`earsivportal.efatura.gov.tr`) and the TCMB rates feed (`www.tcmb.gov.tr/kurlar`). Development, tests and manual QA run against it, never against live GİB: the production portal issues real documents. It also replaces GİB's test portal, whose shared demo accounts are locked by other people's sessions most of the time; Angaria has no test portal mode (removed 2026-10-02).

Plain `node:http`, no runtime dependencies. In-memory state by default, an optional JSON snapshot file for longer QA sessions.

## Run it

```sh
pnpm emulate                                   # repo root, also the `gib` pane of `pnpm dev`
```

It listens on `http://127.0.0.1:5180` and registers two portless aliases for the same server: `https://gib.angaria.localhost` and `https://tcmb.angaria.localhost`. The port is fixed (outside portless's 4000-4999 `PORT` pool) because the desktop app's dev allowlist names it.

Every SMS code, created draft, login and force logout is logged in the terminal.

| User       | Password  | Notes                                                                                                                         |
| ---------- | --------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `33333301` | `1`       | Like GİB's public demo account. Phone `5550000001`.                                                                           |
| `33333302` | `1`       | Second demo account, phone `5550000002`.                                                                                      |
| `33333303` | `1`       | No registered phone: SMS signing fails.                                                                                       |
| `12345678` | `angaria` | Production-like freelancer (TCKN): two signed İSTİSNA invoices (USD, EUR), a cancelled one and a deleted draft in past weeks. |

The SMS code is `123456` unless configured.

### Clients

- SDK: `createClient({ baseUrl: 'http://127.0.0.1:5180' })`. `baseUrl` replaces the production portal.
- TCMB: `fetchTCMBRates(date, { baseUrl: 'http://127.0.0.1:5180' })` (angaria-utils).
- Smoke script: `node packages/earsiv-sdk/scripts/smoke.ts` runs against `http://127.0.0.1:5180` by default (`EARSIV_EMULATOR_URL` for another address; for a portless alias add `NODE_EXTRA_CA_CERTS=~/.portless/ca.pem`, Node ignores the macOS trust store). The real portal only with `EARSIV_MODE=prod`.
- Desktop app (dev only): Ayarlar › Gelişmiş › Emülatör. GİB and TCMB calls then go to `VITE_GIB_EMULATOR_URL` (`apps/desktop/.env.development`). The app uses plain http on loopback, not the portless alias: the Tauri http plugin (reqwest with rustls and bundled roots) does not trust portless's local CA. `tauri dev --config src-tauri/tauri.dev.conf.json` (the `desktop` pane of `pnpm dev`) adds that URL to the http allowlist; release builds never see it. In a plain browser (`pnpm --filter desktop dev`, `VITE_LICENSE_BYPASS=1`) the app reaches the emulator with the browser's fetch, which the emulator allows through CORS for the desktop dev origins (`http://localhost:<port>`, `http://127.0.0.1:<port>`, `tauri://localhost`, `http://tauri.localhost`) on the portal and TCMB routes.
- Tests: `startEmulator({ port: 0 })` in-process. `packages/earsiv-sdk/tests/emulator-setup.ts` starts one per test run.

## Protocol

POST `/earsiv-services/assos-login` (form): `assoscmd=anologin` (production, what the SDK sends) or `login` (GİB's test portal) with `userid`, `sifre` logs in and returns `{ token, redirectUrl }` plus a `JSESSIONID` cookie. `logout` with the token logs out on both portals. `anologin` without a `userid` is a login with missing fields: error type `5`, "Sisteme giriş için eksik bilgi verildi", and the session stays open.

POST `/earsiv-services/dispatch` (form: `cmd`, `callid`, `pageName`, `token`, `jp` = JSON). Success is `{ data, metadata: { optime: 'yyyyMMddHHmmss' } }`, an error is `{ error: '1', messages: [{ type: '4', text }], metadata }`.

| `cmd`                                        | Behavior                                                                                                                                                                                                                                                                                                                |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EARSIV_PORTAL_UUID_GETIR`                   | A fresh time-based UUID.                                                                                                                                                                                                                                                                                                |
| `EARSIV_PORTAL_FATURA_OLUSTUR`               | Assigns the ETTN and the next `GIB{year}{nine digits}` number, answers "Faturanız başarıyla oluşturulmuştur...". A sent `faturaUuid` gets HTTP 200 with "Ettn ya eksik ya boş..." in `data` and no error flag.                                                                                                          |
| `EARSIV_PORTAL_TASLAKLARI_GETIR`             | Rows (`belgeNumarasi`, `belgeTarihi` dd-MM-yyyy, `aliciUnvanAdSoyad`, `aliciVknTckn`, `belgeTuru`, `onayDurumu`, `ettn`), oldest first; a cancellation request adds `iptalItiraz` and `iptalItirazDurumu` ([Statuses](#statuses)). Over the limit: `data: [{ error: 'Seçilen tarih aralığı 7 günden fazla olamaz!' }]`. |
| `EARSIV_PORTAL_FATURA_GETIR`                 | The draft as created, with `faturaUuid` and `belgeNumarasi` filled in.                                                                                                                                                                                                                                                  |
| `EARSIV_PORTAL_FATURA_GOSTER`                | The invoice page as the portal sends it ([Invoice page](#invoice-page)). A deleted draft gets the error envelope "Silinmiş belgeler görüntülenemez.".                                                                                                                                                                   |
| `EARSIV_PORTAL_TELEFONNO_SORGULA`            | `{ telefon }`, or `{}` without a registered phone.                                                                                                                                                                                                                                                                      |
| `EARSIV_PORTAL_SMSSIFRE_GONDER`              | `{ oid }` for the registered phone (another number is refused). The code is logged.                                                                                                                                                                                                                                     |
| `0lhozfib5410mp`                             | Checks `SIFRE` for `OID`: `{ sonuc: '0', msg }` when wrong; `{ sonuc: '1' }` and, with `OPR: 1`, the drafts in `DATA` become Onaylandı. A code works once and expires after `smsTtlSeconds`.                                                                                                                            |
| `EARSIV_PORTAL_FATURA_SIL`                   | Drafts in `silinecekler` become Silinmiş; needs `aciklama`; signed documents are refused.                                                                                                                                                                                                                               |
| `EARSIV_PORTAL_FATURA_HSM_CIHAZI_ILE_IMZALA` | Refused unless the user has `hsm: true`.                                                                                                                                                                                                                                                                                |
| `EARSIV_PORTAL_KULLANICI_BILGILERI_GETIR`    | The user's profile (`vknTckn`, `unvan`, `ad`, `soyad`, `vergiDairesi`, `cadde`, ...).                                                                                                                                                                                                                                   |
| `EARSIV_PORTAL_KULLANICI_BILGILERI_KAYDET`   | Saves the editable profile fields.                                                                                                                                                                                                                                                                                      |
| `SICIL_VEYA_MERNISTEN_BILGILERI_GETIR`       | Name and tax office of a known VKN/TCKN, empty strings otherwise.                                                                                                                                                                                                                                                       |
| anything else                                | Error envelope `Service Not Found`.                                                                                                                                                                                                                                                                                     |

Sessions follow the portal's rules: one open session per user ("Sisteme aynı anda birden fazla giriş yapamazsınız..."), an idle timeout (`sessionTtlSeconds`, default 30 minutes) after which the token fails and the lock is released, and a force logout: the refused login sets a cookie, and a logout carrying it ends the open session (the SDK's `forceLogout`). The force logout is a model, not verified against the live portal: nobody has confirmed that the real portal ends the open session for that cookie.

GET `/earsiv-services/download?token=&ettn=&belgeTip=FATURA&onayDurumu=&cmd=EARSIV_PORTAL_BELGE_INDIR` (`src/download.ts`), the portal's İndir button: a zip with the invoice page (`EARSIV_PORTAL_FATURA_GOSTER`'s) as `{ettn}.html`; the live portal adds the UBL XML, the emulator does not. A missing or expired token answers the plain text "Oturum geçersiz, token yok" (mlevent/fatura), an unknown ETTN the error envelope.

GET `/kurlar/{yyyyMM}/{ddMMyyyy}.xml` and `/kurlar/today.xml`: TCMB's XML schema (`Tarih_Date` › `Currency[CurrencyCode]` › `Unit`, `ForexBuying`, ...) with the 2026 feed's currencies (USD to KZT, then XDR), deterministic rates per day. TCMB publishes at 15:30 Turkish time: before that, `today.xml` is the previous bulletin and today's file answers 404. Weekends, public holidays (fixed ones, Ramazan and Kurban Bayramı for 2025 to 2027, plus `tcmbHolidays`), half days without a bulletin (28 October and the weekday arife days) and days after the latest bulletin answer 404 with an HTML page.

The texts in `src/messages.ts` are split into verified ones (seen on the live portal by the SDK, PR #1, f/fatura and mlevent/fatura) and best-effort wording.

### Invoice page

`EARSIV_PORTAL_FATURA_GOSTER` answers what the app previews, prints and saves as the e-Arşiv version. `src/invoice-html.ts` follows a page captured from GİB's test portal (2026-10-01) and GİB's e-Arşiv XSLT (the copy in bilaleren/e-fatura's fixtures): the same elements, attribute order and stylesheet, Latin-1 letters as entities (`&Ouml;denecek Tutar`; ş, ı, ğ and İ stay as they are), the body tag the portal rewrites (`<body id=mainbody ...>`, an unclosed `<div style='z-index:1'>`).

- Seller block from the profile between two rules: name, address with ` Kapı No:`, `ilçe/ il / Türkiye`, `Tel: … Fax:`, `Web Sitesi:`, `E-Posta:`, `Vergi Dairesi:`, `VKN:` or `TCKN:`. Seal and the bold e-Arşiv Fatura title in the middle, the QR code on the right.
- Buyer block: `SAYIN`, the name, the address with the XSLT's empty ` No:` and `Kapı No:` parts and `/ ` separators (` /  Amerika Birleşik Dev` for a foreign buyer), `Web Sitesi:`, `E-Posta:`, `Tel: Fax:`, `Vergi Dairesi:` only when sent, `VKN:` or `TCKN:`. Then `ETTN:`.
- Despatch table: Özelleştirme No TR1.2, Senaryo EARSIVFATURA, Fatura Tipi, Fatura No, Fatura Tarihi `dd-MM-yyyy HH:mm`, İrsaliye No and Tarihi when sent, Sipariş No when sent.
- Line table: Sıra No, Mal Hizmet, Miktar, Birim Fiyat, İskonto/ Arttırım Oranı, Tutarı and Nedeni, KDV Oranı, KDV Tutarı, Diğer Vergiler, Mal Hizmet Tutarı, and GTİP on İSTİSNA invoices; always 20 rows, empty ones fill it up. Values as the XSLT formats them: `1 Adet`, `1.000 USD`, ` %0,00`, `0,00 USD`, `İskonto - `, `1.000,00 USD`.
- Totals: Mal Hizmet Toplam Tutarı, Toplam İskonto, Hesaplanan KDV(%rate) per rate, Vergiler Dahil Toplam Tutar, Ödenecek Tutar. A foreign currency adds Döviz Kuru and the lira amounts (`Hesaplanan KDV(%0) (TL)`, `Mal Hizmet Toplam Tutarı(TL)`, `Vergiler Dahil Toplam Tutar(TL)`, `Ödenecek Tutar(TL)`) at `dovzTLkur`.
- Not box with the draft's `not` (the app writes the İstisna reason there).
- QR code: empty `#qrcode`, the XSLT's JSON in the hidden `#qrvalue` (amounts as UBL writes them, `120.6`; a space after the buyer's ID, as GİB leaves it), the inline `makeCode()` script.
- A cancelled invoice (cancellation accepted) carries the portal's watermark, `İPTAL EDİLMİŞ` in the markup the test portal uses for `İMZASIZ TEST BELGESİ` (lightcoral, 100px, rotated 310°). Drafts and signed invoices carry none.
- Fonts as GİB's stylesheet sets them: `#mainbody` is `'Tahoma', "Times New Roman", Times, serif` at 11px in `#666666`, h1, h2 and h4 are `Arial, Helvetica, sans-serif`. Tahoma ships with macOS (`/System/Library/Fonts/Supplemental/Tahoma.ttf`), so the app's preview and e-Arşiv PDF show it without loading anything.

Deliberate differences: a qrcode.js stub instead of the inlined library (Angaria strips scripts and draws the code itself), and an SVG drawing of GİB's seal instead of the JPEG the real portal inlines (the real portal supplies the real logo). No remote resources: the app's preview CSP blocks them.

### Statuses

`onayDurumu` in list rows, as GİB sends it:

| `onayDurumu`  | Meaning                                                                                               |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| `Onaylanmadı` | Unsigned draft: can be signed or deleted.                                                             |
| `Onaylandı`   | Signed, a legal invoice. A cancelled invoice stays `Onaylandı`.                                       |
| `Silinmiş`    | Deleted draft (`EARSIV_PORTAL_FATURA_SIL`). Never an invoice: the emulator refuses to show it as one. |

Seen live: `Onaylanmadı` and `Silinmiş` in 291 test portal rows (2026-10-01), `Onaylandı` by f/fatura, mlevent/fatura and bilaleren/e-fatura. No client knows an `İptal Edildi` value: a cancellation leaves `onayDurumu` alone (GİB's own screenshots keep the Onaylı tick on a cancelled row).

A signed invoice is cancelled through a cancellation request (iptal talebi; the buyer accepts or rejects it). The portal's Düzenlenen Belgeler shows the request in an İptal/İtiraz Durumu column next to the Onaylı tick: `İptal Aşamasında`, `İptal Kabul Edildi`, `İptal Reddedildi`, a dash for none (screenshots in GİB's e-Arşiv İptal, İhtar/İtiraz Bildirim Kılavuzu, January 2025). The emulator adds it to the row in the codes of the incoming request list (`EARSIV_PORTAL_GELEN_IPTAL_ITIRAZ_TALEPLERINI_GETIR`, seen live by yankikucuk/efatura):

| `iptalItiraz` | `iptalItirazDurumu` | Column text          | For the app                          |
| ------------- | ------------------- | -------------------- | ------------------------------------ |
| absent        | absent              | -                    | no request                           |
| `0`           | `0`                 | `İptal Aşamasında`   | still valid, cancellation pending    |
| `0`           | `1`                 | `İptal Kabul Edildi` | cancelled: İPTAL EDİLMİŞ on the page |
| `0`           | `2`                 | `İptal Reddedildi`   | valid                                |
| `1`           | `0`, `1`, `2`       | `İtiraz …`           | an objection (not emulated)          |

`iptalItirazDurumu` `3` is a withdrawn request. Unverified: the field names on `EARSIV_PORTAL_TASLAKLARI_GETIR` rows. No open-source client reads this column, and the live rows seen had no request, so only the seven fields. Check a live cancelled row before the app relies on these names.

## Knobs

Start config comes from `GIB_EMULATOR_*` variables, a JSON file (`--config file.json` or `GIB_EMULATOR_CONFIG`, a partial `EmulatorConfig`), or `startEmulator({ config })`. The variables win over the file.

| Variable                        | Config                                                                          | Default  |
| ------------------------------- | ------------------------------------------------------------------------------- | -------- |
| `GIB_EMULATOR_PORT`, `--port`   |                                                                                 | `5180`   |
| `GIB_EMULATOR_HOST`, `--host`   |                                                                                 | loopback |
| `GIB_EMULATOR_STATE`, `--state` | `stateFile`                                                                     | memory   |
| `GIB_EMULATOR_SMS_CODE`         | `smsCode` (`random` too)                                                        | `123456` |
| `GIB_EMULATOR_MAX_RANGE_DAYS`   | `maxRangeDays`                                                                  | `7`      |
| `GIB_EMULATOR_SESSION_TTL`      | `sessionTtlSeconds`                                                             | `1800`   |
| `GIB_EMULATOR_LOCKED`           | `lockedUsers` (comma list)                                                      | none     |
| `GIB_EMULATOR_LATENCY_MS`       | `chaos.latencyMs`                                                               | `0`      |
| `GIB_EMULATOR_JITTER_MS`        | `chaos.jitterMs`                                                                | `0`      |
| `GIB_EMULATOR_ERROR_RATE`       | `chaos.errorRate` (0-1, random 5xx HTML)                                        | `0`      |
| `GIB_EMULATOR_TEXT_ERROR_RATE`  | `chaos.textErrorRate` (0-1, draft creation answers HTTP 200 with an error text) | `0`      |
| `GIB_EMULATOR_MAINTENANCE=1`    | `chaos.maintenance` (portal answers its maintenance HTML page)                  | off      |

`maxRangeDays` is the longest allowed list range in days, both ends counted: with 7, 01/09 to 07/09 is accepted and 01/09 to 08/09 refused. Users and seed documents are `users` and `seedInvoices` in the config file.

With `stateFile`, documents, numbering and edited profiles are written after every change and read on start; sessions and SMS codes are not kept.

## Control API

No auth, so the emulator guards it in other ways. Every request must name a loopback host (`127.0.0.1`, `localhost`, `[::1]`, with any port) or a `*.angaria.localhost` alias in `Host`, else 403: this stops DNS rebinding, and it means the emulator only works on loopback. `/__emulator` sends no CORS headers and answers 403 to a request whose `Origin` is not one of those names, so a web page elsewhere cannot drive it. Keep the default loopback host.

| Request                            | Body                                                                                                                                                                   |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `GET /__emulator/state`            | Config, users, sessions, documents, SMS codes and queued faults.                                                                                                       |
| `POST /__emulator/reset`           | Back to the start config and the seed state.                                                                                                                           |
| `POST /__emulator/seed`            | `{ users?: [...], invoices?: [{ userid, date?, daysAgo?, status?, cancellation?, recipient?, taxID?, country?, amount?, currency?, rate?, vatRate?, item?, note? }] }` |
| `PATCH /__emulator/config`         | `chaos`, `lockedUsers`, `maxRangeDays`, `sessionTtlSeconds`, `smsCode`, `smsTtlSeconds`, `tcmbHolidays`; anything else is 400.                                         |
| `POST /__emulator/sms-code`        | `{ "code": "654321" }` or `{ "code": "random" }`.                                                                                                                      |
| `POST /__emulator/faults`          | One fault or a list: `{ kind, cmd?, count?, status?, text? }`. `cmd` is a dispatch `cmd`, a login `assoscmd` or `tcmb`.                                                |
| `GET`, `DELETE /__emulator/faults` | List or clear queued faults.                                                                                                                                           |
| `POST /__emulator/lock`            | `{ "userid": "33333301" }`: a session opened elsewhere holds the lock.                                                                                                 |
| `POST /__emulator/expire`          | `{ "userid"?: ... }`: end sessions as if they timed out.                                                                                                               |

Seed invoices: `cancellation` (`pending`, `accepted`, `rejected`) puts a cancellation request on a signed invoice ([Statuses](#statuses)); `country`, `rate` (`dovzTLkur`) and `note` fill the draft.

Fault kinds: `5xx` (HTML error page, `status` default 503), `error` (GİB's error envelope with `text`), `maintenance` (the maintenance HTML page, HTTP 200), `text` (HTTP 200 with `text` in `data` and no error flag, the failure PR #1 taught the SDK to catch).

```sh
curl -X POST http://127.0.0.1:5180/__emulator/faults \
  -d '{"kind":"text","cmd":"EARSIV_PORTAL_FATURA_OLUSTUR"}'
curl -X PATCH http://127.0.0.1:5180/__emulator/config -d '{"chaos":{"maintenance":true}}'
```

## Not emulated

The UBL XML in the download's zip, `/earsiv-services/esign`, cancellation and objection requests (`EARSIV_PORTAL_IPTAL_TALEBI_OLUSTUR`, `EARSIV_PORTAL_ITIRAZ_TALEBI_OLUSTUR`), documents issued to the user (`EARSIV_PORTAL_ADIMA_KESILEN_BELGELERI_GETIR`), producer and self-employed receipts. The SDK uses none of them. A cancelled invoice comes from a seed with `cancellation`.
