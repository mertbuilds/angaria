import { Badge, Button, Input, Switch, toast } from '@angaria/ui';
import { spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useQuery } from '@tanstack/react-query';
import { isTauri } from '@tauri-apps/api/core';
import { useState } from 'react';
import { SettingsRow, SettingsSection, SettingsValue } from '@/components/settings-section.tsx';
import { copy } from '@/lib/clipboard.ts';
import { errorMessage } from '@/lib/gib-errors.ts';
import { mcpRotateToken, mcpStatus, mcpToken } from '@/lib/mcp-native.ts';
import {
  claudeCodeHTTPCommand,
  isValidPort,
  MCP_TOOL_COPY,
  mcpToolTitle,
  setMcpSettings,
  useMcpCalls,
  useMcpServerState,
  useMcpSettings,
  type McpServerState,
} from '@/lib/mcp.ts';
import { useStore } from '@/lib/store.tsx';
import { McpInstallSection } from './mcp-install.tsx';

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
 * Angaria › MCP: the built-in MCP server's switch and status, one-click setup
 * for MCP clients (mcp-install.tsx), the tools, and this session's calls.
 */
export function McpPage() {
  const { enabled } = useMcpSettings();
  const server = useMcpServerState();
  const calls = useMcpCalls();
  const { activeEntity } = useStore();
  const tauri = isTauri();
  const status = useQuery({
    enabled: tauri,
    queryFn: mcpStatus,
    queryKey: ['mcp-status'],
    refetchInterval: 5000,
  });
  const runningPort = server.kind === 'running' ? server.port : null;

  return (
    <div {...props(styles.page)}>
      <div {...props(styles.column)}>
        <SettingsSection
          description="Claude, Cursor gibi yapay zekâ uygulamaları Angaria üzerinden faturalarını listeleyebilir, müşterilerini görebilir ve taslak oluşturabilir. Taslağı yalnızca sen, Angaria’da SMS ile onaylarsın."
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
          <SettingsRow hint="Araçlar seçili şirketin GİB hesabıyla çalışır" label="Şirket">
            <SettingsValue>{activeEntity.name}</SettingsValue>
          </SettingsRow>
        </SettingsSection>

        <McpInstallSection status={status.data} />

        <SettingsSection
          description="İmzalama aracı yok: yapay zekâ yalnızca taslak oluşturur, taslağı sen onaylarsın."
          title="Araçlar"
        >
          {Object.entries(MCP_TOOL_COPY).map(([name, tool]) => (
            <SettingsRow hint={tool.description} key={name} label={tool.title}>
              <SettingsValue tone="muted">{name}</SettingsValue>
            </SettingsRow>
          ))}
        </SettingsSection>

        <SettingsSection
          description="Yalnızca bu oturumda tutulur. Fatura bilgisi saklanmaz."
          title="Son çağrılar"
        >
          {calls.length === 0 ? (
            <SettingsRow>
              <SettingsValue tone="muted">Henüz çağrı yok</SettingsValue>
            </SettingsRow>
          ) : (
            calls.map((call) => (
              <SettingsRow
                hint={timeFormat.format(call.at)}
                key={call.id}
                label={mcpToolTitle(call.tool)}
              >
                <Badge variant={call.ok ? 'secondary' : 'destructive'}>
                  {call.ok ? 'Tamam' : 'Hata'}
                </Badge>
              </SettingsRow>
            ))
          )}
        </SettingsSection>

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
