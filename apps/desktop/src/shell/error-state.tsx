import { Button, toast } from '@angaria/ui';
import { spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { Link } from '@tanstack/react-router';
import { useState } from 'react';
import {
  CLOSE_AND_RETRY,
  closeLockedSession,
  describeError,
  SESSION_CLOSE_FAILED,
} from '@/lib/gib-errors.ts';
import { EmptyState } from './searchable-list.tsx';

const styles = create({
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
    justifyContent: 'center',
  },
});

/**
 * Closes the GİB session that refused a read, as Oturumu kapat does, then
 * runs the read again. Only for reads: a write is never sent again on its own.
 */
export function CloseSessionButton({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const [closing, setClosing] = useState(false);
  return (
    <Button
      disabled={closing}
      onClick={async () => {
        setClosing(true);
        const closed = await closeLockedSession(error);
        setClosing(false);
        if (closed) {
          onRetry();
        } else {
          toast.error(SESSION_CLOSE_FAILED);
        }
      }}
    >
      {closing ? 'Kapatılıyor…' : CLOSE_AND_RETRY}
    </Button>
  );
}

/**
 * EmptyState for a failed read: what happened and what to do, GİB's text
 * under it when it helps, Tekrar dene, Ayarlar’a git when Ayarlar fixes it,
 * and Oturumu kapat ve tekrar dene when GİB has a session open.
 */
export function ErrorState({
  error,
  onRetry,
  title,
}: {
  error: unknown;
  onRetry: () => void;
  title: string;
}) {
  const { action, detail, text } = describeError(error);
  return (
    <EmptyState
      action={
        <div {...props(styles.actions)}>
          {action === 'settings' && <Button render={<Link to="/ayarlar" />}>Ayarlar’a git</Button>}
          {action === 'close-session' && <CloseSessionButton error={error} onRetry={onRetry} />}
          <Button onClick={onRetry} variant="outline">
            Tekrar dene
          </Button>
        </div>
      }
      detail={detail}
      title={title}
    >
      {text}
    </EmptyState>
  );
}
