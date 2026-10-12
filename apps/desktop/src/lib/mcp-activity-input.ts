// The input an MCP call got, as the activity log keeps it: secrets masked,
// pretty JSON, at most INPUT_SIZE characters.

/** The activity log keeps at most this many characters of a call's input. */
export const INPUT_SIZE = 4096;
export const MASK = '••••••';
export const TRUNCATED = '… kısaltıldı';

const SECRET_KEYS = new Set([
  'apikey',
  'authorization',
  'code',
  'otp',
  'pass',
  'passwd',
  'password',
  'secret',
  'sifre',
  'smscode',
  'token',
  'şifre',
]);

/** A key that names a secret: an SMS code, a password, a token. `swiftCode` is not one. */
const isSecretKey = (key: string) => {
  const name = key.toLocaleLowerCase('tr').replaceAll(/[^\p{L}\p{N}]/gu, '');
  return SECRET_KEYS.has(name) || /password|token|secret/.test(name);
};

/** `value` with the value of every secret key, at any depth, replaced by MASK. */
export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSecrets);
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        isSecretKey(key) ? MASK : redactSecrets(item),
      ]),
    );
  }
  return value;
}

/**
 * The input to log for a call's arguments: secrets masked, indented JSON, cut
 * at a line end before INPUT_SIZE with TRUNCATED after it. Nothing for no
 * arguments.
 */
export function activityInput(args: unknown): string | undefined {
  if (
    args === undefined ||
    args === null ||
    (typeof args === 'object' && Object.keys(args).length === 0)
  ) {
    return undefined;
  }
  const text = JSON.stringify(redactSecrets(args), null, 2);
  if (text.length <= INPUT_SIZE) {
    return text;
  }
  const cut = text.slice(0, INPUT_SIZE - TRUNCATED.length - 1);
  const lineEnd = cut.lastIndexOf('\n');
  return `${lineEnd > 0 ? cut.slice(0, lineEnd) : cut}\n${TRUNCATED}`;
}
