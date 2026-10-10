import {
  addDays,
  type Day,
  dayNumber,
  istanbulDay,
  istanbulMinutes,
  pad,
  parseGIBDate,
  slashDate,
  weekday,
} from './dates.ts';

// TCMB's daily indicative rates, as https://www.tcmb.gov.tr/kurlar/{yyyyMM}/{ddMMyyyy}.xml
// serves them. Rates are deterministic: the same day always gives the same
// file. Weekends, public holidays, half days and days after the latest
// bulletin answer 404 with an HTML page, like TCMB, so clients have to walk
// back to the last bulletin.

interface CurrencyInfo {
  base: number;
  code: string;
  /** TCMB's CrossOrder attribute, which is not the position in the file. */
  crossOrder: number;
  /** Quoted as US dollars per unit (CrossRateOther) instead of units per US dollar. */
  crossOther?: boolean;
  isim: string;
  name: string;
  /** No banknote rates: the Banknote elements are empty. */
  noBanknote?: boolean;
  unit: number;
}

/** The 2026 feed: its currencies in file order. XDR (SDR) is written by `sdrXML`. */
const CURRENCIES: Array<CurrencyInfo> = [
  { base: 41.2, code: 'USD', crossOrder: 0, isim: 'ABD DOLARI', name: 'US DOLLAR', unit: 1 },
  {
    base: 27.1,
    code: 'AUD',
    crossOrder: 1,
    isim: 'AVUSTRALYA DOLARI',
    name: 'AUSTRALIAN DOLLAR',
    unit: 1,
  },
  {
    base: 6.45,
    code: 'DKK',
    crossOrder: 2,
    isim: 'DANİMARKA KRONU',
    name: 'DANISH KRONE',
    unit: 1,
  },
  { base: 48.1, code: 'EUR', crossOrder: 9, crossOther: true, isim: 'EURO', name: 'EURO', unit: 1 },
  {
    base: 55.4,
    code: 'GBP',
    crossOrder: 10,
    crossOther: true,
    isim: 'İNGİLİZ STERLİNİ',
    name: 'POUND STERLING',
    unit: 1,
  },
  { base: 51.6, code: 'CHF', crossOrder: 3, isim: 'İSVİÇRE FRANGI', name: 'SWISS FRANK', unit: 1 },
  { base: 4.38, code: 'SEK', crossOrder: 4, isim: 'İSVEÇ KRONU', name: 'SWEDISH KRONA', unit: 1 },
  {
    base: 29.7,
    code: 'CAD',
    crossOrder: 6,
    isim: 'KANADA DOLARI',
    name: 'CANADIAN DOLLAR',
    unit: 1,
  },
  {
    base: 134.9,
    code: 'KWD',
    crossOrder: 11,
    crossOther: true,
    isim: 'KUVEYT DİNARI',
    name: 'KUWAITI DINAR',
    unit: 1,
  },
  {
    base: 4.12,
    code: 'NOK',
    crossOrder: 7,
    isim: 'NORVEÇ KRONU',
    name: 'NORWEGIAN KRONE',
    unit: 1,
  },
  {
    base: 10.98,
    code: 'SAR',
    crossOrder: 8,
    isim: 'SUUDİ ARABİSTAN RİYALİ',
    name: 'SAUDI RIYAL',
    unit: 1,
  },
  { base: 27.6, code: 'JPY', crossOrder: 5, isim: 'JAPON YENİ', name: 'JAPENESE YEN', unit: 100 },
  {
    base: 9.47,
    code: 'RON',
    crossOrder: 13,
    isim: 'RUMEN LEYİ',
    name: 'NEW LEU',
    noBanknote: true,
    unit: 1,
  },
  {
    base: 0.49,
    code: 'RUB',
    crossOrder: 14,
    isim: 'RUS RUBLESİ',
    name: 'RUSSIAN ROUBLE',
    noBanknote: true,
    unit: 1,
  },
  {
    base: 5.78,
    code: 'CNY',
    crossOrder: 16,
    isim: 'ÇİN YUANI',
    name: 'CHINESE RENMINBI',
    noBanknote: true,
    unit: 1,
  },
  {
    base: 0.147,
    code: 'PKR',
    crossOrder: 17,
    isim: 'PAKİSTAN RUPİSİ',
    name: 'PAKISTANI RUPEE',
    noBanknote: true,
    unit: 1,
  },
  {
    base: 11.3,
    code: 'QAR',
    crossOrder: 18,
    isim: 'KATAR RİYALİ',
    name: 'QATARI RIAL',
    noBanknote: true,
    unit: 1,
  },
  {
    base: 0.0288,
    code: 'KRW',
    crossOrder: 19,
    isim: 'GÜNEY KORE WONU',
    name: 'SOUTH KOREAN WON',
    noBanknote: true,
    unit: 1,
  },
  {
    base: 24.2,
    code: 'AZN',
    crossOrder: 20,
    isim: 'AZERBAYCAN YENİ MANATI',
    name: 'AZERBAIJANI NEW MANAT',
    noBanknote: true,
    unit: 1,
  },
  {
    base: 11.2,
    code: 'AED',
    crossOrder: 21,
    isim: 'BİRLEŞİK ARAP EMİRLİKLERİ DİRHEMİ',
    name: 'UNITED ARAB EMIRATES DIRHAM',
    noBanknote: true,
    unit: 1,
  },
  {
    base: 0.0816,
    code: 'KZT',
    crossOrder: 22,
    isim: 'KAZAKİSTAN TENGESİ',
    name: 'KAZAKHSTAN TENGE',
    noBanknote: true,
    unit: 1,
  },
];

/** The IMF's special drawing right: a forex buying rate and a USD cross rate only. */
const SDR: CurrencyInfo = {
  base: 56.4,
  code: 'XDR',
  crossOrder: 0,
  crossOther: true,
  isim: 'ÖZEL ÇEKME HAKKI (SDR)',
  name: 'SPECIAL DRAWING RIGHT (SDR)',
  unit: 1,
};

/**
 * Days without a bulletin, as MM-dd: fixed public holidays, plus 28 October,
 * a half day (the eve of Cumhuriyet Bayramı) on which TCMB publishes nothing.
 */
const FIXED_HOLIDAYS = new Set([
  '01-01',
  '04-23',
  '05-01',
  '05-19',
  '07-15',
  '08-30',
  '10-28',
  '10-29',
]);

/**
 * Ramazan and Kurban Bayramı days (dd/MM/yyyy) with their weekday arife half
 * days, which have no bulletin either; extend through `tcmbHolidays`.
 */
const RELIGIOUS_HOLIDAYS = new Set([
  '30/03/2025',
  '31/03/2025',
  '01/04/2025',
  '05/06/2025',
  '06/06/2025',
  '07/06/2025',
  '08/06/2025',
  '09/06/2025',
  '19/03/2026',
  '20/03/2026',
  '21/03/2026',
  '22/03/2026',
  '26/05/2026',
  '27/05/2026',
  '28/05/2026',
  '29/05/2026',
  '30/05/2026',
  '08/03/2027',
  '09/03/2027',
  '10/03/2027',
  '11/03/2027',
  '16/05/2027',
  '17/05/2027',
  '18/05/2027',
  '19/05/2027',
]);

/** Whether TCMB publishes a bulletin for `day`. */
function isBulletinDay(day: Day, extraHolidays: Array<string>): boolean {
  const dow = weekday(day);
  if (dow === 0 || dow === 6) {
    return false;
  }
  if (FIXED_HOLIDAYS.has(`${pad(day.month)}-${pad(day.day)}`)) {
    return false;
  }
  const key = slashDate(day);
  return !RELIGIOUS_HOLIDAYS.has(key) && !extraHolidays.includes(key);
}

/** The bulletin's sequence number within its year. */
function bulletinNumber(day: Day, extraHolidays: Array<string>) {
  let count = 0;
  for (let current = { day: 1, month: 1, year: day.year }; dayNumber(current) <= dayNumber(day);) {
    if (isBulletinDay(current, extraHolidays)) {
      count++;
    }
    current = addDays(current, 1);
  }
  return count;
}

const hash = (text: string) => [...text].reduce((sum, char) => sum * 31 + char.charCodeAt(0), 7);

/** Forex buying rate in Turkish lira for one unit group (`unit` units) on `day`, always positive. */
function buyingRate(currency: CurrencyInfo, day: Day) {
  const days = dayNumber(day) - dayNumber({ day: 1, month: 1, year: 2026 });
  // Rises from 2026 on and falls toward zero before it, never below.
  const trend = days >= 0 ? 1 + 0.00035 * days : Math.exp(0.00035 * days);
  const drift = trend + 0.004 * trend * Math.sin(days * 0.7 + (hash(currency.code) % 100));
  return currency.base * drift;
}

/** TCMB's archive starts with this bulletin. */
const FIRST_BULLETIN: Day = { day: 16, month: 4, year: 1996 };

/** Bulletins before this day are in old lira (TRL), a million to the new one. */
const NEW_LIRA: Day = { day: 1, month: 1, year: 2005 };

/**
 * A rate as TCMB writes it on `day`: four decimals, five below 1 (RUB, PKR,
 * KRW, KZT); in old lira, whole numbers.
 */
const rateText = (day: Day) => (value: number) =>
  dayNumber(day) < dayNumber(NEW_LIRA)
    ? String(Math.round(value * 1_000_000))
    : value.toFixed(value < 1 ? 5 : 4);

const element = (name: string, value: string) =>
  value ? `<${name}>${value}</${name}>` : `<${name}/>`;

function currencyXML(currency: CurrencyInfo, usd: number, day: Day) {
  const fixed = rateText(day);
  const buying = buyingRate(currency, day);
  const perUnit = buying / currency.unit;
  const crossUSD = currency.code === 'USD' || currency.crossOther ? '' : (usd / perUnit).toFixed(4);
  const crossOther = currency.crossOther ? (perUnit / usd).toFixed(4) : '';
  const banknote = (rate: number) => (currency.noBanknote ? '' : fixed(rate));
  return `\t<Currency CrossOrder="${currency.crossOrder}" Kod="${currency.code}" CurrencyCode="${currency.code}">
\t\t\t<Unit>${currency.unit}</Unit>
\t\t\t<Isim>${currency.isim}</Isim>
\t\t\t<CurrencyName>${currency.name}</CurrencyName>
\t\t\t<ForexBuying>${fixed(buying)}</ForexBuying>
\t\t\t<ForexSelling>${fixed(buying * 1.0018)}</ForexSelling>
\t\t\t<BanknoteBuying>${banknote(buying * 0.9993)}</BanknoteBuying>
\t\t\t<BanknoteSelling>${banknote(buying * 1.0026)}</BanknoteSelling>
\t\t\t\t${element('CrossRateUSD', crossUSD)}
\t\t\t\t${element('CrossRateOther', crossOther)}
\t\t
\t</Currency>`;
}

/** XDR closes the file in its own layout: only ForexBuying and CrossRateOther. */
function sdrXML(usd: number, day: Day) {
  const buying = buyingRate(SDR, day);
  return `\t<Currency CrossOrder="${SDR.crossOrder}" Kod="${SDR.code}" CurrencyCode="${SDR.code}">
\t\t<Unit>${SDR.unit}</Unit>
\t\t<Isim>${SDR.isim}</Isim>
\t\t<CurrencyName>${SDR.name}</CurrencyName>
\t\t<ForexBuying>${rateText(day)(buying)}</ForexBuying>
\t\t<ForexSelling/>
\t\t<BanknoteBuying/>
\t\t<BanknoteSelling/>
\t\t<CrossRateUSD/>
\t\t<CrossRateOther>${(buying / usd).toFixed(5)}</CrossRateOther>
\t</Currency>`;
}

function ratesXML(day: Day, extraHolidays: Array<string>): string {
  const usd = buyingRate(CURRENCIES[0], day);
  const currencies = [
    ...CURRENCIES.map((currency) => currencyXML(currency, usd, day)),
    sdrXML(usd, day),
  ].join('\n');
  const tarih = `${pad(day.day)}.${pad(day.month)}.${day.year}`;
  const date = `${pad(day.month)}/${pad(day.day)}/${day.year}`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="isokur.xsl"?>
<Tarih_Date Tarih="${tarih}" Date="${date}"  Bulten_No="${day.year}/${bulletinNumber(day, extraHolidays)}" >
${currencies}
</Tarih_Date>
`;
}

const NOT_FOUND_HTML = `<!DOCTYPE html>
<html lang="tr">
<head><meta charset="utf-8"><title>Sayfa Bulunamadı - TCMB</title></head>
<body><h1>404</h1><p>Aradığınız sayfa bulunamadı.</p></body>
</html>
`;

export interface TCMBReply {
  body: string;
  status: number;
}

/** TCMB publishes the day's bulletin at 15:30 Turkish time. */
const PUBLISH_MINUTES = 15 * 60 + 30;

/**
 * The newest bulletin at `now`: today's from 15:30 Turkish time on a bulletin
 * day, else the bulletin day before.
 */
export function latestBulletin(now: Date, extraHolidays: Array<string>): Day {
  const today = istanbulDay(now);
  let day = istanbulMinutes(now) < PUBLISH_MINUTES ? addDays(today, -1) : today;
  while (!isBulletinDay(day, extraHolidays)) {
    day = addDays(day, -1);
  }
  return day;
}

/**
 * Answers a /kurlar/... path. `today.xml` is the latest bulletin; a dated
 * file exists only for a bulletin day from 16 April 1996 up to the latest one,
 * under its own month.
 */
export function tcmbReply(path: string, now: Date, extraHolidays: Array<string>): TCMBReply {
  const latest = latestBulletin(now, extraHolidays);
  if (path === '/kurlar/today.xml') {
    return { body: ratesXML(latest, extraHolidays), status: 200 };
  }
  const match = /^\/kurlar\/(\d{4})(\d{2})\/(\d{2})(\d{2})(\d{4})\.xml$/.exec(path);
  const day = match ? parseGIBDate(`${match[3]}/${match[4]}/${match[5]}`) : null;
  if (
    !match ||
    !day ||
    match[1] !== String(day.year) ||
    Number(match[2]) !== day.month ||
    dayNumber(day) > dayNumber(latest) ||
    dayNumber(day) < dayNumber(FIRST_BULLETIN) ||
    !isBulletinDay(day, extraHolidays)
  ) {
    return { body: NOT_FOUND_HTML, status: 404 };
  }
  return { body: ratesXML(day, extraHolidays), status: 200 };
}
