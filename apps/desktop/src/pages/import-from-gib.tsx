import {
  Badge,
  Button,
  Checkbox,
  ChoiceChips,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Progress,
  type ChoiceOption,
} from '@angaria/ui';
import { colors, font, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { getDrafts, getInvoiceDetail } from '@/lib/angaria.ts';
import { countryLabel, taxIDKind } from '@/lib/customer.ts';
import {
  applyImport,
  DEFAULT_IMPORT_PERIOD,
  IMPORT_PACE_MS,
  IMPORT_PERIODS,
  importCandidates,
  importRange,
  importWeeks,
  pause,
  scanInvoices,
  type ImportCandidates,
  type ImportPeriod,
  type ScanClient,
  type ScanProgress,
} from '@/lib/gib-import.ts';
import { gib, invoiceDetailQuery, useGIBAccount } from '@/lib/gib.ts';
import { dueDateOf } from '@/lib/invoice-due-dates.ts';
import { formatPrice } from '@/lib/services.ts';
import { useStore } from '@/lib/store.tsx';
import type { Invoice } from '@/lib/types.ts';
import { ErrorState } from '@/shell/error-state.tsx';
import { EmptyState, formatNumber, unitLabel } from '@/shell/searchable-list.tsx';
import { tones } from '../shell/palette.stylex.ts';

const styles = create({
  content: {
    maxWidth: {
      '@media (min-width: 640px)': '34rem',
      default: 'calc(100% - 2rem)',
    },
  },
  field: {
    display: 'grid',
    gap: spacing.s2,
  },
  fieldHint: {
    color: colors.muted,
    fontSize: font.sizeXs,
    lineHeight: 1.5,
    margin: 0,
  },
  fieldLabel: {
    color: colors.fg,
    fontSize: font.sizeSm,
  },
  group: {
    backgroundColor: tones.card,
    borderRadius: radius.base,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: spacing.s1,
  },
  groupHeader: {
    alignItems: 'center',
    display: 'flex',
    gap: spacing.s3,
    paddingBlock: spacing.s1,
    paddingInline: spacing.s3,
  },
  groupTitle: {
    color: colors.fg,
    flex: 1,
    fontSize: font.sizeSm,
    fontWeight: font.weightMedium,
  },
  count: {
    color: colors.muted,
    fontSize: font.sizeXs,
    fontVariantNumeric: 'tabular-nums',
  },
  row: {
    alignItems: 'center',
    backgroundColor: {
      ':hover': `color-mix(in oklab, ${colors.subtle} 60%, transparent)`,
      default: 'transparent',
    },
    borderRadius: `calc(${radius.base} - 4px)`,
    cursor: 'default',
    display: 'flex',
    gap: spacing.s3,
    paddingBlock: spacing.s2,
    paddingInline: spacing.s3,
    userSelect: 'none',
  },
  rowDisabled: {
    backgroundColor: 'transparent',
  },
  rowText: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0,
  },
  rowTitle: {
    color: colors.fg,
    fontSize: font.sizeSm,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  rowSubtitle: {
    color: colors.muted,
    fontSize: font.sizeXs,
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
  muted: {
    color: colors.muted,
  },
  sections: {
    display: 'grid',
    gap: spacing.s4,
  },
});

const periodOptions: ReadonlyArray<ChoiceOption<ImportPeriod>> = IMPORT_PERIODS.map(
  ({ label, value }) => ({ label, value }),
);

interface Selection {
  customers: Set<string>;
  services: Set<string>;
}

type Step =
  | { customers: number; kind: 'done'; services: number }
  | { error: unknown; kind: 'failed' }
  | { candidates: ImportCandidates; kind: 'pick'; selection: Selection }
  | { kind: 'scanning'; progress: ScanProgress | null }
  | { kind: 'start' };

const newKeys = (items: ReadonlyArray<{ existing: boolean; key: string }>) =>
  new Set(items.filter((item) => !item.existing).map((item) => item.key));

function progressText(progress: ScanProgress | null) {
  if (!progress) {
    return { label: 'GİB’e bağlanılıyor…', value: undefined };
  }
  const count = `${formatNumber(progress.done)}/${formatNumber(progress.total)}`;
  return progress.phase === 'weeks'
    ? { label: 'Faturalar taranıyor…', value: `${count} hafta` }
    : { label: 'Fatura ayrıntıları alınıyor…', value: `${count} fatura` };
}

function customerSubtitle(taxID: string, country: string) {
  const kind = taxIDKind(taxID);
  if (kind === 'foreign') {
    return `Yurt dışı · ${countryLabel(country)}`;
  }
  return kind === 'vkn' ? `VKN ${taxID}` : `TCKN ${taxID}`;
}

interface PickRow {
  disabled: boolean;
  key: string;
  subtitle: string;
  title: string;
  trailing: string;
}

/** A titled list of checkbox rows with a select-all box; saved ones are shown, never chosen. */
function PickSection({
  onChange,
  rows,
  selected,
  title,
}: {
  onChange: (next: Set<string>) => void;
  rows: ReadonlyArray<PickRow>;
  selected: Set<string>;
  title: string;
}) {
  const choosable = rows.filter((row) => !row.disabled);
  const all = choosable.length > 0 && choosable.every((row) => selected.has(row.key));
  const some = !all && choosable.some((row) => selected.has(row.key));
  const toggle = (key: string, checked: boolean) => {
    const next = new Set(selected);
    if (checked) {
      next.add(key);
    } else {
      next.delete(key);
    }
    onChange(next);
  };

  return (
    <section aria-label={title} {...props(styles.group)}>
      <label {...props(styles.groupHeader)}>
        <Checkbox
          checked={all}
          disabled={choosable.length === 0}
          indeterminate={some}
          onCheckedChange={(checked) =>
            onChange(checked ? new Set(choosable.map((row) => row.key)) : new Set())
          }
        />
        <span {...props(styles.groupTitle)}>{title}</span>
        <span {...props(styles.count)}>
          {formatNumber(selected.size)}/{formatNumber(choosable.length)} seçili
        </span>
      </label>
      {rows.map((row) => (
        <label key={row.key} {...props(styles.row, row.disabled && styles.rowDisabled)}>
          <Checkbox
            checked={!row.disabled && selected.has(row.key)}
            disabled={row.disabled}
            onCheckedChange={(checked) => toggle(row.key, checked)}
          />
          <span {...props(styles.rowText)}>
            <span {...props(styles.rowTitle, row.disabled && styles.muted)}>{row.title}</span>
            <span {...props(styles.rowSubtitle)}>{row.subtitle}</span>
          </span>
          {row.disabled ? (
            <Badge variant="outline">Zaten kayıtlı</Badge>
          ) : (
            <span {...props(styles.rowTrailing)}>{row.trailing}</span>
          )}
        </label>
      ))}
    </section>
  );
}

/**
 * Eski faturalarından müşteri ve hizmetlerini al: pick a period, scan GİB's
 * signed invoices a week at a time, choose the customers and services to save.
 * `onboarding` names the way out Atla (after the first GİB login), else Vazgeç.
 */
export function ImportFromGIBDialog({
  onboarding,
  onOpenChange,
  open,
}: {
  onboarding: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const { newId, savedItems, savedRecipients, setSavedItems, setSavedRecipients } = useStore();
  const account = useGIBAccount();
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<ImportPeriod>(DEFAULT_IMPORT_PERIOD);
  const [step, setStep] = useState<Step>({ kind: 'start' });
  const scan = useRef<AbortController | null>(null);

  // Closing stops a running scan; the next open starts over.
  useEffect(() => {
    if (!open) {
      scan.current?.abort();
      scan.current = null;
    }
  }, [open]);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
    if (!next) {
      scan.current?.abort();
    }
  };

  async function startScan() {
    const controller = new AbortController();
    scan.current = controller;
    setStep({ kind: 'scanning', progress: null });
    // Background tasks: what the user asks for meanwhile goes first.
    const client: ScanClient = {
      detail: (ettn, signal) =>
        gib.run(
          account,
          async (session) => {
            await pause(IMPORT_PACE_MS, signal);
            const detail = await getInvoiceDetail(session, ettn);
            queryClient.setQueryData(invoiceDetailQuery(account, ettn).queryKey, detail);
            return detail;
          },
          { background: true, signal },
        ),
      list: (week, signal) =>
        gib.run(
          account,
          async (session) => {
            await pause(IMPORT_PACE_MS, signal);
            return (await getDrafts(session, week.start, week.end, { signal })) as Array<Invoice>;
          },
          { background: true, signal },
        ),
    };
    try {
      const invoices = await scanInvoices(client, importWeeks(importRange(period, new Date())), {
        onProgress: (progress) => {
          if (!controller.signal.aborted) {
            setStep({ kind: 'scanning', progress });
          }
        },
        signal: controller.signal,
      });
      const candidates = importCandidates(invoices, {
        customers: savedRecipients,
        services: savedItems,
      });
      setStep({
        candidates,
        kind: 'pick',
        selection: {
          customers: newKeys(candidates.customers),
          services: newKeys(candidates.services),
        },
      });
    } catch (error) {
      if (!controller.signal.aborted) {
        setStep({ error, kind: 'failed' });
      }
    } finally {
      if (scan.current === controller) {
        scan.current = null;
      }
    }
  }

  function stopScan() {
    scan.current?.abort();
    scan.current = null;
    setStep({ kind: 'start' });
  }

  function addChosen(candidates: ImportCandidates, selection: Selection) {
    const chosen = {
      customers: candidates.customers.filter((item) => selection.customers.has(item.key)),
      services: candidates.services.filter((item) => selection.services.has(item.key)),
    };
    const result = applyImport(
      { customers: savedRecipients, services: savedItems },
      chosen,
      newId,
      (ettn) => dueDateOf(ettn),
    );
    setSavedRecipients(result.customers);
    setSavedItems(result.services);
    setStep({
      customers: result.customers.length - savedRecipients.length,
      kind: 'done',
      services: result.services.length - savedItems.length,
    });
  }

  const leave = (
    <DialogClose render={<Button variant="outline" />}>
      {onboarding ? 'Atla' : 'Vazgeç'}
    </DialogClose>
  );

  let body;
  switch (step.kind) {
    case 'start':
      body = (
        <>
          <DialogHeader>
            <DialogTitle>Eski faturalarından müşteri ve hizmetlerini al</DialogTitle>
            <DialogDescription>
              Angaria GİB’deki onaylı faturalarını tarar. Hangi müşteri ve hizmetlerin
              kaydedileceğini sen seçersin, kayıtlı olanlar değişmez.
            </DialogDescription>
          </DialogHeader>
          <div {...props(styles.field)}>
            <span id="import-period-label" {...props(styles.fieldLabel)}>
              Dönem
            </span>
            <ChoiceChips
              aria-describedby="import-period-hint"
              aria-labelledby="import-period-label"
              onValueChange={(value) => {
                if (value) {
                  setPeriod(value);
                }
              }}
              options={periodOptions}
              value={period}
            />
            <p id="import-period-hint" {...props(styles.fieldHint)}>
              GİB her seferinde bir haftayı gösterir, bu yüzden uzun dönemler birkaç dakika
              sürebilir. Taslaklar, iptal edilen ve silinen belgeler alınmaz.
            </p>
          </div>
          <DialogFooter>
            {leave}
            <Button onClick={() => void startScan()}>Faturaları tara</Button>
          </DialogFooter>
        </>
      );
      break;
    case 'scanning': {
      const text = progressText(step.progress);
      body = (
        <>
          <DialogHeader>
            <DialogTitle>Eski faturalarından müşteri ve hizmetlerini al</DialogTitle>
            <DialogDescription>
              GİB’i yormamak için faturalar sırayla alınıyor. Bu sırada Angaria’yı kullanmaya devam
              edebilirsin.
            </DialogDescription>
          </DialogHeader>
          <Progress
            label={text.label}
            max={step.progress?.total || 1}
            value={step.progress ? step.progress.done : null}
            valueText={text.value}
          />
          <DialogFooter>
            <Button onClick={stopScan} variant="outline">
              Durdur
            </Button>
          </DialogFooter>
        </>
      );
      break;
    }
    case 'failed':
      body = (
        <>
          <DialogHeader>
            <DialogTitle>Eski faturalarından müşteri ve hizmetlerini al</DialogTitle>
          </DialogHeader>
          <ErrorState
            error={step.error}
            onRetry={() => void startScan()}
            title="Faturalar alınamadı"
          />
          <DialogFooter>{leave}</DialogFooter>
        </>
      );
      break;
    case 'pick': {
      const { candidates, selection } = step;
      const count = selection.customers.size + selection.services.size;
      const setSelection = (next: Partial<Selection>) =>
        setStep({ ...step, selection: { ...selection, ...next } });
      body = (
        <>
          <DialogHeader>
            <DialogTitle>Kaydedilecekleri seç</DialogTitle>
            <DialogDescription>
              Müşteriler son faturalarındaki bilgilerle, hizmetler son fiyatlarıyla kaydedilir.
            </DialogDescription>
          </DialogHeader>
          {candidates.customers.length === 0 ? (
            <EmptyState
              action={
                <Button onClick={() => setStep({ kind: 'start' })} variant="outline">
                  Başka dönem seç
                </Button>
              }
              title="Onaylı fatura yok"
            >
              Bu dönemde GİB’de onaylı faturan bulunmuyor.
            </EmptyState>
          ) : (
            <div {...props(styles.sections)}>
              <PickSection
                onChange={(customers) => setSelection({ customers })}
                rows={candidates.customers.map((item) => ({
                  disabled: item.existing,
                  key: item.key,
                  subtitle: customerSubtitle(item.taxID, item.latest.detail.recipient.country),
                  title: item.name,
                  trailing: `${formatNumber(item.invoiceCount)} fatura`,
                }))}
                selected={selection.customers}
                title="Müşteriler"
              />
              <PickSection
                onChange={(services) => setSelection({ services })}
                rows={candidates.services.map(({ existing, key, service }) => ({
                  disabled: existing,
                  key,
                  subtitle: `${unitLabel(service.unitType)} · KDV %${formatNumber(service.VATRate)}`,
                  title: service.name,
                  trailing: formatPrice(service.unitPrice, service.currency),
                }))}
                selected={selection.services}
                title="Hizmetler"
              />
            </div>
          )}
          <DialogFooter>
            {leave}
            <Button
              disabled={count === 0}
              focusableWhenDisabled
              onClick={() => addChosen(candidates, selection)}
            >
              Seçilenleri ekle ({formatNumber(count)})
            </Button>
          </DialogFooter>
        </>
      );
      break;
    }
    case 'done':
      body = (
        <>
          <DialogHeader>
            <DialogTitle>Kayıtlar eklendi</DialogTitle>
            <DialogDescription>
              {formatNumber(step.customers)} müşteri ve {formatNumber(step.services)} hizmet
              eklendi. Yeni fatura keserken bunları seçebilirsin.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose render={<Button />}>Tamam</DialogClose>
          </DialogFooter>
        </>
      );
      break;
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent style={styles.content}>{body}</DialogContent>
    </Dialog>
  );
}
