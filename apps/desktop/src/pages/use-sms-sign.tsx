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
  FieldLabel,
  Input,
} from '@angaria/ui';
import { spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useMutation } from '@tanstack/react-query';
import type { SessionInfo } from 'angaria-earsiv-sdk';
import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { startSMSSign, verifyAndSign } from '@/lib/angaria.ts';
import { toastError } from '@/lib/gib-errors.ts';
import { gib, useGIBAccount } from '@/lib/gib.ts';
import type { SessionLease } from '@/lib/session-queue.ts';

const styles = create({
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
  },
});

function SMSCodeForm({
  onVerify,
  pending,
  phone,
}: {
  onVerify: (code: string) => void;
  pending: boolean;
  phone: string;
}) {
  const id = useId();
  const [code, setCode] = useState('');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (code.trim() && !pending) {
      onVerify(code.trim());
      setCode('');
    }
  };

  return (
    <form onSubmit={submit} {...props(styles.form)}>
      <DialogHeader>
        <DialogTitle>SMS ile onayla</DialogTitle>
        <DialogDescription>
          {phone} numarasına gelen SMS şifresini gir. Onaylanan fatura kesinleşir.
        </DialogDescription>
      </DialogHeader>
      <Field>
        <FieldLabel htmlFor={`${id}-code`}>SMS şifresi</FieldLabel>
        <Input
          autoComplete="one-time-code"
          autoFocus
          id={`${id}-code`}
          inputMode="numeric"
          onChange={(event) => setCode(event.target.value)}
          value={code}
        />
      </Field>
      <DialogFooter>
        <DialogClose render={<Button variant="outline" />}>Vazgeç</DialogClose>
        <Button disabled={!code.trim() || pending} type="submit">
          {pending ? 'Onaylanıyor…' : 'Onayla'}
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

  useEffect(() => {
    const controller = new AbortController();
    screen.current = controller;
    return () => controller.abort();
  }, []);

  const verify = useMutation({
    mutationFn: ({ code, flow }: { code: string; flow: Signing }) =>
      verifyAndSign(flow.lease.session, code, flow.oid, flow.ettns),
    onSuccess: (_, { flow }) => {
      flow.lease.release();
      setSigning(null);
      flow.finish(true);
    },
  });

  const cancel = () => {
    if (signing) {
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
      const finish = (signed: boolean) => resolve({ signed, value: prepared.value });
      signal.addEventListener('abort', () => finish(false), { once: true });
      setSigning({ ettns: prepared.ettns, finish, lease, oid: sent.oid, phone: sent.phone });
    });
  }

  const dialog = (
    <Dialog onOpenChange={(open) => !open && cancel()} open={signing !== null}>
      <DialogContent showCloseButton={false}>
        {signing && (
          <SMSCodeForm
            onVerify={(code) => verify.mutate({ code, flow: signing })}
            pending={verify.isPending}
            phone={signing.phone}
          />
        )}
      </DialogContent>
    </Dialog>
  );

  return { dialog, sending, sign };
}
