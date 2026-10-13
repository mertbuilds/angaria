// The regulated choices Yeni fatura offers first. Anything else stays possible
// through a Diğer input where the rules allow it.

/** KDV rates offered as chips. Diğer takes any whole number from 0 to 100. */
export const VAT_RATE_PRESETS: ReadonlyArray<number> = [20, 10, 1, 0];

/** GİB unit codes offered as chips: Adet, Saat, Gün, Ay. */
export const COMMON_UNITS: ReadonlyArray<string> = ['C62', 'HUR', 'DAY', 'MON'];

/** The invoice types Angaria sends. Any other type is blocked at submit. */
export const SUPPORTED_INVOICE_TYPES: ReadonlyArray<string> = ['SATIS', 'ISTISNA'];

/** An İstisna reason: its GİB code and the sentence it writes at the start of the note. */
export interface IstisnaReason {
  code: string;
  label: string;
  sentence: string;
}

/** The İstisna reasons offered. 302 is the default for services. */
export const ISTISNA_REASONS: ReadonlyArray<IstisnaReason> = [
  {
    code: '301',
    label: 'Mal ihracatı',
    sentence:
      "301 - 11/1-a Mal ihracatı. Bu fatura 3065 sayılı KDV Kanunu'nun 11/1-a maddesi uyarınca mal ihracatı kapsamında KDV'den istisnadır.",
  },
  {
    code: '302',
    label: 'Hizmet ihracatı',
    sentence:
      "302 - 11/1-a Hizmet ihracatı. Bu fatura 3065 sayılı KDV Kanunu'nun 11/1-a maddesi uyarınca hizmet ihracatı kapsamında KDV'den istisnadır.",
  },
  {
    code: '350',
    label: 'Diğer',
    sentence: '350 - Diğerleri.',
  },
];

/** Son ödeme presets, in days after the invoice date. 0 is Peşin. */
export const DUE_DAY_PRESETS: ReadonlyArray<number> = [0, 7, 14, 30];

/** VUK 231/5: the invoice is due within this many days of the service. */
export const INVOICE_WINDOW_DAYS = 7;
