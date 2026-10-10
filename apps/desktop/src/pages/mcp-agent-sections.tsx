import { Badge, Button, Switch } from '@angaria/ui';
import { useState } from 'react';
import { SettingsRow, SettingsSection, SettingsValue } from '@/components/settings-section.tsx';
import {
  clearMcpActivity,
  isGatedTool,
  MCP_TOOL_COPY,
  mcpToolTitle,
  setMcpSettings,
  useMcpActivity,
  useMcpSettings,
  type McpToolName,
} from '@/lib/mcp.ts';

const ACTIONS_LABEL = 'Ajanlar onaylayabilir ve silebilir';

/** Rows the activity log shows at first and adds per Daha fazla göster. */
const ACTIVITY_PAGE = 20;

const timeFormat = new Intl.DateTimeFormat('tr-TR', {
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  month: '2-digit',
  second: '2-digit',
});

/**
 * The switch for what agents may do beyond reading and drafting: sign with the
 * SMS code the user gives them, delete, change the company details
 * (docs/adr/0010-mcp-agent-actions.md). Off by default.
 */
export function McpActionsSection() {
  const { allowActions } = useMcpSettings();
  return (
    <SettingsSection
      description="Kapalıyken ajanlar faturalarını okur, taslak hazırlar, müşteri ve hizmet ekler. Açınca telefonuna gelen SMS şifresini ajana yazarak fatura onaylatabilirsin; ajan taslak, müşteri ve hizmet de silebilir, firma bilgilerini değiştirebilir."
      title="İzinler"
    >
      <SettingsRow
        hint="Her onay için SMS şifresini sen verirsin. Ajan bir şey onayladığında ya da sildiğinde Angaria haber verir."
        label={ACTIONS_LABEL}
      >
        <Switch
          aria-label={ACTIONS_LABEL}
          checked={allowActions}
          onCheckedChange={(checked) => setMcpSettings({ allowActions: checked })}
        />
      </SettingsRow>
    </SettingsSection>
  );
}

/** Every tool the server lists, the ones that need İzinler marked. */
export function McpToolsSection() {
  const { allowActions } = useMcpSettings();
  return (
    <SettingsSection
      description={`İşaretli araçlar yalnızca “${ACTIONS_LABEL}” açıkken çalışır. Araçlar seçili şirketle çalışır; ajan başka bir şirketi adıyla seçebilir, Angaria’daki seçim değişmez.`}
      title="Araçlar"
    >
      {(Object.keys(MCP_TOOL_COPY) as Array<McpToolName>).map((name) => (
        <SettingsRow hint={MCP_TOOL_COPY[name].description} key={name} label={mcpToolTitle(name)}>
          {isGatedTool(name) && (
            <Badge variant={allowActions ? 'secondary' : 'outline'}>
              {allowActions ? 'İzin verildi' : 'İzin gerekir'}
            </Badge>
          )}
          <SettingsValue tone="muted">{name}</SettingsValue>
        </SettingsRow>
      ))}
    </SettingsSection>
  );
}

/** The agents' recent calls, kept on this Mac, newest first. */
export function McpActivitySection() {
  const activity = useMcpActivity();
  const [shown, setShown] = useState(ACTIVITY_PAGE);
  return (
    <SettingsSection
      description="Son 200 çağrı bu Mac’te tutulur. Araca verilen bilgiler, SMS şifreleri ve şifreler tutulmaz."
      title="Ajan etkinliği"
    >
      {activity.length === 0 ? (
        <SettingsRow>
          <SettingsValue tone="muted">Henüz çağrı yok</SettingsValue>
        </SettingsRow>
      ) : (
        <>
          {activity.slice(0, shown).map((entry) => (
            <SettingsRow
              align="top"
              hint={[timeFormat.format(new Date(entry.at)), entry.company, entry.summary]
                .filter(Boolean)
                .join(' · ')}
              key={entry.id}
              label={mcpToolTitle(entry.tool)}
            >
              <SettingsValue tone={entry.ok ? 'muted' : 'error'}>{entry.result}</SettingsValue>
            </SettingsRow>
          ))}
          <SettingsRow>
            {activity.length > shown && (
              <Button onClick={() => setShown((count) => count + ACTIVITY_PAGE)} variant="ghost">
                Daha fazla göster
              </Button>
            )}
            <Button onClick={() => clearMcpActivity()} variant="outline">
              Temizle
            </Button>
          </SettingsRow>
        </>
      )}
    </SettingsSection>
  );
}
