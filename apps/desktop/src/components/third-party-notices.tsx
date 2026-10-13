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

// The repository root's LICENSE and THIRD_PARTY_NOTICES.md, loaded when their dialog opens.
const loadLicense = () => import('../../../../LICENSE?raw').then((module) => module.default);
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

/** Ayarlar › Hakkında: Angaria's own license, the GNU AGPL version 3. */
export function LicenseRow() {
  return (
    <TextFileRow
      description="Lisansın İngilizce resmî metni."
      hint="Angaria’yı kullanabilir, değiştirebilir ve paylaşabilirsin. Değiştirdiğin bir sürümü başkalarına sunarsan onun kaynak kodunu da açarsın."
      label="Lisans"
      load={loadLicense}
      title="GNU Affero Genel Kamu Lisansı, sürüm 3"
    />
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
