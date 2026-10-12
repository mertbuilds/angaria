// The MCP tools over Angaria's own records and settings
// (docs/adr/0010-mcp-agent-actions.md): customers and services as Müşteriler
// and Hizmetler keep them, the companies, the company details the PDF
// prints, TCMB's rate and the GİB login. They check what the screens check;
// deleting and changing the company details need Ajanlar onaylayabilir ve
// silebilir. No credential is ever read or returned.
import { gibDate } from '@angaria/mcp-server/inputs';
import { TCMBRateError } from 'angaria-utils';
import { z } from 'zod';
import {
  bankFields,
  companyFieldError,
  companyFields,
  normalizeCompanyField,
} from './company-fields.ts';
import { gibIdentityMismatch, taxIDOwner, taxIDTaken } from './company-identity.ts';
import {
  byRecentInvoice,
  countryError,
  customerDefaults,
  customerName,
  findCustomer,
  nameError,
  normalizeTaxID,
  sameName,
  selfInvoiceWarning,
  taxIDError,
} from './customer.ts';
import { customerDefaultsErrors, formatRate } from './invoice-form.ts';
import { resolvePDFStyle } from './invoice-pdf-i18n.ts';
import {
  currencyCode,
  defineTool,
  failure,
  gibCountry,
  json,
  matches,
  unitCode,
} from './mcp-tool-kit.ts';
import { historyCurrency } from './services.ts';
import type { CompanyInfo, Recipient, Service } from './types.ts';
import { parseGIB, toGIB } from './utils.ts';

const searchInput = z.object({
  query: z.string().optional().describe('Words to look for; all of them must match'),
});

const idInput = (what: string) =>
  z.object({ id: z.string().min(1).describe(`The ${what}'s id from list_${what}s`) });

const customerJSON = (customer: Recipient) => ({
  address: customer.fullAddress,
  city: customer.city || undefined,
  country: customer.country || undefined,
  defaults: { ...customerDefaults(customer), istisnaCode: customer.istisnaCode },
  district: customer.district || undefined,
  id: customer.id,
  lastInvoicedAt: customer.lastInvoicedAt,
  name: customerName(customer),
  personName: customer.name || undefined,
  personSurname: customer.surname || undefined,
  taxIDOrTRID: customer.taxIDOrTRID,
  taxOffice: customer.taxOffice || undefined,
  title: customer.title || undefined,
});

const UNKNOWN_CUSTOMER =
  'Bu müşteri kayıtlı değil. Kayıtlı müşterileri list_customers ile listele.';
const UNKNOWN_SERVICE = 'Bu hizmet kayıtlı değil. Kayıtlı hizmetleri list_services ile listele.';

const listCustomers = defineTool({
  annotations: { openWorldHint: false, readOnlyHint: true },
  description:
    "The active company's saved customers in Angaria, most recently invoiced first, with their invoice defaults. Use a customer's id as create_invoice's customerId.",
  gib: false,
  inputSchema: searchInput,
  name: 'list_customers',
  run: async (ctx, { query }) => {
    const { customers } = ctx.company();
    const found = byRecentInvoice(customers).filter((customer) =>
      matches(query, customerName(customer), customer.taxIDOrTRID),
    );
    return json({ customers: found.map(customerJSON) }, `${found.length} müşteri`);
  },
});

const getCustomer = defineTool({
  annotations: { openWorldHint: false, readOnlyHint: true },
  description: 'One saved customer by its id: details and invoice defaults.',
  gib: false,
  inputSchema: idInput('customer'),
  name: 'get_customer',
  run: async (ctx, { id }) => {
    const customer = ctx.company().customers.find((candidate) => candidate.id === id);
    return customer
      ? json(customerJSON(customer), customerName(customer))
      : failure(UNKNOWN_CUSTOMER, { code: 'unknown-customer' });
  },
});

const customerFields = {
  city: z.string().optional().describe('City'),
  country: z
    .string()
    .optional()
    .describe(
      "Country in Turkish or English, e.g. 'Almanya', 'Germany'. Needed for customers abroad.",
    ),
  district: z.string().optional().describe('District'),
  fullAddress: z.string().optional().describe('Full address'),
  name: z.string().optional().describe('First name, for a person'),
  surname: z.string().optional().describe('Last name, for a person'),
  taxIDOrTRID: z
    .string()
    .optional()
    .describe('VKN (10 digits) or TCKN (11 digits); 2222222222 for any customer abroad'),
  taxOffice: z.string().optional().describe('Tax office (vergi dairesi)'),
  title: z
    .string()
    .optional()
    .describe('Company name (unvan). For a person, give name and surname.'),
};

/** A default given as null is removed: the customer then follows where it is. */
const customerDefaultFields = {
  currency: currencyCode.nullable().optional().describe('Default invoice currency, e.g. USD'),
  dueDays: z
    .number()
    .int()
    .min(0)
    .max(365)
    .nullable()
    .optional()
    .describe('Days to pay after the invoice date, printed on the PDF'),
  invoiceType: z.enum(['SATIS', 'ISTISNA']).nullable().optional().describe('Default invoice type'),
  istisnaCode: z
    .enum(['301', '302', '350'])
    .nullable()
    .optional()
    .describe('Default İstisna reason: 301 goods export, 302 service export, 350 other'),
  pdfLanguage: z.enum(['tr', 'en', 'both']).nullable().optional().describe('PDF language'),
  VATRate: z.number().int().min(0).max(100).nullable().optional().describe('Default VAT rate'),
};

type CustomerPatch = Partial<
  Record<keyof typeof customerFields, string | undefined> & {
    [K in keyof typeof customerDefaultFields]: unknown;
  }
>;

/** The customer with `patch` applied, or the Turkish problems per field. */
function patchCustomer(
  customer: Recipient,
  patch: CustomerPatch,
): { customer: Recipient } | { fields: Record<string, string> } {
  const next: Record<string, unknown> = { ...customer };
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      delete next[key];
    } else if (value !== undefined) {
      next[key] = value;
    }
  }
  const updated = next as unknown as Recipient;
  const fields: Record<string, string> = {};
  if (patch.country !== undefined && patch.country !== null) {
    const country = gibCountry(patch.country);
    if (country === null) {
      fields.country = `${patch.country} GİB’in ülke listesinde yok. Ülkenin Türkçe ya da İngilizce adını yaz, örneğin Almanya.`;
    } else {
      updated.country = country;
    }
  }
  updated.taxIDOrTRID = normalizeTaxID(updated.taxIDOrTRID);
  const taxID = taxIDError(updated.taxIDOrTRID);
  const name = nameError(updated);
  const country = fields.country ? null : countryError(updated);
  if (taxID) {
    fields.taxIDOrTRID = taxID;
  }
  if (name) {
    fields.title = name;
  }
  if (country) {
    fields.country = country;
  }
  Object.assign(fields, customerDefaultsErrors(updated));
  return Object.keys(fields).length > 0 ? { fields } : { customer: updated };
}

/** What a saved customer is worth a second look for, by field; undefined when nothing. */
function customerWarnings(customer: Recipient, company: { companyInfo: CompanyInfo }) {
  const self = selfInvoiceWarning(customer.taxIDOrTRID, company.companyInfo.taxID);
  return self ? { taxIDOrTRID: self } : undefined;
}

const NOT_SAVED = 'Kaydedilmedi: bazı bilgiler eksik ya da hatalı.';

const BLANK_CUSTOMER = {
  city: '',
  country: '',
  district: '',
  fullAddress: '',
  name: '',
  surname: '',
  taxIDOrTRID: '',
  taxOffice: '',
  title: '',
};

const createCustomer = defineTool({
  annotations: { destructiveHint: false, openWorldHint: false },
  description:
    'Save a new customer in Angaria (Müşteriler) for the active company. Give a VKN/TCKN and an unvan, or a first and last name for a person; a customer abroad takes 2222222222 and its country. Invoice defaults are optional: without them the customer follows where it is (abroad: İstisna and an English PDF; in Türkiye: Satış, TRY and a Turkish PDF). A customer with the same VKN/TCKN and name is refused. create_invoice also saves its recipient by itself.',
  gib: false,
  inputSchema: z.object({ ...customerFields, ...customerDefaultFields }),
  name: 'create_customer',
  run: async (ctx, input) => {
    const patched = patchCustomer({ ...BLANK_CUSTOMER, id: ctx.newId() }, input);
    if ('fields' in patched) {
      return failure(NOT_SAVED, { code: 'invalid-customer', fields: patched.fields });
    }
    const { customer } = patched;
    const existing = findCustomer(
      ctx.company().customers,
      customer.taxIDOrTRID,
      customerName(customer),
    );
    if (existing) {
      return failure('Bu müşteri zaten kayıtlı. Değiştirmek için update_customer’ı kullan.', {
        code: 'exists',
        id: existing.id,
      });
    }
    ctx.setCustomers((customers) => [...customers, customer]);
    return json(
      {
        customer: customerJSON(customer),
        message: 'Müşteri kaydedildi.',
        warnings: customerWarnings(customer, ctx.company()),
      },
      customerName(customer),
    );
  },
  summarize: (input) =>
    input.title || [input.name, input.surname].filter(Boolean).join(' ') || 'Müşteri',
});

const updateCustomer = defineTool({
  annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
  description:
    "Change a saved customer's details or invoice defaults by its id. Only the fields given change; a default given as null is removed. Invoices already made do not change.",
  gib: false,
  inputSchema: idInput('customer').extend({ ...customerFields, ...customerDefaultFields }),
  name: 'update_customer',
  run: async (ctx, { id, ...patch }) => {
    const saved = ctx.company().customers.find((candidate) => candidate.id === id);
    if (!saved) {
      return failure(UNKNOWN_CUSTOMER, { code: 'unknown-customer' });
    }
    const patched = patchCustomer(saved, patch);
    if ('fields' in patched) {
      return failure(NOT_SAVED, { code: 'invalid-customer', fields: patched.fields });
    }
    const { customer } = patched;
    const clash = findCustomer(
      ctx.company().customers.filter((candidate) => candidate.id !== id),
      customer.taxIDOrTRID,
      customerName(customer),
    );
    if (clash) {
      return failure('Bu VKN / TCKN ve adla başka bir müşteri kayıtlı.', {
        code: 'exists',
        id: clash.id,
      });
    }
    ctx.setCustomers((customers) =>
      customers.map((candidate) => (candidate.id === id ? customer : candidate)),
    );
    return json(
      {
        customer: customerJSON(customer),
        message: 'Müşteri güncellendi.',
        warnings: customerWarnings(customer, ctx.company()),
      },
      customerName(customer),
    );
  },
});

const deleteCustomer = defineTool({
  annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
  description:
    'Delete a saved customer by its id. Invoices already made do not change. Cannot be undone. Needs Ajanlar onaylayabilir ve silebilir switched on in Angaria.',
  gib: false,
  inputSchema: idInput('customer'),
  limit: { max: 10, windowMs: 60_000 },
  name: 'delete_customer',
  run: async (ctx, { id }) => {
    const saved = ctx.company().customers.find((candidate) => candidate.id === id);
    if (!saved) {
      return failure(UNKNOWN_CUSTOMER, { code: 'unknown-customer' });
    }
    ctx.setCustomers((customers) => customers.filter((candidate) => candidate.id !== id));
    const name = customerName(saved);
    ctx.onAction({ kind: 'customer-deleted', name });
    return json({ message: 'Müşteri silindi.', name }, `${name} silindi`);
  },
});

const serviceJSON = (service: Service) => ({
  currency: service.currency,
  discountRate: service.discountRate || undefined,
  id: service.id,
  name: service.name,
  quantity: service.quantity,
  unitPrice: service.unitPrice,
  unitType: service.unitType,
  VATRate: service.VATRate,
});

const listServices = defineTool({
  annotations: { openWorldHint: false, readOnlyHint: true },
  description:
    "The active company's saved services (invoice lines) in Angaria with their prices, units and VAT rates, for create_invoice's items. unitPrice is in the service's currency; a service without one was saved before services had a currency, and its price was meant for the invoice's currency. create_invoice does not convert prices.",
  gib: false,
  inputSchema: searchInput,
  name: 'list_services',
  run: async (ctx, { query }) => {
    const { services } = ctx.company();
    const found = services.filter((service) => matches(query, service.name));
    return json({ services: found.map(serviceJSON) }, `${found.length} hizmet`);
  },
});

const getService = defineTool({
  annotations: { openWorldHint: false, readOnlyHint: true },
  description: 'One saved service by its id: price, currency, unit, quantity and VAT rate.',
  gib: false,
  inputSchema: idInput('service'),
  name: 'get_service',
  run: async (ctx, { id }) => {
    const service = ctx.company().services.find((candidate) => candidate.id === id);
    return service
      ? json(serviceJSON(service), service.name)
      : failure(UNKNOWN_SERVICE, { code: 'unknown-service' });
  },
});

/** At most two decimals, the kuruş GİB amounts have. */
const hasCents = (value: number) => Math.abs(value * 100 - Math.round(value * 100)) < 1e-6;

/** An invoice line needs a price above 0, so a service saved without one could never be invoiced. */

const serviceFields = {
  currency: currencyCode.optional().describe("The price's currency, e.g. TRY or USD"),
  discountRate: z.number().min(0).max(100).optional().describe('Discount rate as a percentage'),
  name: z.string().trim().min(1).optional().describe('Name as it goes on the invoice line'),
  quantity: z.number().positive().optional().describe('Default quantity'),
  unitPrice: z
    .number()
    .positive()
    .max(1_000_000_000)
    .refine(hasCents, 'Tutarı en çok iki ondalıkla yaz, örneğin 1250.50.')
    .optional()
    .describe('Unit price excluding VAT and above 0, in the service currency'),
  unitType: unitCode
    .optional()
    .describe(
      "GİB unit code: 'C62' (piece), 'HUR' (hour), 'DAY' (day), 'MON' (month), 'ANN' (year)",
    ),
  VATRate: z.number().int().min(0).max(100).optional().describe('VAT rate as a whole percentage'),
};

const namedLike = (services: ReadonlyArray<Service>, name: string, except?: string) =>
  services.find((service) => service.id !== except && sameName(service.name, name));

const createService = defineTool({
  annotations: { destructiveHint: false, openWorldHint: false },
  description:
    "Save a new service in Angaria (Hizmetler) for the active company: a name, a unit price and its currency (default: the currency the company's invoices are in, else TRY), unit (default C62), quantity (default 1) and VAT rate (default 20). A service with the same name is refused. create_invoice also saves its lines by itself.",
  gib: false,
  inputSchema: z.object({
    ...serviceFields,
    name: z.string().trim().min(1).describe('Name as it goes on the invoice line'),
    unitPrice: serviceFields.unitPrice.unwrap(),
  }),
  name: 'create_service',
  run: async (ctx, input) => {
    const { customers, services } = ctx.company();
    const clash = namedLike(services, input.name);
    if (clash) {
      return failure(
        'Bu adla bir hizmet zaten kayıtlı. Değiştirmek için update_service’i kullan.',
        {
          code: 'exists',
          id: clash.id,
        },
      );
    }
    const service: Service = {
      currency: input.currency ?? historyCurrency(customers) ?? 'TRY',
      discountAmount: 0,
      discountRate: input.discountRate ?? 0,
      discountReason: '',
      gtip: '',
      id: ctx.newId(),
      name: input.name,
      quantity: input.quantity ?? 1,
      unitPrice: input.unitPrice,
      unitType: input.unitType ?? 'C62',
      VATRate: input.VATRate ?? 20,
    };
    ctx.setServices((saved) => [...saved, service]);
    return json({ message: 'Hizmet kaydedildi.', service: serviceJSON(service) }, service.name);
  },
  summarize: ({ name }) => name,
});

const updateService = defineTool({
  annotations: { destructiveHint: false, idempotentHint: true, openWorldHint: false },
  description:
    'Change a saved service by its id. Only the fields given change. Invoices already made do not change.',
  gib: false,
  inputSchema: idInput('service').extend(serviceFields),
  name: 'update_service',
  run: async (ctx, { id, ...patch }) => {
    const { services } = ctx.company();
    const saved = services.find((candidate) => candidate.id === id);
    if (!saved) {
      return failure(UNKNOWN_SERVICE, { code: 'unknown-service' });
    }
    if (patch.name !== undefined && namedLike(services, patch.name, id)) {
      return failure('Bu adla başka bir hizmet kayıtlı.', { code: 'exists' });
    }
    const service: Service = {
      ...saved,
      ...Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined)),
    };
    ctx.setServices((all) => all.map((candidate) => (candidate.id === id ? service : candidate)));
    return json({ message: 'Hizmet güncellendi.', service: serviceJSON(service) }, service.name);
  },
});

const deleteService = defineTool({
  annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
  description:
    'Delete a saved service by its id. Invoices already made do not change. Cannot be undone. Needs Ajanlar onaylayabilir ve silebilir switched on in Angaria.',
  gib: false,
  inputSchema: idInput('service'),
  limit: { max: 10, windowMs: 60_000 },
  name: 'delete_service',
  run: async (ctx, { id }) => {
    const saved = ctx.company().services.find((candidate) => candidate.id === id);
    if (!saved) {
      return failure(UNKNOWN_SERVICE, { code: 'unknown-service' });
    }
    ctx.setServices((services) => services.filter((candidate) => candidate.id !== id));
    ctx.onAction({ kind: 'service-deleted', name: saved.name });
    return json({ message: 'Hizmet silindi.', name: saved.name }, `${saved.name} silindi`);
  },
});

const listCompanies = defineTool({
  annotations: { openWorldHint: false, readOnlyHint: true },
  description:
    "Every company set up in Angaria: id, name, legal name and VKN/TCKN from its details, whether it is the one active in Angaria, whether its GİB login is set up (gibLogin: ready or needs-login; credentials are never shown), and gibTaxID, the VKN/TCKN GİB gave for its account at the last login (a warning when the details' differs: Angaria's PDF would name another seller than GİB's invoice). Every other tool takes an optional company (id or VKN/TCKN) and acts on the active company without it. Naming a company never switches the active one in Angaria.",
  gib: false,
  inputSchema: z.object({}),
  name: 'list_companies',
  run: async (ctx) => {
    const companies = ctx.companies().map((company) => {
      const warning = gibIdentityMismatch(
        { ...EMPTY_DETAILS, taxID: company.taxID },
        company.gibTaxID ? { name: '', taxID: company.gibTaxID, taxOffice: '' } : undefined,
      );
      return warning ? { ...company, warning } : company;
    });
    return json({ companies }, `${companies.length} şirket`);
  },
  scoped: false,
});

const DETAIL_FIELDS = [...companyFields, ...bankFields];

const EMPTY_DETAILS: CompanyInfo = {
  accountHolder: '',
  address: '',
  bankAddress: '',
  bankName: '',
  email: '',
  iban: '',
  name: '',
  phone: '',
  swiftCode: '',
  taxID: '',
  taxOffice: '',
};

const companyDetailsJSON = ({ logo, pdfStyle, ...info }: CompanyInfo) => ({
  ...info,
  hasLogo: Boolean(logo),
  pdfStyle: resolvePDFStyle(pdfStyle),
});

const getCompanyDetails = defineTool({
  annotations: { openWorldHint: false, readOnlyHint: true },
  description:
    "The active company's details that Angaria's PDF prints (Ayarlar › Firma bilgileri and Banka bilgileri): name, VKN/TCKN, tax office, address, phone, e-mail, bank, account holder, IBAN, SWIFT, bank address, and the PDF design (classic, the default, or minimal). Not the GİB login. gib is the taxpayer GİB gave for the company's account at its last login; warnings.taxID says when the details' VKN/TCKN differs from it. Angaria never changes the details by itself: ask the user before update_company_details.",
  gib: false,
  inputSchema: z.object({}),
  name: 'get_company_details',
  run: async (ctx) => {
    const { companyInfo, gibIdentity } = ctx.company();
    const mismatch = gibIdentityMismatch(companyInfo, gibIdentity);
    return json({
      ...companyDetailsJSON(companyInfo),
      gib: gibIdentity,
      warnings: mismatch ? { taxID: mismatch } : undefined,
    });
  },
});

const updateCompanyDetails = defineTool({
  annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: false },
  description:
    "Change the active company's details that Angaria's PDF prints, the IBAN included. Only the fields given change; '' clears one. Checked as in Ayarlar (VKN/TCKN check digits, a VKN/TCKN another company in Angaria has is refused, IBAN, SWIFT, phone as +90 532 123 45 67, e-mail). Every PDF from then on prints them, so change the IBAN only when the user asked for exactly that. Needs Ajanlar onaylayabilir ve silebilir switched on in Angaria.",
  gib: false,
  inputSchema: z.object({
    accountHolder: z.string().optional().describe('Hesap sahibi: the bank account holder'),
    address: z.string().optional().describe('Adres: the company address'),
    bankAddress: z.string().optional().describe('Banka adresi: the bank branch address'),
    bankName: z.string().optional().describe('Banka adı: the bank name'),
    email: z.string().optional().describe('E-posta'),
    iban: z.string().optional().describe('IBAN, TR and 24 digits'),
    name: z.string().optional().describe('Firma adı ya da unvan: the company or person name'),
    pdfStyle: z
      .enum(['classic', 'minimal'])
      .optional()
      .describe('PDF design: classic (the default) or minimal'),
    phone: z.string().optional().describe('Telefon, as +90 532 123 45 67'),
    swiftCode: z.string().optional().describe('SWIFT kodu, 8 or 11 letters and digits'),
    taxID: z.string().optional().describe('VKN (10 digits) or TCKN (11 digits)'),
    taxOffice: z.string().optional().describe('Vergi dairesi: the tax office'),
  }),
  limit: { max: 5, windowMs: 60_000 },
  name: 'update_company_details',
  run: async (ctx, input) => {
    const patch: Partial<CompanyInfo> = {};
    const fields: Record<string, string> = {};
    for (const field of DETAIL_FIELDS) {
      const value = input[field.key];
      if (value === undefined) {
        continue;
      }
      const kind = field.kind ?? 'text';
      const normal = normalizeCompanyField(kind, value);
      const problem = companyFieldError(kind, normal);
      if (problem) {
        fields[field.key] = problem;
      } else {
        patch[field.key] = normal;
      }
    }
    if (Object.keys(fields).length > 0) {
      return failure(NOT_SAVED, { code: 'invalid-input', fields });
    }
    const { taxID } = patch;
    const owner = taxID ? taxIDOwner(ctx.companies(), ctx.company().id, taxID) : undefined;
    if (taxID && owner) {
      const message = taxIDTaken(taxID, owner);
      return failure(message, {
        code: 'duplicate-tax-id',
        fields: { taxID: message },
        owner: { id: owner.id, name: owner.name },
      });
    }
    if (input.pdfStyle) {
      patch.pdfStyle = input.pdfStyle;
    }
    ctx.setCompanyInfo((info) => ({ ...info, ...patch }));
    ctx.onAction({ kind: 'company-details-updated' });
    return json(
      {
        details: companyDetailsJSON({ ...ctx.company().companyInfo, ...patch }),
        message: 'Firma bilgileri güncellendi.',
      },
      Object.keys(patch).join(', '),
    );
  },
});

const getExchangeRate = defineTool({
  annotations: { openWorldHint: true, readOnlyHint: true },
  description:
    "TCMB's buying rate (döviz alış) that Angaria uses for an invoice dated `date`: the previous business day's bulletin, the one the invoice day's Resmî Gazete carries. The same rate create_invoice takes.",
  gib: false,
  inputSchema: z.object({
    currency: currencyCode
      .refine((code) => code !== 'TRY', 'TRY için kur gerekmez: lira faturada kur yok.')
      .describe('Currency code, e.g. USD or EUR (any case)'),
    date: gibDate.optional().describe('Invoice date DD/MM/YYYY. Defaults to today.'),
  }),
  name: 'get_exchange_rate',
  run: async (ctx, { currency, date }) => {
    const day = date ? parseGIB(date) : ctx.now();
    if (!day) {
      return failure('Tarihi GG/AA/YYYY biçiminde yaz.', { code: 'invalid-input' });
    }
    const rate = await ctx
      .currencyRate(currency, day)
      .catch((error: unknown) => (error instanceof TCMBRateError ? error : undefined));
    if (rate instanceof TCMBRateError) {
      return failure(rate.message, { code: 'currency-rate' });
    }
    if (rate === undefined) {
      return failure(`TCMB’nin ${currency} kuru alınamadı. Biraz sonra tekrar dene.`, {
        code: 'currency-rate',
      });
    }
    return json({ currency, invoiceDate: toGIB(day), rate }, `${currency} ${formatRate(rate)}`);
  },
  summarize: ({ currency }) => currency,
});

const checkGIBConnection = defineTool({
  annotations: { openWorldHint: true, readOnlyHint: true },
  description:
    "Logs in to GİB with the active company's saved user code and password and logs out, as Ayarlar' Bağlantıyı dene does: tells whether the login works. The credentials never leave Angaria; the user enters them in Angaria's Ayarlar only.",
  gib: true,
  inputSchema: z.object({}),
  name: 'check_gib_connection',
  run: async (ctx, _input, signal) => {
    await ctx.gib(async () => {}, signal);
    return json({ message: 'GİB bağlantısı çalışıyor.' }, 'Bağlandı');
  },
});

const closeGIBSession = defineTool({
  annotations: { destructiveHint: true, idempotentHint: true, openWorldHint: true },
  description:
    "Ends the active company's open session on the e-Arşiv portal, as Ayarlar' Oturumu kapat does: for GİB's 'session already open' error. Logs the user out of the portal in their browser too. Needs Ajanlar onaylayabilir ve silebilir switched on in Angaria.",
  gib: true,
  inputSchema: z.object({}),
  limit: { max: 3, windowMs: 60_000 },
  name: 'close_gib_session',
  run: async (ctx) => {
    // An open signing operation holds the session; the close would wait behind it.
    ctx.state.signing.endAll('cancelled');
    await ctx.forceLogout();
    ctx.onAction({ kind: 'gib-session-closed' });
    return json({ message: 'Oturum kapatıldı.' }, 'Oturum kapatıldı');
  },
});

export const RECORD_TOOLS = [
  listCustomers,
  getCustomer,
  createCustomer,
  updateCustomer,
  deleteCustomer,
  listServices,
  getService,
  createService,
  updateService,
  deleteService,
  listCompanies,
  getCompanyDetails,
  updateCompanyDetails,
  getExchangeRate,
  checkGIBConnection,
  closeGIBSession,
];
