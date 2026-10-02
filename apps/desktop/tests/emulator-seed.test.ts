import { describe, expect, test, vi } from 'vitest';
import {
  EMULATOR_LOGIN,
  fillEmptyCompany,
  SAMPLE_COMPANY,
  sampleCustomers,
  seedEmulatorData,
  type SeedStore,
} from '../src/dev/emulator-seed.ts';
import {
  isTaxIDPlaceholder,
  isValidEmail,
  isValidSWIFT,
  isValidTCKN,
  isValidTRIBAN,
  isValidVKN,
} from '../src/lib/tr-validators.ts';
import type { CompanyInfo, Credentials, Recipient } from '../src/lib/types.ts';

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

/** A store slice that applies its writes, like the app store. */
function fakeStore({
  companyInfo = EMPTY_COMPANY,
  login = { password: '', username: '' },
  savedRecipients = [],
  vault = true,
}: {
  companyInfo?: CompanyInfo;
  login?: Credentials;
  savedRecipients?: Array<Recipient>;
  vault?: boolean;
} = {}) {
  const state = { companyInfo, login: { ...login }, savedRecipients };
  const store: SeedStore = {
    activeEntityId: 'a',
    companyInfo,
    creds: { username: login.username },
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
    expect(isValidTCKN(SAMPLE_COMPANY.taxID)).toBe(true);
    expect(isValidTRIBAN(SAMPLE_COMPANY.iban)).toBe(true);
    expect(isValidSWIFT(SAMPLE_COMPANY.swiftCode)).toBe(true);
    expect(isValidEmail(SAMPLE_COMPANY.email)).toBe(true);
    expect(SAMPLE_COMPANY.phone).toMatch(/^\+90 \d{3} \d{3} \d{2} \d{2}$/);
    const [foreign, domestic] = sampleCustomers(newId);
    expect(isTaxIDPlaceholder(foreign?.taxIDOrTRID ?? '')).toBe(true);
    expect(foreign?.currency).toBe('USD');
    expect(isValidVKN(domestic?.taxIDOrTRID ?? '')).toBe(true);
    expect(domestic?.currency).toBe('TRY');
  });

  test('fillEmptyCompany keeps what was typed', () => {
    const typed = { ...EMPTY_COMPANY, logo: 'data:image/png;base64,', name: 'Benim Firmam' };
    expect(fillEmptyCompany(typed)).toEqual({
      ...SAMPLE_COMPANY,
      logo: typed.logo,
      name: 'Benim Firmam',
    });
  });
});

describe('seedEmulatorData', () => {
  test('fills an empty company: login, company, bank and two customers', async () => {
    const { state, store } = fakeStore();
    expect(await seedEmulatorData(store)).toBe(true);
    expect(state.login).toEqual(EMULATOR_LOGIN);
    expect(state.companyInfo).toEqual(SAMPLE_COMPANY);
    expect(state.savedRecipients.map((customer) => customer.taxIDOrTRID)).toEqual([
      '2222222222',
      '1234567890',
    ]);
  });

  test('never overwrites a typed login, field or customer list', async () => {
    const customer = sampleCustomers(newId)[1] as Recipient;
    const { state, store } = fakeStore({
      companyInfo: { ...SAMPLE_COMPANY, iban: '', name: 'Benim Firmam' },
      login: { password: 'gizli', username: '12345678' },
      savedRecipients: [customer],
    });
    expect(await seedEmulatorData(store)).toBe(true);
    expect(state.login).toEqual({ password: 'gizli', username: '12345678' });
    expect(state.companyInfo.name).toBe('Benim Firmam');
    expect(state.companyInfo.iban).toBe(SAMPLE_COMPANY.iban);
    expect(state.savedRecipients).toEqual([customer]);
  });

  test('says nothing was empty once every field is filled', async () => {
    const { store } = fakeStore({
      companyInfo: { ...SAMPLE_COMPANY },
      login: { ...EMULATOR_LOGIN },
      savedRecipients: sampleCustomers(newId),
    });
    expect(await seedEmulatorData(store)).toBe(false);
  });

  test('without a vault (a plain browser) the password is left alone', async () => {
    const { state, store } = fakeStore({ vault: false });
    expect(await seedEmulatorData(store)).toBe(true);
    expect(state.login).toEqual({ password: '', username: EMULATOR_LOGIN.username });
  });
});
