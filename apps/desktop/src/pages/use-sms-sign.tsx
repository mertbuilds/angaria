import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldError,
  FieldLabel,
  OTPInput,
} from '@angaria/ui';
import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import type { SessionInfo } from 'angaria-earsiv-sdk';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { startSMSSign, verifyAndSign } from '@/lib/angaria.ts';
import { describeError, toastError, type UserError } from '@/lib/gib-errors.ts';
import { gib, useGIBAccount } from '@/lib/gib.ts';
import type { SessionLease } from '@/lib/session-queue.ts';
import { SMS_CODE_LENGTH as CODE_LENGTH, smsCodeError } from '@/lib/sms-code.ts';

/** How long a sent code is waited for before a new one can be asked for. */
const RESEND_DELAY_MS = 60_000;

const styles = create({
  detail: {
    display: 'block',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
  },
  resend: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
    minHeight: '1.75rem',
  },
  // The link button's text lines up with the slots' left edge.
  resendButton: {
    paddingInline: 0,
  },
  resendText: {
    color: colors.muted,
    fontSize: font.sizeXs,
    fontVariantNumeric: 'tabular-nums',
    margin: 0,
  },
});

/** The id of the n-th slot (0-based): OTPInput puts `id` on the first, `{id}-2` on the second. */
const slotId = (id: string, index: number) => (index === 0 ? id : `${id}-${index + 1}`);

function SMSCodeForm({
  onResend,
  onVerify,
  phone,
}: {
  /** Has GİB send a new code. Rejects when it could not. */
  onResend: () => Promise<void>;
  /** Signs with the code. Rejects when GİB refused it. */
  onVerify: (code: string) => Promise<void>;
  phone: string;
}) {
  const id = useId();
  const codeId = `${id}-code`;
  const errorId = `${id}-error`;
  const [code, setCode] = useState('');
  const [error, setError] = useState<UserError | null>(null);
  const [pending, setPending] = useState<'resend' | 'verify' | null>(null);
  const [resent, setResent] = useState(false);
  const [resendAt, setResendAt] = useState(() => Date.now() + RESEND_DELAY_MS);
  const [now, setNow] = useState(() => Date.now());
  const [focusRequest, setFocusRequest] = useState<{ slot: number } | null>(null);
  // One GİB call at a time: an auto-submit, Enter and Onayla can land together.
  const busy = useRef(false);
  const secondsLeft = Math.max(0, Math.ceil((resendAt - now) / 1000));

  useEffect(() => {
    const timer = setInterval(() => {
      const time = Date.now();
      setNow(time);
      if (time >= resendAt) {
        clearInterval(timer);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [resendAt]);

  useEffect(() => {
    if (focusRequest) {
      document.getElementById(slotId(codeId, focusRequest.slot))?.focus();
    }
  }, [codeId, focusRequest]);

  async function verify(value: string) {
    if (busy.current) {
      return;
    }
    const problem = smsCodeError(value);
    if (problem) {
      setError({ text: problem });
      setFocusRequest({ slot: value.length });
      return;
    }
    busy.current = true;
    setPending('verify');
    setError(null);
    try {
      await onVerify(value);
    } catch (verifyError) {
      const described = describeError(verifyError);
      setError(described);
      // A wrong or expired code is typed again from the start.
      if (described.code === 'sms-code-wrong') {
        setCode('');
        setFocusRequest({ slot: 0 });
      }
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  async function resend() {
    if (busy.current) {
      return;
    }
    busy.current = true;
    setPending('resend');
    setError(null);
    setResent(false);
    try {
      await onResend();
      const time = Date.now();
      setCode('');
      setResent(true);
      setNow(time);
      setResendAt(time + RESEND_DELAY_MS);
      setFocusRequest({ slot: 0 });
    } catch (resendError) {
      setError(describeError(resendError));
    } finally {
      busy.current = false;
      setPending(null);
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void verify(code);
  };

  return (
    <form noValidate onSubmit={submit} {...props(styles.form)}>
      <DialogHeader>
        <DialogTitle>SMS ile onayla</DialogTitle>
        <DialogDescription>
          {phone} numarasına gelen SMS şifresini gir. Onaylanan fatura kesinleşir.
        </DialogDescription>
      </DialogHeader>
      <Field data-invalid={error ? true : undefined}>
        <FieldLabel htmlFor={codeId} id={`${codeId}-label`}>
          SMS şifresi
        </FieldLabel>
        <OTPInput
          aria-describedby={error ? errorId : undefined}
          aria-labelledby={`${codeId}-label`}
          id={codeId}
          invalid={error !== null}
          length={CODE_LENGTH}
          // Six characters sign at once, typed or pasted, without Enter.
          onComplete={(value) => void verify(value)}
          onValueChange={setCode}
          value={code}
        />
        {error && (
          <FieldError id={errorId}>
            {error.text}
            {error.detail && <span {...props(styles.detail)}>{error.detail}</span>}
          </FieldError>
        )}
      </Field>
      <div {...props(styles.resend)}>
        <Button
          disabled={secondsLeft > 0 || pending !== null}
          onClick={() => void resend()}
          style={styles.resendButton}
          variant="link"
        >
          {pending === 'resend' ? 'Gönderiliyor…' : 'Kodu tekrar gönder'}
        </Button>
        {secondsLeft > 0 && <span {...props(styles.resendText)}>{secondsLeft} saniye sonra</span>}
        <p role="status" {...props(styles.resendText)}>
          {resent ? 'Yeni SMS şifresi gönderildi.' : ''}
        </p>
      </div>
      <DialogFooter>
        <DialogClose disabled={pending !== null} render={<Button variant="outline" />}>
          Vazgeç
        </DialogClose>
        <Button disabled={pending === 'verify'} focusableWhenDisabled type="submit">
          {pending === 'verify' ? 'Onaylanıyor…' : 'Onayla'}
        </Button>
      </DialogFooter>
    </form>
  );
}

interface Signing {
  ettns: Array<string>;
  /** Ends the flow: true once GİB signed the invoices. */
  finish: (signed: boolean) => void;
  lease: SessionLease;
  oid: string;
  phone: string;
}

export interface SignResult<T> {
  signed: boolean;
  /** What `prepare` returned. */
  value: T;
}

/**
 * SMS ile onayla on one leased GİB session: `sign` runs `prepare` on the
 * session (create the draft, or nothing for one that exists), has GİB send the
 * code, and `dialog` asks for it. No other GİB call gets the session until the
 * invoices are signed or the dialog closes; the screen closing ends the flow
 * too. Render `dialog` once.
 */
export function useSMSSign() {
  const account = useGIBAccount();
  const [signing, setSigning] = useState<Signing | null>(null);
  const [sending, setSending] = useState(false);
  // Aborts when the screen closes: a flow still starting or waiting on the
  // code hands the GİB session back (gib.leaseWith).
  const screen = useRef(new AbortController());
  // A GİB call on the lease (verify, resend) is in flight: closing then would
  // hand the session back mid-call and lose whether GİB signed.
  const calling = useRef(false);

  useEffect(() => {
    const controller = new AbortController();
    screen.current = controller;
    return () => controller.abort();
  }, []);

  const onLease = async (call: () => Promise<void>) => {
    calling.current = true;
    try {
      await call();
    } finally {
      calling.current = false;
    }
  };

  // Failures show in the dialog, so the user can type the code again.
  const verify = (flow: Signing, code: string) =>
    onLease(async () => {
      await verifyAndSign(flow.lease.session, code, flow.oid, flow.ettns);
      flow.lease.release();
      setSigning(null);
      flow.finish(true);
    });

  // A new code on the same session; verifying uses the OID it came with.
  const resend = (flow: Signing) =>
    onLease(async () => {
      const sent = await startSMSSign(flow.lease.session);
      setSigning((current) =>
        current === flow ? { ...flow, oid: sent.oid, phone: sent.phone } : current,
      );
    });

  // Escape and Vazgeç wait for a call in flight (Vazgeç is disabled then).
  const cancel = () => {
    if (signing && !calling.current) {
      signing.lease.release();
      setSigning(null);
      signing.finish(false);
    }
  };

  /**
   * Resolves once the flow ends: `signed` and what `prepare` returned, or null
   * when the screen closed first. Rejects when the session or `prepare`
   * fails. Sending the code can fail after `prepare` made something (a draft),
   * so that failure shows as a toast and resolves unsigned. `prepare` returns
   * the ETTNs to sign; none ends the flow unsigned.
   */
  async function sign<T>(
    prepare: (session: SessionInfo) => Promise<{ ettns: Array<string>; value: T }>,
  ): Promise<SignResult<T> | null> {
    const { signal } = screen.current;
    setSending(true);
    let started;
    try {
      started = await gib.leaseWith(
        account,
        async (session) => {
          const prepared = await prepare(session);
          if (prepared.ettns.length === 0) {
            return { prepared, sent: null };
          }
          try {
            return { prepared, sent: await startSMSSign(session) };
          } catch (error) {
            return { error, prepared, sent: null };
          }
        },
        signal,
      );
    } finally {
      setSending(false);
    }
    if (!started) {
      return null;
    }
    const { lease, value } = started;
    const { prepared, sent } = value;
    if (!sent) {
      const error = 'error' in value ? value.error : undefined;
      lease.release(error);
      if (error !== undefined) {
        toastError(error);
      }
      return { signed: false, value: prepared.value };
    }
    return new Promise((resolve) => {
      const onAbort = () => finish(false);
      const finish = (signed: boolean) => {
        signal.removeEventListener('abort', onAbort);
        resolve({ signed, value: prepared.value });
      };
      signal.addEventListener('abort', onAbort, { once: true });
      setSigning({ ettns: prepared.ettns, finish, lease, oid: sent.oid, phone: sent.phone });
    });
  }

  const dialog = (
    <Dialog onOpenChange={(open) => !open && cancel()} open={signing !== null}>
      <DialogContent showCloseButton={false}>
        {signing && (
          <SMSCodeForm
            onResend={() => resend(signing)}
            onVerify={(code) => verify(signing, code)}
            phone={signing.phone}
          />
        )}
      </DialogContent>
    </Dialog>
  );

  return { dialog, sending, sign };
}
