import { Button, Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@angaria/ui';
import { spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { X } from 'lucide-react';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { layout } from '../lib/layout.ts';
import {
  closeSendToMac,
  SEND_LINK,
  sendToMacState,
  subscribeSendToMac,
} from '../lib/send-to-mac.ts';
import { m } from '../paraglide/messages.js';

/** How long the copy button says the link is copied, in milliseconds. */
const COPIED_MS = 2000;
/** The dialog's room around its content (the kit's body padding). */
const INSET = 16;
/** As round as the 28px pill buttons in its corners plus the room around them. */
const RADIUS = 14 + INSET;

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
  },
  // In the top corner, as far from both edges as the content is.
  close: {
    insetBlockStart: INSET,
    insetInlineEnd: INSET,
    position: 'absolute',
  },
  content: {
    borderRadius: RADIUS,
    maxWidth: 'min(360px, calc(100% - 32px))',
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

/**
 * What a download button opens off a Mac, where the app cannot run: it says
 * so, and gives the site's link to copy or share on to a Mac. One of it stands
 * on every page (routes/__root.tsx). Escape, a press outside it and its close
 * button close it, and focus goes back to the button that opened it while that
 * button is still in the page.
 */
export function SendToMacPopup() {
  const { open, opener } = useSyncExternalStore(subscribeSendToMac, sendToMacState, sendToMacState);
  const [copied, setCopied] = useState(false);
  // A browser without a share sheet has the copy alone.
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = window.setTimeout(() => setCopied(false), COPIED_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(SEND_LINK);
      setCopied(true);
    } catch {
      // No clipboard, or the browser refused it: the button keeps its words.
    }
  }

  return (
    <Dialog
      onOpenChange={(next) => {
        if (!next) {
          closeSendToMac();
        }
      }}
      open={open}
    >
      <DialogContent
        // A button gone with the menu it stood in leaves focus where the browser puts it.
        finalFocus={() => (opener?.isConnected ? opener : null)}
        showCloseButton={false}
        style={styles.content}
      >
        <DialogHeader>
          <DialogTitle style={[layout.heading, styles.title]}>{m.send_to_mac_title()}</DialogTitle>
          <p {...props(layout.text, layout.small, layout.muted)}>{m.send_to_mac_body()}</p>
        </DialogHeader>
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
        {/* After the actions, so focus starts on the copy button. */}
        <DialogClose
          render={
            <Button
              aria-label={m.send_to_mac_close()}
              size="icon"
              style={styles.close}
              variant="ghost"
            >
              <X aria-hidden="true" size={16} />
            </Button>
          }
        />
      </DialogContent>
    </Dialog>
  );
}
