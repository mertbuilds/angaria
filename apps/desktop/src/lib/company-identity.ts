// What makes a company one taxpayer: its VKN / TCKN and its GİB user code.
// No two companies may share either: the same VKN is the same taxpayer, and
// the same user code logs in to the same e-Arşiv account (its invoices, its
// one session). Ayarlar, the MCP tools and the emulator samples check here.
// Companies stored with a shared one before this rule stay as they are: Ayarlar
// shows them, never deletes them.
import type { CompanyInfo, Entity, GIBIdentity } from './types.ts';

/** A company as the checks see it. */
export interface CompanyKey {
  id: string;
  name: string;
  taxID: string;
  /** The GİB user code, when known */
  username?: string;
}

/** Digits only: "100 000 001 46" is 10000000146. */
export const taxIDDigits = (text: string) => text.replaceAll(/\D/g, '');

export const companyKeys = (entities: ReadonlyArray<Entity>): Array<CompanyKey> =>
  entities.map(({ companyInfo, creds, id, name }) => ({
    id,
    name,
    taxID: companyInfo.taxID,
    username: creds.username,
  }));

const idKind = (taxID: string) => (taxIDDigits(taxID).length === 11 ? 'TCKN' : 'VKN');

/** Another company with this VKN / TCKN; none for an empty one. */
export function taxIDOwner(
  companies: ReadonlyArray<CompanyKey>,
  selfId: string,
  taxID: string,
): CompanyKey | undefined {
  const id = taxIDDigits(taxID);
  return id
    ? companies.find((company) => company.id !== selfId && taxIDDigits(company.taxID) === id)
    : undefined;
}

/** Another company with this GİB user code; none for an empty one. */
export function gibUserOwner(
  companies: ReadonlyArray<CompanyKey>,
  selfId: string,
  username: string,
): CompanyKey | undefined {
  const code = username.trim();
  return code
    ? companies.find((company) => company.id !== selfId && company.username?.trim() === code)
    : undefined;
}

export const taxIDTaken = (taxID: string, owner: CompanyKey) =>
  `Bu ${idKind(taxID)} zaten ${owner.name} için kayıtlı.`;

export const gibUserTaken = (owner: CompanyKey) =>
  `Bu kullanıcı kodu zaten ${owner.name} için kayıtlı.`;

/** For a company stored with a VKN / TCKN another one has too. */
export const taxIDShared = (taxID: string) => {
  const kind = idKind(taxID);
  return `Bu ${kind} başka bir şirkette de kayıtlı. Birini sil ya da ${kind}’yi düzelt.`;
};

/** For a company stored with a GİB user code another one has too. */
export const GIB_USER_SHARED =
  'Bu kullanıcı kodu başka bir şirkette de kayıtlı. Birini sil ya da kullanıcı kodunu düzelt.';

/**
 * The company an MCP call names: its id, else its VKN / TCKN. 'ambiguous'
 * when that VKN / TCKN is stored on more than one company, null when none.
 */
export function resolveCompany<T extends CompanyKey>(
  companies: ReadonlyArray<T>,
  ref: string,
): T | 'ambiguous' | null {
  const byId = companies.find((company) => company.id === ref);
  if (byId) {
    return byId;
  }
  const id = taxIDDigits(ref);
  const byTaxID = id ? companies.filter((company) => taxIDDigits(company.taxID) === id) : [];
  if (byTaxID.length > 1) {
    return 'ambiguous';
  }
  return byTaxID[0] ?? null;
}

/**
 * The company details' VKN / TCKN is not the GİB account's: Angaria's PDF
 * would print another seller than GİB's e-Arşiv invoice. Null when they agree
 * or either is unknown.
 */
export function gibIdentityMismatch(info: CompanyInfo, identity: GIBIdentity | undefined) {
  const own = taxIDDigits(info.taxID);
  if (!identity?.taxID || !own || own === taxIDDigits(identity.taxID)) {
    return null;
  }
  const number = `${idKind(identity.taxID)} ${identity.taxID}`;
  const owner = identity.name ? `${identity.name} (${number})` : number;
  return `GİB hesabı ${owner} adına. Firma bilgilerindeki ${idKind(own)} farklı, bu yüzden PDF’te e-Arşiv faturasındakinden başka bir satıcı görünür.`;
}

/** The details with GİB's VKN / TCKN, and its name and tax office where they are empty. */
export const fillFromGIB = (info: CompanyInfo, identity: GIBIdentity): CompanyInfo => ({
  ...info,
  name: info.name.trim() || identity.name,
  taxID: identity.taxID,
  taxOffice: info.taxOffice.trim() || identity.taxOffice,
});
