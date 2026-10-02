import { toast } from '@angaria/ui';
import { GIB_ERROR_CODES, GibError } from 'angaria-earsiv-sdk';
import { describe, expect, test, vi } from 'vitest';
import {
  describeError,
  GIB_ERROR_COPY,
  NETWORK_ERROR,
  TCMB_RATE_ERROR,
  toastError,
  UNEXPECTED_ERROR,
} from '../src/lib/gib-errors.ts';

const ENGLISH =
  /\b(?:the|and|error|failed|request|please|try|again|not|found|network|session|invalid|unknown|timeout)\b/i;

const texts = [
  ...GIB_ERROR_CODES.map((code) => GIB_ERROR_COPY[code].text),
  TCMB_RATE_ERROR,
  NETWORK_ERROR,
  UNEXPECTED_ERROR,
];

describe('copy', () => {
  test('every GİB error code has a text', () => {
    expect(Object.keys(GIB_ERROR_COPY).toSorted()).toEqual([...GIB_ERROR_CODES].toSorted());
  });

  test.each(texts)('%s', (text) => {
    expect(text).toMatch(/[çğıöşüÇĞİÖŞÜ]/);
    expect(text).not.toMatch(ENGLISH);
    expect(text).not.toMatch(/[—–!]/);
    expect(text).not.toMatch(/lütfen|[iıuü]n[iıuü]z\b/i);
    expect(text).not.toMatch(/geçerli|geçersiz|hata oluştu/i);
    expect(text).toMatch(/^\p{Lu}.*\.$/u);
  });

  test('only a wrong password points to Ayarlar', () => {
    expect(GIB_ERROR_CODES.filter((code) => GIB_ERROR_COPY[code].action === 'settings')).toEqual([
      'auth',
    ]);
  });
});

describe('describeError', () => {
  test('a GİB failure gets its code’s text and action', () => {
    const text = 'Kullanıcı adı veya şifre hatalı.';
    expect(describeError(new GibError('auth', text, { gibMessage: text }))).toEqual({
      action: 'settings',
      code: 'auth',
      detail: undefined,
      text: GIB_ERROR_COPY.auth.text,
    });
  });

  test('shows GİB’s Turkish text under the codes where it tells more', () => {
    const text = 'Alıcı VKN/TCKN 10 veya 11 haneli olmalıdır.';
    expect(describeError(new GibError('validation', text, { gibMessage: text }))).toMatchObject({
      detail: `GİB’in mesajı: ${text}`,
      text: GIB_ERROR_COPY.validation.text,
    });
    expect(
      describeError(
        new GibError('validation', 'Başlangıç tarihi bitiş tarihinden sonra olamaz!', {
          gibMessage: 'Başlangıç tarihi bitiş tarihinden sonra olamaz!',
        }),
      ).detail,
    ).toBe('GİB’in mesajı: Başlangıç tarihi bitiş tarihinden sonra olamaz.');
  });

  test('never shows GİB’s English or a text where it adds nothing', () => {
    expect(
      describeError(
        new GibError('unknown', 'Service Not Found', { gibMessage: 'Service Not Found' }),
      ).detail,
    ).toBeUndefined();
    const locked = 'Sisteme aynı anda birden fazla giriş yapamazsınız.';
    expect(
      describeError(new GibError('session-locked', locked, { gibMessage: locked })).detail,
    ).toBeUndefined();
    expect(
      describeError(new GibError('unknown', 'GİB beklenmeyen bir yanıt verdi (HTTP 503)')).detail,
    ).toBeUndefined();
  });

  test('a request that got no answer outside the SDK is a network error', () => {
    for (const error of [
      'error sending request for url (https://api.polar.sh/v1/customer-portal/license-keys/validate)',
      new TypeError('Load failed'),
      new Error('operation timed out'),
      'dns error: failed to lookup address information',
      'invalid peer certificate: UnknownIssuer',
    ]) {
      expect(describeError(error), String(error)).toEqual({ text: NETWORK_ERROR });
    }
  });

  test('keeps the app’s own Turkish messages, hides other English', () => {
    expect(describeError(new Error('Bu lisans anahtarı bulunamadı.'))).toEqual({
      text: 'Bu lisans anahtarı bulunamadı.',
    });
    expect(describeError(new Error('Cannot read properties of undefined'))).toEqual({
      text: UNEXPECTED_ERROR,
    });
    expect(describeError(undefined)).toEqual({ text: UNEXPECTED_ERROR });
  });
});

describe('toastError', () => {
  test('adds Ayarlar’a git when Ayarlar fixes it and the screen can go there', () => {
    const error = vi.spyOn(toast, 'error');
    const openSettings = vi.fn();
    toastError(new GibError('auth', 'Giriş başarısız'), { id: 'x', openSettings });
    expect(error).toHaveBeenLastCalledWith(GIB_ERROR_COPY.auth.text, {
      action: { label: 'Ayarlar’a git', onClick: openSettings },
      description: undefined,
      id: 'x',
    });

    toastError(new GibError('maintenance', 'GİB e-Arşiv portalı bakımda'), { openSettings });
    expect(error).toHaveBeenLastCalledWith(GIB_ERROR_COPY.maintenance.text, {
      action: undefined,
      description: undefined,
      id: undefined,
    });
    error.mockRestore();
  });
});
