import { describe, expect, test } from 'vitest';
import { evaluateNumberText } from '../../../packages/ui/src/lib/number-text.ts';

/** Turkish operands: dots group thousands, a comma is the decimal point. */
function parse(text: string) {
  const normalized = text.replaceAll('.', '').replace(',', '.');
  return /^\d+(?:\.\d+)?$/.test(normalized) ? Number(normalized) : null;
}

const evaluate = (text: string) => evaluateNumberText(text, parse);

const dotDecimal = (text: string) => (/^\d+(?:\.\d+)?$/.test(text) ? Number(text) : null);

describe('evaluateNumberText', () => {
  test.each([
    ['3*8', 24],
    ['90000/12', 7500],
    ['1200+15%', 1380],
    ['1200-%15', 1020],
    ['(2+3)*1,5', 7.5],
    ['3*1.500', 4500],
    ['200*15%', 30],
    ['%20', 20],
    ['2 + 3 * 4', 14],
    ['(2+3)*(4-1)', 15],
    ['10/4', 2.5],
    ['0,1+0,2', 0.3],
    ['-42,5', -42.5],
    ['5-(-2)', 7],
    ['3×8', 24],
    ['90000÷12', 7500],
    ['10−4', 6],
    ['1.250,50', 1250.5],
  ])('%s = %s', (text, expected) => {
    expect(evaluate(text)).toBe(expected);
  });

  test.each([
    'abc',
    '',
    '3*',
    '*3',
    '3**8',
    '(2+3',
    '2+3)',
    '()',
    '1/0',
    '15%%',
    '%%15',
    '3*8 abc',
    '1,2,3+1',
  ])('%j is null', (text) => {
    expect(evaluate(text)).toBeNull();
  });

  test('operands go through the injected parse', () => {
    expect(evaluateNumberText('3*1.5', dotDecimal)).toBe(4.5);
  });

  test('a 2,000-character paste returns at once', () => {
    const pastes = [
      '1+'.repeat(1000),
      `${'1+'.repeat(999)}1`,
      '('.repeat(2000),
      `${'('.repeat(1000)}1${')'.repeat(1000)}`,
      '9'.repeat(2000),
      'x'.repeat(2000),
      '1.2'.repeat(667),
    ];
    const started = performance.now();
    const results = pastes.map(evaluate);
    expect(performance.now() - started).toBeLessThan(100);
    expect(results).toEqual([null, 1000, null, null, null, null, null]);
  });
});
