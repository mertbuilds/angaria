# @angaria/mcp-server

Internal. Not published and not marketed.

MCP server (stdio) that exposes GİB e-Arşiv invoice tools through `angaria-earsiv-sdk`:

- `list_invoices`: invoices in a date range (drafts and signed)
- `create_invoice`: create a draft; totals are computed, GİB assigns the ETTN
- `cancel_invoice`: delete an unsigned draft by ETTN
- `get_invoice_html`: HTML preview of an invoice

Every tool call logs in, runs, and logs out; calls sent at once run one after the other, because GİB refuses a second login while a session is open. A failed logout is written to stderr and added to the result as a `warning`. A GİB failure is a tool error with `{ error: { code, message } }`: the SDK's `GibError` code (`auth`, `session-locked`, `maintenance`, `network`, ...) and its Turkish message, GİB's own text when it sent one. `list_invoices` covers at most 31 days per call. Nothing is signed: drafts still need SMS approval in the app or the portal.

## Standalone or built in

Most users want the MCP server built into the desktop app instead: Angaria › MCP switches it on, and its buttons add Angaria to Claude Desktop, Claude Code and Cursor without Node, environment variables or a password in a config file. It runs its tools inside the app, on the app's GİB session, so it never collides with the app's own GİB calls. See `docs/adr/0009-built-in-mcp-server.md`.

|                  | This package (standalone)                    | Built into the app                                                                                    |
| ---------------- | -------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Runs             | `node dist/index.mjs`, started by the client | In Angaria while its MCP switch is on; the bundled `angaria-mcp` bridge for stdio                     |
| GİB login        | `GIB_USERNAME`, `GIB_PASSWORD` in the config | The active company's login from the app's keychain vault                                              |
| GİB session      | Its own; refused while the app holds one     | The app's session queue                                                                               |
| Tools            | the four above                               | `list_invoices`, `get_invoice`, `create_invoice`, `cancel_invoice`, `list_customers`, `list_services` |
| `create_invoice` | Any invoice type, USD and İstisna by default | Satış or İstisna, the app's rules and the customer's defaults                                         |
| Signing          | None                                         | None: drafts are signed by SMS in the app                                                             |

Both share their tool inputs: `src/inputs.ts`, exported as `@angaria/mcp-server/inputs` (zod schemas, the list and cancel tool definitions, the draft lookup), with no MCP SDK or Node imports so the app can bundle it.

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
  -e GIB_USERNAME='your-user-code' \
  -e GIB_PASSWORD='your-password' \
  -- node /absolute/path/to/angaria/packages/mcp-server/dist/index.mjs
```

The values are stored in plain text in `~/.claude.json`. Do not use `--scope project`: it writes `.mcp.json`, which is committed.
