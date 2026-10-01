# @angaria/gib-emulator

A local stand-in for the GİB e-Arşiv portal (`earsivportal.efatura.gov.tr`, `earsivportaltest.efatura.gov.tr`) and the TCMB rates feed (`www.tcmb.gov.tr/kurlar`). Development, tests and manual QA run against it, never against live GİB: the production portal issues real documents, and the shared test portal's demo accounts are locked by other people's sessions most of the time.

Plain `node:http`, no runtime dependencies. In-memory state by default, an optional JSON snapshot file for longer QA sessions.

## Run it

```sh
pnpm emulate                                   # repo root, also the `gib` pane of `pnpm dev`
```

It listens on `http://127.0.0.1:5180` and registers two portless aliases for the same server: `https://gib.angaria.localhost` and `https://tcmb.angaria.localhost`. The port is fixed (outside portless's 4000-4999 `PORT` pool) because the desktop app's dev allowlist names it.

Every SMS code, created draft, login and force logout is logged in the terminal.

| User       | Password  | Notes                                                                    |
| ---------- | --------- | ------------------------------------------------------------------------ |
| `33333301` | `1`       | Like the test portal's demo account. Phone `5550000001`.                 |
| `33333302` | `1`       | Second demo account, phone `5550000002`.                                 |
| `33333303` | `1`       | No registered phone: SMS signing fails.                                  |
| `12345678` | `angaria` | Production-like freelancer (TCKN), three documents issued in past weeks. |

The SMS code is `123456` unless configured.

### Clients

- SDK: `createClient({ baseUrl: 'http://127.0.0.1:5180' })`. `baseUrl` replaces both the production and the test portal.
- TCMB: `fetchTCMBRates(date, { baseUrl: 'http://127.0.0.1:5180' })` (angaria-utils).
- Smoke script: `EARSIV_MODE=emulator NODE_EXTRA_CA_CERTS=~/.portless/ca.pem node packages/earsiv-sdk/scripts/smoke.ts`. Node ignores the macOS trust store, so the portless CA is passed explicitly; `EARSIV_EMULATOR_URL=http://127.0.0.1:5180` skips TLS.
- Desktop app (dev only): Ayarlar › GİB hesabı › Emülatör. GİB and TCMB calls then go to `VITE_GIB_EMULATOR_URL` (`apps/desktop/.env.development`). The app uses plain http on loopback, not the portless alias: the Tauri http plugin (reqwest with rustls and bundled roots) does not trust portless's local CA. `tauri dev --config src-tauri/tauri.dev.conf.json` (the `desktop` pane of `pnpm dev`) adds that URL to the http allowlist; release builds never see it. In a plain browser (`pnpm --filter desktop dev`, `VITE_LICENSE_BYPASS=1`) the app reaches the emulator with the browser's fetch, which the emulator allows through CORS for the desktop dev origins (`http://localhost:<port>`, `http://127.0.0.1:<port>`, `tauri://localhost`, `http://tauri.localhost`) on the portal and TCMB routes.
- Tests: `startEmulator({ port: 0 })` in-process. `packages/earsiv-sdk/tests/emulator-setup.ts` starts one per test run.

## Protocol

POST `/earsiv-services/assos-login` (form): `assoscmd=login` (test portal) or `anologin` (production) with `userid`, `sifre` logs in and returns `{ token, redirectUrl }` plus a `JSESSIONID` cookie. `logout` with the token logs out on both portals. `anologin` without a `userid` is a login with missing fields: error type `5`, "Sisteme giriş için eksik bilgi verildi", and the session stays open.

POST `/earsiv-services/dispatch` (form: `cmd`, `callid`, `pageName`, `token`, `jp` = JSON). Success is `{ data, metadata: { optime: 'yyyyMMddHHmmss' } }`, an error is `{ error: '1', messages: [{ type: '4', text }], metadata }`.

| `cmd`                                        | Behavior                                                                                                                                                                                                                     |
| -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `EARSIV_PORTAL_UUID_GETIR`                   | A fresh time-based UUID.                                                                                                                                                                                                     |
| `EARSIV_PORTAL_FATURA_OLUSTUR`               | Assigns the ETTN and the next `GIB{year}{nine digits}` number, answers "Faturanız başarıyla oluşturulmuştur...". A sent `faturaUuid` gets HTTP 200 with "Ettn ya eksik ya boş..." in `data` and no error flag.               |
| `EARSIV_PORTAL_TASLAKLARI_GETIR`             | Rows (`belgeNumarasi`, `belgeTarihi` dd-MM-yyyy, `aliciUnvanAdSoyad`, `aliciVknTckn`, `belgeTuru`, `onayDurumu`, `ettn`), oldest first. Over the limit: `data: [{ error: 'Seçilen tarih aralığı 7 günden fazla olamaz!' }]`. |
| `EARSIV_PORTAL_FATURA_GETIR`                 | The draft as created, with `faturaUuid` and `belgeNumarasi` filled in.                                                                                                                                                       |
| `EARSIV_PORTAL_FATURA_GOSTER`                | e-Arşiv invoice HTML: portal table ids, empty `#qrcode`, QR JSON in the hidden `#qrvalue`, inline `makeCode()` script (with a qrcode.js stub).                                                                               |
| `EARSIV_PORTAL_TELEFONNO_SORGULA`            | `{ telefon }`, or `{}` without a registered phone.                                                                                                                                                                           |
| `EARSIV_PORTAL_SMSSIFRE_GONDER`              | `{ oid }` for the registered phone (another number is refused). The code is logged.                                                                                                                                          |
| `0lhozfib5410mp`                             | Checks `SIFRE` for `OID`: `{ sonuc: '0', msg }` when wrong; `{ sonuc: '1' }` and, with `OPR: 1`, the drafts in `DATA` become Onaylandı. A code works once and expires after `smsTtlSeconds`.                                 |
| `EARSIV_PORTAL_FATURA_SIL`                   | Drafts in `silinecekler` become Silinmiş; needs `aciklama`; signed documents are refused.                                                                                                                                    |
| `EARSIV_PORTAL_FATURA_HSM_CIHAZI_ILE_IMZALA` | Refused unless the user has `hsm: true`.                                                                                                                                                                                     |
| `EARSIV_PORTAL_KULLANICI_BILGILERI_GETIR`    | The user's profile (`vknTckn`, `unvan`, `ad`, `soyad`, `vergiDairesi`, `cadde`, ...).                                                                                                                                        |
| `EARSIV_PORTAL_KULLANICI_BILGILERI_KAYDET`   | Saves the editable profile fields.                                                                                                                                                                                           |
| `SICIL_VEYA_MERNISTEN_BILGILERI_GETIR`       | Name and tax office of a known VKN/TCKN, empty strings otherwise.                                                                                                                                                            |
| anything else                                | Error envelope `Service Not Found`.                                                                                                                                                                                          |

Sessions follow the portal's rules: one open session per user ("Sisteme aynı anda birden fazla giriş yapamazsınız..."), an idle timeout (`sessionTtlSeconds`, default 30 minutes) after which the token fails and the lock is released, and a force logout: the refused login sets a cookie, and a logout carrying it ends the open session (the SDK's `forceLogout`). The force logout is a model, not verified against the live portal: nobody has confirmed that the real portal ends the open session for that cookie.

GET `/kurlar/{yyyyMM}/{ddMMyyyy}.xml` and `/kurlar/today.xml`: TCMB's XML schema (`Tarih_Date` › `Currency[CurrencyCode]` › `Unit`, `ForexBuying`, ...) with the 2026 feed's currencies (USD to KZT, then XDR), deterministic rates per day. TCMB publishes at 15:30 Turkish time: before that, `today.xml` is the previous bulletin and today's file answers 404. Weekends, public holidays (fixed ones, Ramazan and Kurban Bayramı for 2025 to 2027, plus `tcmbHolidays`), half days without a bulletin (28 October and the weekday arife days) and days after the latest bulletin answer 404 with an HTML page.

The texts in `src/messages.ts` are split into verified ones (seen on the live portal by the SDK, PR #1, f/fatura and mlevent/fatura) and best-effort wording.

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

`maxRangeDays` is the largest allowed difference between the two dates of a list request. Users and seed documents are `users` and `seedInvoices` in the config file.

With `stateFile`, documents, numbering and edited profiles are written after every change and read on start; sessions and SMS codes are not kept.

## Control API

No auth, so the emulator guards it in other ways. Every request must name a loopback host (`127.0.0.1`, `localhost`, `[::1]`, with any port) or a `*.angaria.localhost` alias in `Host`, else 403: this stops DNS rebinding, and it means the emulator only works on loopback. `/__emulator` sends no CORS headers and answers 403 to a request whose `Origin` is not one of those names, so a web page elsewhere cannot drive it. Keep the default loopback host.

| Request                            | Body                                                                                                                            |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `GET /__emulator/state`            | Config, users, sessions, documents, SMS codes and queued faults.                                                                |
| `POST /__emulator/reset`           | Back to the start config and the seed state.                                                                                    |
| `POST /__emulator/seed`            | `{ users?: [...], invoices?: [{ userid, date?, daysAgo?, status?, recipient?, taxID?, amount?, currency?, vatRate?, item? }] }` |
| `PATCH /__emulator/config`         | `chaos`, `lockedUsers`, `maxRangeDays`, `sessionTtlSeconds`, `smsCode`, `smsTtlSeconds`, `tcmbHolidays`; anything else is 400.  |
| `POST /__emulator/sms-code`        | `{ "code": "654321" }` or `{ "code": "random" }`.                                                                               |
| `POST /__emulator/faults`          | One fault or a list: `{ kind, cmd?, count?, status?, text? }`. `cmd` is a dispatch `cmd`, a login `assoscmd` or `tcmb`.         |
| `GET`, `DELETE /__emulator/faults` | List or clear queued faults.                                                                                                    |
| `POST /__emulator/lock`            | `{ "userid": "33333301" }`: a session opened elsewhere holds the lock.                                                          |
| `POST /__emulator/expire`          | `{ "userid"?: ... }`: end sessions as if they timed out.                                                                        |

Fault kinds: `5xx` (HTML error page, `status` default 503), `error` (GİB's error envelope with `text`), `maintenance` (the maintenance HTML page, HTTP 200), `text` (HTTP 200 with `text` in `data` and no error flag, the failure PR #1 taught the SDK to catch).

```sh
curl -X POST http://127.0.0.1:5180/__emulator/faults \
  -d '{"kind":"text","cmd":"EARSIV_PORTAL_FATURA_OLUSTUR"}'
curl -X PATCH http://127.0.0.1:5180/__emulator/config -d '{"chaos":{"maintenance":true}}'
```

## Not emulated

`/earsiv-services/download` (zip download), `/earsiv-services/esign`, cancellation and objection requests (`EARSIV_PORTAL_IPTAL_TALEBI_OLUSTUR`, `EARSIV_PORTAL_ITIRAZ_TALEBI_OLUSTUR`), documents issued to the user (`EARSIV_PORTAL_ADIMA_KESILEN_BELGELERI_GETIR`), producer and self-employed receipts. The SDK uses none of them.
