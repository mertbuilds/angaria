import { Button, capStyles, Code, CodeBlock, toast } from '@angaria/ui';
import { colors, font, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isTauri } from '@tauri-apps/api/core';
import { useState } from 'react';
import { Disclosure } from '@/components/disclosure.tsx';
import { SettingsRow, SettingsSection, SettingsValue } from '@/components/settings-section.tsx';
import { copy } from '@/lib/clipboard.ts';
import { errorMessage } from '@/lib/gib-errors.ts';
import {
  mcpAgents,
  mcpAgentsAdd,
  mcpAgentsRemove,
  type McpAgent,
  type McpAgentResult,
  type McpStatus,
} from '@/lib/mcp-native.ts';
import { bridgeLocationProblem, claudeCodeCommand, mcpServersJSON } from '@/lib/mcp.ts';

const styles = create({
  dot: {
    borderColor: 'currentColor',
    borderRadius: radius.full,
    borderStyle: 'solid',
    borderWidth: '1.5px',
    boxSizing: 'border-box',
    flexShrink: 0,
    height: '8px',
    width: '8px',
  },
  dotFilled: {
    backgroundColor: 'currentColor',
  },
  hintError: {
    color: colors.error,
  },
  snippet: {
    flex: 1,
  },
  status: {
    alignItems: 'center',
    color: colors.muted,
    display: 'flex',
    fontSize: font.sizeSm,
    gap: spacing.s2,
    whiteSpace: 'nowrap',
    width: '6.5rem',
  },
  statusOn: {
    color: colors.fg,
  },
});

const byName = (a: McpAgent, b: McpAgent) =>
  a.name.localeCompare(b.name, 'tr', { sensitivity: 'base' });

/** "/Users/mert/.cursor/mcp.json" as "~/.cursor/mcp.json". */
const shortPath = (path: string) => path.replace(/^\/Users\/[^/]+/, '~');

function StatusMark({ on }: { on: boolean }) {
  return (
    <span {...props(styles.status, on && styles.statusOn)}>
      <span aria-hidden {...props(styles.dot, on && styles.dotFilled)} />
      <span {...props(capStyles.text)}>{on ? 'Ekli' : 'Ekli değil'}</span>
    </span>
  );
}

/** Toasts for one add or remove: one per failure, one for what worked. */
function report(
  results: ReadonlyArray<McpAgentResult>,
  agents: ReadonlyArray<McpAgent>,
  kind: 'add' | 'remove',
) {
  const nameOf = (id: string) => agents.find((agent) => agent.id === id)?.name ?? id;
  for (const result of results) {
    if (!result.success) {
      toast.error(`${nameOf(result.id)}: ${result.error ?? 'Ayar dosyası değişmedi.'}`);
    }
  }
  const changed = results.filter((result) => result.success && result.changed);
  if (changed.length === 0) {
    if (results.some((result) => result.success)) {
      toast.success(kind === 'add' ? 'Zaten ekli' : 'Zaten kaldırılmış');
    }
    return;
  }
  const names = changed.map((result) => nameOf(result.id)).join(', ');
  toast.success(kind === 'add' ? 'Angaria eklendi' : 'Angaria kaldırıldı', {
    description:
      kind === 'add'
        ? `${names} yeniden açılınca Angaria’yı görür. Eski ayarların yedeği dosyanın yanında, .angaria.bak uzantısıyla.`
        : `${names} yeniden açılınca Angaria’yı görmez.`,
  });
}

function AgentRow({
  agent,
  busy,
  canAdd,
  onAdd,
  onRemove,
}: {
  agent: McpAgent;
  busy: boolean;
  canAdd: boolean;
  onAdd: () => void;
  onRemove: () => void;
}) {
  return (
    <SettingsRow
      hint={
        agent.error ? (
          <span {...props(styles.hintError)}>{agent.error}</span>
        ) : (
          <Code>{shortPath(agent.configPath)}</Code>
        )
      }
      label={agent.name}
    >
      <StatusMark on={agent.ourServerInstalled} />
      {agent.ourServerInstalled ? (
        <Button disabled={busy} onClick={onRemove} variant="ghost">
          Kaldır
        </Button>
      ) : (
        <Button disabled={busy || !canAdd} onClick={onAdd} variant="outline">
          Ekle
        </Button>
      )}
    </SettingsRow>
  );
}

/**
 * Angaria › MCP › Kurulum: the MCP clients on this Mac, each with Ekle or
 * Kaldır, the ones not found under Diğer uygulamalar, and the entry to paste
 * by hand. The clients and their config files: src-tauri/src/mcp/agents.
 */
export function McpInstallSection({ status }: { status: McpStatus | undefined }) {
  const tauri = isTauri();
  const queryClient = useQueryClient();
  const agents = useQuery({ enabled: tauri, queryFn: mcpAgents, queryKey: ['mcp-agents'] });
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());
  const bridgePath = status?.bridgeFound ? status.bridgePath : null;
  const problem = bridgePath ? bridgeLocationProblem(bridgePath) : null;
  const ready = bridgePath !== null && problem === null;

  let note = null;
  if (!tauri) {
    note = 'Kurulum yalnızca Angaria uygulamasında çalışır.';
  } else if (status && !status.bridgeFound) {
    note = 'Angaria’nın MCP köprüsü bulunamadı. Angaria’yı yeniden kur.';
  } else if (problem === 'translocated') {
    note = 'Angaria İndirilenler’den çalışıyor. Önce Uygulamalar klasörüne taşı, sonra ekle.';
  } else if (problem === 'volume') {
    note = 'Angaria disk görüntüsünden çalışıyor. Önce Uygulamalar klasörüne taşı, sonra ekle.';
  }

  const all = agents.data ?? [];
  const found = all.filter((agent) => agent.installed).toSorted(byName);
  const others = all.filter((agent) => !agent.installed).toSorted(byName);
  const missing = found.filter((agent) => !agent.ourServerInstalled);

  async function run(ids: ReadonlyArray<string>, kind: 'add' | 'remove') {
    setBusy((current) => new Set([...current, ...ids]));
    try {
      const results = await (kind === 'add' ? mcpAgentsAdd(ids) : mcpAgentsRemove(ids));
      report(results, all, kind);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy((current) => new Set([...current].filter((id) => !ids.includes(id))));
      await queryClient.invalidateQueries({ queryKey: ['mcp-agents'] });
    }
  }

  const row = (agent: McpAgent) => (
    <AgentRow
      agent={agent}
      busy={busy.has(agent.id)}
      canAdd={ready}
      key={agent.id}
      onAdd={() => void run([agent.id], 'add')}
      onRemove={() => void run([agent.id], 'remove')}
    />
  );

  return (
    <>
      <SettingsSection
        description="Angaria’yı kullandığın yapay zekâ uygulamalarına ekle. Ayar dosyasının yedeğini alır, diğer ayarlarına dokunmaz. Angaria kapalıysa uygulama onu açar; MCP sunucusu açık olmalı."
        title="Kurulum"
      >
        {note && (
          <SettingsRow>
            <SettingsValue tone="warning">{note}</SettingsValue>
          </SettingsRow>
        )}
        {tauri && agents.isError && (
          <SettingsRow>
            <SettingsValue tone="error">{errorMessage(agents.error)}</SettingsValue>
          </SettingsRow>
        )}
        {agents.isSuccess && found.length === 0 && (
          <SettingsRow>
            <SettingsValue tone="muted">
              Bu Mac’te bilinen bir uygulama bulunamadı. Diğer uygulamalar’dan ekleyebilirsin.
            </SettingsValue>
          </SettingsRow>
        )}
        {found.length > 0 && (
          <SettingsRow
            hint={
              missing.length === 0
                ? 'Bulunan uygulamaların hepsinde ekli'
                : 'Bu Mac’te bulunan uygulamaların hepsine ekler'
            }
            label={`${found.length} uygulama bulundu`}
          >
            <Button
              disabled={!ready || missing.length === 0 || missing.some(({ id }) => busy.has(id))}
              onClick={() =>
                void run(
                  missing.map(({ id }) => id),
                  'add',
                )
              }
            >
              Tümünü ekle
            </Button>
          </SettingsRow>
        )}
        {found.map(row)}
      </SettingsSection>

      {others.length > 0 && (
        <Disclosure hint={`${others.length} uygulama`} label="Diğer uygulamalar">
          <SettingsSection
            description="Bu Mac’te bulunamadılar. Eklersen Angaria ayar dosyasını oluşturur; uygulamayı kurduğunda Angaria hazır olur."
            title="Bulunamayanlar"
          >
            {others.map(row)}
          </SettingsSection>
        </Disclosure>
      )}

      <Disclosure hint="Listede olmayan uygulamalar için" label="Elle ekle">
        <SettingsSection
          description="Uygulamanın MCP ayarına bu girdiyi ekle. Ayar dosyasına erişim anahtarı yazılmaz."
          title="Köprü girdisi"
        >
          <SettingsRow align="top">
            <CodeBlock style={styles.snippet}>
              {mcpServersJSON(bridgePath ?? '/Applications/Angaria.app/Contents/MacOS/angaria-mcp')}
            </CodeBlock>
            <Button
              disabled={!ready}
              onClick={() => bridgePath && void copy(mcpServersJSON(bridgePath), 'JSON kopyalandı')}
              variant="outline"
            >
              Kopyala
            </Button>
          </SettingsRow>
          <SettingsRow hint="Terminalde çalıştıracağın komutu kopyalar" label="Claude Code komutu">
            <Button
              disabled={!ready}
              onClick={() =>
                bridgePath &&
                void copy(claudeCodeCommand(bridgePath), 'Komut kopyalandı. Terminalde çalıştır.')
              }
              variant="outline"
            >
              Komutu kopyala
            </Button>
          </SettingsRow>
        </SettingsSection>
      </Disclosure>
    </>
  );
}
