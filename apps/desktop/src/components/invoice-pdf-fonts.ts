import interRegular from '@/assets/fonts/Inter-Regular.ttf';
import interSemiBold from '@/assets/fonts/Inter-SemiBold.ttf';

// Suisse Intl is licensed: `pnpm fonts` fetches it into packages/ui/fonts,
// which git ignores. react-pdf embeds TrueType, not woff2. Without the files
// the glob matches nothing and the PDF falls back to Inter, with SemiBold
// standing in for Medium.
const suisse = import.meta.glob<string>('../../../../packages/ui/fonts/SuisseIntl-*.ttf', {
  eager: true,
  import: 'default',
  query: '?url',
});

const suisseRegular = suisse['../../../../packages/ui/fonts/SuisseIntl-Regular.ttf'];
const suisseMedium = suisse['../../../../packages/ui/fonts/SuisseIntl-Medium.ttf'];

/** The PDF's two weights, 400 and 500 */
export const PDF_FONT_FILES =
  suisseRegular && suisseMedium
    ? { medium: suisseMedium, regular: suisseRegular }
    : { medium: interSemiBold, regular: interRegular };
