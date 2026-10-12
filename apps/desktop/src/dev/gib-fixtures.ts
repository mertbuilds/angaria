// Dev only: a stand-in for the GİB e-Arşiv portal, so the invoice screens work
// in a plain browser, where the Tauri http plugin does not. src/lib/angaria.ts
// routes GİB calls here when the dev server runs with VITE_GIB_FIXTURES=1;
// production builds drop it. Answers the calls the SDK makes with sample
// invoices dated relative to today, keeps GİB's seven-day list limit, and
// accepts 123456 as the SMS code. User 00000000 fails to log in, for the error
// states.

interface FixtureInvoice {
  amount: number;
  currency: string;
  daysAgo: number;
  item: string;
  number: number;
  recipient: string;
  status: 'Onaylandı' | 'Onaylanmadı' | 'Silinmiş';
  taxID: string;
  vatRate: number;
}

const SAMPLES: Array<FixtureInvoice> = [
  {
    amount: 4500,
    currency: 'USD',
    daysAgo: 0,
    item: 'Engineering Services - Mühendislik Hizmetleri',
    number: 41,
    recipient: 'Agent Caffeine',
    status: 'Onaylanmadı',
    taxID: '2222222222',
    vatRate: 0,
  },
  {
    amount: 2400,
    currency: 'EUR',
    daysAgo: 1,
    item: 'Beratung',
    number: 40,
    recipient: 'knobs.dev',
    status: 'Onaylandı',
    taxID: '2222222222',
    vatRate: 0,
  },
  {
    amount: 30_000,
    currency: 'TRY',
    daysAgo: 16,
    item: 'Yazılım Geliştirme Hizmeti',
    number: 39,
    recipient: 'Vinena Studio',
    status: 'Onaylandı',
    taxID: '1234567890',
    vatRate: 20,
  },
  {
    amount: 4500,
    currency: 'USD',
    daysAgo: 29,
    item: 'Engineering Services - Mühendislik Hizmetleri',
    number: 38,
    recipient: 'Agent Caffeine',
    status: 'Onaylandı',
    taxID: '2222222222',
    vatRate: 0,
  },
  {
    amount: 1250,
    currency: 'TRY',
    daysAgo: 33,
    item: 'Danışmanlık Hizmeti',
    number: 37,
    recipient: 'Ahmet Buğra Yiğiter',
    status: 'Silinmiş',
    taxID: '11111111111',
    vatRate: 20,
  },
  {
    amount: 4500,
    currency: 'USD',
    daysAgo: 61,
    item: 'Engineering Services - Mühendislik Hizmetleri',
    number: 36,
    recipient: 'Agent Caffeine',
    status: 'Onaylandı',
    taxID: '2222222222',
    vatRate: 0,
  },
];

const pad = (n: number) => String(n).padStart(2, '0');
const DAY = 24 * 60 * 60 * 1000;

const dateOf = (daysAgo: number) => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);
};
const dashed = (d: Date) => `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
const parse = (gib: string) => {
  const [dd, mm, yyyy] = gib.split(/[/-]/).map(Number);
  return new Date(yyyy, mm - 1, dd);
};

const invoices = SAMPLES.map((sample) => ({
  ...sample,
  date: dateOf(sample.daysAgo),
  ettn: `00000000-0000-4000-8000-${String(sample.number).padStart(12, '0')}`,
}));
type Fixture = (typeof invoices)[number];

const row = (invoice: Fixture) => ({
  aliciUnvanAdSoyad: invoice.recipient,
  aliciVknTckn: invoice.taxID,
  belgeNumarasi: `GIB${invoice.date.getFullYear()}000000${invoice.number}`,
  belgeTarihi: dashed(invoice.date),
  belgeTuru: 'FATURA',
  ettn: invoice.ettn,
  onayDurumu: invoice.status,
});

const vatOf = (invoice: Fixture) => (invoice.amount * invoice.vatRate) / 100;

const detail = (invoice: Fixture) => ({
  aliciAdi: '',
  aliciSoyadi: '',
  aliciUnvan: invoice.recipient,
  belgeNumarasi: row(invoice).belgeNumarasi,
  bulvarcaddesokak: '500 Westover Dr #10034',
  dovzTLkur: 0,
  faturaTarihi: row(invoice).belgeTarihi.replaceAll('-', '/'),
  faturaTipi: 'SATIS',
  malHizmetTable: [
    {
      birim: 'C62',
      birimFiyat: invoice.amount,
      iskontoOrani: 0,
      iskontoTutari: 0,
      kdvOrani: invoice.vatRate,
      malHizmet: invoice.item,
      miktar: 1,
    },
  ],
  mahalleSemtIlce: '',
  not: '',
  odenecekTutar: invoice.amount + vatOf(invoice),
  paraBirimi: invoice.currency,
  sehir: '',
  ulke: 'Amerika Birleşik Dev',
  vergiDairesi: '',
  vknTckn: invoice.taxID,
});

// GİB's preview, cut down: the same QR markup (empty #qrcode, JSON in a hidden
// #qrvalue, a drawing script) around a plain invoice table.
const html = (invoice: Fixture) => {
  const { belgeNumarasi } = row(invoice);
  const total = invoice.amount + vatOf(invoice);
  const qr = JSON.stringify({
    avkntckn: invoice.taxID,
    ettn: invoice.ettn,
    no: belgeNumarasi,
    odenecek: String(total),
    parabirimi: invoice.currency,
    senaryo: 'EARSIVFATURA',
    tarih: dashed(invoice.date).split('-').toReversed().join('-'),
    tip: 'SATIS',
    vkntckn: '3333333301',
  });
  const unsigned =
    invoice.status === 'Onaylanmadı'
      ? `<div style="position:absolute;z-index:1"><p style="font-size:100px;transform:rotate(310deg);color:lightcoral">İMZASIZ TEST BELGESİ</p></div>`
      : '';
  return `<html><head><meta charset="UTF-8"><script>var QRCode;</script><title>e-Belge</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;color:#000;margin:24px}td,th{padding:4px 6px}table.lines{border-collapse:collapse;width:800px;margin-top:24px}table.lines td,table.lines th{border:1px solid #888}</style></head>
<body>${unsigned}<table width="800"><tr valign="top"><td width="40%"><hr>DENEME LİSANS TİCARET A.Ş.<br>ZEYTİNALAN / İstanbul / Türkiye<br>Vergi Dairesi: URLA<br>VKN: 3333333301<hr></td>
<td width="20%" align="center"><b>e-Arşiv Fatura</b></td>
<td align="right"><div id="qrcode"></div><div style="display:none" id="qrvalue"> ${qr}</div><script>makeCode(document.getElementById("qrvalue").innerHTML);</script></td></tr>
<tr><td><hr><b>SAYIN</b><br>${invoice.recipient}<br>VKN: ${invoice.taxID}<hr></td><td></td>
<td><table border="1"><tr><td><b>Fatura No:</b></td><td>${belgeNumarasi}</td></tr><tr><td><b>Fatura Tarihi:</b></td><td>${row(invoice).belgeTarihi}</td></tr><tr><td><b>ETTN:</b></td><td>${invoice.ettn}</td></tr></table></td></tr></table>
<table class="lines"><tr><th>Sıra</th><th>Mal Hizmet</th><th>Miktar</th><th>Birim Fiyat</th><th>KDV Oranı</th><th>Mal Hizmet Tutarı</th></tr>
<tr><td>1</td><td>${invoice.item}</td><td>1 Adet</td><td>${invoice.amount} ${invoice.currency}</td><td>%${invoice.vatRate}</td><td>${invoice.amount} ${invoice.currency}</td></tr></table>
<p align="right">Ödenecek Tutar: ${total} ${invoice.currency}</p></body></html>`;
};

const json = (body: unknown) =>
  new Promise<Response>((resolve) =>
    setTimeout(
      () => resolve(new Response(JSON.stringify(body), { headers: { 'set-cookie': 'fixture=1' } })),
      300,
    ),
  );

const find = (ettn: unknown) => invoices.find((invoice) => invoice.ettn === ettn);

function dispatch(cmd: string, data: Record<string, unknown>) {
  switch (cmd) {
    case 'EARSIV_PORTAL_TASLAKLARI_GETIR': {
      const start = parse(String(data.baslangic));
      const end = parse(String(data.bitis));
      if ((end.getTime() - start.getTime()) / DAY > 7) {
        return { data: [{ error: 'Seçilen tarih aralığı 7 günden fazla olamaz!' }] };
      }
      return {
        data: invoices
          .filter((invoice) => invoice.date >= start && invoice.date <= end)
          .toReversed()
          .map(row),
      };
    }
    case 'EARSIV_PORTAL_FATURA_GETIR': {
      const invoice = find(data.ettn);
      return invoice
        ? { data: detail(invoice) }
        : { error: '1', messages: [{ text: 'Fatura bulunamadı' }] };
    }
    case 'EARSIV_PORTAL_FATURA_GOSTER': {
      const invoice = find(data.ettn);
      return invoice
        ? { data: html(invoice) }
        : { error: '1', messages: [{ text: 'Fatura bulunamadı' }] };
    }
    case 'EARSIV_PORTAL_TELEFONNO_SORGULA':
      return { data: { telefon: '5XX XXX 12 34' } };
    case 'EARSIV_PORTAL_SMSSIFRE_GONDER':
      return { data: { oid: 'fixture-oid' } };
    case '0lhozfib5410mp': {
      if (data.SIFRE !== '123456') {
        return { data: { msg: 'SMS şifresi hatalı', sonuc: '0' } };
      }
      for (const { ettn } of data.DATA as Array<{ ettn: string }>) {
        const invoice = find(ettn);
        if (invoice) {
          invoice.status = 'Onaylandı';
        }
      }
      return { data: { sonuc: '1' } };
    }
    case 'EARSIV_PORTAL_FATURA_SIL': {
      for (const { ettn } of data.silinecekler as Array<{ ettn: string }>) {
        const invoice = find(ettn);
        if (invoice) {
          invoice.status = 'Silinmiş';
        }
      }
      return { data: 'Belge silindi' };
    }
    default:
      return { error: '1', messages: [{ text: `Fixture yok: ${cmd}` }] };
  }
}

export function fixtureFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const url = typeof input === 'string' ? input : 'url' in input ? input.url : input.href;
  const body = new URLSearchParams(typeof init?.body === 'string' ? init.body : '');
  if (url.endsWith('/assos-login')) {
    if (body.get('assoscmd') === 'logout') {
      return json({});
    }
    return json(
      body.get('userid') === '00000000'
        ? { messages: [{ text: 'Kullanıcı adı veya şifre hatalı.' }] }
        : { token: 'fixture-token' },
    );
  }
  if (url.endsWith('/dispatch')) {
    const data = JSON.parse(body.get('jp') ?? '{}') as Record<string, unknown>;
    return json(dispatch(body.get('cmd') ?? '', data));
  }
  return Promise.reject(new Error(`GİB fixture: ${url}`));
}
