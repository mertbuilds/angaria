import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { fetchTCMBRateTable } from '@/lib/angaria.ts';
import { formatRate } from '@/lib/invoice-form.ts';
import { useRateDay } from '@/lib/rate-day.ts';
import type { InvoiceFormValues } from '@/lib/types.ts';
import { parseGIB } from '@/lib/utils.ts';
import type { InvoiceForm } from './use-invoice-form.ts';

/** What the rate field says under it. */
export type RateDescription =
  | { kind: 'error' }
  | { kind: 'loading' }
  // Typed in; `tcmbAvailable` offers going back to TCMB's rate.
  | { kind: 'manual'; tcmbAvailable: boolean }
  // The bulletin TCMB published on `publishedOn`, for an invoice dated `validFor`.
  | { kind: 'tcmb'; publishedOn: Date; validFor: Date }
  // TCMB publishes no rate for this currency.
  | { kind: 'unpublished' };

/**
 * TCMB's buying rate for the invoice's currency and date, from the bulletin
 * the Kur günü setting picks. It fills the rate field until the user types one;
 * while it is loading, failed or not published, the field is empty, so another
 * day's rate never goes to GİB.
 */
export function useCurrencyRate(form: InvoiceForm, values: InvoiceFormValues) {
  const currency = values.invoiceSettings.currency;
  const foreign = currency !== 'TRY';
  const rateDate = values.advancedFields.manualDate;
  const rateManual = values.advancedFields.currencyRateManual === true;
  const rateDay = useRateDay();
  const rates = useQuery({
    enabled: foreign,
    queryFn: () => fetchTCMBRateTable(parseGIB(rateDate), rateDay),
    queryKey: ['tcmb-rates', rateDate, rateDay],
    staleTime: 5 * 60 * 1000,
  });
  const tcmbRate = foreign ? rates.data?.rates.get(currency) : undefined;

  useEffect(() => {
    if (!foreign || rateManual) {
      return;
    }
    const text = tcmbRate === undefined ? '' : formatRate(tcmbRate);
    if (form.getFieldValue('invoiceSettings.currencyRate') !== text) {
      form.setFieldValue('invoiceSettings.currencyRate', text, {
        dontRunListeners: true,
        dontUpdateMeta: true,
      });
    }
  }, [foreign, form, rateManual, tcmbRate]);

  let rateDescription: RateDescription | null = null;
  if (rateManual) {
    rateDescription = { kind: 'manual', tcmbAvailable: tcmbRate !== undefined };
  } else if (rates.isError) {
    rateDescription = { kind: 'error' };
  } else if (rates.data && tcmbRate === undefined) {
    rateDescription = { kind: 'unpublished' };
  } else if (rates.data) {
    const { publishedOn, validFor } = rates.data;
    rateDescription = { kind: 'tcmb', publishedOn, validFor };
  } else if (foreign) {
    rateDescription = { kind: 'loading' };
  }

  return { foreign, rateDescription };
}
