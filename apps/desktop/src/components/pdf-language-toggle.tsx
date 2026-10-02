import { colors, font, radius } from '@angaria/ui/tokens.stylex';
import { create, props, type StyleXStyles } from '@stylexjs/stylex';
import { useRef, type KeyboardEvent } from 'react';
import type { PDFLanguage } from '@/lib/types.ts';
import { tones } from '../shell/palette.stylex.ts';

const LANGUAGES: ReadonlyArray<PDFLanguage> = ['tr', 'en', 'both'];

const LABELS: Record<PDFLanguage, string> = {
  both: 'Türkçe ve İngilizce',
  en: 'İngilizce',
  tr: 'Türkçe',
};

const SHORT_LABELS: Record<PDFLanguage, string> = { both: 'TR+EN', en: 'EN', tr: 'TR' };

const styles = create({
  option: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: radius.full,
    borderWidth: 0,
    boxShadow: {
      ':focus-visible': `0 0 0 1px ${tones.ring}`,
      default: null,
    },
    color: {
      ':hover': colors.fg,
      default: colors.muted,
    },
    cursor: 'pointer',
    display: 'inline-flex',
    fontFamily: 'inherit',
    fontSize: font.sizeXs,
    fontWeight: font.weightMedium,
    height: '1.5rem',
    justifyContent: 'center',
    minWidth: '2.5rem',
    outline: 'none',
    paddingInline: '0.625rem',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0s',
      default: '150ms',
    },
    transitionProperty: 'background-color, color, box-shadow',
  },
  // Selection shows as a raised segment, like the kit's Tabs, never as a
  // heavier weight.
  selected: {
    backgroundColor: tones.tabActive,
    color: tones.tabActiveForeground,
  },
  track: {
    backgroundColor: colors.subtle,
    borderRadius: radius.full,
    display: 'inline-flex',
    gap: '2px',
    padding: '2px',
  },
});

/**
 * TR/EN/TR+EN segmented control for an invoice's PDF language. A radio group: Tab
 * reaches the chosen language, the arrow keys move the choice.
 */
export function PDFLanguageToggle({
  onChange,
  style,
  value,
}: {
  onChange: (language: PDFLanguage) => void;
  style?: StyleXStyles;
  value: PDFLanguage;
}) {
  const refs = useRef(new Map<PDFLanguage, HTMLButtonElement>());

  const onKeyDown = (event: KeyboardEvent) => {
    const step =
      event.key === 'ArrowRight' || event.key === 'ArrowDown'
        ? 1
        : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
          ? -1
          : 0;
    if (step === 0) {
      return;
    }
    event.preventDefault();
    const index = LANGUAGES.indexOf(value);
    const next = LANGUAGES[(index + step + LANGUAGES.length) % LANGUAGES.length];
    onChange(next);
    refs.current.get(next)?.focus();
  };

  return (
    <div
      aria-label="PDF dili"
      onKeyDown={onKeyDown}
      role="radiogroup"
      {...props(styles.track, style)}
    >
      {LANGUAGES.map((language) => (
        <button
          aria-checked={value === language}
          aria-label={LABELS[language]}
          key={language}
          onClick={() => onChange(language)}
          ref={(element) => {
            if (element) {
              refs.current.set(language, element);
            } else {
              refs.current.delete(language);
            }
          }}
          role="radio"
          tabIndex={value === language ? 0 : -1}
          type="button"
          {...props(styles.option, value === language && styles.selected)}
        >
          {SHORT_LABELS[language]}
        </button>
      ))}
    </div>
  );
}
