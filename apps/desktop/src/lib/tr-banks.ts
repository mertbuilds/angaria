import { ibanBankCode } from './tr-validators.ts';

// Turkish banks by the five-digit code in an IBAN (characters 5-9, the bank's
// EFT code with a leading 0), for the bank name hint under Ayarlar › IBAN. The
// banks most freelancers use; an unknown code shows no hint.

const TR_BANKS: Readonly<Record<string, string>> = {
  '00010': 'Ziraat Bankası',
  '00012': 'Halkbank',
  '00015': 'VakıfBank',
  '00016': 'Türk Eximbank',
  '00032': 'TEB',
  '00046': 'Akbank',
  '00059': 'Şekerbank',
  '00062': 'Garanti BBVA',
  '00064': 'İş Bankası',
  '00067': 'Yapı Kredi',
  '00091': 'A&T Bank',
  '00092': 'Citibank',
  '00096': 'Turkish Bank',
  '00099': 'ING',
  '00103': 'Fibabanka',
  '00109': 'ICBC Turkey',
  '00111': 'QNB',
  '00115': 'Deutsche Bank',
  '00123': 'HSBC',
  '00124': 'Alternatif Bank',
  '00125': 'Burgan Bank',
  '00134': 'DenizBank',
  '00135': 'Anadolubank',
  '00143': 'Aktif Bank',
  '00146': 'Odeabank',
  '00203': 'Albaraka Türk',
  '00205': 'Kuveyt Türk',
  '00206': 'Türkiye Finans',
  '00209': 'Ziraat Katılım',
  '00210': 'Vakıf Katılım',
  '00211': 'Emlak Katılım',
};

/** The bank of a Turkish IBAN, typed or grouped, once its bank code is in; else null. */
export function ibanBankName(iban: string): string | null {
  const code = ibanBankCode(iban);
  return (code && TR_BANKS[code]) ?? null;
}
