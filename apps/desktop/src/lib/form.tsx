import { createFormHook } from '@tanstack/react-form';
import { ChoiceField, ComboboxField, SelectField, SuggestField } from './fields/choice.tsx';
import { DateField, TimeField } from './fields/date.tsx';
import { MaskedField } from './fields/masked.tsx';
import { NumberField } from './fields/number.tsx';
import { TextareaField, TextField } from './fields/text.tsx';
import { fieldContext, formContext } from './form-field.tsx';

// The desktop app's form canon, after web-starter's apps/web/src/lib/form.tsx:
// TanStack Form with the checks in a form-level `validators.onChange` (it also
// runs on submit), never a form-level onBlur. Fields render through
// `form.AppField` and the bound components in lib/fields/. A choice shows its
// error once changed, typed text once changed and left; a submit shows them
// all (useFieldError in lib/form-field.tsx).

export const { useAppForm } = createFormHook({
  fieldComponents: {
    ChoiceField,
    ComboboxField,
    DateField,
    MaskedField,
    NumberField,
    SelectField,
    SuggestField,
    TextareaField,
    TextField,
    TimeField,
  },
  fieldContext,
  formComponents: {},
  formContext,
});
