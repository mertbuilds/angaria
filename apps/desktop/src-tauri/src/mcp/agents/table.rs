//! The agent table, ported from add-mcp@2.4.1 src/agents.ts (`agents`, the
//! `transform*Config` functions for a stdio server without env, and
//! `detectGlobalInstall`). Same ids and order as there.

use std::path::{Path, PathBuf};

use serde_json::{json, Value};

/// Environment variables that move an agent's config, as add-mcp reads them.
const VARS: [&str; 8] = [
  "APPDATA",
  "CLINE_DIR",
  "CODEX_HOME",
  "COPILOT_HOME",
  "GROK_HOME",
  "KIMI_CODE_HOME",
  "PI_CODING_AGENT_DIR",
  "XDG_CONFIG_HOME",
];

/// The home folder and the variables above: everything a path depends on.
pub struct Env {
  home: PathBuf,
  vars: Vec<(&'static str, PathBuf)>,
  /// Looks for programs outside the home folder too (claude.rs).
  system: bool,
}

impl Env {
  pub fn new(home: PathBuf) -> Self {
    Self {
      home,
      vars: Vec::new(),
      system: false,
    }
  }

  /// Takes the variables from this process; an empty one counts as unset.
  pub fn with_process_vars(mut self) -> Self {
    for name in VARS {
      if let Some(value) = std::env::var_os(name).filter(|value| !value.is_empty()) {
        self.vars.push((name, PathBuf::from(value)));
      }
    }
    self
  }

  /// Also looks for programs in system folders and the login shell's PATH.
  /// Tests leave it off, so they never run a real program.
  pub fn with_system_paths(mut self) -> Self {
    self.system = true;
    self
  }

  pub(super) fn home_dir(&self) -> &Path {
    &self.home
  }

  pub(super) fn system(&self) -> bool {
    self.system
  }

  #[cfg(test)]
  pub fn with_var(mut self, name: &'static str, value: &Path) -> Self {
    self.vars.push((name, value.to_path_buf()));
    self
  }

  fn var(&self, name: &str) -> Option<PathBuf> {
    self
      .vars
      .iter()
      .find(|(key, _)| *key == name)
      .map(|(_, value)| value.clone())
  }

  fn home(&self, path: &str) -> PathBuf {
    self.home.join(path)
  }

  fn var_or_home(&self, name: &str, path: &str) -> PathBuf {
    self.var(name).unwrap_or_else(|| self.home(path))
  }
}

#[derive(Debug, Clone, Copy, PartialEq)]
pub enum Format {
  /// JSON and JSONC alike: comments are kept.
  Json,
  Toml,
  Yaml,
}

pub struct Agent {
  pub id: &'static str,
  /// Written the way its maker writes it.
  pub name: &'static str,
  pub format: Format,
  /// The keys down to the map of servers.
  pub servers: &'static [&'static str],
  /// The user-level config file.
  pub config: fn(&Env) -> PathBuf,
  /// Whether the agent looks installed for this user.
  pub detect: fn(&Env) -> bool,
  /// The stdio entry that runs `bridge` with no arguments.
  pub entry: fn(&str) -> Value,
  /// Rewrites the file as plain JSON: GitHub Copilot CLI rejects JSONC.
  pub strict: bool,
  /// Keeps the file 0600 and its folder 0700, as fx does with its profile.
  pub private: bool,
}

fn xdg_config(env: &Env) -> PathBuf {
  env
    .var("XDG_CONFIG_HOME")
    .unwrap_or_else(|| env.home(".config"))
}

fn app_support(env: &Env) -> PathBuf {
  if cfg!(target_os = "macos") {
    env.home("Library/Application Support")
  } else if cfg!(windows) {
    env.var_or_home("APPDATA", "AppData/Roaming")
  } else {
    xdg_config(env)
  }
}

fn vscode_user(env: &Env) -> PathBuf {
  app_support(env).join("Code/User")
}

fn goose_config(env: &Env) -> PathBuf {
  if cfg!(target_os = "macos") {
    env.home(".config/goose/config.yaml")
  } else if cfg!(windows) {
    app_support(env).join("Block/goose/config/config.yaml")
  } else {
    xdg_config(env).join("goose/config.yaml")
  }
}

fn cline_extension_config(env: &Env) -> PathBuf {
  vscode_user(env).join("globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json")
}

fn cline_cli_config(env: &Env) -> PathBuf {
  env
    .var_or_home("CLINE_DIR", ".cline")
    .join("data/settings/cline_mcp_settings.json")
}

/// Kilo Code uses xdg-basedir on every platform.
fn kilo_dir(env: &Env) -> PathBuf {
  xdg_config(env).join("kilo")
}

/// Zed reads ~/.config/zed on macOS and Linux (add-mcp 2.4.1 names
/// Application Support/Zed on macOS, which is Zed's data folder).
fn zed_dir(env: &Env) -> PathBuf {
  if cfg!(windows) {
    app_support(env).join("Zed")
  } else {
    xdg_config(env).join("zed")
  }
}

/// The first of `names` in `dir` that exists, else `fallback` there.
fn first_existing(dir: PathBuf, names: &[&str], fallback: &str) -> PathBuf {
  names
    .iter()
    .map(|name| dir.join(name))
    .find(|path| path.exists())
    .unwrap_or_else(|| dir.join(fallback))
}

fn parent_exists(path: PathBuf) -> bool {
  path.parent().is_some_and(Path::exists)
}

fn standard(bridge: &str) -> Value {
  json!({ "command": bridge, "args": [] })
}

fn cline(bridge: &str) -> Value {
  json!({ "command": bridge, "args": [], "disabled": false })
}

fn fx(bridge: &str) -> Value {
  json!({ "type": "local", "command": [bridge], "enabled": true })
}

fn goose(bridge: &str) -> Value {
  json!({
    "name": super::SERVER_KEY,
    "description": "",
    "cmd": bridge,
    "args": [],
    "enabled": true,
    "envs": {},
    "type": "stdio",
    "timeout": 300,
  })
}

fn copilot(bridge: &str) -> Value {
  json!({ "type": "stdio", "command": bridge, "args": [], "tools": ["*"] })
}

/// OpenCode's V1 shape, shared with Kilo Code. V2 (`mcp.servers`) drops `enabled`.
fn opencode(bridge: &str) -> Value {
  json!({ "type": "local", "command": [bridge], "environment": {}, "enabled": true })
}

fn kimi(bridge: &str) -> Value {
  json!({ "transport": "stdio", "command": bridge, "args": [] })
}

fn zed(bridge: &str) -> Value {
  json!({ "source": "custom", "command": bridge, "args": [], "env": {} })
}

const MCP_SERVERS: &[&str] = &["mcpServers"];

pub static AGENTS: [Agent; 22] = [
  Agent {
    id: "antigravity",
    name: "Antigravity",
    format: Format::Json,
    servers: MCP_SERVERS,
    config: |env| env.home(".gemini/config/mcp_config.json"),
    detect: |env| env.home(".gemini/config").exists(),
    entry: standard,
    strict: false,
    private: false,
  },
  Agent {
    id: "cline",
    name: "Cline",
    format: Format::Json,
    servers: MCP_SERVERS,
    config: cline_extension_config,
    detect: |env| parent_exists(cline_extension_config(env)),
    entry: cline,
    strict: false,
    private: false,
  },
  Agent {
    id: "cline-cli",
    name: "Cline CLI",
    format: Format::Json,
    servers: MCP_SERVERS,
    config: cline_cli_config,
    detect: |env| parent_exists(cline_cli_config(env)),
    entry: cline,
    strict: false,
    private: false,
  },
  Agent {
    id: "claude-code",
    name: "Claude Code",
    format: Format::Json,
    servers: MCP_SERVERS,
    config: |env| env.home(".claude.json"),
    detect: |env| env.home(".claude").exists(),
    entry: standard,
    strict: false,
    private: false,
  },
  Agent {
    id: "claude-desktop",
    name: "Claude Desktop",
    format: Format::Json,
    servers: MCP_SERVERS,
    config: |env| app_support(env).join("Claude/claude_desktop_config.json"),
    detect: |env| app_support(env).join("Claude").exists(),
    entry: standard,
    strict: false,
    private: false,
  },
  Agent {
    id: "codex",
    name: "Codex",
    format: Format::Toml,
    servers: &["mcp_servers"],
    config: |env| env.var_or_home("CODEX_HOME", ".codex").join("config.toml"),
    detect: |env| env.home(".codex").exists(),
    entry: standard,
    strict: false,
    private: false,
  },
  Agent {
    id: "cursor",
    name: "Cursor",
    format: Format::Json,
    servers: MCP_SERVERS,
    config: |env| env.home(".cursor/mcp.json"),
    detect: |env| env.home(".cursor").exists(),
    entry: standard,
    strict: false,
    private: false,
  },
  Agent {
    id: "fx",
    name: "fx",
    format: Format::Json,
    servers: &["mcp"],
    config: |env| env.home(".fx/mcp.json"),
    detect: |env| env.home(".fx").exists(),
    entry: fx,
    strict: false,
    private: true,
  },
  Agent {
    id: "gemini-cli",
    name: "Gemini CLI",
    format: Format::Json,
    servers: MCP_SERVERS,
    config: |env| env.home(".gemini/settings.json"),
    detect: |env| env.home(".gemini").exists(),
    entry: standard,
    strict: false,
    private: false,
  },
  Agent {
    id: "goose",
    name: "goose",
    format: Format::Yaml,
    servers: &["extensions"],
    config: goose_config,
    detect: |env| goose_config(env).exists(),
    entry: goose,
    strict: false,
    private: false,
  },
  Agent {
    id: "github-copilot-cli",
    name: "GitHub Copilot CLI",
    format: Format::Json,
    servers: MCP_SERVERS,
    config: |env| {
      env
        .var_or_home("COPILOT_HOME", ".copilot")
        .join("mcp-config.json")
    },
    detect: |env| env.var_or_home("COPILOT_HOME", ".copilot").exists(),
    entry: copilot,
    strict: true,
    private: false,
  },
  Agent {
    id: "grok-build",
    name: "Grok Build",
    format: Format::Toml,
    servers: &["mcp_servers"],
    config: |env| env.var_or_home("GROK_HOME", ".grok").join("config.toml"),
    detect: |env| env.var_or_home("GROK_HOME", ".grok").exists(),
    entry: standard,
    strict: false,
    private: false,
  },
  Agent {
    id: "kilo-code",
    name: "Kilo Code",
    format: Format::Json,
    servers: &["mcp"],
    config: |env| first_existing(kilo_dir(env), &["kilo.jsonc"], "kilo.json"),
    detect: |env| {
      kilo_dir(env).exists()
        || vscode_user(env)
          .join("globalStorage/kilocode.kilo-code")
          .exists()
    },
    entry: opencode,
    strict: false,
    private: false,
  },
  Agent {
    id: "kimi-code",
    name: "Kimi Code",
    format: Format::Json,
    servers: MCP_SERVERS,
    config: |env| {
      env
        .var_or_home("KIMI_CODE_HOME", ".kimi-code")
        .join("mcp.json")
    },
    detect: |env| env.var_or_home("KIMI_CODE_HOME", ".kimi-code").exists(),
    entry: kimi,
    strict: false,
    private: false,
  },
  Agent {
    id: "kiro-cli",
    name: "Kiro",
    format: Format::Json,
    servers: MCP_SERVERS,
    config: |env| env.home(".kiro/settings/mcp.json"),
    detect: |env| env.home(".kiro").exists(),
    entry: standard,
    strict: false,
    private: false,
  },
  Agent {
    id: "mastracode",
    name: "Mastra Code",
    format: Format::Json,
    servers: MCP_SERVERS,
    config: |env| env.home(".mastracode/mcp.json"),
    detect: |env| env.home(".mastracode").exists(),
    entry: standard,
    strict: false,
    private: false,
  },
  Agent {
    id: "mcporter",
    name: "MCPorter",
    format: Format::Json,
    servers: MCP_SERVERS,
    config: |env| {
      first_existing(
        env.home(".mcporter"),
        &["mcporter.json", "mcporter.jsonc"],
        "mcporter.json",
      )
    },
    detect: |env| env.home(".mcporter").exists(),
    entry: standard,
    strict: false,
    private: false,
  },
  Agent {
    id: "opencode",
    name: "OpenCode",
    format: Format::Json,
    // Or ["mcp", "servers"]: see super::opencode_servers.
    servers: &["mcp"],
    config: |env| {
      first_existing(
        env.home(".config/opencode"),
        &["opencode.jsonc", "opencode.json"],
        "opencode.jsonc",
      )
    },
    detect: |env| env.home(".config/opencode").exists(),
    entry: opencode,
    strict: false,
    private: false,
  },
  Agent {
    id: "pi",
    name: "Pi",
    format: Format::Json,
    servers: MCP_SERVERS,
    config: |env| {
      env
        .var_or_home("PI_CODING_AGENT_DIR", ".pi/agent")
        .join("mcp.json")
    },
    detect: |env| env.var_or_home("PI_CODING_AGENT_DIR", ".pi/agent").exists(),
    entry: standard,
    strict: false,
    private: false,
  },
  Agent {
    id: "vscode",
    name: "VS Code",
    format: Format::Json,
    servers: &["servers"],
    config: |env| vscode_user(env).join("mcp.json"),
    detect: |env| vscode_user(env).exists(),
    entry: standard,
    strict: false,
    private: false,
  },
  Agent {
    id: "windsurf",
    name: "Windsurf",
    format: Format::Json,
    servers: MCP_SERVERS,
    config: |env| env.home(".codeium/windsurf/mcp_config.json"),
    detect: |env| env.home(".codeium/windsurf").exists(),
    entry: standard,
    strict: false,
    private: false,
  },
  Agent {
    id: "zed",
    name: "Zed",
    format: Format::Json,
    servers: &["context_servers"],
    config: |env| zed_dir(env).join("settings.json"),
    detect: |env| {
      zed_dir(env).exists() || (cfg!(target_os = "macos") && app_support(env).join("Zed").exists())
    },
    entry: zed,
    strict: false,
    private: false,
  },
];
