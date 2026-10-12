# 0011. MCP client setup ported from add-mcp

Accepted, 2026-10-10. Since 2026-10-12 the page offers only the bridge: the HTTP command under Gelişmiş is gone, and a client that wants Streamable HTTP is set up by hand from the README.

## Context

Angaria › MCP added the stdio bridge to two clients only, Claude Desktop and Cursor, with hand-written code (ADR 0009). Users run many more MCP clients: Claude Code, Codex, VS Code, Gemini CLI, Windsurf, Zed and others, each with its own config file, format and entry shape. add-mcp (https://add-mcp.com, `add-mcp` on npm, Apache-2.0) already keeps that table for over 20 clients and ships an SDK (`upsertServer`, `removeServer`), but the SDK needs Node, and Angaria has none (ADR 0009: nothing to install).

## Decision

- The table is ported to Rust from add-mcp 2.4.1 (`src-tauri/src/mcp/agents`): each client's user-level config path on macOS (also Windows and Linux where add-mcp has them), file format (JSON or JSONC, TOML, YAML), the keys down to its server map, the stdio entry shape, and how add-mcp tells it is installed. Same ids and order as `src/agents.ts`. The SDK's result shape stays, with two more fields: `{ id, success, path, changed, error }` per client (`changed` is false when the file already was as asked), and one failing client never stops the others.
- Commands: `mcp_agents` (every client: installed, config path, Angaria already in it), `mcp_agents_add` and `mcp_agents_remove` (a list of ids). They replace `mcp_install`; there is one path for every client, Claude Desktop and Cursor included. The entry is always named `angaria` and runs the bundled bridge by its absolute path, resolved at runtime; no config gets a secret.
- Only user-level configs: no project files, no remote servers, no env, no auto-approval settings.
- Files are edited, not rewritten: JSON and JSONC through jsonc-parser's CST (comments, order and indentation stay), TOML through toml_edit, YAML (only goose) as lines inside the top-level `extensions:` block, kept only when the result parses to exactly the expected document. Every write goes to a temp file and is renamed over the config, after the previous content is copied to `<file>.angaria.bak` (one backup, the version before Angaria's latest change). The backup and the temp file are created with the config's own mode, so a private file is never copied world-readable. A symlinked config stays a link, the file's mode stays, and nothing is written when the entry is already exactly ours. One exception: fx keeps its config private, so Angaria writes it 0600 and its folder 0700 whatever their mode was, as fx does with its profile.
- The page lists the clients found on this Mac first (Ekle, Kaldır, Tümünü ekle), the others folded under Diğer uygulamalar (adding creates their config), and the raw entry and the Claude Code command under Elle ekle.

Where Angaria differs from add-mcp 2.4.1, on purpose:

- A file that does not parse is an error and stays untouched. add-mcp falls back to rewriting it from a lossy parse. JSON accepts comments and trailing commas only, nothing looser.
- TOML keeps its comments (add-mcp re-serializes with @iarna/toml). YAML keeps them when the line edit verifies; otherwise, as add-mcp always does, the file is written again from the parsed document.
- Zed's config is `~/.config/zed/settings.json`, where Zed reads it on macOS too; add-mcp writes `~/Library/Application Support/Zed/settings.json`, Zed's data folder. Detection accepts either folder.
- Names are written as their makers write them: goose (add-mcp: Goose), Cline for the VS Code extension (add-mcp: Cline VSCode Extension), Kiro (add-mcp: Kiro CLI; the file is shared with the Kiro IDE).
- Not ported: Copilot CLI's bare server map at a project file's root, OpenCode server renames, Claude Code's auto-approval rules in `settings.json`, and the fields Angaria never sends (headers, OAuth scopes, timeouts, bearer token variables).

## Consequences

- Over 20 clients with one click, without Node, and the code that writes users' config files is ours to test (`cargo test`: every client round-trips; formats, comments, foreign entries, missing and malformed files).
- The table goes stale as clients move their configs. Resync by diffing add-mcp's sources against the version named in the module doc (`scripts/sync-add-mcp.md`), then update the doc, this ADR's list of differences and `THIRD_PARTY_NOTICES.md`.
- Claude Code rewrites `~/.claude.json` itself while it runs, so an edit made then can be lost to its next write. When the `claude` CLI is found (`~/.claude/local`, `~/.local/bin`, `/opt/homebrew/bin`, `/usr/local/bin`, then `command -v claude` in the login shell, 3 seconds at most), Angaria runs `claude mcp add --scope user` / `claude mcp remove --scope user` instead (`agents/claude.rs`) and edits the file only when the CLI is missing or fails. Elle ekle keeps the command too.
- Apache-2.0 asks for the license and notice with the ported code: `THIRD_PARTY_NOTICES.md` at the repository root, and the module doc names the source.
