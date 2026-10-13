// Türkiye's 81 il by plate number, for Şehir suggestions and for the tax
// offices of an il, spelled as GİB's "Defterdarlık ve Vergi Daireleri
// Listesi" (revised 2026-06-18, see tax-offices.ts) lists them, in title case.

/** [plate number, name], by plate number. */
export const TR_CITIES: ReadonlyArray<readonly [code: string, name: string]> = [
  ['01', 'Adana'],
  ['02', 'Adıyaman'],
  ['03', 'Afyonkarahisar'],
  ['04', 'Ağrı'],
  ['05', 'Amasya'],
  ['06', 'Ankara'],
  ['07', 'Antalya'],
  ['08', 'Artvin'],
  ['09', 'Aydın'],
  ['10', 'Balıkesir'],
  ['11', 'Bilecik'],
  ['12', 'Bingöl'],
  ['13', 'Bitlis'],
  ['14', 'Bolu'],
  ['15', 'Burdur'],
  ['16', 'Bursa'],
  ['17', 'Çanakkale'],
  ['18', 'Çankırı'],
  ['19', 'Çorum'],
  ['20', 'Denizli'],
  ['21', 'Diyarbakır'],
  ['22', 'Edirne'],
  ['23', 'Elazığ'],
  ['24', 'Erzincan'],
  ['25', 'Erzurum'],
  ['26', 'Eskişehir'],
  ['27', 'Gaziantep'],
  ['28', 'Giresun'],
  ['29', 'Gümüşhane'],
  ['30', 'Hakkari'],
  ['31', 'Hatay'],
  ['32', 'Isparta'],
  ['33', 'Mersin'],
  ['34', 'İstanbul'],
  ['35', 'İzmir'],
  ['36', 'Kars'],
  ['37', 'Kastamonu'],
  ['38', 'Kayseri'],
  ['39', 'Kırklareli'],
  ['40', 'Kırşehir'],
  ['41', 'Kocaeli'],
  ['42', 'Konya'],
  ['43', 'Kütahya'],
  ['44', 'Malatya'],
  ['45', 'Manisa'],
  ['46', 'Kahramanmaraş'],
  ['47', 'Mardin'],
  ['48', 'Muğla'],
  ['49', 'Muş'],
  ['50', 'Nevşehir'],
  ['51', 'Niğde'],
  ['52', 'Ordu'],
  ['53', 'Rize'],
  ['54', 'Sakarya'],
  ['55', 'Samsun'],
  ['56', 'Siirt'],
  ['57', 'Sinop'],
  ['58', 'Sivas'],
  ['59', 'Tekirdağ'],
  ['60', 'Tokat'],
  ['61', 'Trabzon'],
  ['62', 'Tunceli'],
  ['63', 'Şanlıurfa'],
  ['64', 'Uşak'],
  ['65', 'Van'],
  ['66', 'Yozgat'],
  ['67', 'Zonguldak'],
  ['68', 'Aksaray'],
  ['69', 'Bayburt'],
  ['70', 'Karaman'],
  ['71', 'Kırıkkale'],
  ['72', 'Batman'],
  ['73', 'Şırnak'],
  ['74', 'Bartın'],
  ['75', 'Ardahan'],
  ['76', 'Iğdır'],
  ['77', 'Yalova'],
  ['78', 'Karabük'],
  ['79', 'Kilis'],
  ['80', 'Osmaniye'],
  ['81', 'Düzce'],
];

/**
 * Text for matching what is typed: Turkish lower case, ı as i and accents
 * dropped, so "İSTANBUL", "Istanbul" and "istanbul" are one key and "kadikoy"
 * finds "Kadıköy".
 */
export const searchKey = (text: string) =>
  text
    .trim()
    .toLocaleLowerCase('tr')
    .replaceAll('ı', 'i')
    .normalize('NFD')
    .replaceAll(/\p{M}/gu, '');

const wordsOf = (text: string) =>
  searchKey(text)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);

/**
 * Whether every typed word starts a word of `texts`: "bir kr" finds
 * "Birleşik Krallık", "usa" finds the alias USA, but "us" does not find
 * "Avustralya". An empty query matches everything.
 */
export function matchesWords(query: string, ...texts: ReadonlyArray<string>) {
  const words = texts.flatMap(wordsOf);
  return wordsOf(query).every((typed) => words.some((word) => word.startsWith(typed)));
}

const CITY_BY_KEY = new Map(TR_CITIES.map(([code, name]) => [searchKey(name), code]));

/** The plate number of the il named `name`, in any case or without Turkish letters. */
export const cityCode = (name: string) => CITY_BY_KEY.get(searchKey(name)) ?? null;

/** The il names, in Turkish alphabetical order. */
export const CITY_NAMES: ReadonlyArray<string> = TR_CITIES.map(([, name]) => name).toSorted(
  (a, b) => a.localeCompare(b, 'tr'),
);
