import { toast } from '@angaria/ui';
import { useCallback, useMemo } from 'react';
import { useAppForm } from '@/lib/form.tsx';
import { sameAsBlank, validateInvoice } from '@/lib/invoice-form.ts';
import { useStore } from '@/lib/store.tsx';
import type { InvoiceFormValues } from '@/lib/types.ts';

/** What a submit asks for: `form.handleSubmit({ sign: true })` signs the new draft by SMS. */
export interface SubmitMeta {
  sign: boolean;
}

const DRAFT_ONLY: SubmitMeta = { sign: false };

export function useInvoiceForm({
  defaultValues,
  onSubmit,
  onSubmitInvalid,
}: {
  defaultValues: InvoiceFormValues;
  onSubmit: (values: InvoiceFormValues, meta: SubmitMeta) => Promise<void>;
  onSubmitInvalid: () => void;
}) {
  return useAppForm({
    defaultValues,
    onSubmit: ({ meta, value }) => onSubmit(value, meta),
    onSubmitInvalid,
    onSubmitMeta: DRAFT_ONLY,
    // Also runs on submit. No onBlur validator: see lib/form.tsx.
    validators: { onChange: ({ value }) => validateInvoice(value) },
  });
}

export type InvoiceForm = ReturnType<typeof useInvoiceForm>;

/** The invoice form as the store holds it (the mounted form writes through). */
export function useStoredInvoiceForm(): InvoiceFormValues {
  const { advancedFields, invoiceSettings, items, note, recipient } = useStore();
  return useMemo(
    () => ({ advancedFields, invoiceSettings, items, note, recipient }),
    [advancedFields, invoiceSettings, items, note, recipient],
  );
}

/** Empties the invoice form; the toast can put it back. */
export function useClearInvoiceForm() {
  const { invoiceSource, resetInvoiceForm, restoreInvoiceDraft } = useStore();
  const values = useStoredInvoiceForm();

  return useCallback(() => {
    if (!sameAsBlank(values, resetInvoiceForm())) {
      toast('Form temizlendi', {
        action: { label: 'Geri al', onClick: () => restoreInvoiceDraft(values, invoiceSource) },
      });
    }
  }, [invoiceSource, resetInvoiceForm, restoreInvoiceDraft, values]);
}
