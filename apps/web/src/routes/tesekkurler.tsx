import { colors, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { createFileRoute } from '@tanstack/react-router';
import { AppIcon } from '../components/app-icon.tsx';
import { DownloadButton } from '../components/cta.tsx';
import { CONTACT_EMAIL } from '../components/site-footer.tsx';
import { layout } from '../lib/layout.ts';
import { Sentence } from '../lib/slot.tsx';
import { m } from '../paraglide/messages.js';

// Both plans' Polar checkout links send buyers here after payment (their
// success URL), so the page is for people who already have a key and stays
// out of search.
export const Route = createFileRoute('/tesekkurler')({
  component: Thanks,
  head: () => ({
    meta: [{ title: m.thanks_meta_title() }, { content: 'noindex', name: 'robots' }],
  }),
});

const styles = create({
  header: {
    alignItems: 'flex-start',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
  },
  lead: {
    fontSize: 17,
  },
  page: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s12,
  },
  step: {
    '::marker': {
      color: colors.muted,
      fontVariantNumeric: 'tabular-nums',
    },
    paddingInlineStart: spacing.s1,
  },
  steps: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    margin: 0,
    paddingInlineStart: '1.25em',
  },
});

function Thanks() {
  return (
    <div {...props(styles.page)}>
      <header {...props(styles.header)}>
        <AppIcon size={64} />
        <h1 {...props(layout.title)}>{m.thanks_title()}</h1>
        <p {...props(layout.text, styles.lead)}>{m.thanks_lead()}</p>
        <DownloadButton location="thanks" />
      </header>
      <section {...props(layout.section)}>
        <h2 {...props(layout.heading)}>{m.thanks_steps_title()}</h2>
        <ol {...props(styles.steps)}>
          <li {...props(styles.step)}>{m.thanks_step_download()}</li>
          <li {...props(styles.step)}>{m.thanks_step_open()}</li>
          <li {...props(styles.step)}>{m.thanks_step_key()}</li>
          <li {...props(styles.step)}>{m.thanks_step_gib()}</li>
        </ol>
        <p {...props(layout.text, layout.muted)}>{m.thanks_devices()}</p>
        <p {...props(layout.text, layout.muted)}>
          <Sentence
            message={(email) => m.thanks_help({ email })}
            slot={<a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>}
          />
        </p>
      </section>
    </div>
  );
}
