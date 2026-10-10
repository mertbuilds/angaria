import { Button, Input, Switch, toast } from '@angaria/ui';
import { spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useQuery } from '@tanstack/react-query';
import { isTauri } from '@tauri-apps/api/core';
import { useState } from 'react';
import { SettingsRow, SettingsSection, SettingsValue } from '@/components/settings-section.tsx';
import { errorMessage } from '@/lib/gib-errors.ts';
import { mcpInstall, mcpRotateToken, mcpStatus, mcpToken } from '@/lib/mcp-native.ts';
import {
  bridgeLocationProblem,
  claudeCodeCommand,
  claudeCodeHTTPCommand,
  isValidPort,
  mcpServersJSON,
  setMcpSettings,
  useMcpServerState,
  useMcpSettings,
  type McpServerState,
} from '@/lib/mcp.ts';
import { useStore } from '@/lib/store.tsx';
import { McpActionsSection, McpActivitySection, McpToolsSection } from './mcp-agent-sections.tsx';

const styles = create({
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s8,
    marginInline: 'auto',
    maxWidth: '640px',
  },
  page: {
    paddingBlock: spacing.s8,
    paddingInline: spacing.s6,
  },
  port: {
    fontVariantNumeric: 'tabular-nums',
    maxWidth: '8rem',
  },
});

const timeFormat = new Intl.DateTimeFormat('tr-TR', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

function statusText(state: McpServerState) {
  switch (state.kind) {
    case 'failed':
      return state.message;
    case 'off':
      return 'Kapalı';
    case 'running':
      return `Çalışıyor, 127.0.0.1:${state.port}`;
    case 'starting':
      return 'Başlatılıyor…';
  }
}

const statusTone = {
  failed: 'error',
  off: 'muted',
  running: 'default',
  starting: 'muted',
} as const;

async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(done);
  } catch {
    toast.error('Panoya kopyalanamadı. Tekrar dene.');
  }
}

const clientCopy = {
  'claude-desktop': {
    added: 'Claude Desktop’a eklendi',
    present: 'Claude Desktop’ta zaten ekli',
    restart: 'Claude Desktop’u kapatıp yeniden aç.',
  },
  cursor: {
    added: 'Cursor’a eklendi',
    present: 'Cursor’da zaten ekli',
    restart: 'Cursor’u kapatıp yeniden aç.',
  },
} as const;

async function install(client: keyof typeof clientCopy) {
  const text = clientCopy[client];
  try {
    const result = await mcpInstall(client);
    if (result.unchanged) {
      toast.success(text.present);
    } else {
      toast.success(text.added, {
        description: result.backup
          ? `${text.restart} Eski ayarların yedeği: ${result.backup.split('/').pop()}`
          : text.restart,
      });
    }
  } catch (error) {
    toast.error(errorMessage(error));
  }
}

function PortRow() {
  const { port } = useMcpSettings();
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? String(port);
  const invalid = draft !== null && !isValidPort(Number(draft));

  const apply = () => {
    if (draft !== null && !invalid) {
      setMcpSettings({ port: Number(draft) });
    }
    setDraft(null);
  };

  return (
    <SettingsRow
      hint={
        invalid ? '1024 ile 65535 arasında bir sayı yaz' : 'Doluysa sonraki boş port kullanılır'
      }
      htmlFor="mcp-port"
      label="Port"
    >
      <Input
        aria-invalid={invalid || undefined}
        id="mcp-port"
        inputMode="numeric"
        onBlur={apply}
        onChange={(event) => setDraft(event.target.value.replaceAll(/\D/g, ''))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            apply();
          }
        }}
        style={styles.port}
        value={value}
      />
    </SettingsRow>
  );
}

/**
 * Angaria › MCP: the built-in MCP server's switch and status, what agents
 * may do, one-click setup for MCP clients, the tools, and the agents' calls.
 */
export function McpPage() {
  const { enabled } = useMcpSettings();
  const server = useMcpServerState();
  const { activeEntity } = useStore();
  const tauri = isTauri();
  const status = useQuery({
    enabled: tauri,
    queryFn: mcpStatus,
    queryKey: ['mcp-status'],
    refetchInterval: 5000,
  });
  const bridgePath = status.data?.bridgeFound ? status.data.bridgePath : null;
  const problem = bridgePath ? bridgeLocationProblem(bridgePath) : null;
  const setupReady = bridgePath !== null && problem === null;
  const runningPort = server.kind === 'running' ? server.port : null;

  let setupNote = null;
  if (!tauri) {
    setupNote = 'Kurulum yalnızca Angaria uygulamasında çalışır.';
  } else if (status.data && !status.data.bridgeFound) {
    setupNote = 'Angaria’nın MCP köprüsü bulunamadı. Angaria’yı yeniden kur.';
  } else if (problem === 'translocated') {
    setupNote = 'Angaria İndirilenler’den çalışıyor. Önce Uygulamalar klasörüne taşı, sonra ekle.';
  } else if (problem === 'volume') {
    setupNote =
      'Angaria disk görüntüsünden çalışıyor. Önce Uygulamalar klasörüne taşı, sonra ekle.';
  }

  return (
    <div {...props(styles.page)}>
      <div {...props(styles.column)}>
        <SettingsSection
          description="Claude, Cursor gibi yapay zekâ uygulamaları Angaria üzerinden faturalarını listeleyebilir, müşterilerini görebilir ve taslak oluşturabilir. Onaylamak ve silmek için İzinler’deki anahtarı açman gerekir."
          title="MCP sunucusu"
        >
          <SettingsRow hint="Angaria açıkken çalışır, yalnızca bu Mac bağlanabilir" label="MCP">
            <Switch
              aria-label="MCP sunucusu"
              checked={enabled}
              disabled={!tauri}
              onCheckedChange={(checked) => setMcpSettings({ enabled: checked })}
            />
          </SettingsRow>
          <SettingsRow label="Durum">
            <SettingsValue tone={statusTone[server.kind]}>{statusText(server)}</SettingsValue>
          </SettingsRow>
          <SettingsRow
            hint="Ajan başka bir şirket seçmezse araçlar bu şirketle çalışır"
            label="Şirket"
          >
            <SettingsValue>{activeEntity.name}</SettingsValue>
          </SettingsRow>
        </SettingsSection>

        <McpActionsSection />

        <SettingsSection
          description="Uygulamayı bir kez ekle. Angaria kapalıysa uygulama onu açar; MCP sunucusu açık olmalı."
          title="Kurulum"
        >
          {setupNote && (
            <SettingsRow>
              <SettingsValue tone="warning">{setupNote}</SettingsValue>
            </SettingsRow>
          )}
          <SettingsRow
            hint="Ayar dosyasına ekler, önce yedeğini alır. Sonra Claude Desktop’u yeniden aç."
            label="Claude Desktop"
          >
            <Button
              disabled={!setupReady}
              onClick={() => void install('claude-desktop')}
              variant="outline"
            >
              Claude Desktop’a ekle
            </Button>
          </SettingsRow>
          <SettingsRow hint="Terminalde çalıştıracağın komutu kopyalar" label="Claude Code">
            <Button
              disabled={!setupReady}
              onClick={() =>
                bridgePath &&
                void copy(claudeCodeCommand(bridgePath), 'Komut kopyalandı. Terminalde çalıştır.')
              }
              variant="outline"
            >
              Komutu kopyala
            </Button>
          </SettingsRow>
          <SettingsRow hint="~/.cursor/mcp.json dosyasına ekler, önce yedeğini alır" label="Cursor">
            <Button disabled={!setupReady} onClick={() => void install('cursor')} variant="outline">
              Cursor’a ekle
            </Button>
          </SettingsRow>
          <SettingsRow
            hint="Uygulamanın mcpServers ayarına yapıştıracağın JSON’u kopyalar"
            label="Diğer uygulamalar"
          >
            <Button
              disabled={!setupReady}
              onClick={() => bridgePath && void copy(mcpServersJSON(bridgePath), 'JSON kopyalandı')}
              variant="outline"
            >
              JSON’u kopyala
            </Button>
          </SettingsRow>
        </SettingsSection>

        <McpToolsSection />

        <McpActivitySection />

        {status.data && status.data.clients.length > 0 && (
          <SettingsSection title="Bağlanan uygulamalar">
            {status.data.clients.map((client) => (
              <SettingsRow
                hint={`Son görülme ${timeFormat.format(new Date(client.lastSeen))}`}
                key={client.name}
                label={client.name}
              >
                <SettingsValue tone="muted">{client.version}</SettingsValue>
              </SettingsRow>
            ))}
          </SettingsSection>
        )}

        <SettingsSection
          description="Streamable HTTP destekleyen uygulamalar köprü olmadan da bağlanabilir. Bu bağlantı erişim anahtarını içerir, kimseyle paylaşma."
          title="Gelişmiş"
        >
          <PortRow />
          <SettingsRow
            hint={runningPort ? 'Adres ve anahtar komutun içinde' : 'Önce MCP sunucusunu aç'}
            label="Claude Code, HTTP ile"
          >
            <Button
              disabled={!tauri || runningPort === null}
              onClick={() =>
                runningPort !== null &&
                void mcpToken()
                  .then((token) =>
                    copy(
                      claudeCodeHTTPCommand(runningPort, token),
                      'Komut kopyalandı. Terminalde çalıştır.',
                    ),
                  )
                  .catch((error: unknown) => toast.error(errorMessage(error)))
              }
              variant="outline"
            >
              HTTP komutunu kopyala
            </Button>
          </SettingsRow>
          <SettingsRow
            hint="Yenilersen HTTP ile eklediğin uygulamaları yeniden eklemen gerekir. Köprüyle eklenenler etkilenmez."
            label="Erişim anahtarı"
          >
            <Button
              disabled={!tauri}
              onClick={() =>
                void mcpRotateToken().then(
                  () => toast.success('Erişim anahtarı yenilendi'),
                  (error: unknown) => toast.error(errorMessage(error)),
                )
              }
              variant="outline"
            >
              Anahtarı yenile
            </Button>
          </SettingsRow>
        </SettingsSection>
      </div>
    </div>
  );
}
