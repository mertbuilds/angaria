import type { InvoiceItem } from "./angaria-sdk.ts";

interface RawItem {
  name: string;
  quantity: number;
  unitPrice: number;
  VATRate: number;
  unitType?: string;
  discountRate?: number;
  discountAmount?: number;
  discountReason?: string;
  gtip?: string;
}

interface Totals {
  grandTotal: number;
  totalVAT: number;
  grandTotalInclVAT: number;
  paymentTotal: number;
  totalDiscount: number;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeItemFields(raw: RawItem): InvoiceItem {
  const price = round2(raw.quantity * raw.unitPrice);
  const discount = raw.discountAmount ?? 0;
  const taxableAmount = round2(price - discount);
  const VATAmount = round2((taxableAmount * raw.VATRate) / 100);

  return {
    name: raw.name,
    quantity: raw.quantity,
    unitPrice: raw.unitPrice,
    price,
    VATRate: raw.VATRate,
    VATAmount,
    unitType: raw.unitType ?? "C62",
    discountRate: raw.discountRate ?? 0,
    discountAmount: raw.discountAmount ?? 0,
    discountReason: raw.discountReason ?? "",
    gtip: raw.gtip ?? "",
  };
}

export function computeTotals(items: InvoiceItem[]): Totals {
  let grandTotal = 0;
  let totalVAT = 0;
  let totalDiscount = 0;

  for (const item of items) {
    const lineTotal = round2(item.quantity * item.unitPrice);
    const discount = item.discountAmount ?? 0;
    grandTotal += round2(lineTotal - discount);
    totalVAT += item.VATAmount;
    totalDiscount += discount;
  }

  grandTotal = round2(grandTotal);
  totalVAT = round2(totalVAT);
  totalDiscount = round2(totalDiscount);
  const grandTotalInclVAT = round2(grandTotal + totalVAT);

  return {
    grandTotal,
    totalVAT,
    grandTotalInclVAT,
    paymentTotal: grandTotalInclVAT,
    totalDiscount,
  };
}
