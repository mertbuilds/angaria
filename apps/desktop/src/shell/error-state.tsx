import { Button } from '@angaria/ui';
import { spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { Link } from '@tanstack/react-router';
import { describeError } from '@/lib/gib-errors.ts';
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
 * EmptyState for a failed call: what happened and what to do, GİB's text
 * under it when it helps, Tekrar dene, and Ayarlar’a git when Ayarlar fixes it.
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
