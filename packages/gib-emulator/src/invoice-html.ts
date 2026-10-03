import type { EmulatorUser } from './config.ts';
import { dashDate, isoDate, parseGIBDate } from './dates.ts';
import type { StoredInvoice } from './state.ts';
import { unitName } from './units.ts';

// EARSIV_PORTAL_FATURA_GOSTER's page as the portal sends it: the output of
// GİB's e-Arşiv XSLT, captured from the test portal on 2026-10-01, with the
// portal's own edits around <body> (a watermark and an unclosed z-index div).
// Elements, attribute order, entities, the 20-row line table and the totals
// follow that output. Three things differ on purpose: a stub stands in for the
// inlined qrcode.js (Angaria strips scripts and draws the QR code itself), an
// SVG drawing stands in for GİB's seal (the portal inlines a JPEG), and the
// font is the condensed face the portal shows rather than the Tahoma the XSLT
// names.

/** HTML 4's names for U+00A0 to U+00FF. */
const LATIN1 =
  'nbsp iexcl cent pound curren yen brvbar sect uml copy ordf laquo not shy reg macr deg plusmn sup2 sup3 acute micro para middot cedil sup1 ordm raquo frac14 frac12 frac34 iquest Agrave Aacute Acirc Atilde Auml Aring AElig Ccedil Egrave Eacute Ecirc Euml Igrave Iacute Icirc Iuml ETH Ntilde Ograve Oacute Ocirc Otilde Ouml times Oslash Ugrave Uacute Ucirc Uuml Yacute THORN szlig agrave aacute acirc atilde auml aring aelig ccedil egrave eacute ecirc euml igrave iacute icirc iuml eth ntilde ograve oacute ocirc otilde ouml divide oslash ugrave uacute ucirc uuml yacute thorn yuml'.split(
    ' ',
  );

const MARKUP: Record<string, string> = { '&': 'amp', '<': 'lt', '>': 'gt' };

/**
 * Text as the portal's HTML serializer writes it: Ö is &Ouml; and ü &uuml;,
 * while ş, ı, ğ and İ (outside Latin-1) stay as they are. Quotes stay too.
 */
const escapeText = (value: unknown) =>
  String(value ?? '').replaceAll(
    /[&<>\u00A0-\u00FF]/g,
    (char) => `&${MARKUP[char] ?? LATIN1[char.charCodeAt(0) - 0xa0]};`,
  );

const text = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
};

const amount = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const decimals = (min: number, max: number) =>
  new Intl.NumberFormat('tr-TR', { maximumFractionDigits: max, minimumFractionDigits: min });

/** The XSLT's format-number pictures, in its 'european' decimal format. */
const formats = {
  /** '###.##0,00': amounts and percentages. */
  amount: decimals(2, 2),
  /** '###.###,####' */
  quantity: decimals(0, 4),
  /** The exchange rate, as TCMB publishes it. */
  rate: decimals(4, 6),
  /** '###.##0,########' */
  unitPrice: decimals(0, 8),
};

const currencyName = (code: string) => (code === 'TRY' || code === 'TRL' ? 'TL' : code);

/** The XSLT's Curr_Type: "1.234,50 TL", "0,00 USD". */
const money = (value: unknown, currency: string) =>
  `${formats.amount.format(amount(value))} ${currencyName(currency)}`;

/** An amount as UBL writes it, the way the QR code carries it: "204000", "120.6". */
const ublNumber = (value: unknown) => String(amount(value));

/** The line table always has this many rows: empty ones fill it up. */
const LINE_ROWS = 20;

/** Stands in for qrcode.js: keeps the text on #qrcode instead of drawing it. */
const QR_LIBRARY = `
var QRCode = function (element, options) {
  this.element = element;
  this.options = options;
};
QRCode.CorrectLevel = { L: 1, M: 0, Q: 3, H: 2 };
QRCode.prototype.makeCode = function (text) {
  this.element.setAttribute('data-qr', text);
};
`;

/** The script after #qrvalue, as the XSLT writes it. */
const QR_SCRIPT = `
var qrcode = new QRCode(document.getElementById("qrcode"), {
width : 220,
height : 220,
correctLevel : QRCode.CorrectLevel.H
});

function makeCode (msg) {
var elText = document.getElementById("text");

qrcode.makeCode(msg);
}

makeCode(document.getElementById("qrvalue").innerHTML);
`;

/**
 * Roboto Condensed is the portal's own face, Arial Narrow ships with macOS and
 * Windows; the XSLT's choices follow.
 */
const CONDENSED = `'Roboto Condensed', 'Arial Narrow', 'Liberation Sans Narrow'`;

// The XSLT's stylesheet, broken declarations included (they are GİB's).
const STYLE = `
#mainbody {
    background-color: #FFFFFF;
    font-family: ${CONDENSED}, 'Tahoma', "Times New Roman", Times, serif;
    font-size: 11px;
    color: #666666;
}
#mainbody h1,
#mainbody h2 {
    padding-bottom: 3px;
    padding-top: 3px;
    margin-bottom: 5px;
    text-transform: uppercase;
    font-family: ${CONDENSED}, Arial, Helvetica, sans-serif;
}
#mainbody h1 {
    font-size: 1.4em;
    text-transform: none;
}
#mainbody h2 {
    font-size: 1em;
    color: brown;
}
#mainbody h3 {
    font-size: 1em;
    color: #333333;
    text-align: justify;
    margin: 0;
    padding: 0;
}
#mainbody h4 {
    font-size: 1.1em;
    font-style: bold;
    font-family: ${CONDENSED}, Arial, Helvetica, sans-serif;
    color: #000000;
    margin: 0;
    padding: 0;
}
#mainbody hr {
    height: 2px;
    color: #000000;
    background-color: #000000;
    border-bottom: 1px solid #000000;
}
#mainbody p,
#mainbody ul,
#mainbody ol {
    margin-top: 1.5em;
}
#mainbody ul,
#mainbody ol {
    margin-left: 3em;
}
#mainbody blockquote {
    margin-left: 3em;
    margin-right: 3em;
    font-style: italic;
}
#mainbody a {
    text-decoration: none;
    color: #70A300;
}
#mainbody a:hover {
    border: none;
    color: #70A300;
}
#despatchTable {
    border-collapse: collapse;
    font-size: 11px;
    float: right;
    border-color: gray;
}
#ettnTable {
    border-collapse: collapse;
    font-size: 11px;
    border-color: gray;
}
#customerPartyTable {
    border-width: 0px;
    border-spacing: ;
    border-style: inset;
    border-color: gray;
    border-collapse: collapse;
    background-color:
    }
#customerIDTable {
    border-width: 2px;
    border-spacing: ;
    border-style: inset;
    border-color: gray;
    border-collapse: collapse;
    background-color:
    }
#customerIDTableTd {
    border-width: 2px;
    border-spacing: ;
    border-style: inset;
    border-color: gray;
    border-collapse: collapse;
    background-color:
    }
#lineTable {
    border-width: 2px;
    border-spacing: ;
    border-style: inset;
    border-color: black;
    border-collapse: collapse;
    background-color: ;
}
#mainbody td.lineTableTd {
    border-width: 1px;
    padding: 1px;
    border-style: inset;
    border-color: black;
    background-color: white;
}
#mainbody tr.lineTableTr {
    border-width: 1px;
    padding: 0px;
    border-style: inset;
    border-color: black;
    background-color: white;
    -moz-border-radius: ;
}
#lineTableDummyTd {
    border-width: 1px;
    border-color: white;
    padding: 1px;
    border-style: inset;
    border-color: black;
    background-color: white;
}
#mainbody td.lineTableBudgetTd {
    border-width: 2px;
    border-spacing: 0px;
    padding: 1px;
    border-style: inset;
    border-color: black;
    background-color: white;
    -moz-border-radius: ;
}
#notesTable {
    border-width: 2px;
    border-spacing: ;
    border-style: inset;
    border-color: black;
    border-collapse: collapse;
    background-color:
    }
#notesTableTd {
    border-width: 0px;
    border-spacing: ;
    border-style: inset;
    border-color: black;
    border-collapse: collapse;
    background-color:
    }
#mainbody table {
    border-spacing: 0px;
}
#budgetContainerTable {
    border-width: 0px;
    border-spacing: 0px;
    border-style: inset;
    border-color: black;
    border-collapse: collapse;
    background-color: ;
}
#mainbody td {
    border-color: gray;
}`;

/**
 * GİB's seal (T.C. Hazine ve Maliye Bakanlığı, Gelir İdaresi Başkanlığı), drawn
 * for the emulator. The real portal inlines its own JPEG of it.
 */
const SEAL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><path id="t" d="M16,70A38,38 0 1 1 84,70"/><path id="b" d="M12,58A39,39 0 0 0 88,58"/></defs><circle cx="50" cy="50" r="48" fill="#fff" stroke="#1b3f94" stroke-width="2.4"/><g font-family="Arial,Helvetica,sans-serif" font-weight="bold"><text fill="#1b3f94" font-size="9"><textPath href="#t" startOffset="50%" text-anchor="middle">T.C. Hazine ve Maliye Bakanlığı</textPath></text><text fill="#e3262d" font-size="8" dominant-baseline="hanging"><textPath href="#b" startOffset="50%" text-anchor="middle">Gelir İdaresi Başkanlığı</textPath></text></g><g fill="#e3262d"><path d="M56,21C38,21 27,35 27,52C27,65 33,74 42,77L45,68C40,66 38,60 38,53C38,41 45,31 56,30Z"/><circle cx="63" cy="33" r="6.5"/><path d="M55,43H67L61,74H49Z"/></g></svg>`;

const SEAL = `data:image/svg+xml;base64,${Buffer.from(SEAL_SVG).toString('base64')}`;

/** The portal's watermark: the test portal writes İMZASIZ TEST BELGESİ the same way. */
const watermark = (label: string) =>
  `<div style='position:absolute;z-index:1'><p style='font-size:100px;transform:rotate(310deg);-webkit-transform:rotate(310deg);color:lightcoral'>${escapeText(label)}</p></div>`;

const bold = (label: string) => `<span style="font-weight:bold; ">${escapeText(label)}</span>`;

/** The seller's block, from the portal profile (EARSIV_PORTAL_KULLANICI_BILGILERI_GETIR). */
function sellerParty(seller: EmulatorUser) {
  const name = seller.unvan
    ? `${escapeText(seller.unvan)}<br>`
    : `${escapeText(seller.ad)}&nbsp;${escapeText(seller.soyad)}&nbsp;`;
  const scheme = seller.vknTckn.length === 11 ? 'TCKN' : 'VKN';
  return [
    `<tr align="left"><td align="left">${name}</td></tr>`,
    `<tr align="left"><td align="left">${escapeText(seller.cadde)}&nbsp; Kapı No:&nbsp;<br>&nbsp;${escapeText(seller.ilce)}/ ${escapeText(seller.il)}&nbsp;/ ${escapeText('Türkiye')}&nbsp;</td></tr>`,
    `<tr align="left"><td align="left">Tel: ${escapeText(seller.telefon)} Fax: &nbsp;</td></tr>`,
    '<tr align="left"><td>Web Sitesi: </td></tr>',
    `<tr align="left"><td>E-Posta: ${escapeText(seller.ePostaAdresi)}</td></tr>`,
    `<tr align="left"><td align="left">Vergi Dairesi: ${escapeText(seller.vergiDairesi)}&nbsp; </td></tr>`,
    `<tr align="left"><td>${scheme}: ${escapeText(seller.vknTckn)}</td></tr>`,
  ].join('');
}

const partyCell = (content: string) => `<td align="left" style="width:469px; ">${content}</td>`;

/** The buyer's block (the XSLT's Party_Title, Party_Adress and Party_Other). */
function buyerParty(payload: Record<string, unknown>) {
  const field = (key: string) => escapeText(text(payload, key));
  const title = text(payload, 'aliciUnvan') ? `${field('aliciUnvan')}<br>` : '';
  const person =
    text(payload, 'aliciAdi') || text(payload, 'aliciSoyadi')
      ? `${field('aliciAdi')}&nbsp;${field('aliciSoyadi')}&nbsp;`
      : '';
  const region = text(payload, 'kasabaKoy') ? `${field('kasabaKoy')}&nbsp;` : '';
  const address =
    `${region}${field('bulvarcaddesokak')}&nbsp;${field('binaAdi')} No:${field('binaNo')}&nbsp;<br>` +
    `Kapı No:${field('kapiNo')}&nbsp;<br>` +
    `${field('postaKodu')}&nbsp;${field('mahalleSemtIlce')}/ ${field('sehir')}&nbsp;${field('ulke')}&nbsp;`;
  const id = text(payload, 'vknTckn');
  return [
    `<tr>${partyCell(bold('SAYIN'))}</tr>`,
    `<tr>${partyCell(`${title}${person}`)}</tr>`,
    `<tr>${partyCell(address)}</tr>`,
    `<tr align="left"><td>Web Sitesi: ${field('websitesi')}</td></tr>`,
    `<tr align="left"><td>E-Posta: ${field('eposta')}</td></tr>`,
    `<tr align="left">${partyCell(`Tel: ${field('tel')} Fax: ${field('fax')}&nbsp;`)}</tr>`,
    text(payload, 'vergiDairesi')
      ? `<tr align="left"><td>Vergi Dairesi: ${field('vergiDairesi')}</td></tr>`
      : '',
    `<tr align="left"><td>${id.length === 11 ? 'TCKN' : 'VKN'}: ${escapeText(id)}</td></tr>`,
  ].join('');
}

function despatchRows(invoice: StoredInvoice, invoiceType: string) {
  const { payload } = invoice;
  const row = (label: string, value: string) =>
    `<tr style="height:13px; "><td align="left">${bold(label)}</td><td align="left">${value}</td></tr>`;
  const time = text(payload, 'saat').slice(0, 5);
  const despatchNumber = text(payload, 'irsaliyeNumarasi');
  const despatchDay = parseGIBDate(text(payload, 'irsaliyeTarihi'));
  const orderNumber = text(payload, 'siparisNumarasi');
  return [
    `<tr><td align="left" style="width:105px;">${bold('Özelleştirme No:')}</td><td align="left" style="width:110px;">TR1.2</td></tr>`,
    row('Senaryo:', 'EARSIVFATURA'),
    row('Fatura Tipi:', escapeText(invoiceType)),
    row('Fatura No:', escapeText(invoice.belgeNumarasi)),
    row('Fatura Tarihi:', `${escapeText(invoice.belgeTarihi)}&nbsp;${escapeText(time)}`),
    despatchNumber
      ? `<tr style="height:13px; "><td align="left">${bold('İrsaliye No:')}&nbsp;</td><td align="left">${escapeText(despatchNumber)}</td></tr>` +
        row('İrsaliye Tarihi:', despatchDay ? dashDate(despatchDay) : '')
      : '',
    orderNumber
      ? `<tr style="height:13px"><td align="left">${bold('Sipariş No:')}</td><td align="left">${escapeText(orderNumber)}</td></tr>`
      : '',
  ].join('');
}

const COLUMNS: Array<[string, string]> = [
  ['3%', 'Sıra No'],
  ['20%', 'Mal Hizmet'],
  ['7.4%', 'Miktar'],
  ['9%', 'Birim Fiyat'],
  ['7%', 'İskonto/ Arttırım Oranı'],
  ['9%', 'İskonto/ Arttırım Tutarı'],
  ['9%', 'İskonto/ Arttırım Nedeni'],
  ['7%', 'KDV Oranı'],
  ['10%', 'KDV Tutarı'],
  ['17%; ', 'Diğer Vergiler'],
  ['10.6%', 'Mal Hizmet Tutarı'],
];

const leftCell = (content: string) => `<td class="lineTableTd">&nbsp;${content}</td>`;
const rightCell = (content: string) =>
  `<td align="right" class="lineTableTd">&nbsp;${content}</td>`;

/** İstisna invoices get a GTİP column. */
const GTIP_COLUMN: [string, string] = ['10.6%', 'GTİP'];

function lineTable(items: Array<Record<string, unknown>>, currency: string, istisna: boolean) {
  const columns = istisna ? [...COLUMNS, GTIP_COLUMN] : COLUMNS;
  const header = columns
    .map(
      ([width, label]) =>
        `<td align="center" style="width:${width}" class="lineTableTd"><span style="font-weight:bold;">${escapeText(label)}</span></td>`,
    )
    .join('');
  const lines = items.map((item, index) => {
    const kind = text(item, 'iskontoArttm') === 'Arttırım' ? 'Arttırım' : 'İskonto';
    const gtip = text(item, 'gtip');
    return [
      '<tr class="lineTableTr">',
      leftCell(String(index + 1)),
      leftCell(escapeText(text(item, 'malHizmet'))),
      rightCell(
        `${formats.quantity.format(amount(item.miktar))} ${escapeText(unitName(text(item, 'birim')))}`,
      ),
      rightCell(`${formats.unitPrice.format(amount(item.birimFiyat))} ${currencyName(currency)}`),
      rightCell(` %${formats.amount.format(amount(item.iskontoOrani))}`),
      rightCell(money(item.iskontoTutari, currency)),
      rightCell(`${escapeText(kind)} - ${escapeText(text(item, 'iskontoNedeni'))}`),
      rightCell(`  %${formats.amount.format(amount(item.kdvOrani))}`),
      rightCell(` ${money(item.kdvTutari, currency)}`),
      '<td align="right" style="font-size: xx-small" class="lineTableTd">&nbsp;</td>',
      rightCell(money(item.malHizmetTutari, currency)),
      istisna ? rightCell(gtip ? `&nbsp;${escapeText(gtip)}` : '') : '',
      '</tr>',
    ].join('');
  });
  const empty = `<tr class="lineTableTr">${leftCell('')}${leftCell('')}${rightCell('').repeat(columns.length - 2)}</tr>`;
  const filler = Array.from({ length: Math.max(0, LINE_ROWS - items.length) }, () => empty);
  return `<table width="800" id="lineTable" border="1"><tbody><tr class="lineTableTr">${header}</tr>${[...lines, ...filler].join('')}</tbody></table>`;
}

interface VatGroup {
  base: number;
  rate: string;
  vat: number;
}

/** One group per VAT rate, in the order the lines first use it (UBL's TaxSubtotal). */
function vatGroups(items: Array<Record<string, unknown>>): Array<VatGroup> {
  const groups = new Map<string, VatGroup>();
  for (const item of items) {
    const rate = text(item, 'kdvOrani') || '0';
    const group = groups.get(rate) ?? { base: 0, rate, vat: 0 };
    group.base += amount(item.malHizmetTutari);
    group.vat += amount(item.kdvTutari);
    groups.set(rate, group);
  }
  return [...groups.values()];
}

/** The XSLT opens the totals' label cells in two attribute orders and their value cells in two widths. */
const BUDGET_CELLS = {
  first: '<td width="200px" align="right" class="lineTableBudgetTd">',
  later: '<td align="right" width="200px" class="lineTableBudgetTd">',
  narrow: '<td align="right" style="width:81px; " class="lineTableBudgetTd">',
  wide: '<td align="right" style="width:82px; " class="lineTableBudgetTd">',
};

const budgetRow = (label: string, value: string, labelCell: string, valueCell: string) =>
  `<tr align="right"><td></td>${labelCell}${bold(label)}</td>${valueCell}${value}</td></tr>`;

function budgetTable(payload: Record<string, unknown>, currency: string, groups: Array<VatGroup>) {
  const { first, later, narrow, wide } = BUDGET_CELLS;
  const rows = [
    budgetRow(
      'Mal Hizmet Toplam Tutarı',
      money(payload.malhizmetToplamTutari, currency),
      first,
      narrow,
    ),
    budgetRow('Toplam İskonto', money(payload.toplamIskonto, currency), first, narrow),
    ...groups.map(
      ({ rate, vat }) =>
        `<tr align="right"><td></td><td align="right" width="211px" class="lineTableBudgetTd"><span style="font-weight:bold;">Hesaplanan KDV(%${escapeText(rate)})</span></td><td align="right" style="width:82px;" class="lineTableBudgetTd"> ${money(vat, currency)}</td></tr>`,
    ),
    budgetRow(
      'Vergiler Dahil Toplam Tutar',
      money(payload.vergilerDahilToplamTutar, currency),
      later,
      wide,
    ),
    budgetRow('Ödenecek Tutar', money(payload.odenecekTutar, currency), later, wide),
  ];
  if (currencyName(currency) !== 'TL') {
    // In lira at the invoice's rate, after the rate itself.
    const rate = amount(payload.dovzTLkur);
    const lira = (value: unknown) => money(amount(value) * rate, 'TRY');
    rows.push(
      budgetRow('Döviz Kuru', formats.rate.format(rate), later, wide),
      ...groups.map(({ rate: vatRate, vat }) =>
        budgetRow(`Hesaplanan KDV(%${vatRate}) (TL)`, `<span>${lira(vat)}</span>`, first, narrow),
      ),
      budgetRow('Mal Hizmet Toplam Tutarı(TL)', lira(payload.malhizmetToplamTutari), first, narrow),
      budgetRow(
        'Vergiler Dahil Toplam Tutar(TL)',
        lira(payload.vergilerDahilToplamTutar),
        later,
        wide,
      ),
      budgetRow('Ödenecek Tutar(TL)', lira(payload.odenecekTutar), later, wide),
    );
  }
  return `<table width="800px" table-layout="fixed" id="budgetContainerTable"><tbody><tr><td valign="top" align="right"><table><tbody>${rows.join('')}</tbody></table></td></tr></tbody></table>`;
}

function notesTable(note: string) {
  const content = note ? `<b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; Not: </b>${escapeText(note)}<br>` : '';
  return `<table align="left" width="800" id="notesTable"><tbody><tr align="left"><td height="100" id="notesTableTd">${content}</td></tr></tbody></table>`;
}

/** The QR code's text: the XSLT's JSON, with its trailing space after the buyer's ID. */
function qrValue(
  invoice: StoredInvoice,
  seller: EmulatorUser,
  invoiceType: string,
  currency: string,
  groups: Array<VatGroup>,
) {
  const { payload } = invoice;
  const day = parseGIBDate(text(payload, 'faturaTarihi'));
  const fields: Array<[string, string]> = [
    ['vkntckn', seller.vknTckn],
    ['avkntckn', `${text(payload, 'vknTckn')} `],
    ['senaryo', 'EARSIVFATURA'],
    ['tip', invoiceType],
    ['tarih', day ? isoDate(day) : ''],
    ['no', invoice.belgeNumarasi],
    ['ettn', invoice.ettn],
    ['parabirimi', currency],
    ['malhizmettoplam', ublNumber(payload.malhizmetToplamTutari)],
    ...groups.map(({ base, rate }): [string, string] => [`kdvmatrah(${rate})`, ublNumber(base)]),
    ...groups.map(({ rate, vat }): [string, string] => [`hesaplanankdv(${rate})`, ublNumber(vat)]),
    ['vergidahil', ublNumber(payload.vergilerDahilToplamTutar)],
    ['odenecek', ublNumber(payload.odenecekTutar)],
  ];
  return ` {${fields.map(([key, value]) => `"${key}":"${value}"`).join(', ')}}`;
}

export function invoiceHTML(invoice: StoredInvoice, seller: EmulatorUser): string {
  const { payload } = invoice;
  const currency = text(payload, 'paraBirimi') || 'TRY';
  const invoiceType = text(payload, 'faturaTipi') || 'SATIS';
  const items = Array.isArray(payload.malHizmetTable)
    ? (payload.malHizmetTable as Array<Record<string, unknown>>)
    : [];
  const groups = vatGroups(items);

  const header = [
    '<table cellpadding="0px" width="800" cellspacing="0px" border="0" style="border-color:blue; "><tbody>',
    '<tr valign="top"><td width="40%"><br><hr><table width="100%" border="0" align="center"><tbody>',
    sellerParty(seller),
    '</tbody></table><hr></td>',
    `<td valign="middle" align="center" width="20%"><br><br><img src="${SEAL}" alt="E-Fatura Logo" align="middle" style="width:91px;"><h1 align="center">${bold('e-Arşiv Fatura')}</h1></td>`,
    '<td width="5%"></td>',
    `<td align="right"><div id="qrcode"></div><div style="visibility: hidden; height: 20px;width: 20px; ; display:none" id="qrvalue">${escapeText(qrValue(invoice, seller, invoiceType, currency, groups))}</div><script type="text/javascript">${QR_SCRIPT}</script></td></tr>`,
    '<tr valign="top" style="height:118px; "><td valign="bottom" align="right" width="40%"><table border="0" align="left" id="customerPartyTable"><tbody><tr style="height:71px; "><td><hr><table border="0" align="center"><tbody>',
    buyerParty(payload),
    '</tbody></table><hr></td></tr></tbody></table><br></td>',
    '<td align="right" width="20%"></td>',
    `<td colspan="2" valign="bottom" align="center" width="40%"><table id="despatchTable" border="1"><tbody>${despatchRows(invoice, invoiceType)}</tbody></table></td></tr>`,
    `<tr align="left"><td id="ettnTable" valign="top" align="left"><span style="font-weight:bold; ">ETTN:&nbsp;</span>${escapeText(invoice.ettn)}</td></tr>`,
    '<tr><td><br></td></tr></tbody></table>',
  ].join('');

  return [
    '<!DOCTYPE html PUBLIC "-//W3C//DTD HTML 4.01 Transitional//EN" "http://www.w3.org/TR/html4/loose.dtd">\n',
    `<html><head><META http-equiv="Content-Type" content="text/html; charset=UTF-8"><script type="text/javascript">${QR_LIBRARY}</script>`,
    `<style type="text/css">${STYLE}</style><title>e-Belge</title></head>`,
    '<body id=mainbody style=margin-left=0.6in; margin-right=0.6in; margin-top=0.79in; margin-bottom=0.79in>',
    invoice.cancellation === 'accepted' ? watermark('İPTAL EDİLMİŞ') : '',
    "<div style='z-index:1'>",
    header,
    '<div id="lineTableAligner"><span>&nbsp;</span></div>',
    lineTable(items, currency, invoiceType === 'ISTISNA'),
    budgetTable(payload, currency, groups),
    '<br><br>',
    notesTable(text(payload, 'not')),
    "<div style='z-index:1'></html>",
  ].join('');
}
