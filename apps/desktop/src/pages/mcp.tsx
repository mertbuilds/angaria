import { Button, Code, Input, Switch, toast } from '@angaria/ui';
import { font, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useQuery } from '@tanstack/react-query';
import { isTauri } from '@tauri-apps/api/core';
import { useState } from 'react';
import {
  SettingsField,
  SettingsRow,
  SettingsSection,
  SettingsValue,
} from '@/components/settings-section.tsx';
import { copy } from '@/lib/clipboard.ts';
import { errorMessage } from '@/lib/gib-errors.ts';
import { mcpRotateToken, mcpStatus, mcpToken } from '@/lib/mcp-native.ts';
import {
  claudeCodeHTTPCommand,
  isValidPort,
  setMcpSettings,
  useMcpServerState,
  useMcpSettings,
  type McpServerState,
} from '@/lib/mcp.ts';
import { useStore } from '@/lib/store.tsx';
import { McpActionsSection, McpActivitySection, McpToolsSection } from './mcp-agent-sections.tsx';
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
  // Five digits in the mono of Code, at the row's end.
  port: {
    fontFamily: font.mono,
    fontVariantNumeric: 'tabular-nums',
    paddingInline: spacing.s3,
    textAlign: 'end',
    width: `calc(5ch + 2 * ${spacing.s3} + 2px)`,
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
      return (
        <>
          Çalışıyor, <Code>127.0.0.1:{state.port}</Code>
        </>
      );
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

/** The port as typed: digits only, at most five. */
const portDigits = (text: string) => text.replaceAll(/\D/g, '').slice(0, 5);

/**
 * Port: a technical value in the mono of `Code`, five digits wide. A typed
 * port is kept on Enter or leaving the field when it is 1024 to 65535; Esc
 * puts the saved one back. While the server runs on the next free port, the
 * hint says which.
 */
function PortRow() {
  const { port } = useMcpSettings();
  const server = useMcpServerState();
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | undefined>();
  const value = draft ?? String(port);
  const fallback = server.kind === 'running' && server.port !== port ? server.port : null;

  const apply = () => {
    if (draft === null) {
      return;
    }
    if (!isValidPort(Number(draft))) {
      setError('1024 ile 65535 arasında bir port yaz');
      return;
    }
    setMcpSettings({ port: Number(draft) });
    setDraft(null);
    setError(undefined);
  };

  const revert = () => {
    setDraft(null);
    setError(undefined);
  };

  return (
    <SettingsRow
      align="top"
      hint={
        fallback === null ? (
          'Doluysa sonraki boş port kullanılır'
        ) : (
          <>
            <Code>{port}</Code> dolu, şu an <Code>{fallback}</Code> kullanılıyor
          </>
        )
      }
      htmlFor="mcp-port"
      label="Port"
    >
      <SettingsField align="end" error={error} id="mcp-port">
        {(describedBy) => (
          <Input
            aria-describedby={describedBy}
            aria-invalid={error ? true : undefined}
            autoComplete="off"
            id="mcp-port"
            inputMode="numeric"
            maxLength={5}
            onBlur={apply}
            onChange={(event) => {
              setDraft(portDigits(event.target.value));
              // A fix clears the error as it is typed.
              if (error && isValidPort(Number(portDigits(event.target.value)))) {
                setError(undefined);
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                apply();
              } else if (event.key === 'Escape') {
                event.preventDefault();
                revert();
              }
            }}
            spellCheck={false}
            style={styles.port}
            value={value}
          />
        )}
      </SettingsField>
    </SettingsRow>
  );
}

/**
 * Angaria › MCP: the built-in MCP server's switch and status, what agents
 * may do, one-click setup for MCP clients (mcp-install.tsx), the tools, and
 * the agents' calls.
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
  const runningPort = server.kind === 'running' ? server.port : null;

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

        <McpInstallSection status={status.data} />

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
