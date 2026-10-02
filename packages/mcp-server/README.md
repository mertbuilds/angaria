# @angaria/mcp-server

Internal. Not published and not marketed.

MCP server (stdio) that exposes GİB e-Arşiv invoice tools through `angaria-earsiv-sdk`:

- `list_invoices`: invoices in a date range (drafts and signed)
- `create_invoice`: create a draft; totals are computed, GİB assigns the ETTN
- `cancel_invoice`: delete an unsigned draft by ETTN
- `get_invoice_html`: HTML preview of an invoice

Every tool call logs in, runs, and logs out; calls sent at once run one after the other, because GİB refuses a second login while a session is open. A failed logout is written to stderr and added to the result as a `warning`. A GİB failure is a tool error with `{ error: { code, message } }`: the SDK's `GibError` code (`auth`, `session-locked`, `maintenance`, `network`, ...) and its Turkish message, GİB's own text when it sent one. `list_invoices` covers at most 31 days per call. Nothing is signed: drafts still need SMS approval in the app or the portal.

## Build

```bash
pnpm install
pnpm --filter @angaria/mcp-server build
node packages/mcp-server/dist/index.mjs
```

## Configuration

Environment variables only:

| Variable       | What                     |
| -------------- | ------------------------ |
| `GIB_USERNAME` | e-Arşiv portal user code |
| `GIB_PASSWORD` | e-Arşiv portal password  |

## Claude Code

```bash
claude mcp add angaria --scope user \
  -e GIB_USERNAME=<user> \
  -e GIB_PASSWORD=<password> \
  -- node /absolute/path/to/angaria/packages/mcp-server/dist/index.mjs
```

The values are stored in plain text in `~/.claude.json`. Do not use `--scope project`: it writes `.mcp.json`, which is committed.
