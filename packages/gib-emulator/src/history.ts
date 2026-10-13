import type { InvoiceFixture } from './config.ts';

// Two years and more of a freelancer's documents, dated back from today, for
// Angaria's import from past invoices: customers at home and abroad (several
// on GİB's foreign VKN 2222222222), lira, dollars and euros, services billed
// again and again with a newer price, multi-line invoices, and documents the
// import skips (drafts, a cancelled invoice, a deleted draft).

const ISTISNA_NOTE =
  "302 - 11/1-a Hizmet ihracatı. Bu fatura 3065 sayılı KDV Kanunu'nun 11/1-a maddesi uyarınca hizmet ihracatı kapsamında KDV'den istisnadır.";

const range = (count: number) => Array.from({ length: count }, (_, index) => index);

/** A rate that drifts up by `step` per 30 days back from `latest`, to four decimals. */
const rateAt = (latest: number, step: number, daysAgo: number) =>
  Math.round((latest - (step * daysAgo) / 30) * 10_000) / 10_000;

export function historyFixtures(userid: string): Array<InvoiceFixture> {
  const plastic = range(26).map((month): InvoiceFixture => ({
    address: '500 Westover Dr #10034, Sanford, NC 27330',
    // The newest is waiting for the buyer to accept a cancellation: still an invoice.
    cancellation: month === 0 ? 'pending' : undefined,
    country: 'Amerika Birleşik Dev',
    currency: 'USD',
    daysAgo: 5 + month * 30,
    items: [
      { name: 'Yazılım Geliştirme Hizmeti', unit: 'MON', unitPrice: month < 12 ? 4500 : 4000 },
    ],
    note: ISTISNA_NOTE,
    rate: rateAt(41.3, 0.45, 5 + month * 30),
    recipient: 'Agent Caffeine',
    status: 'Onaylandı',
    taxID: '2222222222',
    userid,
    vatRate: 0,
  }));
  const acme = range(13).map((step): InvoiceFixture => ({
    address: 'Hauptstraße 42, 10115 Berlin',
    // A rejected cancellation leaves the invoice valid.
    cancellation: step === 4 ? 'rejected' : undefined,
    country: 'Almanya',
    currency: 'EUR',
    daysAgo: 15 + step * 60,
    items: [
      {
        name: 'Danışmanlık Hizmeti',
        quantity: 20 + (step % 3) * 4,
        unit: 'HUR',
        unitPrice: step < 6 ? 120 : 110,
      },
    ],
    note: ISTISNA_NOTE,
    rate: rateAt(48.1, 0.5, 15 + step * 60),
    // Spelled two ways over the years: one customer all the same.
    recipient: step % 4 === 3 ? 'KNOBS.DEV' : 'knobs.dev',
    status: 'Onaylandı',
    taxID: '2222222222',
    userid,
    vatRate: 0,
  }));
  // Only in the second year back: a 2 yıl scan finds it, 1 yıl does not.
  const nordic = range(4).map((step): InvoiceFixture => ({
    address: 'Drottninggatan 12, 111 51 Stockholm',
    country: 'İsveç',
    currency: 'EUR',
    daysAgo: 420 + step * 30,
    items: [{ name: 'Mobil Uygulama Geliştirme', unit: 'MON', unitPrice: 3000 }],
    note: ISTISNA_NOTE,
    rate: rateAt(48.1, 0.5, 420 + step * 30),
    recipient: 'attention awareness',
    status: 'Onaylandı',
    taxID: '2222222222',
    userid,
    vatRate: 0,
  }));
  const ornek = range(9).map((quarter): InvoiceFixture => ({
    address: 'Bağdat Cad. No:123',
    currency: 'TRY',
    daysAgo: 25 + quarter * 90,
    district: 'Kadıköy',
    items: [
      {
        name: 'Mühendislik Hizmetleri',
        quantity: 40,
        unit: 'HUR',
        unitPrice: quarter < 4 ? 1750 : 1500,
      },
      { name: 'Sunucu Bakımı', unit: 'MON', unitPrice: 2500 },
    ],
    recipient: 'Vinena Studio',
    status: 'Onaylandı',
    taxID: '4820193752',
    taxOffice: 'Kadıköy',
    userid,
    vatRate: 20,
  }));
  const ayse = range(8).map((month): InvoiceFixture => ({
    address: 'Tunalı Hilmi Cad. No:40 D:6',
    city: 'Ankara',
    currency: 'TRY',
    daysAgo: 9 + month * 30,
    district: 'Çankaya',
    items: [{ name: 'Web Sitesi Bakımı', unit: 'MON', unitPrice: 2500 }],
    recipient: 'Ahmet Buğra',
    status: 'Onaylandı',
    surname: 'Yiğiter',
    taxID: '23456789060',
    userid,
    vatRate: 20,
  }));
  const mavi = range(3).map((step): InvoiceFixture => ({
    address: 'Alsancak Mah. Kıbrıs Şehitleri Cad. No:8',
    city: 'İzmir',
    currency: 'TRY',
    daysAgo: 100 + step * 100,
    district: 'Konak',
    // The same name as knobs.dev's service, in hours and lira: another service.
    items: [{ name: 'Danışmanlık Hizmeti', quantity: 10, unit: 'HUR', unitPrice: 2000 }],
    recipient: 'MAVİ AJANS LTD. ŞTİ.',
    status: 'Onaylandı',
    taxID: '7310045629',
    taxOffice: 'Konak',
    userid,
    vatRate: 20,
  }));
  const skipped: Array<InvoiceFixture> = [
    ...[2, 33].map((daysAgo): InvoiceFixture => ({
      currency: 'TRY',
      daysAgo,
      items: [{ name: 'Taslak Hizmeti', unitPrice: 1000 }],
      recipient: 'TASLAK DENEME A.Ş.',
      status: 'Onaylanmadı',
      taxID: '6152239089',
      userid,
      vatRate: 20,
    })),
    {
      cancellation: 'accepted',
      country: 'Hollanda',
      currency: 'EUR',
      daysAgo: 70,
      items: [{ name: 'İptal Edilen Hizmet', unitPrice: 800 }],
      note: ISTISNA_NOTE,
      rate: rateAt(48.1, 0.5, 70),
      recipient: 'İPTAL EDİLEN B.V.',
      status: 'Onaylandı',
      taxID: '2222222222',
      userid,
      vatRate: 0,
    },
    {
      currency: 'TRY',
      daysAgo: 130,
      items: [{ name: 'Silinen Hizmet', unitPrice: 500 }],
      recipient: 'SİLİNEN MÜŞTERİ A.Ş.',
      status: 'Silinmiş',
      taxID: '6152239089',
      userid,
      vatRate: 20,
    },
  ];
  const documents = [...plastic, ...acme, ...nordic, ...ornek, ...ayse, ...mavi, ...skipped];
  // Oldest first, so GİB's numbers rise with the dates.
  return documents.toSorted((a, b) => (b.daysAgo ?? 0) - (a.daysAgo ?? 0));
}
