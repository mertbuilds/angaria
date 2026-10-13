# Resync the MCP client table with add-mcp

`apps/desktop/src-tauri/src/mcp/agents` is ported from add-mcp (Apache-2.0); its module doc names the version it matches. Why and what differs on purpose: `docs/adr/0011-mcp-clients-from-add-mcp.md`.

1. Get the old and the new version side by side:

   ```sh
   git clone https://github.com/neon-solutions/add-mcp /tmp/add-mcp
   cd /tmp/add-mcp
   git diff v2.4.1 vNEW --stat -- src README.md
   ```

2. Read the diff of these files and port what changed:

   | add-mcp                                                                                                      | Angaria (`src-tauri/src/mcp/agents/`)                   |
   | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------- |
   | `src/agents.ts`: `agents`, path helpers, `transform*Config` (stdio branch only), `detectGlobalInstall`       | `table.rs` (`AGENTS`, entry functions, `Env` variables) |
   | `src/types.ts`: `AgentType`, `ConfigFormat`                                                                  | `table.rs` (`Format`)                                   |
   | `src/formats/json.ts`, `utils.ts`                                                                            | `json.rs`                                               |
   | `src/formats/toml.ts`                                                                                        | `toml.rs`                                               |
   | `src/formats/yaml.ts`                                                                                        | `yaml.rs`                                               |
   | `src/opencode-config.ts`                                                                                     | `mod.rs` (`opencode_servers`, `is_opencode_server`)     |
   | `src/installer.ts` (`installServerForAgent`, `getConfigPath`), `src/lib.ts` (`upsertServer`, `removeServer`) | `mod.rs` (`upsert_server`, `remove_server`)             |
   | `README.md` (supported agents table)                                                                         | check config paths and names                            |

   A new client is a new `Agent` in `AGENTS` (same id as add-mcp); update the count in `the_table_has_unique_ids_and_valid_entries`. Keep the differences ADR 0011 lists unless the new version fixes them.

3. Run `cargo test` in `apps/desktop/src-tauri` (every client round-trips in `every_agent_round_trips`).
4. Bump the version in the module doc (`agents/mod.rs`), `table.rs`, `THIRD_PARTY_NOTICES.md` (tag and commit) and ADR 0011. If the client count crosses a round number, check the web copy (`apps/web/messages/tr.json`, `mcp_note`, `mcp_meta_description`).
