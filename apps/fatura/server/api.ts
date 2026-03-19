import type { Plugin } from "vite";
import type { IncomingMessage } from "node:http";
import { setStorageRoot, loadData, saveData } from "./storage.ts";
import * as angaria from "./angaria-invoice-sdk.ts";

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += String(chunk);
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

export function apiPlugin(): Plugin {
  return {
    name: "fatura-api",
    configureServer(server) {
      setStorageRoot(server.config.root);

      // Store last session so logout is a single call
      let lastSession: { token: string; cookies: string[]; baseUrl: string } | null = null;

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith("/api/")) return next();

        const url = new URL(req.url, `http://${req.headers.host ?? "localhost"}`);
        res.setHeader("Content-Type", "application/json");

        try {
          if (req.method === "GET" && url.pathname === "/api/data") {
            res.end(JSON.stringify(loadData()));
            return;
          }

          if (req.method === "POST" && url.pathname === "/api/recipients") {
            const body = await readBody(req);
            const data = loadData();
            const idx = data.recipients.findIndex((r) => r.id === body.id);
            if (idx >= 0) data.recipients[idx] = body as unknown as (typeof data.recipients)[0];
            else data.recipients.push(body as unknown as (typeof data.recipients)[0]);
            saveData(data);
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          if (req.method === "DELETE" && url.pathname.startsWith("/api/recipients/")) {
            const id = url.pathname.split("/").pop()!;
            const data = loadData();
            data.recipients = data.recipients.filter((r) => r.id !== id);
            saveData(data);
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          if (req.method === "POST" && url.pathname === "/api/items") {
            const body = await readBody(req);
            const data = loadData();
            const idx = data.items.findIndex((i) => i.id === body.id);
            if (idx >= 0) data.items[idx] = body as unknown as (typeof data.items)[0];
            else data.items.push(body as unknown as (typeof data.items)[0]);
            saveData(data);
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          if (req.method === "DELETE" && url.pathname.startsWith("/api/items/")) {
            const id = url.pathname.split("/").pop()!;
            const data = loadData();
            data.items = data.items.filter((i) => i.id !== id);
            saveData(data);
            res.end(JSON.stringify({ ok: true }));
            return;
          }

          if (req.method === "POST" && url.pathname === "/api/logout") {
            if (lastSession) {
              await angaria.logout(lastSession);
              lastSession = null;
              res.end(JSON.stringify({ ok: true }));
            } else {
              // No stored session — login then immediately logout
              const body = await readBody(req);
              const session = await angaria.login(
                body.username as string,
                body.password as string,
                body.testMode as boolean,
              );
              await angaria.logout(session);
              res.end(JSON.stringify({ ok: true }));
            }
            return;
          }

          if (req.method === "POST" && url.pathname === "/api/invoice/create") {
            const body = await readBody(req);
            const invoice = body.invoice as Record<string, unknown>;

            const session = await angaria.login(
              body.username as string,
              body.password as string,
              body.testMode as boolean,
            );
            lastSession = session;

            try {
              const draft = await angaria.createDraftInvoice(session, {
                date: invoice.date as string,
                time: invoice.time as string,
                currency: invoice.currency as string | undefined,
                currencyRate: invoice.currencyRate as string | undefined,
                invoiceType: invoice.invoiceType as string | undefined,
                taxIDOrTRID: invoice.taxIDOrTRID as string,
                title: invoice.title as string,
                name: invoice.name as string | undefined,
                surname: invoice.surname as string | undefined,
                fullAddress: invoice.fullAddress as string,
                country: invoice.country as string | undefined,
                city: invoice.city as string | undefined,
                district: invoice.district as string | undefined,
                taxOffice: invoice.taxOffice as string | undefined,
                items: invoice.items as angaria.InvoiceItem[],
                grandTotal: invoice.grandTotal as number,
                totalVAT: invoice.totalVAT as number,
                grandTotalInclVAT: invoice.grandTotalInclVAT as number,
                paymentTotal: invoice.paymentTotal as number,
                note: invoice.note as string | undefined,
              });

              // Try to get HTML preview
              let html: string | null = null;
              try {
                html = await angaria.getInvoiceHTML(session, draft.uuid, "Onaylanmadı");
              } catch {
                // HTML preview is optional
              }

              res.end(
                JSON.stringify({
                  ok: true,
                  uuid: draft.uuid,
                  date: draft.date,
                  html,
                }),
              );
            } finally {
              // Auto-logout to free the session
              angaria.logout(session).catch(() => {});
              lastSession = null;
            }
            return;
          }

          if (req.method === "POST" && url.pathname === "/api/invoice/list") {
            const body = await readBody(req);
            const session = await angaria.login(
              body.username as string,
              body.password as string,
              body.testMode as boolean,
            );
            try {
              const drafts = await angaria.getDrafts(
                session,
                body.startDate as string,
                body.endDate as string,
              );
              res.end(JSON.stringify({ ok: true, drafts }));
            } finally {
              angaria.logout(session).catch(() => {});
            }
            return;
          }

          if (req.method === "POST" && url.pathname === "/api/invoice/html") {
            const body = await readBody(req);
            const session = await angaria.login(
              body.username as string,
              body.password as string,
              body.testMode as boolean,
            );
            try {
              const html = await angaria.getInvoiceHTML(
                session,
                body.uuid as string,
                (body.onayDurumu as string) ?? "Onaylanmadı",
              );
              res.end(JSON.stringify({ ok: true, html }));
            } finally {
              angaria.logout(session).catch(() => {});
            }
            return;
          }

          if (req.method === "POST" && url.pathname === "/api/invoice/cancel") {
            const body = await readBody(req);
            const session = await angaria.login(
              body.username as string,
              body.password as string,
              body.testMode as boolean,
            );
            try {
              const result = await angaria.cancelInvoice(
                session,
                body.reason as string,
                body.invoice as Record<string, unknown>,
              );
              res.end(JSON.stringify({ ok: true, result }));
            } finally {
              angaria.logout(session).catch(() => {});
            }
            return;
          }

          res.statusCode = 404;
          res.end(JSON.stringify({ error: "Not found" }));
        } catch (err: unknown) {
          res.statusCode = 500;
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : "Sunucu hatası",
            }),
          );
        }
      });
    },
  };
}
