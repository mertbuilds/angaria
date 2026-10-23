import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogText,
  DialogTitle,
  DialogTrigger,
} from '@angaria/ui';
import { useState } from 'react';
import { SettingsRow } from './settings-section.tsx';

// The repository root's THIRD_PARTY_NOTICES.md, loaded when its dialog opens.
const loadNotices = () =>
  import('../../../../THIRD_PARTY_NOTICES.md?raw').then((module) => module.default);

/** A row whose Göster button opens a text file of the repository in a dialog. */
function TextFileRow({
  description,
  hint,
  label,
  load,
  title,
}: {
  description: string;
  hint: string;
  label: string;
  load: () => Promise<string>;
  title: string;
}) {
  const [text, setText] = useState<string | null>(null);
  return (
    <SettingsRow hint={hint} label={label}>
      <Dialog
        onOpenChange={(open) => {
          if (open && text === null) {
            void load().then(setText);
          }
        }}
      >
        <DialogTrigger render={<Button variant="outline" />}>Göster</DialogTrigger>
        <DialogContent size="text">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <DialogText>{text ?? 'Yükleniyor…'}</DialogText>
        </DialogContent>
      </Dialog>
    </SettingsRow>
  );
}

/** Ayarlar › Hakkında: the licenses of code Angaria adapted from other projects. */
export function ThirdPartyNoticesRow() {
  return (
    <TextFileRow
      description="Angaria, aşağıdaki projelerden uyarlanan kodu bu lisanslarla kullanır."
      hint="Angaria’nın içindeki başka projelerden gelen kodun lisansları"
      label="Açık kaynak lisansları"
      load={loadNotices}
      title="Açık kaynak lisansları"
    />
  );
}
