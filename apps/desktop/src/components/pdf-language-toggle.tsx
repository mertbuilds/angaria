import { ChoiceChips, type ChoiceOption } from '@angaria/ui';
import { props, type StyleXStyles } from '@stylexjs/stylex';
import type { PDFLanguage } from '@/lib/types.ts';

const OPTIONS: ReadonlyArray<ChoiceOption<PDFLanguage>> = [
  { description: 'Türkçe', label: 'TR', value: 'tr' },
  { description: 'İngilizce', label: 'EN', value: 'en' },
  { description: 'Türkçe ve İngilizce', label: 'TR+EN', value: 'both' },
];

/**
 * TR/EN/TR+EN chips for an invoice's PDF language, the same ChoiceChips as
 * every other choice: one Tab stop, ←/→ move the choice, 1-3 pick one. Named
 * "PDF dili" unless `aria-labelledby` points at a visible label.
 */
export function PDFLanguageToggle({
  'aria-labelledby': labelledBy,
  id,
  onChange,
  size = 'sm',
  style,
  value,
}: {
  'aria-labelledby'?: string;
  id?: string;
  onChange: (language: PDFLanguage) => void;
  size?: 'sm' | 'md';
  style?: StyleXStyles;
  value: PDFLanguage;
}) {
  const chips = (
    <ChoiceChips
      aria-label={labelledBy ? undefined : 'PDF dili'}
      aria-labelledby={labelledBy}
      id={id}
      onValueChange={(language) => language && onChange(language)}
      options={OPTIONS}
      size={size}
      value={value}
    />
  );
  return style ? <div {...props(style)}>{chips}</div> : chips;
}
