import { colors, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { Check } from 'lucide-react';
import { brand } from '../lib/brand.stylex.ts';
import { LICENSE_URL } from '../lib/config.ts';
import { layout } from '../lib/layout.ts';
import { Sentence } from '../lib/slot.tsx';
import { m } from '../paraglide/messages.js';
import { SourceButton } from './cta.tsx';

const styles = create({
  // One narrow card in the middle of the column.
  card: {
    alignItems: 'flex-start',
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: 1,
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
    marginInline: 'auto',
    maxWidth: 440,
    padding: spacing.s6,
  },
  check: {
    color: brand.ink,
    flexShrink: 0,
    height: 16,
    marginBlockStart: 4,
    width: 16,
  },
  point: {
    alignItems: 'flex-start',
    display: 'flex',
    gap: spacing.s2,
  },
});

/** What free means here, and where the code and its license are. */
export function FreeCard() {
  return (
    <div {...props(styles.card)}>
      <ul {...props(layout.list)}>
        <Point>{m.free_point_account()}</Point>
        <Point>{m.free_point_limits()}</Point>
        <Point>{m.free_point_code()}</Point>
      </ul>
      <SourceButton location="free" />
      <p {...props(layout.text, layout.muted, layout.small)}>
        <Sentence
          message={(license) => m.free_note({ license })}
          slots={[
            <a href={LICENSE_URL} key="license">
              {m.free_license()}
            </a>,
          ]}
        />
      </p>
    </div>
  );
}

function Point({ children }: { children: string }) {
  return (
    <li {...props(styles.point)}>
      <Check aria-hidden="true" {...props(styles.check)} />
      <span>{children}</span>
    </li>
  );
}
