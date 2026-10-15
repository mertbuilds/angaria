/** GİB's SMS şifresi has six characters: digits, and since 2026 letters too. */
export const SMS_CODE_LENGTH = 6;

/**
 * What is wrong with a typed SMS şifresi, in the user's words, or null. Spaces
 * are ignored ("123 456").
 */
export function smsCodeError(value: string): string | null {
  const code = value.replaceAll(/\s/g, '');
  if (!code) {
    return 'SMS şifresini gir';
  }
  if (!/^[a-z\d]+$/i.test(code)) {
    return 'SMS şifresini yalnızca harf ve rakamla yaz';
  }
  return code.length === SMS_CODE_LENGTH
    ? null
    : `SMS şifresinin ${SMS_CODE_LENGTH} hanesini de gir`;
}
