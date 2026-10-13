import { toast } from '@angaria/ui';
import { GIB_ERROR_CODES, GibError } from 'angaria-earsiv-sdk';
import { describe, expect, test, vi, type MockInstance } from 'vitest';
import {
  CLOSE_AND_RETRY,
  describeError,
  GIB_ERROR_COPY,
  NETWORK_ERROR,
  SESSION_CLOSE_FAILED,
  SESSION_CLOSED_WRITE,
  TCMB_RATE_ERROR,
  toastError,
  UNEXPECTED_ERROR,
} from '../src/lib/gib-errors.ts';
import { createSessionQueue } from '../src/lib/session-queue.ts';

const ENGLISH =
  /\b(?:the|and|error|failed|request|please|try|again|not|found|network|session|invalid|unknown|timeout)\b/i;

const texts = [
  ...GIB_ERROR_CODES.map((code) => GIB_ERROR_COPY[code].text),
  TCMB_RATE_ERROR,
  NETWORK_ERROR,
  UNEXPECTED_ERROR,
  SESSION_CLOSE_FAILED,
  SESSION_CLOSED_WRITE,
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

  test('only a wrong password points to Ayarlar, only an open session offers to close it', () => {
    expect(GIB_ERROR_CODES.filter((code) => GIB_ERROR_COPY[code].action === 'settings')).toEqual([
      'auth',
    ]);
    expect(
      GIB_ERROR_CODES.filter((code) => GIB_ERROR_COPY[code].action === 'close-session'),
    ).toEqual(['session-locked']);
  });

  test('the 10 minute wait is only advice for when closing fails', () => {
    expect(GIB_ERROR_COPY['session-locked'].text).not.toMatch(/dakika/);
    expect(SESSION_CLOSE_FAILED).toMatch(/10 dakika/);
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
      'error sending request for url (https://www.tcmb.gov.tr/kurlar/today.xml)',
      new TypeError('Load failed'),
      new Error('operation timed out'),
      'dns error: failed to lookup address information',
      'invalid peer certificate: UnknownIssuer',
    ]) {
      expect(describeError(error), String(error)).toEqual({ text: NETWORK_ERROR });
    }
  });

  test('keeps the app’s own Turkish messages, hides other English', () => {
    expect(describeError(new Error('Şirket bilgileri kaydedilemedi.'))).toEqual({
      text: 'Şirket bilgileri kaydedilemedi.',
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

const lockedText = 'Sisteme aynı anda birden fazla giriş yapamazsınız.';

/** A refusal for an open session from a queue, as the app's calls get it. */
async function lockedError(forceLogout = vi.fn(async () => {})) {
  const queue = createSessionQueue({
    forceLogout,
    login: async () => {
      throw new GibError('session-locked', lockedText, { gibMessage: lockedText });
    },
    logout: async () => {},
  });
  const error: unknown = await queue
    .run({ credentials: async () => ({ password: '1', username: 'u' }), key: 'u' }, async () => {})
    .catch((error: unknown) => error);
  return { error, forceLogout };
}

/** The button of the last error toast. */
function lastAction(shown: MockInstance<typeof toast.error>) {
  const action = shown.mock.lastCall?.[1]?.action;
  if (!action || typeof action !== 'object' || !('onClick' in action)) {
    throw new Error('The toast has no button.');
  }
  return action as { label: string; onClick: () => void };
}

describe('an open GİB session', () => {
  test('offers to close it, or Ayarlar’s Oturumu kapat when the call has no closer', async () => {
    const { error } = await lockedError();
    expect(describeError(error).action).toBe('close-session');
    expect(describeError(new GibError('session-locked', lockedText)).action).toBe('settings');
  });

  test('a read closes the session, then goes again', async () => {
    const shown = vi.spyOn(toast, 'error').mockReturnValue('t');
    const loading = vi.spyOn(toast, 'loading').mockReturnValue('l');
    const dismiss = vi.spyOn(toast, 'dismiss').mockImplementation(() => 'l');
    const { error, forceLogout } = await lockedError();
    const retry = vi.fn();

    toastError(error, { retry });
    const action = lastAction(shown);
    expect(action.label).toBe(CLOSE_AND_RETRY);
    action.onClick();
    await vi.waitFor(() => expect(retry).toHaveBeenCalledOnce());
    expect(forceLogout).toHaveBeenCalledWith('u', '1');
    expect(loading).toHaveBeenCalledWith('Oturum kapatılıyor…');
    expect(dismiss).toHaveBeenCalledWith('l');
    vi.restoreAllMocks();
  });

  test('a write only closes the session: the user starts it again', async () => {
    const shown = vi.spyOn(toast, 'error').mockReturnValue('t');
    vi.spyOn(toast, 'loading').mockReturnValue('l');
    const success = vi.spyOn(toast, 'success').mockReturnValue('l');
    const { error, forceLogout } = await lockedError();

    toastError(error);
    const action = lastAction(shown);
    expect(action.label).toBe('Oturumu kapat');
    action.onClick();
    await vi.waitFor(() =>
      expect(success).toHaveBeenCalledWith('Oturum kapatıldı', {
        description: SESSION_CLOSED_WRITE,
        id: 'l',
      }),
    );
    expect(forceLogout).toHaveBeenCalledOnce();
    vi.restoreAllMocks();
  });

  test('a close that fails gives GİB’s own way out, and nothing goes again', async () => {
    const shown = vi.spyOn(toast, 'error').mockReturnValue('t');
    vi.spyOn(toast, 'loading').mockReturnValue('l');
    const { error } = await lockedError(
      vi.fn(async () => {
        throw new GibError('network', 'GİB’e ulaşılamadı');
      }),
    );
    const retry = vi.fn();

    toastError(error, { retry });
    lastAction(shown).onClick();
    await vi.waitFor(() =>
      expect(shown).toHaveBeenLastCalledWith(SESSION_CLOSE_FAILED, { id: 'l' }),
    );
    expect(retry).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
