import { colors, font, radius } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { Check } from 'lucide-react';
import { brand } from '../lib/brand.stylex.ts';
import type { Loop } from '../lib/loop.ts';
import { m } from '../paraglide/messages.js';
import { AppIcon } from './app-icon.tsx';
import { enter, hidden, progress, shown, Stage, styles as scene, Window } from './scene.tsx';

/*
 * The MCP section's scene: a request in a chat, Angaria's Taslak oluştur tool at
 * work, the draft it made, and the reply that sends the user to Angaria to
 * approve it by SMS. Every part is drawn in its last frame, which is what
 * reduced motion (and the server) shows.
 */

/** Leaving the screen: slow at first, then away. */
const AWAY = 'cubic-bezier(0.4, 0, 1, 1)';
const translateY = (y: number) => `translateY(${y}px)`;

const CUSTOMER = 'Agent Caffeine';
const AMOUNT = '$4.500,00';
const TOOL_AT = 1000;
const DONE_AT = 2400;

export const mcpLoop: Loop = {
  duration: 6000,
  tracks: [
    enter('prompt', 300, { opacity: 0, transform: translateY(6) }, 350),
    enter('tool', TOOL_AT, { opacity: 0, transform: translateY(6) }, 300),
    {
      // Turns at one speed while the tool runs, then gives way to the check.
      frames: [
        [0, { opacity: 0, transform: 'rotate(0deg)' }],
        [TOOL_AT, { opacity: 0, transform: 'rotate(0deg)' }, 'linear'],
        [TOOL_AT + 150, { opacity: 1, transform: 'rotate(116deg)' }, 'linear'],
        [DONE_AT, { opacity: 1, transform: 'rotate(1080deg)' }],
        [DONE_AT + 100, { opacity: 0, transform: 'rotate(1080deg)' }],
      ],
      part: 'spinner',
    },
    enter('check', DONE_AT, { opacity: 0, transform: 'scale(0.25)' }, 300),
    enter('card', 2700, { opacity: 0, transform: translateY(8) }, 400),
    enter('badge', 3050, { opacity: 0, transform: 'scale(0.6)' }, 300),
    enter('reply', 3500, { opacity: 0, transform: translateY(4) }, 400),
    {
      frames: [
        [0, shown],
        [5400, shown, AWAY],
        [5750, hidden],
      ],
      part: 'chat',
    },
    progress(5400),
  ],
};

const styles = create({
  amount: {
    fontWeight: font.weightMedium,
  },
  // GİB's draft status, as the app's outline badge shows it.
  badge: {
    borderColor: colors.border,
    borderRadius: radius.full,
    borderStyle: 'solid',
    borderWidth: 1,
    fontSize: 10,
    lineHeight: '14px',
    paddingInline: 6,
  },
  between: {
    alignItems: 'center',
    display: 'flex',
    justifyContent: 'space-between',
  },
  card: {
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: 8,
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    justifyContent: 'center',
    paddingInline: 10,
  },
  check: {
    alignItems: 'center',
    backgroundColor: brand.fill,
    borderRadius: radius.full,
    color: '#000000',
    display: 'flex',
    height: 14,
    inset: 0,
    justifyContent: 'center',
    position: 'absolute',
    width: 14,
  },
  customer: {
    fontWeight: font.weightMedium,
  },
  fill: {
    inset: 0,
    position: 'absolute',
  },
  // The request, on the right like a sent message: its corner nearest the
  // sender stays tight.
  prompt: {
    alignItems: 'center',
    backgroundColor: colors.subtle,
    borderColor: colors.border,
    borderRadius: '13px 13px 4px 13px',
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    display: 'flex',
    height: 26,
    paddingInline: 10,
    position: 'absolute',
    right: 13,
    top: 28,
    transformOrigin: '100% 100%',
    whiteSpace: 'nowrap',
  },
  reply: {
    color: colors.muted,
  },
  spinner: {
    borderColor: colors.border,
    borderRadius: radius.full,
    borderStyle: 'solid',
    borderTopColor: colors.fg,
    borderWidth: 1.5,
    boxSizing: 'border-box',
    height: 14,
    inset: 0,
    opacity: 0,
    position: 'absolute',
    width: 14,
  },
  status: {
    flexShrink: 0,
    height: 14,
    marginInlineStart: 'auto',
    position: 'relative',
    width: 14,
  },
  tool: {
    alignItems: 'center',
    borderColor: colors.border,
    borderRadius: radius.full,
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    display: 'flex',
    gap: 6,
    paddingInline: 6,
  },
});

/** Decorative: the page's words say what it shows. */
export function McpScene() {
  return (
    <Stage loop={mcpLoop}>
      <Window height={188} width={264} x={0} y={6}>
        <div data-part="chat" {...props(styles.fill)}>
          <span data-part="prompt" {...props(styles.prompt)}>
            {m.mcp_scene_prompt()}
          </span>
          <div data-part="tool" {...props(scene.at(13, 62), scene.size(236, 26), styles.tool)}>
            <AppIcon size={14} />
            <span>{m.mcp_scene_app()}</span>
            <span {...props(scene.muted)}>{m.mcp_scene_tool()}</span>
            <span {...props(styles.status)}>
              <span data-part="spinner" {...props(styles.spinner)} />
              <span data-part="check" {...props(styles.check)}>
                <Check size={10} strokeWidth={2.5} />
              </span>
            </span>
          </div>
          <div data-part="card" {...props(scene.at(13, 96), scene.size(236, 52), styles.card)}>
            <div {...props(styles.between)}>
              <span {...props(styles.customer)}>{CUSTOMER}</span>
              <span data-part="badge" {...props(styles.badge)}>
                {m.mcp_scene_draft()}
              </span>
            </div>
            <div {...props(styles.between)}>
              <span {...props(scene.muted)}>{m.scene_sign_line_consulting()}</span>
              <span {...props(styles.amount)}>{AMOUNT}</span>
            </div>
          </div>
          <span data-part="reply" {...props(scene.at(13, 156), scene.size(236, 30), styles.reply)}>
            {m.mcp_scene_reply()}
          </span>
        </div>
      </Window>
    </Stage>
  );
}
