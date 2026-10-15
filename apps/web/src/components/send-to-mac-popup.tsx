import { Button } from '@angaria/ui';
import { colors, motion, spacing } from '@angaria/ui/tokens.stylex';
import { create, keyframes, props } from '@stylexjs/stylex';
import { X } from 'lucide-react';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { layout } from '../lib/layout.ts';
import {
  closeSendToMac,
  SEND_LINK,
  sendToMacOpener,
  subscribeSendToMac,
  type Opener,
} from '../lib/send-to-mac.ts';
import { m } from '../paraglide/messages.js';

/** How long the copy button says the link is copied, in milliseconds. */
const COPIED_MS = 2000;
/** The room around the content. The corners are as round as a 28px pill plus this room. */
const INSET = 16;
const RADIUS = 14 + INSET;

const popupIn = keyframes({
  from: { opacity: 0, transform: 'scale(0.97)' },
});

const dimIn = keyframes({
  from: { opacity: 0 },
});

const styles = create({
  // One share of the row each, so the copy's change of words moves nothing.
  action: {
    flexBasis: 0,
    flexGrow: 1,
    minWidth: 0,
  },
  actions: {
    display: 'flex',
    gap: spacing.s2,
    marginBlockStart: spacing.s2,
  },
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    padding: INSET,
  },
  close: {
    insetBlockStart: INSET,
    insetInlineEnd: INSET,
    position: 'absolute',
  },
  dialog: {
    '::backdrop': {
      animationDuration: motion.fade,
      animationName: {
        '@media (prefers-reduced-motion: reduce)': 'none',
        default: dimIn,
      },
      backgroundColor: 'color-mix(in oklab, black 20%, transparent)',
    },
    animationDuration: motion.move,
    animationName: {
      '@media (prefers-reduced-motion: reduce)': 'none',
      default: popupIn,
    },
    animationTimingFunction: motion.ease,
    backgroundColor: colors.bg,
    borderColor: colors.border,
    borderRadius: RADIUS,
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    color: colors.fg,
    margin: 'auto',
    maxWidth: 360,
    padding: 0,
    width: 'calc(100% - 32px)',
  },
  // Clear of the close button.
  title: {
    paddingInlineEnd: 36,
  },
});

/** Hands the link to the browser's share sheet. */
async function share() {
  try {
    await navigator.share({ title: 'Angaria', url: SEND_LINK });
  } catch {
    // The visitor closed the share sheet.
  }
}

function onServer(): null {
  return null;
}

/**
 * What a download button opens off a Mac, where the app cannot run: it says
 * so, and gives the site's link to copy or share on to a Mac. One of it stands
 * on every page (routes/__root.tsx), and it is in the page only while it is
 * open. Escape, a press outside it and its close button close it, and focus
 * goes back to the button that opened it.
 */
export function SendToMacPopup() {
  const opener = useSyncExternalStore(subscribeSendToMac, sendToMacOpener, onServer);
  return opener === null ? null : <Popup opener={opener} />;
}

function Popup({ opener }: { opener: Opener }) {
  const dialog = useRef<HTMLDialogElement>(null);
  // True while the press under way began on the dimmed page.
  const pressedOutside = useRef(false);
  const [copied, setCopied] = useState(false);
  const title = useId();
  // A browser without a share sheet has the copy alone.
  const canShare = typeof navigator.share === 'function';

  useEffect(() => {
    const node = dialog.current;
    if (node !== null && !node.open) {
      node.showModal();
    }
  }, []);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  function onClose() {
    closeSendToMac();
    // A button gone with the menu it stood in leaves focus where the browser puts it.
    if (opener.isConnected) {
      opener.focus({ preventScroll: true });
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(SEND_LINK);
      setCopied(true);
    } catch {
      // No clipboard, or the browser refused it: the button keeps its words.
    }
  }

  return (
    <dialog
      aria-labelledby={title}
      // The dialog has no padding, so only a press on the dimmed page lands on the dialog itself.
      onClick={(event) => {
        // A drag that began on the popup's words and ended on the dimmed page is not a press outside.
        if (pressedOutside.current && event.target === event.currentTarget) {
          event.currentTarget.close();
        }
      }}
      onClose={onClose}
      onPointerDown={(event) => {
        pressedOutside.current = event.target === event.currentTarget;
      }}
      ref={dialog}
      {...props(styles.dialog)}
    >
      <div {...props(styles.body)}>
        <h2 id={title} {...props(layout.heading, styles.title)}>
          {m.send_to_mac_title()}
        </h2>
        <p {...props(layout.text, layout.small, layout.muted)}>{m.send_to_mac_body()}</p>
        <div {...props(styles.actions)}>
          <Button onClick={() => void copy()} style={styles.action}>
            <span aria-live="polite">{copied ? m.send_to_mac_copied() : m.send_to_mac_copy()}</span>
          </Button>
          {canShare ? (
            <Button onClick={() => void share()} style={styles.action} variant="outline">
              {m.send_to_mac_share()}
            </Button>
          ) : null}
        </div>
      </div>
      {/* After the actions, so focus starts on the copy button. */}
      <Button
        aria-label={m.send_to_mac_close()}
        onClick={() => dialog.current?.close()}
        size="icon"
        style={styles.close}
        variant="ghost"
      >
        <X aria-hidden="true" size={16} />
      </Button>
    </dialog>
  );
}
