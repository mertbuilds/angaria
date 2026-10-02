import { Button, Kbd } from '@angaria/ui';
import { colors, font, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { FilePlusIcon, RepeatIcon } from 'lucide-react';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { UNNAMED_CUSTOMER } from '@/lib/copy.ts';
import { describeError } from '@/lib/gib-errors.ts';
import { cachedInvoices, invoiceListQuery, useGIBAccount } from '@/lib/gib.ts';
import { presetRange, recentInvoices } from '@/lib/invoices.ts';
import { useStore } from '@/lib/store.tsx';
import type { Invoice } from '@/lib/types.ts';
import { formatDateHuman } from '@/lib/utils.ts';
import { tones } from '../shell/palette.stylex.ts';
import { InvoiceTotal } from './invoices.tsx';

const RECENT = 5;

const styles = create({
  amount: {
    color: colors.fg,
    fontSize: font.sizeSm,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  detail: {
    display: 'block',
    fontSize: font.sizeXs,
  },
  error: {
    color: colors.muted,
    fontSize: font.sizeSm,
    margin: 0,
  },
  footer: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s3,
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
  },
  hint: {
    color: colors.muted,
    fontSize: font.sizeXs,
  },
  keys: {
    alignItems: 'center',
    color: colors.muted,
    display: 'flex',
    flexWrap: 'wrap',
    fontSize: font.sizeXs,
    gap: spacing.s1,
    margin: 0,
  },
  keysGap: {
    marginInlineStart: spacing.s2,
  },
  list: {
    backgroundColor: tones.card,
    borderRadius: radius.base,
    display: 'flex',
    flexDirection: 'column',
    listStyle: 'none',
    margin: 0,
    overflow: 'hidden',
    padding: 0,
  },
  page: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s6,
    marginInline: 'auto',
    maxWidth: '40rem',
    paddingBlock: spacing.s8,
    paddingInline: spacing.s6,
    width: '100%',
  },
  item: {
    borderTopColor: tones.divider,
    borderTopStyle: 'solid',
    borderTopWidth: {
      ':first-child': 0,
      default: '1px',
    },
  },
  repeat: {
    alignItems: 'center',
    color: colors.muted,
    display: 'inline-flex',
    fontSize: font.sizeXs,
    gap: spacing.s1,
    whiteSpace: 'nowrap',
  },
  repeatIcon: {
    flexShrink: 0,
    height: '0.875rem',
    width: '0.875rem',
  },
  row: {
    alignItems: 'center',
    backgroundColor: {
      ':focus-visible': colors.subtle,
      ':hover': colors.subtle,
      default: 'transparent',
    },
    borderWidth: 0,
    boxSizing: 'border-box',
    color: 'inherit',
    cursor: 'pointer',
    display: 'grid',
    fontFamily: 'inherit',
    gap: spacing.s4,
    gridTemplateColumns: 'auto minmax(0, 1fr) auto auto',
    outline: 'none',
    paddingBlock: spacing.s3,
    paddingInline: spacing.s4,
    textAlign: 'start',
    width: '100%',
  },
  skeleton: {
    backgroundColor: colors.subtle,
    borderRadius: radius.full,
    display: 'block',
    height: '0.75rem',
  },
  skeletonRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    paddingBlock: spacing.s4,
    paddingInline: spacing.s4,
  },
  skeletonWidth: (width: string) => ({
    width,
  }),
  subtitle: {
    color: colors.muted,
    fontSize: font.sizeXs,
    fontVariantNumeric: 'tabular-nums',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  text: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  title: {
    color: colors.fg,
    fontSize: font.sizeMd,
    fontWeight: font.weightMedium,
    margin: 0,
  },
  lead: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
  },
  name: {
    color: colors.fg,
    fontSize: font.sizeSm,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
});

/**
 * The newest invoices: this month's and last month's GİB lists (shared with
 * Faturalar's presets and ⌘K's reissue, so often cached already) plus every
 * list fetched this session.
 */
function useRecentInvoices() {
  const queryClient = useQueryClient();
  const account = useGIBAccount();
  const [now] = useState(() => new Date());
  const lists = useQueries({
    queries: [presetRange('bu-ay', now), presetRange('gecen-ay', now)].map((range) =>
      invoiceListQuery(account, range),
    ),
  });
  const fetched = lists.flatMap((list) => list.data ?? []);
  return {
    error: lists.find((list) => list.isError)?.error,
    // A cached empty list that is being refetched (a draft was just created)
    // does not count as no invoices yet.
    pending: lists.some((list) => list.isPending || list.isFetching),
    refetch: () => lists.forEach((list) => void list.refetch()),
    rows: recentInvoices([...fetched, ...cachedInvoices(queryClient, account)], RECENT),
  };
}

/** Keys typed into a field or a dialog are not the list's. */
function ownsKeys(target: EventTarget | null) {
  return !(target as Element | null)?.closest?.(
    'input, textarea, select, [contenteditable="true"], [role="dialog"], [role="alertdialog"]',
  );
}

function RecentRow({
  invoice,
  onRepeat,
  shortcut,
}: {
  invoice: Invoice;
  onRepeat: () => void;
  /** 1-9: the digit that repeats this invoice. */
  shortcut: number;
}) {
  const name = invoice.aliciUnvanAdSoyad || UNNAMED_CUSTOMER;
  const details = [invoice.belgeNumarasi, formatDateHuman(invoice.belgeTarihi ?? '')]
    .filter(Boolean)
    .join(' · ');
  return (
    <li {...props(styles.item)}>
      <button
        aria-keyshortcuts={String(shortcut)}
        aria-label={`Tekrar kes: ${name}, ${details}`}
        onClick={onRepeat}
        type="button"
        {...props(styles.row)}
      >
        <Kbd aria-hidden>{shortcut}</Kbd>
        <span {...props(styles.text)}>
          <span {...props(styles.name)}>{name}</span>
          <span {...props(styles.subtitle)}>{details}</span>
        </span>
        <span {...props(styles.amount)}>
          <InvoiceTotal invoice={invoice} />
        </span>
        <span {...props(styles.repeat)}>
          <RepeatIcon aria-hidden {...props(styles.repeatIcon)} />
          Tekrar kes
        </span>
      </button>
    </li>
  );
}

function SkeletonRows() {
  return (
    <ul aria-label="Son faturalar yükleniyor" role="status" {...props(styles.list)}>
      {['60%', '45%', '70%'].map((width) => (
        <li key={width} {...props(styles.item, styles.skeletonRow)}>
          <span {...props(styles.skeleton, styles.skeletonWidth(width))} />
          <span {...props(styles.skeleton, styles.skeletonWidth('35%'))} />
        </li>
      ))}
    </ul>
  );
}

/**
 * /yeni before a form is started: the newest invoices to repeat in one click
 * or key (Tekrar kes loads one through ?kaynak=), or a blank invoice. ↑/↓ move
 * between the invoices, ↵ repeats the focused one and 1-9 the one with that
 * number. With no invoice yet, the blank form opens right away.
 */
export function InvoiceStart() {
  const navigate = useNavigate();
  const { startBlankInvoice } = useStore();
  const recent = useRecentInvoices();
  const listRef = useRef<HTMLUListElement>(null);
  const empty = !recent.pending && !recent.error && recent.rows.length === 0;

  useEffect(() => {
    if (empty) {
      startBlankInvoice();
    }
  }, [empty, startBlankInvoice]);

  const repeat = (invoice: Invoice) =>
    void navigate({ search: { kaynak: invoice.ettn }, to: '/yeni' });

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.isComposing ||
      event.defaultPrevented ||
      !ownsKeys(event.target)
    ) {
      return;
    }
    const invoice = /^[1-9]$/.test(event.key) ? recent.rows[Number(event.key) - 1] : undefined;
    if (invoice) {
      event.preventDefault();
      repeat(invoice);
      return;
    }
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
      return;
    }
    const rows = [...(listRef.current?.querySelectorAll<HTMLElement>('button') ?? [])];
    if (rows.length === 0) {
      return;
    }
    event.preventDefault();
    const at = rows.indexOf(document.activeElement as HTMLElement);
    const next =
      at === -1
        ? event.key === 'ArrowDown'
          ? 0
          : rows.length - 1
        : Math.min(rows.length - 1, Math.max(0, at + (event.key === 'ArrowDown' ? 1 : -1)));
    rows[next]?.focus();
  });

  useEffect(() => {
    const listener = (event: KeyboardEvent) => onKeyDown(event);
    document.addEventListener('keydown', listener);
    return () => document.removeEventListener('keydown', listener);
  }, []);

  let list;
  if (recent.rows.length > 0) {
    list = (
      <>
        <ul aria-label="Son faturalar" ref={listRef} {...props(styles.list)}>
          {recent.rows.map((invoice, index) => (
            <RecentRow
              invoice={invoice}
              key={invoice.ettn}
              onRepeat={() => repeat(invoice)}
              shortcut={index + 1}
            />
          ))}
        </ul>
        <p aria-hidden {...props(styles.keys)}>
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          seç,
          <Kbd style={styles.keysGap}>↵</Kbd>
          ya da
          <Kbd>1</Kbd>
          {recent.rows.length > 1 && (
            <>
              -<Kbd>{recent.rows.length}</Kbd>
            </>
          )}
          tekrar kes
        </p>
      </>
    );
  } else if (recent.error) {
    const failure = describeError(recent.error);
    list = (
      <div {...props(styles.footer)}>
        <p {...props(styles.error)}>
          Son faturalar alınamadı. {failure.text}
          {failure.detail && <span {...props(styles.detail)}>{failure.detail}</span>}
        </p>
        {failure.action === 'settings' && (
          <Button render={<Link to="/ayarlar" />}>Ayarlar’a git</Button>
        )}
        <Button onClick={recent.refetch} variant="outline">
          Tekrar dene
        </Button>
      </div>
    );
  } else {
    list = <SkeletonRows />;
  }

  return (
    <div {...props(styles.page)}>
      <header {...props(styles.header)}>
        <h2 {...props(styles.title)}>Geçen faturadan başla</h2>
        <p {...props(styles.lead)}>
          Seçtiğin faturanın müşterisi, hizmetleri ve notu forma gelir. Tarih bugün olur.
        </p>
      </header>
      {list}
      <div {...props(styles.footer)}>
        <Button onClick={startBlankInvoice} variant="outline">
          <FilePlusIcon />
          Boş fatura
        </Button>
        <span {...props(styles.hint)}>Yeni bir müşteri ya da farklı bir fatura için</span>
      </div>
    </div>
  );
}
