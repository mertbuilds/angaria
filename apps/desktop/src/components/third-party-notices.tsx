import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@angaria/ui';
import { colors, font } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useState } from 'react';
import { SettingsRow } from './settings-section.tsx';

const styles = create({
  content: {
    maxWidth: {
      '@media (min-width: 640px)': '42rem',
      default: 'calc(100% - 2rem)',
    },
  },
  text: {
    color: colors.fg,
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    fontSize: font.sizeXs,
    lineHeight: 1.5,
    margin: 0,
    overflowWrap: 'anywhere',
    whiteSpace: 'pre-wrap',
  },
});

// THIRD_PARTY_NOTICES.md at the repository root, loaded when the dialog opens.
const loadNotices = () =>
  import('../../../../THIRD_PARTY_NOTICES.md?raw').then((module) => module.default);

/** Ayarlar › Hakkında: the licenses of code Angaria adapted from other projects. */
export function ThirdPartyNoticesRow() {
  const [text, setText] = useState<string | null>(null);
  return (
    <SettingsRow
      hint="Angaria’nın içindeki açık kaynak kodun lisansları"
      label="Açık kaynak lisansları"
    >
      <Dialog
        onOpenChange={(open) => {
          if (open && text === null) {
            void loadNotices().then(setText);
          }
        }}
      >
        <DialogTrigger render={<Button variant="outline" />}>Göster</DialogTrigger>
        <DialogContent style={styles.content}>
          <DialogHeader>
            <DialogTitle>Açık kaynak lisansları</DialogTitle>
            <DialogDescription>
              Angaria, aşağıdaki projelerden uyarlanan kodu bu lisanslarla kullanır.
            </DialogDescription>
          </DialogHeader>
          <pre {...props(styles.text)}>{text ?? 'Yükleniyor…'}</pre>
        </DialogContent>
      </Dialog>
    </SettingsRow>
  );
}
