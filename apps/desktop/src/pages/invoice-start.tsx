import { Button } from '@angaria/ui';
import { colors, font, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { FilePlusIcon, RepeatIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { errorMessage, UNNAMED_CUSTOMER } from '@/lib/copy.ts';
import { cachedInvoices, invoiceListQuery, useGIBAccount } from '@/lib/gib.ts';
import { presetRange, recentInvoices } from '@/lib/invoices.ts';
import { useStore } from '@/lib/store.tsx';
import type { Invoice } from '@/lib/types.ts';
import { formatDateHuman } from '@/lib/utils.ts';
import { InvoiceTotal } from './invoices.tsx';

const RECENT = 5;

const styles = create({
  amount: {
    color: colors.fg,
    fontSize: font.sizeSm,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
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
  list: {
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
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
    borderTopColor: colors.border,
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
    gridTemplateColumns: 'minmax(0, 1fr) auto auto',
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
    pending: lists.some((list) => list.isPending),
    refetch: () => lists.forEach((list) => void list.refetch()),
    rows: recentInvoices([...fetched, ...cachedInvoices(queryClient, account)], RECENT),
  };
}

function RecentRow({ invoice, onRepeat }: { invoice: Invoice; onRepeat: () => void }) {
  const name = invoice.aliciUnvanAdSoyad || UNNAMED_CUSTOMER;
  const details = [invoice.belgeNumarasi, formatDateHuman(invoice.belgeTarihi ?? '')]
    .filter(Boolean)
    .join(' · ');
  return (
    <li {...props(styles.item)}>
      <button
        aria-label={`Tekrar kes: ${name}, ${details}`}
        onClick={onRepeat}
        type="button"
        {...props(styles.row)}
      >
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
 * (Tekrar kes loads one through ?kaynak=), or a blank invoice. With no invoice
 * yet, the blank form opens right away.
 */
export function InvoiceStart() {
  const navigate = useNavigate();
  const { startBlankInvoice } = useStore();
  const recent = useRecentInvoices();
  const empty = !recent.pending && !recent.error && recent.rows.length === 0;

  useEffect(() => {
    if (empty) {
      startBlankInvoice();
    }
  }, [empty, startBlankInvoice]);

  let list;
  if (recent.rows.length > 0) {
    list = (
      <ul aria-label="Son faturalar" {...props(styles.list)}>
        {recent.rows.map((invoice) => (
          <RecentRow
            invoice={invoice}
            key={invoice.ettn}
            onRepeat={() => void navigate({ search: { kaynak: invoice.ettn }, to: '/yeni' })}
          />
        ))}
      </ul>
    );
  } else if (recent.error) {
    list = (
      <div {...props(styles.footer)}>
        <p {...props(styles.error)}>Son faturalar alınamadı: {errorMessage(recent.error)}</p>
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
