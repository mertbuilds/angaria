'use client';

import { create, props as stylexProps } from '@stylexjs/stylex';
import { MinusIcon, PlusIcon } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { evaluateNumberText } from '../lib/number-text.ts';
import { colors, radius } from '../lib/tokens.stylex.ts';
import { Input, type InputProps } from './input.tsx';

const styles = create({
  end: {
    alignItems: 'center',
    display: 'flex',
    insetBlock: 0,
    insetInlineEnd: '1rem',
    position: 'absolute',
  },
  endSteppers: {
    insetInlineEnd: '0.375rem',
  },
  hint: {
    alignItems: 'center',
    color: colors.mutedForeground,
    display: 'flex',
    fontSize: '0.75rem',
    fontVariantNumeric: 'tabular-nums',
    insetBlock: 0,
    insetInlineStart: '1rem',
    pointerEvents: 'none',
    position: 'absolute',
    whiteSpace: 'nowrap',
  },
  input: {
    fontVariantNumeric: 'tabular-nums',
    textAlign: 'right',
  },
  // Room for the hint at the start and the suffix and steppers at the end.
  padEnd: (width: string) => ({ paddingInlineEnd: width }),
  padStart: (width: string) => ({ paddingInlineStart: width }),
  stepper: {
    '::before': {
      // A 28 by 38px target inside the 40px field; the two never overlap.
      content: '""',
      insetBlock: '-0.3125rem',
      insetInline: 0,
      position: 'absolute',
    },
    alignItems: 'center',
    backgroundColor: {
      ':hover': { '@media (hover: hover)': colors.accent, default: null },
      default: 'transparent',
    },
    borderRadius: radius.full,
    borderWidth: 0,
    color: {
      ':hover': { '@media (hover: hover)': colors.foreground, default: null },
      default: colors.mutedForeground,
    },
    cursor: 'pointer',
    display: 'inline-flex',
    height: '1.75rem',
    justifyContent: 'center',
    padding: 0,
    position: 'relative',
    touchAction: 'manipulation',
    width: '1.75rem',
  },
  suffix: {
    color: colors.mutedForeground,
    cursor: 'text',
    fontSize: '0.875rem',
    paddingInlineStart: '0.25rem',
    userSelect: 'none',
  },
  suffixBeforeSteppers: {
    paddingInlineEnd: '0.25rem',
  },
  wrap: {
    minWidth: 0,
    position: 'relative',
    width: '100%',
  },
});

export type NumberInputProps = Omit<
  InputProps,
  'defaultValue' | 'max' | 'min' | 'step' | 'type' | 'value'
> & {
  /** Evaluates `3*8`, `90000/12` or `1200+15%` while typing. Default true. */
  allowExpressions?: boolean | undefined;
  /** Shows 0 as an empty field with the placeholder. */
  blankZero?: boolean | undefined;
  /** The text a value shows once the field is left. */
  format: (value: number) => string;
  /** The ↑/↓ step with Shift. Default `step * 10`. */
  largeStep?: number | undefined;
  /** Bounds for ↑/↓ and the steppers. Typed values are left for the form's checks. */
  max?: number | undefined;
  min?: number | undefined;
  /** Every change: the parsed value, NaN while the text does not parse. */
  onValueChange: (value: number) => void;
  /** The number in `text`, or null when it does not parse. */
  parse: (text: string) => number | null;
  /** The ↑/↓ step; Alt takes a tenth of it. Default 1. */
  step?: number | undefined;
  /** Small − and + buttons inside the field (Shift-click ×10, hold to repeat). */
  steppers?: boolean | undefined;
  /** Shown inside the field's end, e.g. ₺ or %. A click on it focuses the field. */
  suffix?: ReactNode;
  /** NaN while the text does not parse. */
  value: number;
};

const DECREMENT_LABEL = 'Azalt';
const INCREMENT_LABEL = 'Artır';

/** Hold a stepper this long before it repeats, then repeat this often. */
const REPEAT_DELAY = 400;
const REPEAT_INTERVAL = 60;

const setRef = <T,>(ref: Ref<T> | undefined, element: T | null) => {
  if (typeof ref === 'function') {
    ref(element);
  } else if (ref) {
    ref.current = element;
  }
};

/**
 * A number field that never blocks typing. The text stays as typed and the
 * parsed value goes to `onValueChange` on every keystroke; `3*1.500` counts as
 * 4500 with a muted "= 4.500" hint. On blur and Enter the text becomes the
 * formatted value. ↑/↓ step (Shift ×10, Alt ×0.1), as do the optional
 * steppers. `style` sizes the field; the text is right aligned in tabular
 * figures.
 */
const NumberInput = ({
  allowExpressions = true,
  'aria-describedby': describedBy,
  blankZero = false,
  disabled,
  format,
  largeStep,
  max,
  min,
  onBlur,
  onChange,
  onKeyDown,
  onValueChange,
  parse,
  readOnly,
  ref,
  step = 1,
  steppers = false,
  style,
  suffix,
  value,
  ...props
}: NumberInputProps) => {
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLSpanElement | null>(null);
  const repeat = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [endWidth, setEndWidth] = useState(0);
  const mergedRef = useCallback(
    (element: HTMLInputElement | null) => {
      inputRef.current = element;
      setRef(ref, element);
    },
    [ref],
  );

  const read = (text: string) => {
    const parsed = parse(text);
    return parsed !== null || !allowExpressions ? parsed : evaluateNumberText(text, parse);
  };
  const show = (number: number) =>
    Number.isNaN(number) || (blankZero && number === 0) ? '' : format(number);

  const [text, setText] = useState(() => show(value));
  const [shown, setShown] = useState(value);
  // The value the steppers count from while held, ahead of the next render.
  const current = useRef(value);
  useEffect(() => {
    current.current = value;
  }, [value]);

  // A value set elsewhere replaces the text.
  if (!Object.is(shown, value)) {
    setShown(value);
    if (!Object.is(read(text) ?? Number.NaN, value)) {
      setText(show(value));
    }
  }

  const hasEnd = suffix != null || steppers;
  useLayoutEffect(() => {
    const end = endRef.current;
    if (!end) {
      setEndWidth(0);
      return;
    }
    const measure = () => setEndWidth(end.offsetWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(end);
    return () => observer.disconnect();
  }, [hasEnd]);

  useEffect(() => () => clearTimeout(repeat.current), []);

  const commit = () => {
    const next = read(text);
    if (next !== null) {
      setText(show(next));
    }
  };

  const stepBy = (delta: number) => {
    const base = current.current;
    if (Number.isNaN(base)) {
      return;
    }
    let next = Number((base + delta).toPrecision(15));
    if (min !== undefined) {
      next = Math.max(min, next);
    }
    if (max !== undefined) {
      next = Math.min(max, next);
    }
    current.current = next;
    setShown(next);
    setText(show(next));
    onValueChange(next);
  };

  const stopRepeat = () => {
    clearTimeout(repeat.current);
    repeat.current = undefined;
  };

  const startRepeat = (direction: 1 | -1) => (event: PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || disabled || readOnly) {
      return;
    }
    // Keeps the caret in the field, and the press away from the text.
    event.preventDefault();
    const delta = direction * (event.shiftKey ? (largeStep ?? step * 10) : step);
    stepBy(delta);
    const tick = (wait: number) => {
      repeat.current = setTimeout(() => {
        stepBy(delta);
        tick(REPEAT_INTERVAL);
      }, wait);
    };
    tick(REPEAT_DELAY);
  };

  const expression = allowExpressions && text.trim() !== '' && parse(text) === null;
  const hintValue = expression ? evaluateNumberText(text, parse) : null;
  const hint = hintValue === null ? null : `= ${format(hintValue)}`;

  return (
    <div {...stylexProps(styles.wrap, style)}>
      <Input
        aria-describedby={
          [describedBy, hint ? hintId : undefined].filter(Boolean).join(' ') || undefined
        }
        autoComplete="off"
        autoCorrect="off"
        disabled={disabled}
        inputMode="decimal"
        readOnly={readOnly}
        spellCheck={false}
        {...props}
        onBlur={(event) => {
          onBlur?.(event);
          commit();
        }}
        onChange={(event) => {
          onChange?.(event);
          setText(event.target.value);
          const next = read(event.target.value) ?? Number.NaN;
          setShown(next);
          onValueChange(next);
        }}
        onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
          onKeyDown?.(event);
          if (event.defaultPrevented || event.nativeEvent.isComposing) {
            return;
          }
          if (event.key === 'Enter') {
            commit();
          } else if (
            (event.key === 'ArrowUp' || event.key === 'ArrowDown') &&
            !event.metaKey &&
            !event.ctrlKey &&
            !readOnly
          ) {
            event.preventDefault();
            const size = event.shiftKey
              ? (largeStep ?? step * 10)
              : event.altKey
                ? step / 10
                : step;
            stepBy(event.key === 'ArrowUp' ? size : -size);
          }
        }}
        ref={mergedRef}
        style={[
          styles.input,
          hint ? styles.padStart(`calc(1.5rem + ${hint.length}ch)`) : null,
          hasEnd
            ? styles.padEnd(`calc(${endWidth}px + ${steppers ? '0.75rem' : '1.25rem'})`)
            : null,
        ]}
        type="text"
        value={text}
      />
      {hint && (
        <span {...stylexProps(styles.hint)} id={hintId}>
          {hint}
        </span>
      )}
      {hasEnd && (
        <span {...stylexProps(styles.end, steppers && styles.endSteppers)} ref={endRef}>
          {suffix != null && (
            <span
              {...stylexProps(styles.suffix, steppers && styles.suffixBeforeSteppers)}
              // The suffix reads as part of the field: a press focuses it.
              onMouseDown={(event) => {
                event.preventDefault();
                inputRef.current?.focus();
              }}
            >
              {suffix}
            </span>
          )}
          {steppers && (
            <>
              <button
                aria-label={DECREMENT_LABEL}
                disabled={disabled || readOnly}
                onPointerCancel={stopRepeat}
                onPointerDown={startRepeat(-1)}
                onPointerLeave={stopRepeat}
                onPointerUp={stopRepeat}
                tabIndex={-1}
                type="button"
                {...stylexProps(styles.stepper)}
              >
                <MinusIcon aria-hidden size={14} />
              </button>
              <button
                aria-label={INCREMENT_LABEL}
                disabled={disabled || readOnly}
                onPointerCancel={stopRepeat}
                onPointerDown={startRepeat(1)}
                onPointerLeave={stopRepeat}
                onPointerUp={stopRepeat}
                tabIndex={-1}
                type="button"
                {...stylexProps(styles.stepper)}
              >
                <PlusIcon aria-hidden size={14} />
              </button>
            </>
          )}
        </span>
      )}
    </div>
  );
};

export { NumberInput };
