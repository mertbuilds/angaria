import { Code, Switch } from '@angaria/ui';
import { spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useQuery } from '@tanstack/react-query';
import { isTauri } from '@tauri-apps/api/core';
import { SettingsRow, SettingsSection, SettingsValue } from '@/components/settings-section.tsx';
import { mcpStatus } from '@/lib/mcp-native.ts';
import {
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
});

const MENU_BAR_LABEL = 'Menü çubuğunda göster';

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

/**
 * Angaria › MCP: the built-in MCP server's switch and status, what agents
 * may do, one-click setup for MCP clients (mcp-install.tsx), the tools, and
 * the agents' calls.
 */
export function McpPage() {
  const { enabled, showInMenuBar } = useMcpSettings();
  const server = useMcpServerState();
  const { activeEntity } = useStore();
  const tauri = isTauri();
  const status = useQuery({
    enabled: tauri,
    queryFn: mcpStatus,
    queryKey: ['mcp-status'],
    refetchInterval: 5000,
  });

  return (
    <div {...props(styles.page)}>
      <div {...props(styles.column)}>
        <SettingsSection
          description="Claude, Cursor gibi yapay zekâ uygulamaları Angaria üzerinden faturalarını listeleyebilir, müşterilerini görebilir ve taslak oluşturabilir. Onaylamak ve silmek için İzinler’deki anahtarı açman gerekir. Pencereyi kapatınca Angaria menü çubuğunda çalışmaya devam eder; ajan çağırınca kapalı Angaria arka planda açılır."
          title="MCP sunucusu"
        >
          <SettingsRow
            hint="Angaria kapalıyken de çalışır, yalnızca bu Mac bağlanabilir"
            label="MCP"
          >
            <Switch
              aria-label="MCP sunucusu"
              checked={enabled}
              disabled={!tauri}
              onCheckedChange={(checked) => setMcpSettings({ enabled: checked })}
            />
          </SettingsRow>
          <SettingsRow
            hint="Gizlersen MCP arka planda çalışmaya devam eder. Ayarları değiştirmek için Angaria’yı Finder’dan ya da Spotlight’tan aç."
            label={MENU_BAR_LABEL}
          >
            <Switch
              aria-label={MENU_BAR_LABEL}
              checked={showInMenuBar}
              disabled={!tauri}
              onCheckedChange={(checked) => setMcpSettings({ showInMenuBar: checked })}
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
      </div>
    </div>
  );
}
