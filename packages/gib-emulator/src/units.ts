/**
 * GİB's units: `value` is the code a draft sends in `birim`, `label` the name
 * the portal shows for it. A copy of `GIB_UNIT_TYPES` in
 * apps/desktop/src/lib/gib-constants.ts, since the emulator depends on no
 * workspace package; apps/desktop/tests/gib-constants.test.ts keeps the two
 * equal.
 */
export const GIB_UNIT_TYPES = [
  { label: 'Gün', value: 'DAY' },
  { label: 'Ay', value: 'MON' },
  { label: 'Yıl', value: 'ANN' },
  { label: 'Saat', value: 'HUR' },
  { label: 'Dakika', value: 'D61' },
  { label: 'Saniye', value: 'D62' },
  { label: 'Adet', value: 'C62' },
  { label: 'Paket', value: 'PA' },
  { label: 'Kutu', value: 'BX' },
  { label: 'mg', value: 'MGM' },
  { label: 'g', value: 'GRM' },
  { label: 'kg', value: 'KGM' },
  { label: 'lt', value: 'LTR' },
  { label: 'ton', value: 'TNE' },
  { label: 'Net Ton', value: 'NT' },
  { label: 'Gross ton', value: 'GT' },
  { label: 'mm', value: 'MMT' },
  { label: 'cm', value: 'CMT' },
  { label: 'm', value: 'MTR' },
  { label: 'km', value: 'KTM' },
  { label: 'ml', value: 'MLT' },
  { label: 'mm3', value: 'MMQ' },
  { label: 'cm2', value: 'CMK' },
  { label: 'cm3', value: 'CMQ' },
  { label: 'm2', value: 'MTK' },
  { label: 'm3', value: 'MTQ' },
  { label: 'kJ', value: 'KJO' },
  { label: 'cl', value: 'CLT' },
  { label: 'KARAT', value: 'CT' },
  { label: 'KWH', value: 'KWH' },
  { label: 'MWH', value: 'MWH' },
  { label: 'Ton baş.taşıma kap.', value: 'CCT' },
  { label: 'Brüt kalori', value: 'D30' },
  { label: '1000 lt', value: 'D40' },
  { label: 'Saf alkol lt', value: 'LPA' },
  { label: 'kg.m2', value: 'B32' },
  { label: 'Hücre adet', value: 'NCL' },
  { label: 'Çift', value: 'PR' },
  { label: '1000 m3', value: 'R9' },
  { label: 'Set', value: 'SET' },
  { label: '1000 adet', value: 'T3' },
  { label: 'SCM', value: 'Q37' },
  { label: 'NCM', value: 'Q39' },
  { label: 'mmBTU', value: 'J39' },
  { label: 'CM³', value: 'G52' },
  { label: 'Düzine', value: 'DZN' },
  { label: 'dm2', value: 'DMK' },
  { label: 'dm', value: 'DMT' },
  { label: 'ha', value: 'HAR' },
  { label: 'Metretül (LM)', value: 'LM' },
];

const UNIT_NAMES = new Map(GIB_UNIT_TYPES.map(({ label, value }) => [value, label]));

/** A unit code by the name GİB prints for it ("HUR" is "Saat"); a code outside the list prints as it is. */
export const unitName = (code: string) => UNIT_NAMES.get(code) ?? code;
