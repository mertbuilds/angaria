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
import { capStyles, capText } from '../lib/cap-text.tsx';
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
    insetInlineEnd: '0.5rem',
  },
  // Muted "= 4.500" at the start while an expression is typed.
  hint: {
    alignItems: 'center',
    color: colors.mutedForeground,
    display: 'flex',
    fontSize: '0.75rem',
    insetBlock: 0,
    insetInlineStart: '1rem',
    pointerEvents: 'none',
    position: 'absolute',
    whiteSpace: 'nowrap',
  },
  // With steppers the start holds the − button: the hint sits above the
  // field's end, on the label's line, so nothing moves.
  hintSteppers: {
    bottom: '100%',
    insetBlock: 'auto',
    insetInlineEnd: '0.5rem',
    insetInlineStart: 'auto',
    paddingBottom: '0.25rem',
  },
  // Proportional figures: Suisse Intl's tabular 1, 4, 7 and 0 are
  // typewriter-like alternates (a 1 with a foot), which read as a mono font.
  input: {
    textAlign: 'right',
  },
  inputSteppers: {
    textAlign: 'center',
  },
  // Room for the hint at the start and the suffix and steppers at the end.
  padEnd: (width: string) => ({ paddingInlineEnd: width }),
  padStart: (width: string) => ({ paddingInlineStart: width }),
  // A 24px round button, its target 32px inside the 40px field.
  stepper: {
    '::before': {
      borderRadius: radius.full,
      content: '""',
      inset: '-0.25rem',
      position: 'absolute',
    },
    alignItems: 'center',
    backgroundColor: {
      ':active': colors.accent,
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
    flexShrink: 0,
    height: '1.5rem',
    justifyContent: 'center',
    // At a bound: faded, and a press goes to the field.
    opacity: {
      ':disabled': 0.4,
      default: 1,
    },
    padding: 0,
    pointerEvents: {
      ':disabled': 'none',
      default: null,
    },
    position: 'relative',
    scale: {
      ':active': '0.96',
      default: '1',
    },
    touchAction: 'manipulation',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0s',
      default: '150ms',
    },
    transitionProperty: 'background-color, color, opacity, scale',
    transitionTimingFunction: 'cubic-bezier(0.2, 0, 0, 1)',
    width: '1.5rem',
  },
  stepperIcon: {
    display: 'block',
    flexShrink: 0,
    height: '0.875rem',
    width: '0.875rem',
  },
  stepperStart: {
    insetBlock: 0,
    insetInlineStart: '0.5rem',
    marginBlock: 'auto',
    position: 'absolute',
  },
  // One space from the number, so "4.500,00 ₺" reads as one value.
  suffix: {
    color: colors.mutedForeground,
    cursor: 'text',
    fontSize: '0.875rem',
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
  // Sized to its content; a caller's `style` can set another width.
  wrapSteppers: {
    width: '8rem',
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
  /** − and + at the field's ends, the number centered between them in an 8rem field (Shift-click ×10, hold to repeat). */
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
 * steppers. `style` sizes the field; the text is right aligned, or centered
 * between the steppers in an 8rem field.
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

  const stopRepeat = () => {
    clearTimeout(repeat.current);
    repeat.current = undefined;
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
    // The button at a bound turns disabled and may never see the release.
    if (next === min || next === max) {
      stopRepeat();
    }
    current.current = next;
    setShown(next);
    setText(show(next));
    onValueChange(next);
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
  const atMin = min !== undefined && value <= min;
  const atMax = max !== undefined && value >= max;
  // The steppers' end (the + button, a suffix before it) sets both sides, so
  // the number stays in the middle.
  const endPad = `calc(${endWidth}px + ${steppers ? '0.75rem' : '1.25rem'})`;

  const stepper = (direction: 1 | -1) => (
    <button
      aria-label={direction === 1 ? INCREMENT_LABEL : DECREMENT_LABEL}
      disabled={disabled || readOnly || (direction === 1 ? atMax : atMin)}
      // A click without a press (VoiceOver, Voice Control) steps once.
      onClick={(event) => event.detail === 0 && stepBy(direction * step)}
      onPointerCancel={stopRepeat}
      onPointerDown={startRepeat(direction)}
      onPointerLeave={stopRepeat}
      onPointerUp={stopRepeat}
      tabIndex={-1}
      type="button"
      {...stylexProps(styles.stepper, direction === -1 && styles.stepperStart)}
    >
      {direction === 1 ? (
        <PlusIcon aria-hidden strokeWidth={2.25} {...stylexProps(styles.stepperIcon)} />
      ) : (
        <MinusIcon aria-hidden strokeWidth={2.25} {...stylexProps(styles.stepperIcon)} />
      )}
    </button>
  );

  return (
    <div {...stylexProps(styles.wrap, steppers && styles.wrapSteppers, style)}>
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
          steppers && styles.inputSteppers,
          steppers ? styles.padStart(endPad) : null,
          !steppers && hint ? styles.padStart(`calc(1.5rem + ${hint.length}ch)`) : null,
          hasEnd ? styles.padEnd(endPad) : null,
        ]}
        type="text"
        value={text}
      />
      {hint && (
        <span {...stylexProps(styles.hint, steppers && styles.hintSteppers)} id={hintId}>
          {capText(hint)}
        </span>
      )}
      {steppers && stepper(-1)}
      {hasEnd && (
        <span {...stylexProps(styles.end, steppers && styles.endSteppers)} ref={endRef}>
          {suffix != null && (
            <span
              {...stylexProps(
                styles.suffix,
                capStyles.text,
                steppers && styles.suffixBeforeSteppers,
              )}
              // The suffix reads as part of the field: a press focuses it.
              onMouseDown={(event) => {
                event.preventDefault();
                inputRef.current?.focus();
              }}
            >
              {suffix}
            </span>
          )}
          {steppers && stepper(1)}
        </span>
      )}
    </div>
  );
};

export { NumberInput };
