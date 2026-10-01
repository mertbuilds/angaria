import { Button } from '@/components/ui/button';
import { PDF_LANGUAGES } from '@/lib/invoice-pdf-i18n.ts';
import type { PDFLanguage } from '@/lib/types.ts';
import { cn } from '@/lib/utils';

export function PDFLanguageToggle({
  className,
  onChange,
  value,
}: {
  className?: string;
  onChange: (language: PDFLanguage) => void;
  value: PDFLanguage;
}) {
  return (
    <div
      aria-label="PDF dili"
      className={cn('inline-flex items-center gap-0.5 rounded-lg border p-0.5', className)}
      role="group"
    >
      {PDF_LANGUAGES.map((language) => (
        <Button
          aria-pressed={value === language}
          key={language}
          onClick={() => onChange(language)}
          size="sm"
          variant={value === language ? 'secondary' : 'ghost'}
        >
          {language.toUpperCase()}
        </Button>
      ))}
    </div>
  );
}
