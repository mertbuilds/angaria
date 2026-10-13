// Son ödeme tarihi is PDF only: GİB's invoice has no such field. The due date
// an invoice was created with is kept here by its ETTN, so the PDF downloaded
// from Faturalar prints it too. ETTNs are unique, so one map serves every
// company.

const STORAGE_KEY = 'fatura-due-dates';

type DueDateStorage = Pick<Storage, 'getItem' | 'setItem'>;

function readAll(storage: DueDateStorage): Record<string, string> {
  try {
    const stored: unknown = JSON.parse(storage.getItem(STORAGE_KEY) ?? 'null');
    return stored && typeof stored === 'object' ? (stored as Record<string, string>) : {};
  } catch {
    return {};
  }
}

/**
 * Keeps `dueDate` (dd/MM/yyyy) for the invoice `ettn`; empty forgets it. It
 * runs after GİB has the draft, so a full or blocked storage never fails the
 * creation: the PDF then prints without the due date.
 */
export function saveDueDate(ettn: string, dueDate: string, storage: DueDateStorage = localStorage) {
  try {
    const all = readAll(storage);
    if (dueDate) {
      all[ettn] = dueDate;
    } else {
      delete all[ettn];
    }
    storage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch {
    // Optional: the draft exists either way.
  }
}

/** The due date the invoice `ettn` was created with, if any. */
export const dueDateOf = (ettn: string, storage: DueDateStorage = localStorage) =>
  readAll(storage)[ettn] || undefined;
