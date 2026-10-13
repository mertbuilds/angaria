import { describe, expect, test } from 'vitest';
import {
  activityInput,
  INPUT_SIZE,
  MASK,
  redactSecrets,
  TRUNCATED,
} from '../src/lib/mcp-activity-input.ts';

describe('redactSecrets', () => {
  test('masks the SMS code and keeps the operation id', () => {
    expect(redactSecrets({ code: '123456', operationId: 'op-1' })).toEqual({
      code: MASK,
      operationId: 'op-1',
    });
  });

  test('masks passwords, tokens and secrets at any depth, whatever the value', () => {
    expect(
      redactSecrets({
        auth: { accessToken: 'abc', 'api-key': 'k', gibPassword: 'p', şifre: 's' },
        items: [{ name: 'Danışmanlık', smsCode: 654_321 }],
        Password: { nested: true },
      }),
    ).toEqual({
      auth: { accessToken: MASK, 'api-key': MASK, gibPassword: MASK, şifre: MASK },
      items: [{ name: 'Danışmanlık', smsCode: MASK }],
      Password: MASK,
    });
  });

  test('keeps the IBAN, SWIFT code, keys and other plain fields', () => {
    const input = {
      customerKeys: ['1234567890'],
      iban: 'TR330006100519786457841326',
      swiftCode: 'TGBATRIS',
      taxID: '1234567890',
    };
    expect(redactSecrets(input)).toEqual(input);
  });
});

describe('activityInput', () => {
  test('is indented JSON with secrets masked', () => {
    expect(activityInput({ code: '123456', operationId: 'op-1' })).toBe(
      JSON.stringify({ code: MASK, operationId: 'op-1' }, null, 2),
    );
  });

  test('is nothing for no arguments', () => {
    expect(activityInput(undefined)).toBeUndefined();
    expect(activityInput(null)).toBeUndefined();
    expect(activityInput({})).toBeUndefined();
  });

  test('cuts a large input at a line end and marks it', () => {
    const items = Array.from({ length: 200 }, (_, index) => ({
      name: `Hizmet ${index}`,
      quantity: 1,
      unitPrice: 1000,
    }));
    const input = activityInput({ items }) ?? '';
    expect(input.length).toBeLessThanOrEqual(INPUT_SIZE);
    expect(input.endsWith(`\n${TRUNCATED}`)).toBe(true);
    expect(input).toContain('"name": "Hizmet 0"');
    const kept = input.slice(0, -TRUNCATED.length - 1);
    expect(JSON.stringify({ items }, null, 2).startsWith(`${kept}\n`)).toBe(true);
  });

  test('keeps an input up to the cap whole', () => {
    const input = activityInput({ note: 'a'.repeat(100) }) ?? '';
    expect(input).not.toContain(TRUNCATED);
  });
});
