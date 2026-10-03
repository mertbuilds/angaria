import { capStyles, Input, Kbd } from '@angaria/ui';
import { colors, font, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { GIB_INVOICE_TYPES, GIB_UNIT_TYPES } from '@/lib/gib-constants.ts';
import { listRows, type ListSelection } from './list-selection.ts';
import { tones } from './palette.stylex.ts';

const styles = create({
  empty: {
    alignItems: 'center',
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: spacing.s3,
    justifyContent: 'center',
    padding: spacing.s8,
    textAlign: 'center',
  },
  emptyText: {
    color: colors.muted,
    fontSize: font.sizeSm,
    lineHeight: 1.5,
    margin: 0,
    maxWidth: '22rem',
  },
  emptyDetail: {
    fontSize: font.sizeXs,
  },
  emptyTitle: {
    color: colors.fg,
    fontSize: font.sizeMd,
    fontWeight: font.weightMedium,
    margin: 0,
  },
  footer: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    bottom: 0,
    color: colors.muted,
    display: 'flex',
    flexWrap: 'wrap',
    fontSize: font.sizeXs,
    gap: spacing.s3,
    paddingBlock: spacing.s2,
    paddingInline: spacing.s4,
    position: 'sticky',
  },
  hint: {
    alignItems: 'center',
    display: 'inline-flex',
    gap: spacing.s1,
  },
  listbox: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: '2px',
    outline: 'none',
    paddingBottom: spacing.s2,
    paddingInline: spacing.s2,
  },
  noResults: {
    color: colors.muted,
    fontSize: font.sizeSm,
    paddingBlock: spacing.s6,
    textAlign: 'center',
  },
  root: {
    display: 'flex',
    flexDirection: 'column',
    minHeight: '100%',
  },
  row: {
    backgroundColor: {
      ':hover': `color-mix(in oklab, ${colors.subtle} 60%, transparent)`,
      default: 'transparent',
    },
    borderRadius: radius.base,
    cursor: 'default',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    paddingBlock: spacing.s2,
    paddingInline: spacing.s3,
    userSelect: 'none',
  },
  rowLine: {
    alignItems: 'baseline',
    display: 'flex',
    gap: spacing.s3,
    justifyContent: 'space-between',
    minWidth: 0,
  },
  rowLineCenter: {
    alignItems: 'center',
  },
  rowSelected: {
    backgroundColor: {
      ':hover': tones.selection,
      default: tones.selection,
    },
  },
  rowSubtitle: {
    color: colors.muted,
    fontSize: font.sizeXs,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowTitle: {
    color: colors.fg,
    fontSize: font.sizeSm,
    fontWeight: font.weightMedium,
    minWidth: 0,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowTrailing: {
    color: colors.fg,
    flexShrink: 0,
    fontSize: font.sizeSm,
    fontVariantNumeric: 'tabular-nums',
    whiteSpace: 'nowrap',
  },
  search: {
    backgroundColor: colors.bg,
    padding: spacing.s3,
    position: 'sticky',
    top: 0,
    zIndex: 1,
  },
});

// Compared without Turkish diacritics and case, like the ⌘K palette: "musteri"
// finds "Müşteri", "ISIK" finds "Işık".
const fold = (text: string) =>
  text.toLocaleLowerCase('tr').replaceAll('ı', 'i').normalize('NFD').replaceAll(/\p{M}/gu, '');

/** True when every word of the query appears in one of the fields. */
export function matchesQuery(query: string, ...fields: Array<string>) {
  const words = fold(query).split(/\s+/).filter(Boolean);
  const text = fold(fields.join(' '));
  return words.every((word) => text.includes(word));
}

const numberFormat = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 4 });
const decimalFormat = new Intl.NumberFormat('tr-TR', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

/** 1.250 or 2,5 */
export const formatNumber = (value: number) => numberFormat.format(value);

/** ₺6.000,00 or $120,00; a code GİB uses but Intl rejects prints as "120,00 XYZ". */
export function formatMoney(value: number, currency?: string) {
  if (!currency) {
    return decimalFormat.format(value);
  }
  try {
    return new Intl.NumberFormat('tr-TR', { currency, style: 'currency' }).format(value);
  } catch {
    return `${decimalFormat.format(value)} ${currency}`;
  }
}

// GİB lists invoice types in capitals ("TEVKİFAT İADE"); show "Tevkifat iade".
export function invoiceTypeLabel(code: string) {
  const label = (
    GIB_INVOICE_TYPES.find((type) => type.value === code)?.label ?? code
  ).toLocaleLowerCase('tr');
  return label.charAt(0).toLocaleUpperCase('tr') + label.slice(1);
}

/** GİB unit code to its label: C62 is "Adet". */
export const unitLabel = (code: string) =>
  GIB_UNIT_TYPES.find((unit) => unit.value === code)?.label ?? code;

/**
 * The rows of `items` that `query` lists, and the selected one. A selection
 * the search hides, or none yet, falls back to the first row; a row edited
 * out of the search stays listed and selected until the search changes.
 * `matches` must be stable (a module-level function).
 */
export function useListSelection<T extends { id: string }>(
  items: ReadonlyArray<T>,
  query: string,
  matches: (item: T, query: string) => boolean,
) {
  const [selection, setSelection] = useState<ListSelection>({ id: null, query: null });
  const { next, selected, visible } = useMemo(
    () => listRows(items, query, matches, selection),
    [items, matches, query, selection],
  );
  if (next !== selection) {
    setSelection(next);
  }

  const select = useCallback((id: string | null) => setSelection({ id, query: null }), []);

  /** The row to select once `id` is gone: the next one, else the previous. */
  const neighborOf = (id: string) => {
    const index = visible.findIndex((item) => item.id === id);
    return (visible[index + 1] ?? visible[index - 1])?.id ?? null;
  };

  return { neighborOf, select, selected, visible };
}

/** The row a dialog is about. Kept after closing, so the text stays while it fades out. */
export function useDialogTarget<T>() {
  const [target, setTarget] = useState<T | null>(null);
  const [open, setOpen] = useState(false);

  const show = (next: T) => {
    setTarget(next);
    setOpen(true);
  };

  return { close: () => setOpen(false), open, show, target };
}

export interface ListRow {
  /** End of the subtitle line, e.g. a status badge. */
  aside?: ReactNode;
  subtitle: string;
  title: string;
  trailing?: ReactNode;
}

export interface SearchableListProps<T extends { id: string }> {
  /** Accessible name of the list. */
  label: string;
  /** ⌫ on the selected row; without it the list has no delete key. */
  onDelete?: (item: T) => void;
  /** Enter and double click (a single click with `openOnClick`). */
  onOpen: (item: T) => void;
  onQueryChange: (query: string) => void;
  onSelect: (id: string) => void;
  /** Footer hint for Enter, e.g. "fatura kes". */
  openHint: string;
  /** Open a row on a single click, for details that load on open. */
  openOnClick?: boolean;
  query: string;
  row: (item: T) => ListRow;
  searchPlaceholder: string;
  selected: T | null;
  visible: ReadonlyArray<T>;
}

/**
 * Search field, the rows and a hint footer, for the list column of a
 * ListDetail. ↑/↓ move the selection from the list or the search field, Enter
 * opens the selected row, ⌫ asks to delete it (not from the search field), Esc
 * clears the search.
 */
export function SearchableList<T extends { id: string }>({
  label,
  onDelete,
  onOpen,
  onQueryChange,
  onSelect,
  openHint,
  openOnClick = false,
  query,
  row,
  searchPlaceholder,
  selected,
  visible,
}: SearchableListProps<T>) {
  const idPrefix = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionId = (id: string) => `${idPrefix}-${id}`;

  // A screen opened from the sidebar or a shortcut takes the arrows right away,
  // unless a field already has the focus (a new row's name field).
  useEffect(() => {
    if (!document.activeElement?.matches('input, textarea, select')) {
      listRef.current?.focus({ preventScroll: true });
    }
  }, []);

  const selectedId = selected?.id;
  useEffect(() => {
    if (selectedId) {
      document.getElementById(`${idPrefix}-${selectedId}`)?.scrollIntoView({ block: 'nearest' });
    }
  }, [idPrefix, selectedId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey
      ) {
        return;
      }
      const fromSearch = event.target === searchRef.current;
      const fromList = event.target === listRef.current || event.target === document.body;
      if (!fromSearch && !fromList) {
        return;
      }
      // An open dialog owns the keys, also when the focus fell back to the page.
      if (
        document.querySelector('[role="dialog"], [role="alertdialog"]') ||
        listRef.current?.closest('[aria-hidden="true"], [inert]')
      ) {
        return;
      }
      const index = selected ? visible.indexOf(selected) : -1;
      switch (event.key) {
        case 'ArrowDown':
        case 'ArrowUp': {
          const next = visible[index + (event.key === 'ArrowDown' ? 1 : -1)];
          if (next) {
            onSelect(next.id);
          }
          break;
        }
        case 'Enter':
          if (!selected) {
            return;
          }
          onOpen(selected);
          break;
        case 'Backspace':
        case 'Delete':
          if (fromSearch || !selected || !onDelete) {
            return;
          }
          onDelete(selected);
          break;
        case 'Escape':
          if (!fromSearch || !query) {
            return;
          }
          onQueryChange('');
          break;
        default:
          return;
      }
      event.preventDefault();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onDelete, onOpen, onQueryChange, onSelect, query, selected, visible]);

  return (
    <div {...props(styles.root)}>
      <div {...props(styles.search)}>
        <Input
          aria-label={searchPlaceholder}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={searchPlaceholder}
          ref={searchRef}
          value={query}
        />
      </div>
      <div
        aria-activedescendant={selected ? optionId(selected.id) : undefined}
        aria-label={label}
        ref={listRef}
        role="listbox"
        tabIndex={0}
        {...props(styles.listbox)}
      >
        {visible.length === 0 && <p {...props(styles.noResults)}>Sonuç yok</p>}
        {visible.map((item) => {
          const { aside, subtitle, title, trailing } = row(item);
          return (
            <div
              aria-selected={item === selected}
              id={optionId(item.id)}
              key={item.id}
              onClick={() => {
                onSelect(item.id);
                if (openOnClick) {
                  onOpen(item);
                }
              }}
              onDoubleClick={openOnClick ? undefined : () => onOpen(item)}
              role="option"
              {...props(styles.row, item === selected && styles.rowSelected)}
            >
              <div {...props(styles.rowLine)}>
                <span {...props(styles.rowTitle)}>{title}</span>
                {trailing && <span {...props(styles.rowTrailing)}>{trailing}</span>}
              </div>
              {aside ? (
                <div {...props(styles.rowLine, styles.rowLineCenter)}>
                  <span {...props(styles.rowSubtitle)}>{subtitle}</span>
                  {aside}
                </div>
              ) : (
                <span {...props(styles.rowSubtitle)}>{subtitle}</span>
              )}
            </div>
          );
        })}
      </div>
      <div {...props(styles.footer)}>
        <span {...props(styles.hint)}>
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd>
          <span {...props(capStyles.text)}>seç</span>
        </span>
        <span {...props(styles.hint)}>
          <Kbd>↵</Kbd>
          <span {...props(capStyles.text)}>{openHint}</span>
        </span>
        {onDelete && (
          <span {...props(styles.hint)}>
            <Kbd>⌫</Kbd>
            <span {...props(capStyles.text)}>sil</span>
          </span>
        )}
      </div>
    </div>
  );
}

/** Centered message for a screen with nothing to list yet. */
export function EmptyState({
  action,
  children,
  detail,
  title,
}: {
  action?: ReactNode;
  children: ReactNode;
  /** A second, smaller line under the text. */
  detail?: ReactNode;
  title: string;
}) {
  return (
    <div {...props(styles.empty)}>
      <h2 {...props(styles.emptyTitle)}>{title}</h2>
      <p {...props(styles.emptyText)}>{children}</p>
      {detail && <p {...props(styles.emptyText, styles.emptyDetail)}>{detail}</p>}
      {action}
    </div>
  );
}
