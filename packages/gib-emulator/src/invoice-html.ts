import type { EmulatorUser } from './config.ts';
import { isoDate, parseGIBDate } from './dates.ts';
import type { StoredInvoice } from './state.ts';

// EARSIV_PORTAL_FATURA_GOSTER's page, modeled on the portal's XSLT output:
// the same table ids (despatchTable, lineTable, budgetContainerTable,
// notesTable) and the same QR markup. The portal inlines qrcode.js in <head>,
// leaves #qrcode empty, puts the QR JSON in the hidden #qrvalue div and draws
// it with makeCode(). Here a stub stands in for qrcode.js, so the code is not
// drawn when the page runs scripts; Angaria strips them and draws it itself.

/** Escapes text content the way innerHTML reads it back: quotes stay as they are. */
const escapeText = (value: unknown) =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');

const escapeHTML = (value: unknown) => escapeText(value).replaceAll('"', '&quot;');

const text = (record: Record<string, unknown>, key: string) => {
  const value = record[key];
  return typeof value === 'string' || typeof value === 'number' ? String(value) : '';
};

const amount = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatter = new Intl.NumberFormat('tr-TR', {
  maximumFractionDigits: 2,
  minimumFractionDigits: 2,
});

const money = (value: unknown, currency: string) =>
  `${formatter.format(amount(value))} ${currency === 'TRY' ? 'TL' : currency}`;

const QR_SCRIPT = `var QRCode = function (element, options) {
  this.element = element;
  this.options = options;
};
QRCode.CorrectLevel = { L: 1, M: 0, Q: 3, H: 2 };
QRCode.prototype.makeCode = function (text) {
  this.element.setAttribute('data-qr', text);
};
var qrcode;
function makeCode(text) {
  qrcode = qrcode || new QRCode(document.getElementById('qrcode'), {
    width: 220,
    height: 220,
    correctLevel: QRCode.CorrectLevel.H
  });
  qrcode.makeCode(text);
}`;

const STYLE = `body { background-color: #ffffff; font-family: Tahoma, 'Times New Roman', Times, serif; font-size: 11px; color: #666666; }
h1, h2 { padding-bottom: 3px; padding-top: 3px; margin-bottom: 5px; text-transform: uppercase; font-family: Arial, Helvetica, sans-serif; }
h1 { font-size: 1.4em; text-transform: none; }
#despatchTable { border-collapse: collapse; font-size: 11px; float: right; border-color: gray; }
#ettnTable { border-collapse: collapse; font-size: 11px; border-color: gray; }
#customerPartyTable { border-width: 0px; border-spacing: ; border-style: inset; border-color: gray; border-collapse: collapse; background-color: }
#lineTable { border-width: 2px; border-spacing: ; border-style: inset; border-color: black; border-collapse: collapse; background-color: ; }
td.lineTableTd { border-width: 1px; padding: 1px; border-style: inset; border-color: gray; background-color: white; }
tr.lineTableTr { border-width: 1px; padding: 0px; border-style: inset; border-color: gray; background-color: white; -moz-border-radius: ; }
#lineTableDummyTd { border-width: 1px; border-color: white; padding: 1px; border-style: inset; border-color: white; background-color: white; }
td.lineTableBudgetTd { border-width: 2px; border-spacing: 0px; padding: 1px; border-style: inset; border-color: gray; background-color: white; -moz-border-radius: ; }
#notesTable { border-width: 2px; border-spacing: ; border-style: inset; border-color: black; border-collapse: collapse; background-color: }
#notesTableTd { border-width: 0px; border-spacing: ; border-style: inset; border-color: black; border-collapse: collapse; background-color: }
table { border-spacing: 0px; }
#budgetContainerTable { border-width: 0px; border-spacing: 0px; border-style: inset; border-color: black; border-collapse: collapse; background-color: ; }
td { border-color: gray; }`;

function partyRows(lines: Array<string>) {
  return lines
    .filter(Boolean)
    .map((line) => `<tr align="left"><td align="left">${line}</td></tr>`)
    .join('\n');
}

export function invoiceHTML(invoice: StoredInvoice, seller: EmulatorUser): string {
  const { payload } = invoice;
  const currency = text(payload, 'paraBirimi') || 'TRY';
  const invoiceType = text(payload, 'faturaTipi') || 'SATIS';
  const items = Array.isArray(payload.malHizmetTable)
    ? (payload.malHizmetTable as Array<Record<string, unknown>>)
    : [];
  const sellerName = seller.unvan || `${seller.ad} ${seller.soyad}`.trim();
  const sellerIDLabel = seller.vknTckn.length === 11 ? 'TCKN' : 'VKN';
  const buyerID = text(payload, 'vknTckn');
  const day = parseGIBDate(text(payload, 'faturaTarihi'));
  const time = text(payload, 'saat').slice(0, 5);

  const vatRates = [...new Set(items.map((item) => text(item, 'kdvOrani') || '0'))];
  const qr: Record<string, string> = {
    avkntckn: buyerID,
    ettn: invoice.ettn,
    malhizmettoplam: text(payload, 'malhizmetToplamTutari'),
    no: invoice.belgeNumarasi,
    odenecek: text(payload, 'odenecekTutar'),
    parabirimi: currency,
    senaryo: 'EARSIVFATURA',
    tarih: day ? isoDate(day) : '',
    tip: invoiceType,
    vergidahil: text(payload, 'vergilerDahilToplamTutar'),
    vkntckn: seller.vknTckn,
  };
  for (const rate of vatRates) {
    const lines = items.filter((item) => (text(item, 'kdvOrani') || '0') === rate);
    qr[`kdvmatrah(${rate})`] = lines
      .reduce((sum, item) => sum + amount(item.malHizmetTutari), 0)
      .toFixed(2);
    qr[`hesaplanankdv(${rate})`] = lines
      .reduce((sum, item) => sum + amount(item.kdvTutari), 0)
      .toFixed(2);
  }

  const lineRows = items
    .map(
      (item, index) => `<tr class="lineTableTr">
<td class="lineTableTd" align="right">&nbsp;${index + 1}</td>
<td class="lineTableTd">&nbsp;${escapeHTML(text(item, 'malHizmet'))}</td>
<td class="lineTableTd" align="right">&nbsp;${escapeHTML(text(item, 'miktar'))} ${escapeHTML(text(item, 'birim') === 'C62' ? 'Adet' : text(item, 'birim'))}</td>
<td class="lineTableTd" align="right">&nbsp;${money(item.birimFiyat, currency)}</td>
<td class="lineTableTd" align="right">&nbsp;%${formatter.format(amount(item.iskontoOrani))}</td>
<td class="lineTableTd" align="right">&nbsp;${money(item.iskontoTutari, currency)}</td>
<td class="lineTableTd" align="right">&nbsp;%${formatter.format(amount(item.kdvOrani))}</td>
<td class="lineTableTd" align="right">&nbsp;${money(item.kdvTutari, currency)}</td>
<td class="lineTableTd" align="right">&nbsp;${money(item.malHizmetTutari, currency)}</td>
</tr>`,
    )
    .join('\n');

  const vatRows = vatRates
    .map(
      (rate) => `<tr align="right"><td></td>
<td class="lineTableBudgetTd" width="200px" align="right"><span style="font-weight:bold;">Hesaplanan KDV(%${escapeHTML(rate)})</span></td>
<td class="lineTableBudgetTd" style="width:82px;" align="right">${money(qr[`hesaplanankdv(${rate})`], currency)}</td></tr>`,
    )
    .join('\n');

  const note = text(payload, 'not');

  return `<html xmlns:fo="http://www.w3.org/1999/XSL/Format" xmlns:n1="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2">
<head>
<script type="text/javascript">${QR_SCRIPT}</script>
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
<title>e-Belge</title>
<style type="text/css">${STYLE}</style>
</head>
<body style="margin-left=0.6in; margin-right=0.6in; margin-top=0.79in; margin-bottom=0.79in">
<table style="border-color:blue;" border="0" cellspacing="0px" width="800" cellpadding="0px">
<tbody>
<tr valign="top">
<td width="40%"><br /><hr />
<table align="center" border="0" width="100%"><tbody>
${partyRows([
  `<span style="font-weight:bold;">${escapeHTML(sellerName)}</span>`,
  escapeHTML(seller.cadde),
  escapeHTML([seller.ilce, seller.il].filter(Boolean).join(' / ')),
  seller.ePostaAdresi ? `E-Posta: ${escapeHTML(seller.ePostaAdresi)}` : '',
  `Vergi Dairesi: ${escapeHTML(seller.vergiDairesi)}`,
  `${sellerIDLabel}: ${escapeHTML(seller.vknTckn)}`,
])}
</tbody></table><hr /></td>
<td width="20%" align="center" valign="middle"><br /><br /><h1 align="center"><span style="font-weight:bold;">e-Arşiv Fatura</span></h1></td>
<td width="40%" colspan="2" valign="top"><br /><br /><br />
<div id="qrcode" align="right"></div>
<div id="qrvalue" style="visibility: hidden; height: 0px; width: 0px;">${escapeText(JSON.stringify(qr))}</div>
<script type="text/javascript">makeCode(document.getElementById("qrvalue").innerHTML);</script>
</td>
</tr>
<tr style="height:118px;" valign="top">
<td width="40%" align="right" valign="bottom">
<table id="customerPartyTable" align="left" border="0"><tbody><tr style="height:71px;"><td><hr />
<table align="center" border="0"><tbody>
<tr><td style="width:469px;" align="left"><span style="font-weight:bold;">SAYIN</span></td></tr>
${partyRows([
  escapeHTML(invoice.aliciUnvanAdSoyad),
  escapeHTML(text(payload, 'bulvarcaddesokak')),
  escapeHTML(
    [text(payload, 'mahalleSemtIlce'), text(payload, 'sehir').trim(), text(payload, 'ulke')]
      .filter(Boolean)
      .join(' / '),
  ),
  text(payload, 'vergiDairesi')
    ? `Vergi Dairesi: ${escapeHTML(text(payload, 'vergiDairesi'))}`
    : '',
  `${buyerID.length === 11 ? 'TCKN' : 'VKN'}: ${escapeHTML(buyerID)}`,
])}
</tbody></table><hr /></td></tr></tbody></table><br /></td>
<td width="60%" align="center" valign="bottom" colspan="2">
<table border="1" height="13" id="despatchTable"><tbody>
<tr><td style="width:105px;" align="left"><span style="font-weight:bold;">Özelleştirme No:</span></td><td style="width:110px;" align="left">TR1.2</td></tr>
<tr style="height:13px;"><td align="left"><span style="font-weight:bold;">Senaryo:</span></td><td align="left">EARSIVFATURA</td></tr>
<tr style="height:13px;"><td align="left"><span style="font-weight:bold;">Fatura Tipi:</span></td><td align="left">${escapeHTML(invoiceType)}</td></tr>
<tr style="height:13px;"><td align="left"><span style="font-weight:bold;">Fatura No:</span></td><td align="left">${escapeHTML(invoice.belgeNumarasi)}</td></tr>
<tr style="height:13px;"><td align="left"><span style="font-weight:bold;">Fatura Tarihi:</span></td><td align="left">${escapeHTML(invoice.belgeTarihi)}${time ? ` ${escapeHTML(time)}` : ''}</td></tr>
${currency === 'TRY' ? '' : `<tr style="height:13px;"><td align="left"><span style="font-weight:bold;">Döviz Kuru:</span></td><td align="left">${escapeHTML(text(payload, 'dovzTLkur'))}</td></tr>`}
</tbody></table></td>
</tr>
<tr align="left"><td align="left" valign="top" id="ettnTable"><span style="font-weight:bold;">ETTN:</span>&nbsp;${escapeHTML(invoice.ettn)}</td></tr>
</tbody>
</table>
<div id="lineTableAligner"><span>&nbsp;</span></div>
<table border="1" id="lineTable" width="800"><tbody>
<tr class="lineTableTr">
<td class="lineTableTd" style="width:3%" align="center"><span style="font-weight:bold;">Sıra No</span></td>
<td class="lineTableTd" style="width:20%" align="center"><span style="font-weight:bold;">Mal Hizmet</span></td>
<td class="lineTableTd" style="width:7.4%" align="center"><span style="font-weight:bold;">Miktar</span></td>
<td class="lineTableTd" style="width:9%" align="center"><span style="font-weight:bold;">Birim Fiyat</span></td>
<td class="lineTableTd" style="width:7%" align="center"><span style="font-weight:bold;">İskonto Oranı</span></td>
<td class="lineTableTd" style="width:9%" align="center"><span style="font-weight:bold;">İskonto Tutarı</span></td>
<td class="lineTableTd" style="width:7%" align="center"><span style="font-weight:bold;">KDV Oranı</span></td>
<td class="lineTableTd" style="width:10%" align="center"><span style="font-weight:bold;">KDV Tutarı</span></td>
<td class="lineTableTd" style="width:10.6%" align="center"><span style="font-weight:bold;">Mal Hizmet Tutarı</span></td>
</tr>
${lineRows}
</tbody></table>
<table id="budgetContainerTable" width="800px"><tbody>
<tr align="right"><td></td>
<td class="lineTableBudgetTd" width="200px" align="right"><span style="font-weight:bold;">Mal Hizmet Toplam Tutarı</span></td>
<td class="lineTableBudgetTd" style="width:82px;" align="right">${money(payload.malhizmetToplamTutari, currency)}</td></tr>
<tr align="right"><td></td>
<td class="lineTableBudgetTd" width="200px" align="right"><span style="font-weight:bold;">Toplam İskonto</span></td>
<td class="lineTableBudgetTd" style="width:82px;" align="right">${money(payload.toplamIskonto, currency)}</td></tr>
${vatRows}
<tr align="right"><td></td>
<td class="lineTableBudgetTd" width="200px" align="right"><span style="font-weight:bold;">Vergiler Dahil Toplam Tutar</span></td>
<td class="lineTableBudgetTd" style="width:82px;" align="right">${money(payload.vergilerDahilToplamTutar, currency)}</td></tr>
<tr align="right"><td></td>
<td class="lineTableBudgetTd" width="200px" align="right"><span style="font-weight:bold;">Ödenecek Tutar</span></td>
<td class="lineTableBudgetTd" style="width:82px;" align="right">${money(payload.odenecekTutar, currency)}</td></tr>
</tbody></table>
<br />
<table id="notesTable" width="800" align="left" height="100"><tbody><tr align="left"><td id="notesTableTd">${note ? `<b>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Not: </b>${escapeHTML(note)}<br />` : ''}</td></tr></tbody></table>
</body>
</html>`;
}
