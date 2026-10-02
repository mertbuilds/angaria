import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { fetchTCMBRateTable } from '@/lib/angaria.ts';
import { formatRate } from '@/lib/invoice-form.ts';
import type { InvoiceFormValues } from '@/lib/types.ts';
import { parseGIB } from '@/lib/utils.ts';
import type { InvoiceForm } from './use-invoice-form.ts';

/** What the rate field says under it. */
export type RateDescription =
  | { kind: 'error' }
  | { kind: 'loading' }
  // Typed in; `tcmbAvailable` offers going back to TCMB's rate.
  | { kind: 'manual'; tcmbAvailable: boolean }
  | { date: Date; kind: 'tcmb' }
  // TCMB publishes no rate for this currency.
  | { kind: 'unpublished' };

/**
 * TCMB's buying rate for the invoice's currency and date. It fills the rate
 * field until the user types one.
 */
export function useCurrencyRate(form: InvoiceForm, values: InvoiceFormValues) {
  const currency = values.invoiceSettings.currency;
  const foreign = currency !== 'TRY';
  const rateDate = values.advancedFields.manualDate;
  const rateManual = values.advancedFields.currencyRateManual === true;
  const rates = useQuery({
    enabled: foreign,
    queryFn: () => fetchTCMBRateTable(parseGIB(rateDate)),
    queryKey: ['tcmb-rates', rateDate],
    staleTime: 5 * 60 * 1000,
  });
  const tcmbRate = foreign ? rates.data?.rates.get(currency) : undefined;

  useEffect(() => {
    if (rateManual || tcmbRate === undefined) {
      return;
    }
    const text = formatRate(tcmbRate);
    if (form.getFieldValue('invoiceSettings.currencyRate') !== text) {
      form.setFieldValue('invoiceSettings.currencyRate', text, {
        dontRunListeners: true,
        dontUpdateMeta: true,
      });
    }
  }, [form, rateManual, tcmbRate]);

  let rateDescription: RateDescription | null = null;
  if (rateManual) {
    rateDescription = { kind: 'manual', tcmbAvailable: tcmbRate !== undefined };
  } else if (rates.isError) {
    rateDescription = { kind: 'error' };
  } else if (rates.data && tcmbRate === undefined) {
    rateDescription = { kind: 'unpublished' };
  } else if (rates.data) {
    rateDescription = { date: rates.data.date, kind: 'tcmb' };
  } else if (foreign) {
    rateDescription = { kind: 'loading' };
  }

  return { foreign, rateDescription };
}
