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
  ChoiceChips,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  MaskedInput,
  Switch,
  Textarea,
  toast,
  type ChoiceOption,
} from '@angaria/ui';
import { readTheme, themeChoices, type ThemeChoice } from '@angaria/ui/theme';
import { colors, font, radius, spacing } from '@angaria/ui/tokens.stylex';
import type { MaskitoOptions } from '@maskito/core';
import { create, props } from '@stylexjs/stylex';
import { getVersion } from '@tauri-apps/api/app';
import {
  CheckIcon,
  ChevronRightIcon,
  CircleAlertIcon,
  EyeIcon,
  EyeOffIcon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
} from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { LicenseCard } from '@/components/license-card.tsx';
import {
  SettingsField,
  SettingsRow,
  SettingsSection,
  SettingsValue,
} from '@/components/settings-section.tsx';
import { forceLogout } from '@/lib/angaria.ts';
import { LOGO_TYPES, readLogo } from '@/lib/company-logo.ts';
import { activeGibEmulatorURL, gibEmulatorURL, setGibEmulator } from '@/lib/gib-emulator.ts';
import { describeError, toastError } from '@/lib/gib-errors.ts';
import { gib, useGIBAccount } from '@/lib/gib.ts';
import { PDF_STYLES, resolvePDFStyle } from '@/lib/invoice-pdf-i18n.ts';
import { paletteChoices, paletteLabels, setPalette, usePalette } from '@/lib/palette.ts';
import {
  DEFAULT_RATE_DAY,
  rateDayChoices,
  readRateDay,
  setRateDay,
  useRateDay,
  type RateDay,
} from '@/lib/rate-day.ts';
import { useStore } from '@/lib/store.tsx';
import { setTheme } from '@/lib/theme.ts';
import { ibanBankName } from '@/lib/tr-banks.ts';
import {
  IBAN_MASK,
  isValidEmail,
  isValidSWIFT,
  isValidTCKN,
  isValidTRIBAN,
  isValidVKN,
  normalizeIBAN,
  TR_PHONE_MASK,
} from '@/lib/tr-validators.ts';
import type { CompanyInfo, Entity, PDFStyle } from '@/lib/types.ts';
import { checkForUpdate, installUpdate, type Update } from '@/lib/updater.ts';
import { tones } from '../shell/palette.stylex.ts';

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
  // The PDF is white paper in both themes, so the logo shows on white.
  logo: {
    backgroundColor: '#ffffff',
    borderColor: colors.border,
    borderRadius: radius.base,
    borderStyle: 'solid',
    borderWidth: '1px',
    height: '40px',
    maxWidth: '160px',
    objectFit: 'contain',
    padding: spacing.s1,
  },
  page: {
    paddingBlock: spacing.s8,
    paddingInline: spacing.s6,
  },
  password: {
    flex: 1,
    minWidth: 0,
    position: 'relative',
  },
  passwordInput: {
    paddingInlineEnd: '2.75rem',
  },
  passwordToggle: {
    insetInlineEnd: '6px',
    position: 'absolute',
    top: '6px',
  },
  // The note's link sits in its line of text.
  noteLink: {
    fontSize: font.sizeXs,
    height: 'auto',
    paddingInline: 0,
  },
  tabular: {
    fontVariantNumeric: 'tabular-nums',
  },
  testColumn: {
    alignItems: 'flex-end',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
    minWidth: 0,
  },
  testIcon: {
    flexShrink: 0,
    height: '0.875rem',
    marginTop: '0.125rem',
    width: '0.875rem',
  },
  testResult: {
    color: colors.muted,
    display: 'flex',
    fontSize: font.sizeXs,
    gap: spacing.s1,
    lineHeight: 1.5,
    margin: 0,
    textAlign: 'end',
    textWrap: 'pretty',
  },
  testResultError: {
    color: colors.error,
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
      ':focus-visible': `1px solid ${tones.ring}`,
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

type ConnectionTest =
  | { detail?: string | undefined; kind: 'failed'; login: string; text: string }
  | { kind: 'idle' }
  | { kind: 'ok'; login: string }
  | { kind: 'testing'; login: string };

/** The connection test's outcome, in a live region that is always there. */
function ConnectionTestResult({ test }: { test: ConnectionTest }) {
  const failed = test.kind === 'failed';
  return (
    <p role="status" {...props(styles.testResult, failed && styles.testResultError)}>
      {test.kind === 'ok' && (
        <>
          <CheckIcon aria-hidden {...props(styles.testIcon)} />
          GİB girişi çalışıyor.
        </>
      )}
      {failed && (
        <>
          <CircleAlertIcon aria-hidden {...props(styles.testIcon)} />
          <span>
            {test.text}
            {test.detail && ` ${test.detail}`}
          </span>
        </>
      )}
    </p>
  );
}

function GibAccountSection() {
  const {
    activeEntity,
    activeEntityId,
    creds,
    flushCredentials,
    getCredentials,
    hasCredentials,
    setCredentials,
  } = useStore();
  const account = useGIBAccount();
  const [loggingOut, setLoggingOut] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [test, setTest] = useState<ConnectionTest>({ kind: 'idle' });
  // The password read from the keychain, tagged with its company
  const [loaded, setLoaded] = useState<{ entityId: string; password: string } | null>(null);
  // null while the keychain read for the active company is pending
  const password = loaded?.entityId === activeEntityId ? loaded.password : null;
  // A result holds for the login it tried, so editing either field clears it.
  const login = `${activeEntityId}\n${creds.username}\n${password ?? ''}`;
  const testShown = test.kind === 'idle' || test.login === login ? test : { kind: 'idle' as const };

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

  // A password change waits for typing to pause; leaving Ayarlar writes it now.
  useEffect(() => () => void flushCredentials(), [flushCredentials]);

  function handlePasswordChange(value: string) {
    setLoaded({ entityId: activeEntityId, password: value });
    setCredentials(activeEntityId, { password: value }).catch((error) => {
      toast.error(error instanceof Error ? error.message : 'Şifre kaydedilemedi', {
        id: 'password-save',
      });
    });
  }

  async function handleTest() {
    if (!creds.username.trim() || !password) {
      setTest({ kind: 'failed', login, text: 'Önce kullanıcı kodunu ve şifreni gir' });
      return;
    }
    setTest({ kind: 'testing', login });
    try {
      // The queue logs in for the task and logs out once nothing else waits.
      await gib.run(account, async () => {});
      setTest({ kind: 'ok', login });
    } catch (error) {
      const { code, detail, text } = describeError(error);
      setTest({
        detail,
        kind: 'failed',
        login,
        // Ayarlar is where the user is already.
        text: code === 'auth' ? 'GİB kullanıcı kodunu ya da şifreyi kabul etmedi.' : text,
      });
    }
  }

  async function handleForceLogout() {
    if (!hasCredentials) {
      toast.error('Önce kullanıcı kodunu ve şifreni gir');
      return;
    }
    setLoggingOut(true);
    try {
      const login = await getCredentials(activeEntityId);
      await forceLogout(login.username, login.password);
      toast.success('Oturum kapatıldı');
    } catch (error) {
      toastError(error);
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <SettingsSection
      description="e-Arşiv portalına girdiğin kullanıcı kodu ve şifre. Bunlar yoksa mali müşavirinden ya da İnteraktif Vergi Dairesi’nden alabilirsin. Şifre bu Mac’in Anahtar Zinciri’nde saklanır."
      title="GİB hesabı"
    >
      <SettingsRow label="Şirket">
        <SettingsValue>{activeEntity.name}</SettingsValue>
      </SettingsRow>
      <SettingsRow htmlFor="gib-username" label="Kullanıcı kodu">
        <Input
          autoComplete="off"
          id="gib-username"
          onChange={(event) =>
            void setCredentials(activeEntityId, { username: event.target.value })
          }
          placeholder="e-Arşiv kullanıcı kodu"
          spellCheck={false}
          value={creds.username}
        />
      </SettingsRow>
      <SettingsRow htmlFor="gib-password" label="Şifre">
        <div {...props(styles.password)}>
          <Input
            autoComplete="off"
            disabled={password === null}
            id="gib-password"
            onBlur={() => void flushCredentials()}
            onChange={(event) => handlePasswordChange(event.target.value)}
            placeholder="e-Arşiv şifresi"
            spellCheck={false}
            style={styles.passwordInput}
            type={showPassword ? 'text' : 'password'}
            value={password ?? ''}
          />
          <Button
            aria-controls="gib-password"
            aria-label="Şifreyi göster"
            aria-pressed={showPassword}
            disabled={password === null}
            onClick={() => setShowPassword((shown) => !shown)}
            size="icon"
            style={styles.passwordToggle}
            variant="ghost"
          >
            {showPassword ? <EyeOffIcon aria-hidden /> : <EyeIcon aria-hidden />}
          </Button>
        </div>
      </SettingsRow>
      <SettingsRow hint="Kullanıcı kodu ve şifreyle GİB’e girip çıkar" label="Bağlantı">
        <div {...props(styles.testColumn)}>
          <Button
            disabled={testShown.kind === 'testing'}
            onClick={() => void handleTest()}
            variant="outline"
          >
            {testShown.kind === 'testing' ? 'Deneniyor…' : 'Bağlantıyı test et'}
          </Button>
          <ConnectionTestResult test={testShown} />
        </div>
      </SettingsRow>
      <SettingsRow hint="e-Arşiv portalında açık kalan oturumu kapatır" label="Oturum">
        <Button
          disabled={loggingOut || !hasCredentials}
          onClick={() => void handleForceLogout()}
          variant="outline"
        >
          {loggingOut ? 'Kapatılıyor…' : 'Oturumu kapat'}
        </Button>
      </SettingsRow>
    </SettingsSection>
  );
}

const rateDayCopy: Record<RateDay, { description: string; label: string }> = {
  previous: {
    description: 'TCMB’nin fatura tarihinden önceki iş günü açıkladığı kur',
    label: 'Önceki iş günü',
  },
  same: {
    description: 'TCMB’nin fatura tarihinde açıkladığı kur',
    label: 'Fatura günü',
  },
};

const rateDayOptions: ReadonlyArray<ChoiceOption<RateDay>> = rateDayChoices.map((choice) => ({
  ...rateDayCopy[choice],
  value: choice,
}));

function RateDayRow() {
  const rateDay = useRateDay();

  return (
    <SettingsRow
      hint="Önceki iş günü önerilir: TCMB’nin bir gün önce açıkladığı kur, fatura gününün kurudur"
      id="rate-day"
      label="Kur günü"
    >
      <ChoiceChips
        aria-describedby="rate-day-hint"
        aria-labelledby="rate-day-label"
        onValueChange={(choice) => choice && setRateDay(choice)}
        options={rateDayOptions}
        value={rateDay}
      />
    </SettingsRow>
  );
}

// Dev only, like the emulator: sample data for its empty fields.
const loadEmulatorSeed = import.meta.env.DEV ? () => import('@/dev/emulator-seed.ts') : null;

/**
 * Settings few people need, folded away: the TCMB rate day, and in
 * development the local emulator. Open while either is changed, so it shows.
 */
function AdvancedSection() {
  const store = useStore();
  const [open, setOpen] = useState(
    () => Boolean(activeGibEmulatorURL) || readRateDay() !== DEFAULT_RATE_DAY,
  );
  const emulator = import.meta.env.DEV && gibEmulatorURL;

  return (
    <details onToggle={(event) => setOpen(event.currentTarget.open)} open={open}>
      <summary {...props(styles.summary)}>
        <ChevronRightIcon
          aria-hidden
          {...props(styles.summaryIcon, open && styles.summaryIconOpen)}
        />
        Gelişmiş
        <span {...props(styles.summaryHint)}>{emulator ? 'Kur günü, emülatör' : 'Kur günü'}</span>
      </summary>
      <div {...props(styles.advancedBody, styles.column)}>
        <SettingsSection
          description="Döviz faturanın kuru, TCMB’nin döviz alış kurundan alınır."
          title="Döviz kuru"
        >
          <RateDayRow />
        </SettingsSection>
        {emulator && (
          <SettingsSection title="Geliştirme">
            <SettingsRow hint={`GİB ve TCMB yerine ${emulator} (pnpm emulate)`} label="Emülatör">
              <Switch
                aria-label="Emülatör"
                checked={Boolean(activeGibEmulatorURL)}
                onCheckedChange={setGibEmulator}
              />
            </SettingsRow>
            {activeGibEmulatorURL && (
              <SettingsRow
                hint="Boş GİB, firma ve banka alanlarını örnek bilgilerle doldurur, müşteri yoksa iki örnek ekler"
                label="Örnek veriler"
              >
                <Button
                  onClick={() =>
                    void loadEmulatorSeed?.().then(({ fillEmulatorSamples }) =>
                      fillEmulatorSamples(store),
                    )
                  }
                  variant="outline"
                >
                  Örnek verileri doldur
                </Button>
              </SettingsRow>
            )}
          </SettingsSection>
        )}
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
      description="Her şirketin kendi GİB hesabı, firma bilgileri, müşterileri ve hizmetleri olur. Bu sayfadaki diğer ayarlar yalnızca seçili şirketi etkiler."
      title="Şirketler"
    >
      {entities.map((entity) => (
        <SettingsRow
          hint={entity.companyInfo.name || 'Firma bilgisi eklenmedi'}
          key={entity.id}
          label={entity.name}
        >
          {entity.id === activeEntityId ? (
            <Badge variant="secondary">Seçili</Badge>
          ) : (
            <Button onClick={() => setActiveEntityId(entity.id)} variant="ghost">
              Seç
            </Button>
          )}
          <Button
            aria-label={`Yeniden adlandır: ${entity.name}`}
            onClick={() => openDialog('rename', entity)}
            size="icon"
            variant="ghost"
          >
            <PencilIcon />
          </Button>
          <Button
            aria-label={`Sil: ${entity.name}`}
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
              <DialogTitle>Şirketi yeniden adlandır</DialogTitle>
            </DialogHeader>
            <Input
              aria-label="Şirket adı"
              defaultValue={target?.name}
              key={target?.id}
              name="name"
              onFocus={(event) => event.currentTarget.select()}
            />
            <DialogFooter>
              <DialogClose render={<Button variant="outline" />}>Vazgeç</DialogClose>
              <Button type="submit">Kaydet</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog onOpenChange={(open) => !open && setDialog(null)} open={dialog === 'delete'}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{target?.name} silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              Şirketin GİB giriş bilgileri, firma bilgileri, müşterileri ve hizmetleri bu Mac’ten
              silinir. GİB’deki faturalar etkilenmez. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} variant="destructive">
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SettingsSection>
  );
}

/** How a company field is typed and checked. */
type CompanyFieldKind = 'email' | 'iban' | 'phone' | 'swift' | 'taxID' | 'text' | 'textarea';

interface CompanyField {
  key: Exclude<keyof CompanyInfo, 'logo' | 'pdfStyle'>;
  kind?: CompanyFieldKind;
  label: string;
  placeholder: string;
}

const companyFields: Array<CompanyField> = [
  { key: 'name', label: 'Firma adı ya da unvan', placeholder: 'Firma Adı A.Ş.' },
  { key: 'taxID', kind: 'taxID', label: 'VKN / TCKN', placeholder: '1234567890' },
  { key: 'taxOffice', label: 'Vergi dairesi', placeholder: 'Kadıköy' },
  { key: 'address', kind: 'textarea', label: 'Adres', placeholder: 'Tam adres' },
  { key: 'phone', kind: 'phone', label: 'Telefon', placeholder: '+90 532 123 45 67' },
  { key: 'email', kind: 'email', label: 'E-posta', placeholder: 'info@firma.com' },
];

const bankFields: Array<CompanyField> = [
  { key: 'bankName', label: 'Banka adı', placeholder: 'Ziraat Bankası' },
  { key: 'accountHolder', label: 'Hesap sahibi', placeholder: 'Ad Soyad' },
  { key: 'iban', kind: 'iban', label: 'IBAN', placeholder: 'TR00 0000 0000 0000 0000 0000 00' },
  { key: 'swiftCode', kind: 'swift', label: 'SWIFT kodu', placeholder: 'TCZBTR2AXXX' },
  { key: 'bankAddress', kind: 'textarea', label: 'Banka adresi', placeholder: 'Banka şube adresi' },
];

/** Letters and digits only, up to 11, upper-cased as typed: a SWIFT/BIC code. */
const SWIFT_MASK: MaskitoOptions = { mask: /^[0-9A-Z]{0,11}$/ };

const masks: Partial<Record<CompanyFieldKind, MaskitoOptions>> = {
  iban: IBAN_MASK,
  phone: TR_PHONE_MASK,
  swift: SWIFT_MASK,
};

const PHONE_SHAPE = /^\+90 \d{3} \d{3} \d{2} \d{2}$/;

/** What is wrong with a company field's value, in the user's words. Empty is fine. */
function companyFieldError(kind: CompanyFieldKind, value: string) {
  const text = value.trim();
  if (!text) {
    return undefined;
  }
  switch (kind) {
    case 'email':
      return isValidEmail(text) ? undefined : 'E-postayı ad@firma.com biçiminde yaz';
    case 'iban':
      if (!/^TR\d{24}$/.test(normalizeIBAN(text))) {
        return 'IBAN, TR ve 24 rakamdan oluşur. Eksik ya da fazla haneyi düzelt.';
      }
      return isValidTRIBAN(text)
        ? undefined
        : 'Bu IBAN’ın kontrol haneleri tutmuyor. Numarayı kontrol et.';
    case 'phone':
      return PHONE_SHAPE.test(text) ? undefined : 'Telefonu +90 532 123 45 67 biçiminde yaz';
    case 'swift':
      return isValidSWIFT(text)
        ? undefined
        : 'SWIFT kodu 8 ya da 11 harf ve rakamdan oluşur. Örnek: TCZBTR2AXXX';
    case 'taxID': {
      const id = text.replaceAll(/\s/g, '');
      if (!/^\d{10,11}$/.test(id)) {
        return 'VKN 10, TCKN 11 haneli olur. Yalnızca rakam yaz.';
      }
      if (id.length === 10) {
        return isValidVKN(id)
          ? undefined
          : 'Bu VKN’nin kontrol hanesi tutmuyor. Numarayı kontrol et.';
      }
      return isValidTCKN(id)
        ? undefined
        : 'Bu TCKN’nin kontrol haneleri tutmuyor. Numarayı kontrol et.';
    }
    default:
      return undefined;
  }
}

/** The value a field keeps once it is left: spaces out of a tax ID, a bare +90 cleared. */
function normalizeCompanyField(kind: CompanyFieldKind, value: string) {
  switch (kind) {
    case 'email':
      return value.trim();
    case 'phone':
      return /^\+?9?0?\s*$/.test(value) ? '' : value;
    case 'taxID':
      return value.replaceAll(/\s/g, '');
    default:
      return value;
  }
}

/** One company field: checked once it is left, then on every change, so a fix clears it. */
function CompanyFieldRow({ field }: { field: CompanyField }) {
  const { companyInfo, setCompanyInfo } = useStore();
  const [left, setLeft] = useState(false);
  const id = `company-${field.key}`;
  const kind = field.kind ?? 'text';
  const value = companyInfo[field.key];
  const error = left ? companyFieldError(kind, value) : undefined;
  const mask = masks[kind];

  const setValue = (next: string) => setCompanyInfo((info) => ({ ...info, [field.key]: next }));

  const handleBlur = () => {
    setLeft(true);
    const normal = normalizeCompanyField(kind, value);
    if (normal !== value) {
      setValue(normal);
    }
  };

  let note;
  const bank = kind === 'iban' ? ibanBankName(value) : null;
  if (bank) {
    note = (
      <>
        {bank}
        {!companyInfo.bankName.trim() && (
          <Button
            onClick={() => setCompanyInfo((info) => ({ ...info, bankName: bank }))}
            style={styles.noteLink}
            variant="link"
          >
            Banka adını doldur
          </Button>
        )}
      </>
    );
  }

  return (
    <SettingsRow align={kind === 'text' ? 'center' : 'top'} htmlFor={id} label={field.label}>
      <SettingsField error={error} id={id} note={note}>
        {(describedBy) => {
          const control = {
            'aria-describedby': describedBy,
            'aria-invalid': error ? true : undefined,
            id,
            onBlur: handleBlur,
            placeholder: field.placeholder,
          };
          if (kind === 'textarea') {
            return (
              <Textarea
                rows={2}
                {...control}
                onChange={(event) => setValue(event.target.value)}
                value={value}
              />
            );
          }
          if (mask) {
            return (
              <MaskedInput
                {...control}
                autoComplete={kind === 'phone' ? 'tel' : 'off'}
                inputMode={kind === 'phone' ? 'tel' : 'text'}
                mask={mask}
                onInput={(event) => setValue(event.currentTarget.value)}
                style={styles.tabular}
                type={kind === 'phone' ? 'tel' : 'text'}
                value={value}
              />
            );
          }
          return (
            <Input
              {...control}
              autoComplete={kind === 'email' ? 'email' : undefined}
              inputMode={kind === 'taxID' ? 'numeric' : undefined}
              onChange={(event) => setValue(event.target.value)}
              spellCheck={kind === 'email' || kind === 'taxID' ? false : undefined}
              style={kind === 'taxID' ? styles.tabular : undefined}
              type={kind === 'email' ? 'email' : 'text'}
              value={value}
            />
          );
        }}
      </SettingsField>
    </SettingsRow>
  );
}

/** Rows bound to the active company's PDF details. */
function CompanyFields({ fields }: { fields: Array<CompanyField> }) {
  const { activeEntityId } = useStore();
  // Keyed by company too: another company's fields start unchecked.
  return fields.map((field) => (
    <CompanyFieldRow field={field} key={`${activeEntityId}-${field.key}`} />
  ));
}

function CompanyLogoRow() {
  const { companyInfo, setCompanyInfo } = useStore();
  const input = useRef<HTMLInputElement>(null);
  const [reading, setReading] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) {
      return;
    }
    setReading(true);
    try {
      const logo = await readLogo(file);
      setCompanyInfo((info) => ({ ...info, logo }));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Logo okunamadı');
    } finally {
      setReading(false);
    }
  }

  return (
    <SettingsRow
      hint="PNG, JPG ya da SVG, en fazla 1 megabayt. Logo yoksa PDF’te firma adı yazılır"
      label="Logo"
    >
      {companyInfo.logo && <img alt="Logo" src={companyInfo.logo} {...props(styles.logo)} />}
      <input
        accept={LOGO_TYPES.join(',')}
        hidden
        onChange={(event) => {
          void handleFile(event.target.files?.[0]);
          event.target.value = '';
        }}
        ref={input}
        type="file"
      />
      <Button disabled={reading} onClick={() => input.current?.click()} variant="outline">
        {companyInfo.logo ? 'Değiştir' : 'Logo seç'}
      </Button>
      {companyInfo.logo && (
        <Button
          aria-label="Logoyu kaldır"
          onClick={() => setCompanyInfo((info) => ({ ...info, logo: undefined }))}
          size="icon"
          variant="ghost"
        >
          <Trash2Icon />
        </Button>
      )}
    </SettingsRow>
  );
}

const pdfStyleLabels: Record<PDFStyle, string> = {
  classic: 'Klasik',
  minimal: 'Sade',
};

const pdfStyleOptions: ReadonlyArray<ChoiceOption<PDFStyle>> = PDF_STYLES.map((style) => ({
  label: pdfStyleLabels[style],
  value: style,
}));

function PDFStyleRow() {
  const { companyInfo, setCompanyInfo } = useStore();

  return (
    <SettingsRow
      hint="Sade ince çizgilerle, Klasik çerçeveli tablolarla basılır"
      id="pdf-style"
      label="PDF tasarımı"
    >
      <ChoiceChips
        aria-describedby="pdf-style-hint"
        aria-labelledby="pdf-style-label"
        onValueChange={(style) => {
          if (style) {
            setCompanyInfo((info) => ({ ...info, pdfStyle: style }));
          }
        }}
        options={pdfStyleOptions}
        value={resolvePDFStyle(companyInfo.pdfStyle)}
      />
    </SettingsRow>
  );
}

const themeLabels: Record<ThemeChoice, string> = {
  dark: 'Koyu',
  light: 'Açık',
  system: 'Sistem',
};

const themeOptions: ReadonlyArray<ChoiceOption<ThemeChoice>> = themeChoices.map((choice) => ({
  label: themeLabels[choice],
  value: choice,
}));

function AppearanceSection() {
  const [theme, setThemeChoice] = useState<ThemeChoice>(() => readTheme());

  return (
    <SettingsSection title="Görünüm">
      <SettingsRow hint="Sistem, macOS görünüm ayarını izler" id="theme" label="Tema">
        <ChoiceChips
          aria-describedby="theme-hint"
          aria-labelledby="theme-label"
          onValueChange={(choice) => {
            if (choice) {
              setTheme(choice);
              setThemeChoice(choice);
            }
          }}
          options={themeOptions}
          value={theme}
        />
      </SettingsRow>
      <PaletteRow />
    </SettingsSection>
  );
}

const paletteOptions = paletteChoices.map((choice) => ({
  label: paletteLabels[choice],
  value: choice,
}));

function PaletteRow() {
  const palette = usePalette();

  return (
    <SettingsRow hint="Serin mavi-gri, Sıcak krem tonlar kullanır" id="palette" label="Renk paleti">
      <ChoiceChips
        aria-describedby="palette-hint"
        aria-labelledby="palette-label"
        onValueChange={(choice) => {
          if (choice) {
            setPalette(choice);
          }
        }}
        options={paletteOptions}
        value={palette}
      />
    </SettingsRow>
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
      return 'Denetleniyor…';
    case 'current':
      return 'Angaria güncel';
    case 'downloading':
      return state.progress === null
        ? 'İndiriliyor…'
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
      setState({ kind: 'failed', message: 'Denetlenemedi. Tekrar dene.' });
    }
  }

  async function handleInstall(update: Update) {
    setState({ kind: 'downloading', progress: null });
    try {
      await installUpdate(update, (progress) => setState({ kind: 'downloading', progress }));
    } catch {
      setState({ kind: 'failed', message: 'Yüklenemedi. Tekrar dene.' });
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
          <CompanyLogoRow />
          <CompanyFields fields={companyFields} />
          <PDFStyleRow />
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
