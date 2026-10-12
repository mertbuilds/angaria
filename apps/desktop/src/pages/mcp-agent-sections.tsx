import { Badge, Button, Code, CodeBlock, Switch } from '@angaria/ui';
import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useState } from 'react';
import { Disclosure } from '@/components/disclosure.tsx';
import { SettingsRow, SettingsSection, SettingsValue } from '@/components/settings-section.tsx';
import {
  clearMcpActivity,
  isGatedTool,
  MCP_TOOL_COPY,
  mcpToolTitle,
  setMcpSettings,
  useMcpActivity,
  useMcpSettings,
  type McpActivity,
  type McpToolName,
} from '@/lib/mcp.ts';

const ACTIONS_LABEL = 'Ajanlar onaylayabilir ve silebilir';

/** Rows the activity log shows at first and adds per Daha fazla göster. */
const ACTIVITY_PAGE = 20;

/** Lines of an input shown before Tümünü göster. */
export const INPUT_PREVIEW_LINES = 12;

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
          <Code>{name}</Code>
        </SettingsRow>
      ))}
    </SettingsSection>
  );
}

const styles = create({
  entry: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  head: {
    alignItems: 'baseline',
    display: 'flex',
    gap: spacing.s2,
  },
  input: {
    alignItems: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
  },
  inputCode: {
    alignSelf: 'stretch',
  },
  inputDisclosure: {
    paddingTop: spacing.s1,
  },
  meta: {
    color: colors.muted,
    fontSize: font.sizeXs,
    lineHeight: 1.5,
  },
  failed: {
    color: colors.error,
  },
  result: {
    color: colors.fg,
    fontSize: font.sizeXs,
    lineHeight: 1.5,
    overflowWrap: 'anywhere',
  },
  time: {
    color: colors.muted,
    fontSize: font.sizeXs,
    fontVariantNumeric: 'tabular-nums',
    marginInlineStart: 'auto',
    whiteSpace: 'nowrap',
  },
  title: {
    color: colors.fg,
    fontSize: font.sizeSm,
    lineHeight: 1.4,
  },
});

/** One call: the tool, when, for which company, what was asked, what came of it. */
function ActivityEntry({ entry }: { entry: McpActivity }) {
  return (
    <div {...props(styles.entry)}>
      <div {...props(styles.head)}>
        <span {...props(styles.title)}>{mcpToolTitle(entry.tool)}</span>
        <Code>{entry.tool}</Code>
        <time dateTime={entry.at} {...props(styles.time)}>
          {timeFormat.format(new Date(entry.at))}
        </time>
      </div>
      <span {...props(styles.meta)}>
        {[entry.company, entry.summary].filter(Boolean).join(' · ')}
      </span>
      <span {...props(styles.result, !entry.ok && styles.failed)}>{entry.result}</span>
      {entry.input && (
        <div {...props(styles.inputDisclosure)}>
          <Disclosure label="Girdi">
            <ActivityInput input={entry.input} />
          </Disclosure>
        </div>
      )}
    </div>
  );
}

/** The arguments the agent sent, the first lines until Tümünü göster. */
function ActivityInput({ input }: { input: string }) {
  const [full, setFull] = useState(false);
  const lines = input.split('\n');
  const long = lines.length > INPUT_PREVIEW_LINES;
  return (
    <div {...props(styles.input)}>
      <CodeBlock style={styles.inputCode}>
        {long && !full ? `${lines.slice(0, INPUT_PREVIEW_LINES).join('\n')}\n…` : input}
      </CodeBlock>
      {long && (
        <Button onClick={() => setFull((shown) => !shown)} variant="ghost">
          {full ? 'Daha az göster' : 'Tümünü göster'}
        </Button>
      )}
    </div>
  );
}

/** The agents' recent calls, kept on this Mac, newest first. */
export function McpActivitySection() {
  const activity = useMcpActivity();
  const [shown, setShown] = useState(ACTIVITY_PAGE);
  return (
    <SettingsSection
      description="Son 200 çağrı, araca verilen girdiyle birlikte bu Mac’te tutulur. SMS şifreleri ve şifreler gizlenir."
      title="Ajan etkinliği"
    >
      {activity.length === 0 ? (
        <SettingsRow>
          <SettingsValue tone="muted">Henüz çağrı yok</SettingsValue>
        </SettingsRow>
      ) : (
        <>
          {activity.slice(0, shown).map((entry) => (
            <SettingsRow key={entry.id}>
              <ActivityEntry entry={entry} />
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
