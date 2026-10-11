import type { Recipient, Service } from '@/lib/types.ts';

// Dev only: the customers and services a new dev install starts with. The
// store reads them behind import.meta.env.DEV, so release builds start empty
// and drop this module.

type ItemDefaults = Pick<
  Service,
  'discountAmount' | 'discountRate' | 'discountReason' | 'gtip' | 'unitType'
>;

export function sampleCustomers(): Array<Recipient> {
  return [
    {
      id: crypto.randomUUID(),
      taxIDOrTRID: '2222222222',
      taxOffice: '',
      title: 'PLASTIC SOFTWARE LLC',
      name: '',
      surname: '',
      fullAddress: '500 Westover Dr #10034\nSanford, NC 27330',
      country: 'Amerika Birleşik Devletleri',
      city: '',
      district: '',
    },
    {
      id: crypto.randomUUID(),
      taxIDOrTRID: '1234567890',
      taxOffice: 'Kadıköy',
      title: 'ÖRNEK TEKNOLOJİ A.Ş.',
      name: 'Ahmet',
      surname: 'Yılmaz',
      fullAddress: 'Bağdat Cad. No:123 Kadıköy',
      country: 'Türkiye',
      city: 'İstanbul',
      district: 'Kadıköy',
    },
    {
      id: crypto.randomUUID(),
      taxIDOrTRID: '2222222222',
      taxOffice: '',
      title: 'ACME GMBH',
      name: 'Hans',
      surname: 'Müller',
      fullAddress: 'Hauptstraße 42, 10115 Berlin',
      country: 'Almanya',
      city: 'Berlin',
      district: '',
    },
  ];
}

export function sampleServices(defaults: ItemDefaults): Array<Service> {
  return [
    {
      id: crypto.randomUUID(),
      currency: 'USD',
      name: 'Engineering Services - Mühendislik Hizmetleri',
      quantity: 1,
      unitPrice: 100,
      VATRate: 0,
      ...defaults,
    },
    {
      id: crypto.randomUUID(),
      currency: 'TRY',
      name: 'Yazılım Geliştirme Hizmeti',
      quantity: 1,
      unitPrice: 5000,
      VATRate: 20,
      ...defaults,
    },
    {
      id: crypto.randomUUID(),
      currency: 'TRY',
      name: 'Danışmanlık Hizmeti',
      quantity: 1,
      unitPrice: 2500,
      VATRate: 20,
      ...defaults,
    },
  ];
}
