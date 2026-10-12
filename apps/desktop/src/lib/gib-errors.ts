// Every failure the user sees, in their words: what happened and what to do.
// GİB calls fail with the SDK's GibError (a code and GİB's own text). Other
// errors are read here too (Tauri's http plugin rejects with reqwest's English
// text), so no English reaches the screen.

import { toast } from '@angaria/ui';
import { GibError, type GibErrorCode } from 'angaria-earsiv-sdk';
import { sessionCloser } from './session-queue.ts';

/**
 * What fixes it. settings: the screen offers Ayarlar’a git where it can.
 * close-session: GİB has a session open; the screen offers to close it as
 * Oturumu kapat does (`closeSessionAction`), Ayarlar’a git when it cannot.
 */
export type ErrorAction = 'close-session' | 'settings';

export interface GibErrorCopy {
  action?: ErrorAction;
  /** GİB's own text tells more than `text`, so it is shown under it. */
  detail?: boolean;
  text: string;
}

export const GIB_ERROR_COPY: Record<GibErrorCode, GibErrorCopy> = {
  auth: {
    action: 'settings',
    text: 'Kullanıcı kodu ya da şifre hatalı. Ayarlar’dan kontrol et.',
  },
  maintenance: { text: 'GİB e-Arşiv portalı şu an bakımda. Biraz sonra tekrar dene.' },
  network: {
    text: 'GİB’e ulaşılamadı. İnternet bağlantını kontrol et ya da biraz sonra tekrar dene.',
  },
  'not-found': { text: 'Belge GİB’de bulunamadı. Listeyi yenileyip tekrar dene.' },
  'range-too-long': {
    text: 'GİB bu kadar uzun bir tarih aralığını kabul etmiyor. Daha kısa bir aralık seç.',
  },
  'rate-limit': {
    detail: true,
    text: 'GİB şu an yoğun. Birkaç dakika bekleyip tekrar dene.',
  },
  'session-expired': { text: 'GİB oturumu kapandı. Tekrar dene.' },
  // GİB allows one session per user. Oturumu kapat ends it at once; GİB's own
  // advice (Güvenli Çıkış, then a wait) is for when that fails.
  'session-locked': {
    action: 'close-session',
    text: 'GİB’de açık bir oturumun var. Oturumu kapatıp tekrar dene.',
  },
  'sms-code-wrong': {
    text: 'SMS şifresi hatalı ya da süresi dolmuş. Şifreyi kontrol et ya da yeni bir SMS şifresi iste.',
  },
  'sms-failed': {
    detail: true,
    text: 'SMS şifresi gönderilemedi. Portalda kayıtlı cep telefonunu kontrol et ya da biraz sonra tekrar dene.',
  },
  unknown: { detail: true, text: 'GİB işlemi tamamlayamadı. Biraz sonra tekrar dene.' },
  validation: {
    detail: true,
    text: 'GİB bu işlemi kabul etmedi. Bilgileri kontrol edip tekrar dene.',
  },
};

/** TCMB's rates could not be fetched; the rate field then asks for one. */
export const TCMB_RATE_ERROR = 'TCMB kuru alınamadı, kuru elle girebilirsin.';

/** A request outside GİB that never got an answer. */
export const NETWORK_ERROR = 'Bağlantı kurulamadı. İnternet bağlantını kontrol et.';

export const UNEXPECTED_ERROR = 'İşlem tamamlanamadı. Tekrar dene.';

/** Oturumu kapat failed too: GİB's own way out. */
export const SESSION_CLOSE_FAILED =
  'Oturum kapatılamadı. Tarayıcında e-Arşiv portalından Güvenli Çıkış yap, sonra yaklaşık 10 dakika sonra tekrar dene.';

/** After closing the session that refused a write: the user starts it again. */
export const SESSION_CLOSED_WRITE = 'İşlemi yeniden başlatabilirsin.';

export const CLOSE_AND_RETRY = 'Oturumu kapat ve tekrar dene';

export interface UserError {
  action?: ErrorAction;
  code?: GibErrorCode;
  /** GİB's own text, when it adds to `text`. */
  detail?: string;
  text: string;
}

/** Turkish text has these; English, GİB's included ("Service Not Found"), does not. */
const TURKISH = /[çğıöşüÇĞİÖŞÜ]/;

/** What reqwest (Tauri's http plugin), WebKit and Node reject with when no answer came. */
const NETWORK =
  /error sending request|dns|timed? ?out|tls|certificate|connection|network|fetch failed|load failed/i;

function rawText(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return typeof error === 'string' ? error : '';
}

/** The user's words for `error`: what happened, what to do, and GİB's text when it helps. */
export function describeError(error: unknown): UserError {
  if (error instanceof GibError) {
    const { action, detail, text } = GIB_ERROR_COPY[error.code];
    const gibMessage = error.gibMessage?.trim().replace(/!+$/, '.');
    return {
      // Without the queue's closer, Ayarlar’s Oturumu kapat does it.
      action: action === 'close-session' && !sessionCloser(error) ? 'settings' : action,
      code: error.code,
      detail:
        detail && gibMessage && TURKISH.test(gibMessage)
          ? `GİB’in mesajı: ${gibMessage}`
          : undefined,
      text,
    };
  }
  const message = rawText(error);
  if (NETWORK.test(message)) {
    return { text: NETWORK_ERROR };
  }
  // The app's own errors (keychain, settings) are Turkish already.
  return { text: TURKISH.test(message) ? message : UNEXPECTED_ERROR };
}

export const errorMessage = (error: unknown) => describeError(error).text;

/**
 * Closes the GİB session that refused `error`'s call, as Oturumu kapat does.
 * False when it could not (the caller shows SESSION_CLOSE_FAILED).
 */
export async function closeLockedSession(error: unknown): Promise<boolean> {
  const close = sessionCloser(error);
  if (!close) {
    return false;
  }
  try {
    await close();
    return true;
  } catch {
    return false;
  }
}

/**
 * A toast button that closes the session behind `error`, with its progress
 * in a toast. A read goes again (`retry`); a write never does: the toast
 * says so and the user starts it again.
 */
export function closeSessionAction(error: unknown, retry?: () => void) {
  return {
    label: retry ? CLOSE_AND_RETRY : 'Oturumu kapat',
    onClick: () => {
      const id = toast.loading('Oturum kapatılıyor…');
      void closeLockedSession(error).then((closed) => {
        if (!closed) {
          toast.error(SESSION_CLOSE_FAILED, { id });
        } else if (retry) {
          toast.dismiss(id);
          retry();
        } else {
          toast.success('Oturum kapatıldı', { description: SESSION_CLOSED_WRITE, id });
        }
      });
    },
  };
}

/**
 * An error toast in the user's words, GİB's text under it when it helps,
 * Ayarlar’a git when Ayarlar fixes it and `openSettings` is given, and for
 * an open GİB session a button that closes it. Pass `retry` only for a read:
 * it runs again once the session is closed.
 */
export function toastError(
  error: unknown,
  {
    id,
    openSettings,
    retry,
  }: { id?: number | string; openSettings?: () => void; retry?: () => void } = {},
) {
  const { action, detail, text } = describeError(error);
  let button;
  if (action === 'close-session') {
    button = closeSessionAction(error, retry);
  } else if (action === 'settings' && openSettings) {
    button = { label: 'Ayarlar’a git', onClick: openSettings };
  }
  return toast.error(text, { action: button, description: detail, id });
}
