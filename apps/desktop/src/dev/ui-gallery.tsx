// Dev-only gallery of every @angaria/ui component, served from ui-gallery.html
// (or /?ui-gallery). It loads the theme without the pre-relaunch app.css, so
// the components render exactly as the relaunch will see them.
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  Badge,
  Button,
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
  Checkbox,
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  Input,
  Kbd,
  KbdGroup,
  Label,
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  Skeleton,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  toast,
  Toaster,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
  Wordmark,
} from '@angaria/ui';
import { applyTheme, readTheme, themeChoices } from '@angaria/ui/theme';
import type { ThemeChoice } from '@angaria/ui/theme';
import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import {
  CopyIcon,
  DownloadIcon,
  EllipsisIcon,
  FilePlusIcon,
  FileTextIcon,
  LayoutTemplateIcon,
  PlusIcon,
  RepeatIcon,
  SettingsIcon,
  Trash2Icon,
  UsersIcon,
} from 'lucide-react';
import { StrictMode, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import '@angaria/ui/fonts.css';
import '@angaria/ui/theme.css';
import '@angaria/ui/base.css';

const styles = create({
  bar: {
    alignItems: 'center',
    backgroundColor: colors.bg,
    borderBottomColor: colors.border,
    borderBottomStyle: 'solid',
    borderBottomWidth: '1px',
    display: 'flex',
    gap: spacing.s4,
    justifyContent: 'space-between',
    paddingBlock: spacing.s3,
    paddingInline: spacing.s6,
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  barTitle: {
    alignItems: 'baseline',
    display: 'flex',
    fontSize: font.sizeLg,
    gap: spacing.s2,
  },
  barHint: {
    color: colors.muted,
    fontSize: font.sizeSm,
  },
  cardWidth: {
    maxWidth: '22rem',
  },
  commandInline: {
    borderColor: colors.border,
    borderRadius: '8px',
    borderStyle: 'solid',
    borderWidth: '1px',
    maxWidth: '28rem',
  },
  frame: {
    borderColor: colors.border,
    borderRadius: '8px',
    borderStyle: 'solid',
    borderWidth: '1px',
    display: 'flex',
    height: '20rem',
    overflow: 'hidden',
  },
  frameMain: {
    color: colors.muted,
    flex: 1,
    fontSize: font.sizeSm,
    padding: spacing.s4,
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: {
      '@media (min-width: 1100px)': '1fr 1fr',
      default: '1fr',
    },
  },
  pane: {
    backgroundColor: colors.bg,
    color: colors.fg,
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s8,
    minWidth: 0,
    padding: spacing.s6,
  },
  paneTitle: {
    color: colors.muted,
    fontSize: font.sizeSm,
    fontWeight: font.weightMedium,
  },
  row: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s3,
  },
  scrollBox: {
    borderColor: colors.border,
    borderRadius: '8px',
    borderStyle: 'solid',
    borderWidth: '1px',
    height: '8rem',
    width: '16rem',
  },
  scrollInner: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s2,
    padding: spacing.s3,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
  },
  sectionTitle: {
    fontSize: font.sizeMd,
    fontWeight: font.weightMedium,
    margin: 0,
  },
  sidebarWordmark: {
    fontSize: font.sizeLg,
    paddingInline: spacing.s2,
  },
  skeletonNarrow: {
    height: '1rem',
    width: '8rem',
  },
  skeletonWide: {
    height: '1rem',
    width: '14rem',
  },
  stack: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s3,
    maxWidth: '22rem',
  },
  wordmarkLarge: {
    fontSize: '3rem',
  },
});

const themeLabels: Record<ThemeChoice, string> = {
  dark: 'Koyu',
  light: 'Açık',
  system: 'Sistem',
};

const customers = ['Acme GmbH', 'Linear Orbit Inc.', 'Kuzey Yazılım', 'Mavi Tasarım'];

const invoices = [
  { amount: '1.499,00 ₺', customer: 'Kuzey Yazılım', date: '01.10.2026', no: 'GIB2026000000012' },
  { amount: '$2,400.00', customer: 'Acme GmbH', date: '28.09.2026', no: 'GIB2026000000011' },
  { amount: '€980.00', customer: 'Linear Orbit Inc.', date: '02.09.2026', no: 'GIB2026000000010' },
];

function Section({ children, title }: { children: ReactNode; title: string }) {
  return (
    <section {...props(styles.section)}>
      <h2 {...props(styles.sectionTitle)}>{title}</h2>
      {children}
    </section>
  );
}

function Showcase() {
  const [englishPdf, setEnglishPdf] = useState(false);
  const [lines, setLines] = useState(true);

  return (
    <>
      <Section title="Wordmark">
        <div {...props(styles.row)}>
          <Wordmark style={styles.wordmarkLarge} />
          <Wordmark />
        </div>
      </Section>

      <Section title="Button">
        <div {...props(styles.row)}>
          <Button>Fatura kes</Button>
          <Button variant="secondary">İkincil</Button>
          <Button variant="outline">Çerçeveli</Button>
          <Button variant="ghost">Hayalet</Button>
          <Button variant="destructive">Sil</Button>
          <Button variant="link">Bağlantı</Button>
        </div>
        <div {...props(styles.row)}>
          <Button>
            <PlusIcon />
            Yeni fatura
          </Button>
          <Button aria-label="Daha fazla" size="icon" variant="ghost">
            <EllipsisIcon />
          </Button>
          <Button aria-label="Ekle" size="icon" variant="outline">
            <PlusIcon />
          </Button>
          <Button disabled>Devre dışı</Button>
          <Button render={<a href="#gallery" />}>Bağlantı olarak</Button>
        </div>
      </Section>

      <Section title="Badge">
        <div {...props(styles.row)}>
          <Badge>Onaylandı</Badge>
          <Badge variant="secondary">Taslak</Badge>
          <Badge variant="outline">Şablon</Badge>
          <Badge variant="warning">İmza bekliyor</Badge>
          <Badge variant="destructive">İptal</Badge>
        </div>
      </Section>

      <Section title="Field, Input, Textarea, Label">
        <FieldGroup style={styles.stack}>
          <Field>
            <FieldLabel htmlFor="gallery-name">Müşteri adı</FieldLabel>
            <Input id="gallery-name" placeholder="Acme GmbH" />
            <FieldDescription>Faturada görünen ad.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="gallery-vkn">Vergi numarası</FieldLabel>
            <Input aria-invalid defaultValue="12345" id="gallery-vkn" />
            <FieldError>Vergi numarası 10 haneli olmalı.</FieldError>
          </Field>
          <Field>
            <FieldLabel htmlFor="gallery-note">Not</FieldLabel>
            <Textarea id="gallery-note" placeholder="Faturaya eklenecek not" />
          </Field>
          <Field>
            <FieldLabel htmlFor="gallery-disabled">Devre dışı</FieldLabel>
            <Input defaultValue="Değiştirilemez" disabled id="gallery-disabled" />
          </Field>
        </FieldGroup>
      </Section>

      <Section title="Select">
        <div {...props(styles.stack)}>
          <Select
            defaultValue="TRY"
            items={[
              { label: 'Türk lirası', value: 'TRY' },
              { label: 'ABD doları', value: 'USD' },
              { label: 'Euro', value: 'EUR' },
            ]}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TRY">Türk lirası</SelectItem>
              <SelectItem value="USD">ABD doları</SelectItem>
              <SelectItem value="EUR">Euro</SelectItem>
            </SelectContent>
          </Select>
          <Select>
            <SelectTrigger size="sm">
              <SelectValue placeholder="Dil seç" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tr">Türkçe</SelectItem>
              <SelectItem value="en">İngilizce</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Section>

      <Section title="Combobox">
        <div {...props(styles.stack)}>
          <Combobox items={customers}>
            <ComboboxInput placeholder="Müşteri ara" />
            <ComboboxContent>
              <ComboboxEmpty>Müşteri bulunamadı.</ComboboxEmpty>
              <ComboboxList>
                {(item: string) => (
                  <ComboboxItem key={item} value={item}>
                    {item}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
        </div>
      </Section>

      <Section title="Checkbox, Switch">
        <div {...props(styles.row)}>
          <Label>
            <Checkbox checked={lines} onCheckedChange={setLines} />
            Satır açıklamalarını göster
          </Label>
          <Label>
            <Checkbox indeterminate />
            Kısmen seçili
          </Label>
          <Label>
            <Checkbox disabled />
            Devre dışı
          </Label>
        </div>
        <div {...props(styles.row)}>
          <Label>
            <Switch checked={englishPdf} onCheckedChange={setEnglishPdf} />
            İngilizce PDF
          </Label>
          <Label>
            <Switch disabled />
            Devre dışı
          </Label>
        </div>
      </Section>

      <Section title="Dialog, AlertDialog">
        <div {...props(styles.row)}>
          <Dialog>
            <DialogTrigger render={<Button variant="outline" />}>Müşteri ekle</DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Yeni müşteri</DialogTitle>
                <DialogDescription>Faturalarda kullanılacak bilgiler.</DialogDescription>
              </DialogHeader>
              <Field>
                <FieldLabel htmlFor="dialog-name">Ad</FieldLabel>
                <Input id="dialog-name" placeholder="Acme GmbH" />
              </Field>
              <DialogFooter>
                <DialogClose render={<Button variant="outline" />}>Vazgeç</DialogClose>
                <Button>Kaydet</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <AlertDialog>
            <AlertDialogTrigger render={<Button variant="destructive" />}>
              Taslağı sil
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Taslak silinsin mi?</AlertDialogTitle>
                <AlertDialogDescription>
                  Bu taslak GİB portalından da kaldırılır. Bu işlem geri alınamaz.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Vazgeç</AlertDialogCancel>
                <AlertDialogAction variant="destructive">Sil</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </Section>

      <Section title="Popover, DropdownMenu, Tooltip">
        <div {...props(styles.row)}>
          <Popover>
            <PopoverTrigger render={<Button variant="outline" />}>Kur bilgisi</PopoverTrigger>
            <PopoverContent>
              <PopoverHeader>
                <PopoverTitle>TCMB döviz alış</PopoverTitle>
                <PopoverDescription>
                  Fatura tarihinden önceki iş gününün kuru kullanılır.
                </PopoverDescription>
              </PopoverHeader>
            </PopoverContent>
          </Popover>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="outline" />}>
              İşlemler
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuLabel>Fatura</DropdownMenuLabel>
              <DropdownMenuItem>
                <RepeatIcon />
                Tekrar kes
                <DropdownMenuShortcut>⌘R</DropdownMenuShortcut>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <CopyIcon />
                Şablon olarak kullan
              </DropdownMenuItem>
              <DropdownMenuItem>
                <DownloadIcon />
                PDF indir
              </DropdownMenuItem>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>PDF dili</DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuItem>Türkçe</DropdownMenuItem>
                  <DropdownMenuItem>İngilizce</DropdownMenuItem>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuCheckboxItem checked={lines} onCheckedChange={setLines}>
                Satır açıklamaları
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">
                <Trash2Icon />
                Sil
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Tooltip>
            <TooltipTrigger
              render={<Button aria-label="Yeni fatura" size="icon" variant="ghost" />}
            >
              <FilePlusIcon />
            </TooltipTrigger>
            <TooltipContent>Yeni fatura</TooltipContent>
          </Tooltip>
        </div>
      </Section>

      <Section title="Tabs">
        <Tabs defaultValue="details">
          <TabsList>
            <TabsTrigger value="details">Bilgiler</TabsTrigger>
            <TabsTrigger value="lines">Satırlar</TabsTrigger>
            <TabsTrigger value="preview">Önizleme</TabsTrigger>
          </TabsList>
          <TabsContent value="details">Fatura bilgileri burada.</TabsContent>
          <TabsContent value="lines">Fatura satırları burada.</TabsContent>
          <TabsContent value="preview">PDF önizlemesi burada.</TabsContent>
        </Tabs>
        <Tabs defaultValue="tr">
          <TabsList variant="line">
            <TabsTrigger value="tr">Türkçe</TabsTrigger>
            <TabsTrigger value="en">İngilizce</TabsTrigger>
          </TabsList>
        </Tabs>
      </Section>

      <Section title="Card">
        <Card style={styles.cardWidth}>
          <CardHeader>
            <CardTitle>Yıllık lisans</CardTitle>
            <CardDescription>14 gün ücretsiz, sonra 1.499 ₺ / yıl.</CardDescription>
            <CardAction>
              <Badge variant="secondary">Deneme</Badge>
            </CardAction>
          </CardHeader>
          <CardContent>Lisans 3 cihazda etkinleştirilebilir.</CardContent>
          <CardFooter>
            <Button>Satın al</Button>
            <Button variant="ghost">Lisans anahtarı gir</Button>
          </CardFooter>
        </Card>
      </Section>

      <Section title="Table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fatura no</TableHead>
              <TableHead>Müşteri</TableHead>
              <TableHead>Tarih</TableHead>
              <TableHead>Tutar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.map((invoice, index) => (
              <TableRow data-state={index === 0 ? 'selected' : undefined} key={invoice.no}>
                <TableCell>{invoice.no}</TableCell>
                <TableCell>{invoice.customer}</TableCell>
                <TableCell>{invoice.date}</TableCell>
                <TableCell>{invoice.amount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Section>

      <Section title="ScrollArea, Separator, Skeleton, Kbd">
        <div {...props(styles.row)}>
          <ScrollArea style={styles.scrollBox}>
            <div {...props(styles.scrollInner)}>
              {invoices.concat(invoices, invoices).map((invoice, index) => (
                <div key={`${invoice.no}-${index}`}>
                  {invoice.customer}
                  <Separator />
                </div>
              ))}
            </div>
          </ScrollArea>
          <div {...props(styles.stack)}>
            <Skeleton style={styles.skeletonWide} />
            <Skeleton style={styles.skeletonNarrow} />
            <KbdGroup>
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </KbdGroup>
          </div>
        </div>
      </Section>

      <Section title="Toast">
        <div {...props(styles.row)}>
          <Button
            onClick={() => toast('Fatura taslağı oluşturuldu', { description: 'GIB2026000000013' })}
            variant="outline"
          >
            Bildirim göster
          </Button>
          <Button onClick={() => toast.error('GİB oturumu kapandı')} variant="outline">
            Hata bildirimi
          </Button>
        </div>
      </Section>

      <Section title="Command">
        <Command style={styles.commandInline}>
          <CommandInput placeholder="Komut ara" />
          <CommandList>
            <CommandEmpty>Sonuç yok.</CommandEmpty>
            <CommandGroup heading="Faturalar">
              <CommandItem>
                <FilePlusIcon />
                Yeni fatura
                <CommandShortcut>⌘N</CommandShortcut>
              </CommandItem>
              <CommandItem>
                <RepeatIcon />
                Geçen ayın faturasını tekrar kes
              </CommandItem>
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup heading="Git">
              <CommandItem>
                <UsersIcon />
                Müşteriler
              </CommandItem>
              <CommandItem disabled>
                <SettingsIcon />
                Ayarlar (devre dışı)
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </Section>

      <Section title="Sidebar">
        <div {...props(styles.frame)}>
          <Sidebar>
            <SidebarHeader>
              <Wordmark style={styles.sidebarWordmark} />
            </SidebarHeader>
            <SidebarContent>
              <SidebarGroup>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive>
                      <FileTextIcon />
                      Faturalar
                      <SidebarMenuBadge>12</SidebarMenuBadge>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton>
                      <FilePlusIcon />
                      Yeni fatura
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton>
                      <UsersIcon />
                      Müşteriler
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroup>
              <SidebarGroup>
                <SidebarGroupLabel>Kayıtlı</SidebarGroupLabel>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton>
                      <LayoutTemplateIcon />
                      Şablonlar
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroup>
            </SidebarContent>
            <SidebarFooter>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton>
                    <SettingsIcon />
                    Ayarlar
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarFooter>
          </Sidebar>
          <div {...props(styles.frameMain)}>Liste ve ayrıntı bölmeleri burada.</div>
        </div>
      </Section>
    </>
  );
}

function Gallery() {
  const [theme, setTheme] = useState<ThemeChoice>(readTheme);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  const chooseTheme = (choice: ThemeChoice) => {
    applyTheme(choice);
    setTheme(choice);
  };

  return (
    <TooltipProvider>
      <header {...props(styles.bar)} id="gallery">
        <div {...props(styles.barTitle)}>
          <Wordmark />
          <span {...props(styles.barHint)}>
            Arayüz bileşenleri. Açılır pencereler sayfa temasını izler. Komut paleti için ⌘K.
          </span>
        </div>
        <Tabs onValueChange={(value: ThemeChoice) => chooseTheme(value)} value={theme}>
          <TabsList>
            {themeChoices.map((choice) => (
              <TabsTrigger key={choice} value={choice}>
                {themeLabels[choice]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </header>
      <div {...props(styles.grid)}>
        <div {...props(styles.pane)} data-theme="light">
          <span {...props(styles.paneTitle)}>Açık</span>
          <Showcase />
        </div>
        <div {...props(styles.pane)} data-theme="dark">
          <span {...props(styles.paneTitle)}>Koyu</span>
          <Showcase />
        </div>
      </div>
      <CommandDialog onOpenChange={setPaletteOpen} open={paletteOpen}>
        <CommandInput placeholder="Ne yapmak istersin?" />
        <CommandList>
          <CommandEmpty>Sonuç yok.</CommandEmpty>
          <CommandGroup heading="Faturalar">
            <CommandItem onSelect={() => setPaletteOpen(false)}>
              <RepeatIcon />
              Geçen ayın faturasını tekrar kes
            </CommandItem>
            <CommandItem onSelect={() => setPaletteOpen(false)}>
              <FilePlusIcon />
              Yeni fatura
              <CommandShortcut>⌘N</CommandShortcut>
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
      <Toaster />
    </TooltipProvider>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Gallery />
  </StrictMode>,
);
