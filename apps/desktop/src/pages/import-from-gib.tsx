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
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { getDrafts, getInvoiceDetail } from '@/lib/angaria.ts';
import { fullCountryName } from '@/lib/countries.ts';
import { taxIDKind } from '@/lib/customer.ts';
import {
  applyImport,
  DEFAULT_IMPORT_PERIOD,
  IMPORT_PERIODS,
  importCandidates,
  importRange,
  importWeeks,
  RATE_LIMIT_BACKOFF_MS,
  type ImportCandidates,
  type ImportPeriod,
  type ScanClient,
  type ScanProgress,
} from '@/lib/gib-import.ts';
import { gib, invoiceDetailQuery } from '@/lib/gib.ts';
import { importRuns } from '@/lib/import-run.ts';
import { dueDateOf } from '@/lib/invoice-due-dates.ts';
import { formatPrice } from '@/lib/services.ts';
import { useStore } from '@/lib/store.tsx';
import type { Entity, Invoice } from '@/lib/types.ts';
import { ErrorState } from '@/shell/error-state.tsx';
import { EmptyState, formatNumber, unitLabel } from '@/shell/searchable-list.tsx';
import { tones } from '../shell/palette.stylex.ts';

const styles = create({
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
  // Long names wrap: the whole name is what the user chooses by.
  rowTitle: {
    color: colors.fg,
    fontSize: font.sizeSm,
    overflowWrap: 'anywhere',
  },
  rowSubtitle: {
    color: colors.muted,
    fontSize: font.sizeXs,
    overflowWrap: 'anywhere',
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
    gridTemplateColumns: 'minmax(0, 1fr)',
  },
});

const periodOptions: ReadonlyArray<ChoiceOption<ImportPeriod>> = IMPORT_PERIODS.map(
  ({ label, value }) => ({ label, value }),
);

interface Selection {
  customers: Set<string>;
  services: Set<string>;
}

const newKeys = (items: ReadonlyArray<{ existing: boolean; key: string }>) =>
  new Set(items.filter((item) => !item.existing).map((item) => item.key));

/** The scan's progress in words, for the dialog and the indicator in the corner. */
export function progressText(progress: ScanProgress | null) {
  if (!progress) {
    return { label: 'GİB’e bağlanılıyor…', value: undefined };
  }
  const count = `${formatNumber(progress.done)}/${formatNumber(progress.total)}`;
  const value = `${count} ${progress.phase === 'weeks' ? 'hafta' : 'fatura'}`;
  if (progress.wait) {
    return {
      label: `GİB yoğun, ${formatNumber(progress.wait.seconds)} saniye sonra tekrar denenecek (${progress.wait.attempt}/${RATE_LIMIT_BACKOFF_MS.length})`,
      value,
    };
  }
  return {
    label: progress.phase === 'weeks' ? 'Faturalar taranıyor…' : 'Fatura ayrıntıları alınıyor…',
    value,
  };
}

/** The scan's GİB calls as background tasks on the company's login: what the user asks for goes first. */
function useScanClient() {
  const { getCredentials } = useStore();
  const queryClient = useQueryClient();
  return (entity: Entity): ScanClient => {
    const account = { credentials: () => getCredentials(entity.id), key: entity.creds.username };
    return {
      detail: (ettn, signal) =>
        gib.run(
          account,
          async (session) => {
            const detail = await getInvoiceDetail(session, ettn);
            queryClient.setQueryData(invoiceDetailQuery(account, ettn).queryKey, detail);
            return detail;
          },
          { background: true, signal },
        ),
      list: (week, signal) =>
        gib.run(
          account,
          async (session) =>
            (await getDrafts(session, week.start, week.end, { signal })) as Array<Invoice>,
          { background: true, signal },
        ),
    };
  };
}

/** What the period asks of GİB, under the period choice. */
function periodHint(period: ImportPeriod) {
  const weeks = importWeeks(importRange(period, new Date())).length;
  const long = period === '2-yil' ? ' 2 yıl birkaç dakika sürer.' : '';
  return `GİB her seferinde bir haftayı gösterir: ${formatNumber(weeks)} hafta sırayla taranır, sonra her onaylı fatura ayrıca okunur.${long} Taslaklar, iptal edilen ve silinen belgeler alınmaz.`;
}

function customerSubtitle(taxID: string, country: string) {
  const kind = taxIDKind(taxID);
  if (kind === 'foreign') {
    return `Yurt dışı · ${fullCountryName(country)}`;
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
 * The scan is the app's one import run (importRuns): closing the dialog never
 * stops it, and opening the dialog shows it at its step, for the company it
 * scans. `onboarding` names the way out Atla (after the first GİB login), else
 * Vazgeç.
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
  const { activeEntity, entities, newId, updateEntity } = useStore();
  const scanClient = useScanClient();
  const run = useSyncExternalStore(importRuns.subscribe, importRuns.current);
  const [period, setPeriod] = useState<ImportPeriod>(DEFAULT_IMPORT_PERIOD);
  const [done, setDone] = useState<{ customers: number; services: number } | null>(null);
  const [picked, setPicked] = useState<(Selection & { runId: string }) | null>(null);
  // The company the run scans, which may not be the active one.
  const entity = run ? entities.find((item) => item.id === run.companyId) : activeEntity;

  // A run for a company deleted meanwhile has nowhere to save.
  useEffect(() => {
    if (run && !entity) {
      importRuns.cancel(run.id);
    }
  }, [entity, run]);

  const candidates = useMemo(
    () =>
      run?.status === 'ready' && run.invoices && entity
        ? importCandidates(run.invoices, {
            customers: entity.savedRecipients,
            services: entity.savedItems,
          })
        : null,
    [entity, run],
  );
  const selection: Selection | null =
    candidates && run
      ? picked?.runId === run.id
        ? picked
        : { customers: newKeys(candidates.customers), services: newKeys(candidates.services) }
      : null;

  function startScan() {
    setDone(null);
    // Another run scanning comes back instead, and the dialog shows it.
    importRuns.start(activeEntity.id, period, scanClient(activeEntity));
  }

  /** Stops and forgets the run (Durdur), or drops what it found (Vazgeç). */
  function dropRun() {
    if (run) {
      importRuns.cancel(run.id);
    }
  }

  function addChosen(target: Entity, found: ImportCandidates, chosenKeys: Selection) {
    const chosen = {
      customers: found.customers.filter((item) => chosenKeys.customers.has(item.key)),
      services: found.services.filter((item) => chosenKeys.services.has(item.key)),
    };
    const saved = { customers: target.savedRecipients, services: target.savedItems };
    const result = applyImport(saved, chosen, newId, (ettn) => dueDateOf(ettn));
    updateEntity(target.id, (current) => ({
      ...current,
      savedItems: applyImport(
        { customers: [], services: current.savedItems },
        { customers: [], services: chosen.services },
        newId,
      ).services,
      savedRecipients: applyImport(
        { customers: current.savedRecipients, services: [] },
        { customers: chosen.customers, services: [] },
        newId,
        (ettn) => dueDateOf(ettn),
      ).customers,
    }));
    setDone({
      customers: result.customers.length - saved.customers.length,
      services: result.services.length - saved.services.length,
    });
    dropRun();
  }

  const leave = (
    <DialogClose render={<Button variant="outline" />}>
      {onboarding ? 'Atla' : 'Vazgeç'}
    </DialogClose>
  );
  // Leaving a finished or failed run drops it; closing the dialog any other way keeps it.
  const leaveRun = (
    <DialogClose onClick={dropRun} render={<Button variant="outline" />}>
      {onboarding ? 'Atla' : 'Vazgeç'}
    </DialogClose>
  );
  const otherCompany =
    run && entity && run.companyId !== activeEntity.id ? ` Bu tarama ${entity.name} için.` : '';

  let body;
  if (done) {
    body = (
      <>
        <DialogHeader>
          <DialogTitle>Kayıtlar eklendi</DialogTitle>
          <DialogDescription>
            {formatNumber(done.customers)} müşteri ve {formatNumber(done.services)} hizmet eklendi.
            Yeni fatura keserken bunları seçebilirsin.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose render={<Button />}>Tamam</DialogClose>
        </DialogFooter>
      </>
    );
  } else if (!run || !entity) {
    body = (
      <>
        <DialogHeader>
          <DialogTitle>Eski faturalarından müşteri ve hizmetlerini al</DialogTitle>
          <DialogDescription>
            Angaria GİB’deki onaylı faturalarını tarar. Hangi müşteri ve hizmetlerin kaydedileceğini
            sen seçersin, kayıtlı olanlar değişmez.
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
            {periodHint(period)}
          </p>
        </div>
        <DialogFooter>
          {leave}
          <Button onClick={startScan}>Faturaları tara</Button>
        </DialogFooter>
      </>
    );
  } else if (run.status === 'scanning') {
    const text = progressText(run.progress);
    body = (
      <>
        <DialogHeader>
          <DialogTitle>Eski faturalarından müşteri ve hizmetlerini al</DialogTitle>
          <DialogDescription>
            GİB’i yormamak için faturalar sırayla alınıyor. Pencereyi kapatabilirsin, tarama arka
            planda sürer ve bitince sağ altta haber verir.{otherCompany}
          </DialogDescription>
        </DialogHeader>
        <Progress
          label={text.label}
          max={run.progress?.total || 1}
          value={run.progress ? run.progress.done : null}
          valueText={text.value}
        />
        <DialogFooter>
          <Button onClick={dropRun} variant="outline">
            Durdur
          </Button>
          <DialogClose render={<Button />}>Kapat</DialogClose>
        </DialogFooter>
      </>
    );
  } else if (run.status === 'failed') {
    body = (
      <>
        <DialogHeader>
          <DialogTitle>Eski faturalarından müşteri ve hizmetlerini al</DialogTitle>
          {otherCompany && <DialogDescription>{otherCompany.trim()}</DialogDescription>}
        </DialogHeader>
        <ErrorState
          error={run.error}
          // Goes on from where it stopped.
          onRetry={() => importRuns.retry(scanClient(entity))}
          title="Faturalar alınamadı"
        />
        <DialogFooter>{leaveRun}</DialogFooter>
      </>
    );
  } else if (candidates && selection) {
    const count = selection.customers.size + selection.services.size;
    const setSelection = (next: Partial<Selection>) =>
      setPicked({ ...selection, ...next, runId: run.id });
    body = (
      <>
        <DialogHeader>
          <DialogTitle>Kaydedilecekleri seç</DialogTitle>
          <DialogDescription>
            Müşteriler son faturalarındaki bilgilerle, hizmetler son fiyatlarıyla kaydedilir.
            {otherCompany}
          </DialogDescription>
        </DialogHeader>
        {candidates.customers.length === 0 ? (
          <EmptyState
            action={
              <Button onClick={dropRun} variant="outline">
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
          {leaveRun}
          <Button
            disabled={count === 0}
            focusableWhenDisabled
            onClick={() => addChosen(entity, candidates, selection)}
          >
            Seçilenleri ekle ({formatNumber(count)})
          </Button>
        </DialogFooter>
      </>
    );
  }

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent size="lg">{body}</DialogContent>
    </Dialog>
  );
}
