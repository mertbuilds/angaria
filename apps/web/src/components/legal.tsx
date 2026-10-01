import { spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { ReactNode } from 'react';
import { layout } from '../lib/layout.ts';
import { m } from '../paraglide/messages.js';

const styles = create({
  body: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s8,
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
  },
});

/** The frame both legal pages share: title, date, intro, then the sections. */
export function LegalPage({
  children,
  intro,
  title,
}: {
  children: ReactNode;
  intro: string;
  title: string;
}) {
  return (
    <article {...props(styles.body)}>
      <header {...props(styles.header)}>
        <h1 {...props(layout.title)}>{title}</h1>
        <p {...props(layout.text, layout.muted, layout.small)}>{m.legal_updated()}</p>
      </header>
      <p {...props(layout.text)}>{intro}</p>
      {children}
    </article>
  );
}

export function LegalSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section {...props(styles.section)}>
      <h2 {...props(layout.heading)}>{title}</h2>
      {children}
    </section>
  );
}

export function Paragraph({ children }: { children: string }) {
  return <p {...props(layout.text, layout.muted)}>{children}</p>;
}
