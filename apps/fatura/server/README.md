# Angaria Invoice SDK

A zero-dependency TypeScript client for Turkey's GİB e-Arşiv Portal. Creates e-arşiv invoices by talking directly to `earsivportal.efatura.gov.tr`, replicating the exact browser behavior including session cookies, server-side UUID generation, and proper logout.

Built as a replacement for the [fatura](https://github.com/f/fatura) npm package which has multiple bugs (broken `findInvoice`, wrong `faturaTipi` defaults, no cookie management).

## Usage

```ts
import * as angaria from "./angaria.ts";

// Login
const session = await angaria.login("username", "password", false);

try {
  // Create a draft invoice
  const draft = await angaria.createDraftInvoice(session, {
    date: "19/03/2026",
    time: "14:30:00",
    currency: "USD",
    currencyRate: "38.50",
    invoiceType: "ISTISNA",
    taxIDOrTRID: "1234567890",
    title: "ACME CORP",
    fullAddress: "123 Main St, New York, NY",
    country: "Amerika Birleşik Dev",
    items: [
      {
        name: "Engineering Services",
        quantity: 1,
        unitPrice: 1000,
        price: 1000,
        VATRate: 0,
        VATAmount: 0,
      },
    ],
    grandTotal: 1000,
    totalVAT: 0,
    grandTotalInclVAT: 1000,
    paymentTotal: 1000,
  });

  console.log("Invoice UUID:", draft.uuid);

  // Get HTML preview
  const html = await angaria.getInvoiceHTML(session, draft.uuid, false);

  // List today's drafts
  const drafts = await angaria.getDrafts(session, "19/03/2026", "19/03/2026");

  // Lookup recipient by VKN/TCKN
  const recipient = await angaria.lookupRecipient(session, "1234567890");
} finally {
  // Always logout to free the session
  await angaria.logout(session);
}
```

## API

### `login(username, password, testMode) → Promise<Session>`

Authenticates with the GİB portal. Returns a session object with token and cookies.

- `testMode: true` → uses `earsivportaltest.efatura.gov.tr`
- `testMode: false` → uses `earsivportal.efatura.gov.tr`

### `logout(session) → Promise<void>`

Terminates the session. Always call this when done to avoid the "multiple login" lockout.

### `createDraftInvoice(session, details) → Promise<{uuid, date, response}>`

Creates an unsigned draft invoice. Gets UUID from the server (not generated locally).

**Invoice types** (`invoiceType`): `ISTISNA` (export/exemption), `SATIS` (sale), `IADE` (return), `TEVKIFAT` (withholding), `OZELMATRAH` (special base), `IHRACKAYITLI` (export registered).

**Currencies**: `TRY`, `USD`, `EUR`, `GBP`, etc. Set `currencyRate` to the TRY exchange rate for foreign currencies.

### `getInvoiceHTML(session, uuid, signed) → Promise<string>`

Returns the invoice as an HTML string for preview or printing.

### `getDrafts(session, startDate, endDate) → Promise<array>`

Lists all draft invoices in a date range. Dates in `DD/MM/YYYY` format.

### `lookupRecipient(session, taxId) → Promise<object>`

Looks up recipient info by VKN or TCKN from the GİB registry.

### `getUUID(session) → Promise<string>`

Gets a new invoice UUID from the server.

## Why not `fatura`?

The [fatura](https://github.com/f/fatura) npm package (v0.1.4) has several issues:

- **`findInvoice` is broken** — calls `getAllInvoicesByDateRange` with wrong parameter format and double-accesses `.data`
- **`createInvoiceAndGetHTML` is broken** — passes `signed` as boolean instead of `{ signed }` to `getInvoiceHTML`
- **Wrong `faturaTipi` default** — sends `"5000/30000"` instead of actual invoice type like `"ISTISNA"`
- **Wrong `hangiTip` default** — sends `"Buyuk"` instead of `"5000/30000"`
- **No cookie management** — GİB portal uses `JSESSIONID` cookies for session tracking
- **Local UUID generation** — portal expects UUIDs from `EARSIV_PORTAL_UUID_GETIR`
- **No error handling** — API errors in response body are silently ignored
- **`enableTestMode` is irreversible** — sets a global variable with no way to switch back
