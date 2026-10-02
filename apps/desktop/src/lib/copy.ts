// Strings several screens share.

/** A customer, or an invoice's recipient, with neither an unvan nor a name. */
export const UNNAMED_CUSTOMER = 'Adsız müşteri';

/** The text of a failed call's error, else a generic message. */
export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Beklenmeyen bir hata oluştu. Tekrar dene.';
