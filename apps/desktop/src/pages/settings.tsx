import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Switch,
  Tabs,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
} from '@angaria/ui';
import { readTheme, themeChoices, type ThemeChoice } from '@angaria/ui/theme';
import { colors, font, radius, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { getVersion } from '@tauri-apps/api/app';
import { ChevronRightIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { useEffect, useState, type FormEvent } from 'react';
import { LicenseCard } from '@/components/license-card.tsx';
import { SettingsRow, SettingsSection, SettingsValue } from '@/components/settings-section.tsx';
import { forceLogout } from '@/lib/angaria.ts';
import { activeGibEmulatorURL, gibEmulatorURL, setGibEmulator } from '@/lib/gib-emulator.ts';
import { useStore } from '@/lib/store.tsx';
import { setTheme } from '@/lib/theme.ts';
import type { CompanyInfo, Entity } from '@/lib/types.ts';
import { checkForUpdate, installUpdate, type Update } from '@/lib/updater.ts';

const styles = create({
  column: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s8,
    marginInline: 'auto',
    maxWidth: '640px',
  },
  dialogForm: {
    display: 'grid',
    gap: spacing.s4,
  },
  page: {
    paddingBlock: spacing.s8,
    paddingInline: spacing.s6,
  },
  summary: {
    '::-webkit-details-marker': {
      display: 'none',
    },
    alignItems: 'center',
    borderRadius: radius.base,
    color: colors.fg,
    cursor: 'pointer',
    display: 'flex',
    fontSize: font.sizeSm,
    fontWeight: font.weightMedium,
    gap: spacing.s2,
    listStyle: 'none',
    outline: {
      ':focus-visible': `1px solid ${colors.muted}`,
      default: 'none',
    },
    outlineOffset: '4px',
    paddingInline: spacing.s1,
    userSelect: 'none',
  },
  summaryHint: {
    color: colors.muted,
    fontSize: font.sizeXs,
    fontWeight: font.weightRegular,
  },
  summaryIcon: {
    color: colors.muted,
    height: '1rem',
    transitionDuration: {
      '@media (prefers-reduced-motion: reduce)': '0s',
      default: '150ms',
    },
    transitionProperty: 'transform',
    width: '1rem',
  },
  summaryIconOpen: {
    transform: 'rotate(90deg)',
  },
  advancedBody: {
    paddingTop: spacing.s3,
  },
});

function GibAccountSection() {
  const { activeEntity, activeEntityId, creds, getCredentials, hasCredentials, setCredentials } =
    useStore();
  const [loggingOut, setLoggingOut] = useState(false);
  // The password read from the keychain, tagged with its company
  const [loaded, setLoaded] = useState<{ entityId: string; password: string } | null>(null);
  // null while the keychain read for the active company is pending
  const password = loaded?.entityId === activeEntityId ? loaded.password : null;

  useEffect(() => {
    let active = true;
    getCredentials(activeEntityId)
      .then((login) => {
        if (active) {
          setLoaded({ entityId: activeEntityId, password: login.password });
        }
      })
      .catch((error) => {
        if (active) {
          setLoaded({ entityId: activeEntityId, password: '' });
          toast.error(error instanceof Error ? error.message : 'Şifre okunamadı');
        }
      });
    return () => {
      active = false;
    };
  }, [activeEntityId, getCredentials]);

  function handlePasswordChange(value: string) {
    setLoaded({ entityId: activeEntityId, password: value });
    setCredentials(activeEntityId, { password: value }).catch((error) => {
      toast.error(error instanceof Error ? error.message : 'Şifre kaydedilemedi', {
        id: 'password-save',
      });
    });
  }

  async function handleForceLogout() {
    if (!hasCredentials) {
      toast.error('Kullanıcı adı ve şifre gerekli');
      return;
    }
    setLoggingOut(true);
    try {
      const login = await getCredentials(activeEntityId);
      await forceLogout(login.username, login.password, login.testMode);
      toast.success('Oturum kapatıldı');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Çıkış yapılamadı');
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <SettingsSection
      description="e-Arşiv portalına bu bilgilerle girilir. Şifre bu cihazın anahtar zincirinde saklanır."
      title="GİB hesabı"
    >
      <SettingsRow label="Şirket">
        <SettingsValue>{activeEntity.name}</SettingsValue>
      </SettingsRow>
      <SettingsRow htmlFor="gib-username" label="Kullanıcı adı">
        <Input
          autoComplete="off"
          id="gib-username"
          onChange={(event) =>
            void setCredentials(activeEntityId, { username: event.target.value })
          }
          placeholder="GİB kullanıcı adı"
          spellCheck={false}
          value={creds.username}
        />
      </SettingsRow>
      <SettingsRow htmlFor="gib-password" label="Şifre">
        <Input
          disabled={password === null}
          id="gib-password"
          onChange={(event) => handlePasswordChange(event.target.value)}
          placeholder="GİB şifresi"
          type="password"
          value={password ?? ''}
        />
      </SettingsRow>
      <SettingsRow hint="GİB portalında açık kalan oturumu kapatır" label="Oturum">
        <Button
          disabled={loggingOut || !hasCredentials}
          onClick={() => void handleForceLogout()}
          variant="outline"
        >
          {loggingOut ? 'Kapatılıyor...' : 'Oturumu kapat'}
        </Button>
      </SettingsRow>
    </SettingsSection>
  );
}

/**
 * Settings few people need, folded away: GİB's test portal, and in
 * development the local emulator. Open while either is on, so it shows.
 */
function AdvancedSection() {
  const { activeEntityId, creds, setCredentials } = useStore();
  const [open, setOpen] = useState(() => creds.testMode || Boolean(activeGibEmulatorURL));

  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)} open={open}>
      <summary {...props(styles.summary)}>
        <ChevronRightIcon
          aria-hidden
          {...props(styles.summaryIcon, open && styles.summaryIconOpen)}
        />
        Gelişmiş
        <span {...props(styles.summaryHint)}>Test modu</span>
      </summary>
      <div {...props(styles.advancedBody)}>
        <SettingsSection
          description="Test modu açıkken faturalar GİB’in test portalında kesilir, gerçek fatura oluşmaz."
          title="GİB bağlantısı"
        >
          <SettingsRow hint="earsivportaltest.efatura.gov.tr adresine bağlanır" label="Test modu">
            <Switch
              aria-label="Test modu"
              checked={creds.testMode}
              onCheckedChange={(checked) =>
                void setCredentials(activeEntityId, { testMode: checked })
              }
            />
          </SettingsRow>
          {import.meta.env.DEV && gibEmulatorURL && (
            <SettingsRow
              hint={`Geliştirme: GİB ve TCMB yerine ${gibEmulatorURL} (pnpm emulate)`}
              label="Emülatör"
            >
              <Switch
                aria-label="Emülatör"
                checked={Boolean(activeGibEmulatorURL)}
                onCheckedChange={setGibEmulator}
              />
            </SettingsRow>
          )}
        </SettingsSection>
      </div>
    </details>
  );
}

function CompaniesSection() {
  const { activeEntityId, createEntity, deleteEntity, entities, renameEntity, setActiveEntityId } =
    useStore();
  // The target outlives the open flag so the dialog keeps its text while it closes.
  const [target, setTarget] = useState<Entity | null>(null);
  const [dialog, setDialog] = useState<'delete' | 'rename' | null>(null);

  function openDialog(kind: 'delete' | 'rename', entity: Entity) {
    setTarget(entity);
    setDialog(kind);
  }

  function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (target) {
      renameEntity(target.id, String(new FormData(event.currentTarget).get('name') ?? ''));
    }
    setDialog(null);
  }

  function handleDelete() {
    if (target) {
      deleteEntity(target.id);
    }
    setDialog(null);
  }

  return (
    <SettingsSection
      description="Her şirket kendi GİB hesabını, firma bilgilerini, müşterilerini ve hizmetlerini tutar. Bu sayfadaki diğer ayarlar etkin şirkete aittir."
      title="Şirketler"
    >
      {entities.map((entity) => (
        <SettingsRow
          hint={entity.companyInfo.name || 'Firma bilgisi eklenmedi'}
          key={entity.id}
          label={entity.name}
        >
          {entity.id === activeEntityId ? (
            <Badge variant="secondary">Etkin</Badge>
          ) : (
            <Button onClick={() => setActiveEntityId(entity.id)} variant="ghost">
              Seç
            </Button>
          )}
          <Button
            aria-label={`${entity.name} adını değiştir`}
            onClick={() => openDialog('rename', entity)}
            size="icon"
            variant="ghost"
          >
            <PencilIcon />
          </Button>
          <Button
            aria-label={`${entity.name} sil`}
            disabled={entities.length === 1}
            onClick={() => openDialog('delete', entity)}
            size="icon"
            variant="ghost"
          >
            <Trash2Icon />
          </Button>
        </SettingsRow>
      ))}
      <SettingsRow>
        <Button onClick={createEntity} variant="outline">
          <PlusIcon />
          Yeni şirket
        </Button>
      </SettingsRow>

      <Dialog onOpenChange={(open) => !open && setDialog(null)} open={dialog === 'rename'}>
        <DialogContent showCloseButton={false}>
          <form onSubmit={handleRename} {...props(styles.dialogForm)}>
            <DialogHeader>
              <DialogTitle>Şirketin adını değiştir</DialogTitle>
            </DialogHeader>
            <Input
              aria-label="Şirket adı"
              defaultValue={target?.name}
              key={target?.id}
              name="name"
              onFocus={(event) => event.currentTarget.select()}
            />
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>İptal</DialogClose>
              <Button type="submit">Kaydet</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog onOpenChange={(open) => !open && setDialog(null)} open={dialog === 'delete'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Şirketi sil</AlertDialogTitle>
            <AlertDialogDescription>
              {target?.name} ile birlikte GİB hesabı, firma bilgileri, müşterileri ve hizmetleri bu
              cihazdan silinir. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} variant="destructive">
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  );
}

interface CompanyField {
  key: keyof CompanyInfo;
  label: string;
  multiline?: boolean;
  placeholder: string;
}

const companyFields: Array<CompanyField> = [
  { key: 'name', label: 'Firma adı veya unvan', placeholder: 'Firma Adı A.Ş.' },
  { key: 'taxID', label: 'VKN veya TCKN', placeholder: '1234567890' },
  { key: 'taxOffice', label: 'Vergi dairesi', placeholder: 'Kadıköy' },
  { key: 'address', label: 'Adres', multiline: true, placeholder: 'Tam adres' },
  { key: 'phone', label: 'Telefon', placeholder: '+90 555 123 45 67' },
  { key: 'email', label: 'E-posta', placeholder: 'info@firma.com' },
];

const bankFields: Array<CompanyField> = [
  { key: 'bankName', label: 'Banka adı', placeholder: 'Ziraat Bankası' },
  { key: 'accountHolder', label: 'Hesap sahibi', placeholder: 'Ad Soyad' },
  { key: 'iban', label: 'IBAN', placeholder: 'TR00 0000 0000 0000 0000 0000 00' },
  { key: 'swiftCode', label: 'SWIFT kodu', placeholder: 'TCZBTR2AXXX' },
  { key: 'bankAddress', label: 'Banka adresi', multiline: true, placeholder: 'Banka şube adresi' },
];

/** Text rows bound to the active company's PDF details. */
function CompanyFields({ fields }: { fields: Array<CompanyField> }) {
  const { companyInfo, setCompanyInfo } = useStore();

  return fields.map((field) => {
    const id = `company-${field.key}`;
    const control = {
      id,
      onChange: (event: { target: { value: string } }) => {
        const { value } = event.target;
        setCompanyInfo((info) => ({ ...info, [field.key]: value }));
      },
      placeholder: field.placeholder,
      value: companyInfo[field.key],
    };
    return (
      <SettingsRow
        align={field.multiline ? 'top' : 'center'}
        htmlFor={id}
        key={field.key}
        label={field.label}
      >
        {field.multiline ? <Textarea rows={2} {...control} /> : <Input {...control} />}
      </SettingsRow>
    );
  });
}

const themeLabels: Record<ThemeChoice, string> = {
  dark: 'Koyu',
  light: 'Açık',
  system: 'Sistem',
};

function AppearanceSection() {
  const [theme, setThemeChoice] = useState<ThemeChoice>(() => readTheme());

  function handleChange(value: unknown) {
    const choice = themeChoices.find((item) => item === value);
    if (choice) {
      setTheme(choice);
      setThemeChoice(choice);
    }
  }

  return (
    <SettingsSection title="Görünüm">
      <SettingsRow hint="Sistem, macOS görünüm ayarını izler" label="Tema">
        <Tabs onValueChange={handleChange} value={theme}>
          <TabsList>
            {themeChoices.map((choice) => (
              <TabsTrigger key={choice} value={choice}>
                {themeLabels[choice]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </SettingsRow>
    </SettingsSection>
  );
}

type UpdateState =
  | { kind: 'available'; update: Update }
  | { kind: 'checking' }
  | { kind: 'current' }
  | { kind: 'downloading'; progress: number | null }
  | { kind: 'failed'; message: string }
  | { kind: 'idle' };

const percent = new Intl.NumberFormat('tr-TR', { style: 'percent' });

function updateStatus(state: UpdateState) {
  switch (state.kind) {
    case 'available':
      return `Yeni sürüm var: ${state.update.version}`;
    case 'checking':
      return 'Denetleniyor...';
    case 'current':
      return 'Angaria güncel';
    case 'downloading':
      return state.progress === null
        ? 'İndiriliyor...'
        : `İndiriliyor, ${percent.format(state.progress)}`;
    case 'failed':
      return state.message;
    case 'idle':
      return null;
  }
}

function AboutSection() {
  const [version, setVersion] = useState<string | null>(null);
  const [state, setState] = useState<UpdateState>({ kind: 'idle' });

  useEffect(() => {
    let active = true;
    getVersion()
      .then((value) => {
        if (active) {
          setVersion(value);
        }
      })
      .catch(() => {
        if (active) {
          setVersion('Bilinmiyor');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleCheck() {
    setState({ kind: 'checking' });
    try {
      const update = await checkForUpdate();
      setState(update ? { kind: 'available', update } : { kind: 'current' });
    } catch {
      setState({ kind: 'failed', message: 'Güncellemeler denetlenemedi' });
    }
  }

  async function handleInstall(update: Update) {
    setState({ kind: 'downloading', progress: null });
    try {
      await installUpdate(update, (progress) => setState({ kind: 'downloading', progress }));
    } catch {
      setState({ kind: 'failed', message: 'Güncelleme yüklenemedi' });
    }
  }

  const status = updateStatus(state);
  const busy = state.kind === 'checking' || state.kind === 'downloading';

  return (
    <SettingsSection title="Hakkında">
      <SettingsRow label="Sürüm">
        <SettingsValue>{version ?? ''}</SettingsValue>
      </SettingsRow>
      <SettingsRow label="Güncellemeler">
        {status && (
          <SettingsValue tone={state.kind === 'failed' ? 'error' : 'muted'}>{status}</SettingsValue>
        )}
        {state.kind === 'available' ? (
          <Button onClick={() => void handleInstall(state.update)}>Yükle</Button>
        ) : (
          <Button disabled={busy} onClick={() => void handleCheck()} variant="outline">
            Güncellemeleri denetle
          </Button>
        )}
      </SettingsRow>
    </SettingsSection>
  );
}

export function SettingsPage() {
  return (
    <div {...props(styles.page)}>
      <div {...props(styles.column)}>
        <GibAccountSection />
        <CompaniesSection />
        <SettingsSection
          description="PDF faturalarda satıcı bilgisi olarak görünür."
          title="Firma bilgileri"
        >
          <CompanyFields fields={companyFields} />
        </SettingsSection>
        <SettingsSection
          description="PDF faturalarda ödeme bilgisi olarak görünür."
          title="Banka bilgileri"
        >
          <CompanyFields fields={bankFields} />
        </SettingsSection>
        <LicenseCard />
        <AppearanceSection />
        <AboutSection />
        <AdvancedSection />
      </div>
    </div>
  );
}
