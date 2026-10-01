import {
  addDays,
  type Day,
  dayNumber,
  istanbulDay,
  pad,
  parseGIBDate,
  slashDate,
  weekday,
} from './dates.ts';

// TCMB's daily indicative rates, as https://www.tcmb.gov.tr/kurlar/{yyyyMM}/{ddMMyyyy}.xml
// serves them. Rates are deterministic: the same day always gives the same
// file. Weekends, public holidays and days after today answer 404 with an
// HTML page, like TCMB, so clients have to walk back to the last bulletin.

interface CurrencyInfo {
  base: number;
  code: string;
  /** Quoted as US dollars per unit (CrossRateOther) instead of units per US dollar. */
  crossOther?: boolean;
  isim: string;
  name: string;
  unit: number;
}

const CURRENCIES: Array<CurrencyInfo> = [
  { base: 41.2, code: 'USD', isim: 'ABD DOLARI', name: 'US DOLLAR', unit: 1 },
  {
    base: 27.1,
    code: 'AUD',
    crossOther: true,
    isim: 'AVUSTRALYA DOLARI',
    name: 'AUSTRALIAN DOLLAR',
    unit: 1,
  },
  { base: 6.45, code: 'DKK', isim: 'DANİMARKA KRONU', name: 'DANISH KRONE', unit: 1 },
  { base: 48.1, code: 'EUR', crossOther: true, isim: 'EURO', name: 'EURO', unit: 1 },
  {
    base: 55.4,
    code: 'GBP',
    crossOther: true,
    isim: 'İNGİLİZ STERLİNİ',
    name: 'POUND STERLING',
    unit: 1,
  },
  { base: 51.6, code: 'CHF', isim: 'İSVİÇRE FRANGI', name: 'SWISS FRANK', unit: 1 },
  { base: 4.38, code: 'SEK', isim: 'İSVEÇ KRONU', name: 'SWEDISH KRONA', unit: 1 },
  { base: 29.7, code: 'CAD', isim: 'KANADA DOLARI', name: 'CANADIAN DOLLAR', unit: 1 },
  { base: 134.9, code: 'KWD', isim: 'KUVEYT DİNARI', name: 'KUWAITI DINAR', unit: 1 },
  { base: 4.12, code: 'NOK', isim: 'NORVEÇ KRONU', name: 'NORWEGIAN KRONE', unit: 1 },
  { base: 10.98, code: 'SAR', isim: 'SUUDİ ARABİSTAN RİYALİ', name: 'SAUDI RIYAL', unit: 1 },
  { base: 27.6, code: 'JPY', isim: 'JAPON YENİ', name: 'JAPENESE YEN', unit: 100 },
  { base: 24.6, code: 'BGN', isim: 'BULGAR LEVASI', name: 'BULGARIAN LEV', unit: 1 },
  { base: 9.47, code: 'RON', isim: 'RUMEN LEYİ', name: 'NEW LEU', unit: 1 },
  { base: 0.49, code: 'RUB', isim: 'RUS RUBLESİ', name: 'RUSSIAN ROUBLE', unit: 1 },
  { base: 5.78, code: 'CNY', isim: 'ÇİN YUANI', name: 'CHINESE RENMINBI', unit: 1 },
  { base: 11.3, code: 'QAR', isim: 'KATAR RİYALİ', name: 'QATARI RIAL', unit: 1 },
  {
    base: 24.2,
    code: 'AZN',
    isim: 'AZERBAYCAN YENİ MANATI',
    name: 'AZERBAIJANI NEW MANAT',
    unit: 1,
  },
  {
    base: 11.2,
    code: 'AED',
    isim: 'BİRLEŞİK ARAP EMİRLİKLERİ DİRHEMİ',
    name: 'UNITED ARAB EMIRATES DIRHAM',
    unit: 1,
  },
];

/** Fixed public holidays as MM-dd. */
const FIXED_HOLIDAYS = new Set(['01-01', '04-23', '05-01', '05-19', '07-15', '08-30', '10-29']);

/** Ramazan and Kurban Bayramı days (dd/MM/yyyy); extend through `tcmbHolidays`. */
const RELIGIOUS_HOLIDAYS = new Set([
  '30/03/2025',
  '31/03/2025',
  '01/04/2025',
  '06/06/2025',
  '07/06/2025',
  '08/06/2025',
  '09/06/2025',
  '20/03/2026',
  '21/03/2026',
  '22/03/2026',
  '27/05/2026',
  '28/05/2026',
  '29/05/2026',
  '30/05/2026',
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

/** Forex buying rate for one unit group (`unit` units) on `day`. */
function buyingRate(currency: CurrencyInfo, day: Day) {
  const days = dayNumber(day) - dayNumber({ day: 1, month: 1, year: 2026 });
  const drift = 1 + 0.00035 * days + 0.004 * Math.sin(days * 0.7 + (hash(currency.code) % 100));
  return currency.base * drift;
}

const fixed = (value: number) => value.toFixed(4);

const element = (name: string, value: string) =>
  value ? `<${name}>${value}</${name}>` : `<${name}/>`;

function ratesXML(day: Day, extraHolidays: Array<string>): string {
  const usd = buyingRate(CURRENCIES[0], day);
  const currencies = CURRENCIES.map((currency, index) => {
    const buying = buyingRate(currency, day);
    const perUnit = buying / currency.unit;
    const crossUSD = currency.code === 'USD' || currency.crossOther ? '' : fixed(usd / perUnit);
    const crossOther = currency.crossOther ? fixed(perUnit / usd) : '';
    return `\t<Currency CrossOrder="${index}" Kod="${currency.code}" CurrencyCode="${currency.code}">
\t\t\t<Unit>${currency.unit}</Unit>
\t\t\t<Isim>${currency.isim}</Isim>
\t\t\t<CurrencyName>${currency.name}</CurrencyName>
\t\t\t<ForexBuying>${fixed(buying)}</ForexBuying>
\t\t\t<ForexSelling>${fixed(buying * 1.0018)}</ForexSelling>
\t\t\t<BanknoteBuying>${fixed(buying * 0.9993)}</BanknoteBuying>
\t\t\t<BanknoteSelling>${fixed(buying * 1.0026)}</BanknoteSelling>
\t\t\t\t${element('CrossRateUSD', crossUSD)}
\t\t\t\t${element('CrossRateOther', crossOther)}
\t</Currency>`;
  }).join('\n');
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

/**
 * Answers a /kurlar/... path. `today.xml` is the latest bulletin; a dated
 * file exists only for a bulletin day up to today, under its own month.
 */
export function tcmbReply(path: string, now: Date, extraHolidays: Array<string>): TCMBReply {
  const today = istanbulDay(now);
  if (path === '/kurlar/today.xml') {
    let day = today;
    while (!isBulletinDay(day, extraHolidays)) {
      day = addDays(day, -1);
    }
    return { body: ratesXML(day, extraHolidays), status: 200 };
  }
  const match = /^\/kurlar\/(\d{4})(\d{2})\/(\d{2})(\d{2})(\d{4})\.xml$/.exec(path);
  const day = match ? parseGIBDate(`${match[3]}/${match[4]}/${match[5]}`) : null;
  if (
    !match ||
    !day ||
    match[1] !== String(day.year) ||
    Number(match[2]) !== day.month ||
    dayNumber(day) > dayNumber(today) ||
    !isBulletinDay(day, extraHolidays)
  ) {
    return { body: NOT_FOUND_HTML, status: 404 };
  }
  return { body: ratesXML(day, extraHolidays), status: 200 };
}
