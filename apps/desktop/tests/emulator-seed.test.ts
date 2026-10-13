import { describe, expect, test, vi } from 'vitest';
import {
  EMULATOR_PROFILES,
  type EmulatorProfile,
  fillEmptyCompany,
  sampleCustomers,
  seedEmulatorData,
  type SeedStore,
} from '../src/dev/emulator-seed.ts';
import { taxIDDigits } from '../src/lib/company-identity.ts';
import {
  isTaxIDPlaceholder,
  isValidEmail,
  isValidSWIFT,
  isValidTCKN,
  isValidTRIBAN,
  isValidVKN,
} from '../src/lib/tr-validators.ts';
import type { CompanyInfo, Credentials, Entity, Recipient } from '../src/lib/types.ts';

vi.mock('@angaria/ui', () => ({ toast: Object.assign(vi.fn(), { success: vi.fn() }) }));

const EMPTY_COMPANY: CompanyInfo = {
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

let ids = 0;
const newId = () => `id-${++ids}`;

const [DENIZ, ECE] = EMULATOR_PROFILES as [EmulatorProfile, EmulatorProfile];

/** Another company in the store, with this login and details. */
const otherCompany = (username: string, companyInfo: Partial<CompanyInfo> = {}): Entity => ({
  companyInfo: { ...EMPTY_COMPANY, ...companyInfo },
  creds: { username },
  id: 'b',
  name: 'Şirket 2',
  savedItems: [],
  savedRecipients: [],
});

/** A store slice that applies its writes, like the app store. */
function fakeStore({
  companyInfo = EMPTY_COMPANY,
  login = { password: '', username: '' },
  others = [],
  savedRecipients = [],
  vault = true,
}: {
  companyInfo?: CompanyInfo;
  login?: Credentials;
  others?: Array<Entity>;
  savedRecipients?: Array<Recipient>;
  vault?: boolean;
} = {}) {
  const state = { companyInfo, login: { ...login }, savedRecipients };
  const store: SeedStore = {
    activeEntityId: 'a',
    companyInfo,
    creds: { username: login.username },
    entities: [
      {
        companyInfo,
        creds: { username: login.username },
        id: 'a',
        name: 'Ana şirket',
        savedItems: [],
        savedRecipients,
      },
      ...others,
    ],
    getCredentials: async () => {
      if (!vault) {
        throw new Error('GİB şifresi Anahtar Zinciri’nden okunamadı');
      }
      return { ...state.login };
    },
    newId,
    savedRecipients,
    setCompanyInfo: (value) => {
      state.companyInfo = typeof value === 'function' ? value(state.companyInfo) : value;
    },
    setCredentials: async (_, creds) => {
      if (creds.password !== undefined && !vault) {
        throw new Error('GİB şifresi Anahtar Zinciri’ne kaydedilemedi');
      }
      Object.assign(state.login, creds);
    },
    setSavedRecipients: (value) => {
      state.savedRecipients = typeof value === 'function' ? value(state.savedRecipients) : value;
    },
  };
  return { state, store };
}

describe('samples', () => {
  test('every sample ID passes its check', () => {
    for (const { company } of EMULATOR_PROFILES) {
      const id = company.taxID;
      expect(id.length === 10 ? isValidVKN(id) : isValidTCKN(id)).toBe(true);
      expect(isValidTRIBAN(company.iban)).toBe(true);
      expect(isValidSWIFT(company.swiftCode)).toBe(true);
      expect(isValidEmail(company.email)).toBe(true);
      expect(company.phone).toMatch(/^\+90 \d{3} \d{3} \d{2} \d{2}$/);
    }
    const [foreign, domestic] = sampleCustomers(newId);
    expect(isTaxIDPlaceholder(foreign?.taxIDOrTRID ?? '')).toBe(true);
    expect(foreign?.currency).toBe('USD');
    expect(isValidVKN(domestic?.taxIDOrTRID ?? '')).toBe(true);
    expect(domestic?.currency).toBe('TRY');
  });

  test('each emulator user has its own user code and VKN / TCKN', () => {
    expect(EMULATOR_PROFILES.map(({ login }) => login.username)).toEqual(['12345678', '87654321']);
    const taxIDs = EMULATOR_PROFILES.map(({ company }) => taxIDDigits(company.taxID));
    expect(new Set(taxIDs).size).toBe(taxIDs.length);
  });

  test('fillEmptyCompany keeps what was typed', () => {
    const typed = { ...EMPTY_COMPANY, logo: 'data:image/png;base64,', name: 'Benim Firmam' };
    expect(fillEmptyCompany(DENIZ.company)(typed)).toEqual({
      ...DENIZ.company,
      logo: typed.logo,
      name: 'Benim Firmam',
    });
  });
});

describe('seedEmulatorData', () => {
  test('fills an empty company: login, company, bank and two customers', async () => {
    const { state, store } = fakeStore();
    expect(await seedEmulatorData(store)).toBe(true);
    expect(state.login).toEqual(DENIZ.login);
    expect(state.companyInfo).toEqual(DENIZ.company);
    expect(state.savedRecipients.map((customer) => customer.taxIDOrTRID)).toEqual([
      '2222222222',
      '1234567890',
    ]);
  });

  test("a second company gets the next emulator user, never the first one's", async () => {
    const { state, store } = fakeStore({
      others: [otherCompany(DENIZ.login.username, DENIZ.company)],
    });
    expect(await seedEmulatorData(store)).toBe(true);
    expect(state.login).toEqual(ECE.login);
    expect(state.companyInfo).toEqual(ECE.company);
  });

  test("a company's user code picks its own emulator user's details", async () => {
    const { state, store } = fakeStore({ login: { password: '', username: ECE.login.username } });
    await seedEmulatorData(store);
    expect(state.login).toEqual(ECE.login);
    expect(state.companyInfo.taxID).toBe(ECE.company.taxID);
  });

  test('never fills a VKN / TCKN another company has', async () => {
    // Another company took Mert's VKN with a user code of its own.
    const { state, store } = fakeStore({
      login: { password: 'gizli', username: DENIZ.login.username },
      others: [otherCompany('33333301', { taxID: DENIZ.company.taxID })],
    });
    await seedEmulatorData(store);
    expect(state.companyInfo.taxID).toBe('');
    expect(state.companyInfo.name).toBe(DENIZ.company.name);
  });

  test('fills no login when every emulator user is taken', async () => {
    const { state, store } = fakeStore({
      others: [
        otherCompany(DENIZ.login.username, { taxID: DENIZ.company.taxID }),
        { ...otherCompany(ECE.login.username, { taxID: ECE.company.taxID }), id: 'c' },
      ],
    });
    await seedEmulatorData(store);
    expect(state.login).toEqual({ password: '', username: '' });
    expect(state.companyInfo).toEqual(EMPTY_COMPANY);
  });

  test('never overwrites a typed login, field or customer list', async () => {
    const customer = sampleCustomers(newId)[1] as Recipient;
    const { state, store } = fakeStore({
      companyInfo: { ...DENIZ.company, iban: '', name: 'Benim Firmam' },
      login: { password: 'gizli', username: '12345678' },
      savedRecipients: [customer],
    });
    expect(await seedEmulatorData(store)).toBe(true);
    expect(state.login).toEqual({ password: 'gizli', username: '12345678' });
    expect(state.companyInfo.name).toBe('Benim Firmam');
    expect(state.companyInfo.iban).toBe(DENIZ.company.iban);
    expect(state.savedRecipients).toEqual([customer]);
  });

  test('says nothing was empty once every field is filled', async () => {
    const { store } = fakeStore({
      companyInfo: { ...DENIZ.company },
      login: { ...DENIZ.login },
      savedRecipients: sampleCustomers(newId),
    });
    expect(await seedEmulatorData(store)).toBe(false);
  });

  test('without a vault (a plain browser) the password is left alone', async () => {
    const { state, store } = fakeStore({ vault: false });
    expect(await seedEmulatorData(store)).toBe(true);
    expect(state.login).toEqual({ password: '', username: DENIZ.login.username });
  });
});
