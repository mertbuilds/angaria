import { renderSVG } from 'uqr';
import { describe, expect, test } from 'vitest';
import { readQRValue, withQRCode } from '../src/lib/invoice-preview.ts';

// The shape of GİB's preview: the QR script library in <head>, an empty
// #qrcode target, the JSON in a hidden #qrvalue div, then the drawing script.
const gibPreview = (value: string) => `<html><head><script type="text/javascript">
var QRCode;!function(){}();</script><title>e-Belge</title></head><body>
<td align="right"><div id="qrcode"></div><div style="visibility: hidden; height: 20px;width: 20px; ; display:none" id="qrvalue">${value}</div><script type="text/javascript">
makeCode(document.getElementById("qrvalue").innerHTML);
</script></td></body></html>`;

const qrImage = (html: string) => {
  const match =
    /<div id="qrcode"><img alt="Karekod" height="220" width="220" src="data:image\/svg\+xml;base64,([^"]+)"><\/div>/.exec(
      html,
    );
  return match ? atob(match[1]) : null;
};

describe('withQRCode', () => {
  test('draws the #qrvalue JSON into #qrcode and drops the scripts', () => {
    const value = ` {"vkntckn":"3333333301", "avkntckn":"11111111111 ", "senaryo":"EARSIVFATURA",
\t\t"tip":"SATIS", "tarih":"2026-09-25", "no":"GIB2026000002033",
\t\t"ettn":"13cc1102-6e3e-45de-bcd8-4ffc9e7075f3", "parabirimi":"TRY", "odenecek":"306000"}`;

    const html = withQRCode(gibPreview(value));

    expect(qrImage(html)).toBe(renderSVG(value, { border: 0, ecc: 'H' }));
    expect(html).not.toContain('<script');
    expect(html).toContain('id="qrvalue"');
  });

  test('encodes the text, not its HTML entities', () => {
    const html = withQRCode(gibPreview('{"unvan":"A &amp; B &#304;n&#x015F;aat"}'));
    expect(qrImage(html)).toBe(renderSVG('{"unvan":"A & B İnşaat"}', { border: 0, ecc: 'H' }));
  });

  test('leaves HTML without a QR value as it was, minus scripts', () => {
    expect(withQRCode('<p>Fatura</p><script>alert(1)</script>')).toBe('<p>Fatura</p>');
    expect(withQRCode(gibPreview(' '))).not.toContain('<img');
  });
});

describe('readQRValue', () => {
  test('reads the #qrvalue text with its entities decoded', () => {
    expect(readQRValue(gibPreview('{"unvan":"A &amp; B &#304;n&#x015F;aat"}'))).toBe(
      '{"unvan":"A & B İnşaat"}',
    );
    expect(readQRValue(withQRCode(gibPreview('{"no":"GIB1"}')))).toBe('{"no":"GIB1"}');
  });

  test('is undefined without a QR value', () => {
    expect(readQRValue('<p>Fatura</p>')).toBeUndefined();
    expect(readQRValue(gibPreview(' \n '))).toBeUndefined();
  });
});
