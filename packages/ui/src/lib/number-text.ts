/**
 * Arithmetic typed into a number field: `3*8`, `90000/12`, `1200+15%`,
 * `(2+3)*1,5`. The numbers in it go through the field's own `parse`, so
 * `1.500` and `1,5` mean what the field means by them. No `eval`.
 *
 * A percentage (`15%`, or the Turkish `%15`) is a share of the left operand
 * after + and − (`1200+15%` is 1380) and a fraction after × and ÷ (`200*15%`
 * is 30). On its own it is the number itself (`%20` is 20).
 *
 * Returns null for anything else, including a result that is not finite.
 */
export function evaluateNumberText(
  text: string,
  parse: (operand: string) => number | null,
): number | null {
  const tokens = tokenize(text, parse);
  if (!tokens) {
    return null;
  }
  const value = evaluate(tokens);
  return value === null ? null : finite(value);
}

type Operator = '%' | '(' | ')' | '*' | '+' | '-' | '/';
type Token = number | Operator;

const OPERATORS: Readonly<Record<string, Operator>> = {
  '-': '-',
  '(': '(',
  ')': ')',
  '*': '*',
  '/': '/',
  '%': '%',
  '+': '+',
  '÷': '/',
  '×': '*',
  '−': '-',
};

/** Nesting deeper than this is not arithmetic anyone types. */
const MAX_DEPTH = 32;

/** Drops float noise: 0.1 + 0.2 is 0.3. */
const finite = (value: number) => (Number.isFinite(value) ? Number(value.toPrecision(15)) : null);

function tokenize(text: string, parse: (operand: string) => number | null): Array<Token> | null {
  const tokens: Array<Token> = [];
  let operand = '';
  const flush = () => {
    const trimmed = operand.trim();
    operand = '';
    if (!trimmed) {
      return true;
    }
    const value = parse(trimmed);
    if (value === null || !Number.isFinite(value)) {
      return false;
    }
    tokens.push(value);
    return true;
  };
  for (const char of text) {
    const operator = OPERATORS[char];
    if (operator === undefined) {
      operand += char;
    } else {
      if (!flush()) {
        return null;
      }
      tokens.push(operator);
    }
  }
  if (!flush() || tokens.length === 0) {
    return null;
  }
  return tokens;
}

interface Term {
  /** Marked with %: resolved against its left operand. */
  percent: boolean;
  value: number;
}

const plain = (term: Term) => (term.percent ? term.value / 100 : term.value);

/** A recursive descent over the tokens: sums of products of signed factors. */
function evaluate(tokens: ReadonlyArray<Token>): number | null {
  let index = 0;
  let depth = 0;
  const peek = () => tokens[index];
  const next = () => {
    const token = tokens[index];
    index += 1;
    return token;
  };

  // A number or a parenthesized sum.
  const primary = (): Term | null => {
    const token = next();
    if (typeof token === 'number') {
      return { percent: false, value: token };
    }
    if (token !== '(' || depth >= MAX_DEPTH) {
      return null;
    }
    depth += 1;
    const inner = sum();
    depth -= 1;
    return inner && next() === ')' ? inner : null;
  };

  // A signed or %-marked factor: `-5`, `%15`, `15%`.
  const unary = (): Term | null => {
    const token = peek();
    if (token === '+' || token === '-') {
      next();
      const operand = unary();
      return operand && { ...operand, value: token === '-' ? -operand.value : operand.value };
    }
    if (token === '%') {
      next();
      const operand = primary();
      return operand && !operand.percent ? { percent: true, value: operand.value } : null;
    }
    const operand = primary();
    if (operand && peek() === '%') {
      next();
      return operand.percent ? null : { percent: true, value: operand.value };
    }
    return operand;
  };

  // Factors joined by × and ÷.
  const product = (): Term | null => {
    let left = unary();
    while (left && (peek() === '*' || peek() === '/')) {
      const operator = next();
      const right = unary();
      if (!right) {
        return null;
      }
      left = {
        percent: false,
        value: operator === '*' ? plain(left) * plain(right) : plain(left) / plain(right),
      };
    }
    return left;
  };

  // Products joined by + and −; a % operand is a share of the left side.
  function sum(): Term | null {
    let left = product();
    while (left && (peek() === '+' || peek() === '-')) {
      const operator = next();
      const right = product();
      if (!right) {
        return null;
      }
      const base = plain(left);
      const amount = right.percent ? (base * right.value) / 100 : right.value;
      left = { percent: false, value: operator === '+' ? base + amount : base - amount };
    }
    return left;
  }

  const result = sum();
  return result && index === tokens.length ? result.value : null;
}
