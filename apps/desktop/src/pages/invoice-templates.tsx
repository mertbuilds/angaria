import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  FieldLabel,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  toast,
} from '@angaria/ui';
import { colors, font, spacing } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { useNavigate } from '@tanstack/react-router';
import { FilePlusIcon, PencilIcon, Trash2Icon } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { useStore } from '@/lib/store.tsx';
import type { InvoiceItem, InvoiceTemplate } from '@/lib/types.ts';
import { ListDetail } from '@/shell/list-detail.tsx';
import { Screen } from '@/shell/screen.tsx';
import {
  EmptyState,
  formatMoney,
  formatNumber,
  invoiceTypeLabel,
  matchesQuery,
  SearchableList,
  unitLabel,
  useDialogTarget,
  useListSelection,
} from '@/shell/searchable-list.tsx';
import { useAppActions } from '@/shell/use-app-actions.ts';

const styles = create({
  actions: {
    alignItems: 'center',
    display: 'flex',
    flexWrap: 'wrap',
    gap: spacing.s2,
  },
  detail: {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s8,
    maxWidth: '48rem',
    padding: spacing.s6,
    width: '100%',
  },
  facts: {
    display: 'grid',
    gap: spacing.s2,
    gridTemplateColumns: 'minmax(8rem, max-content) 1fr',
    margin: 0,
  },
  factTerm: {
    color: colors.muted,
  },
  factValue: {
    margin: 0,
    overflowWrap: 'anywhere',
    whiteSpace: 'pre-line',
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s4,
  },
  number: {
    textAlign: 'right',
  },
  placeholder: {
    alignItems: 'center',
    color: colors.muted,
    display: 'flex',
    flex: 1,
    fontSize: font.sizeSm,
    justifyContent: 'center',
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    fontSize: font.sizeSm,
    gap: spacing.s3,
    margin: 0,
  },
  sectionTitle: {
    color: colors.muted,
    fontSize: font.sizeXs,
    fontWeight: font.weightRegular,
    margin: 0,
  },
  subtitle: {
    color: colors.muted,
    fontSize: font.sizeSm,
    margin: 0,
  },
  title: {
    color: colors.fg,
    fontSize: font.sizeLg,
    fontWeight: font.weightMedium,
    lineHeight: 1.25,
    margin: 0,
    overflowWrap: 'anywhere',
  },
  titleBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing.s1,
  },
  totalLabel: {
    color: colors.muted,
  },
  totalRow: {
    display: 'flex',
    gap: spacing.s6,
    justifyContent: 'space-between',
    minWidth: '16rem',
  },
  totalStrong: {
    fontWeight: font.weightMedium,
  },
  totals: {
    alignItems: 'flex-end',
    display: 'flex',
    flexDirection: 'column',
    fontSize: font.sizeSm,
    fontVariantNumeric: 'tabular-nums',
    gap: spacing.s2,
  },
});

const dateFormat = new Intl.DateTimeFormat('tr-TR', { dateStyle: 'long' });

// Same arithmetic as the invoice form: discounts come off before VAT.
const lineNet = (item: InvoiceItem) => item.quantity * item.unitPrice - (item.discountAmount || 0);

function templateTotals(items: Array<InvoiceItem>) {
  const net = items.reduce((sum, item) => sum + lineNet(item), 0);
  const vat = items.reduce((sum, item) => sum + lineNet(item) * (item.VATRate / 100), 0);
  return { net, total: net + vat, vat };
}

const lastUsed = (template: InvoiceTemplate) => template.lastUsedAt ?? 0;

function Fact({ children, term }: { children: ReactNode; term: string }) {
  return (
    <>
      <dt {...props(styles.factTerm)}>{term}</dt>
      <dd {...props(styles.factValue)}>{children}</dd>
    </>
  );
}

function TemplateDetail({
  onDelete,
  onIssue,
  onRename,
  template,
}: {
  onDelete: () => void;
  onIssue: () => void;
  onRename: () => void;
  template: InvoiceTemplate;
}) {
  const { items, note, recipient, settings } = template;
  const { net, total, vat } = templateTotals(items);
  const place = [recipient.district, recipient.city, recipient.country].filter(Boolean).join(', ');
  const person = [recipient.name, recipient.surname].filter(Boolean).join(' ');

  return (
    <div {...props(styles.detail)}>
      <header {...props(styles.header)}>
        <div {...props(styles.titleBlock)}>
          <h2 {...props(styles.title)}>{template.name}</h2>
          <p {...props(styles.subtitle)}>
            {template.lastUsedAt
              ? `Son kullanım ${dateFormat.format(template.lastUsedAt)}`
              : 'Henüz kullanılmadı'}
          </p>
        </div>
        <div {...props(styles.actions)}>
          <Button onClick={onIssue}>
            <FilePlusIcon />
            Bu şablonla fatura kes
          </Button>
          <Button onClick={onRename} variant="outline">
            <PencilIcon />
            Yeniden adlandır
          </Button>
          <Button onClick={onDelete} variant="destructive">
            <Trash2Icon />
            Sil
          </Button>
        </div>
      </header>

      <section {...props(styles.section)}>
        <h3 {...props(styles.sectionTitle)}>Müşteri</h3>
        <dl {...props(styles.facts)}>
          <Fact term="Unvan">{recipient.title || 'Belirtilmedi'}</Fact>
          {person && <Fact term="Yetkili">{person}</Fact>}
          <Fact term="VKN / TCKN">{recipient.taxIDOrTRID || 'Belirtilmedi'}</Fact>
          {recipient.taxOffice && <Fact term="Vergi dairesi">{recipient.taxOffice}</Fact>}
          {recipient.fullAddress && <Fact term="Adres">{recipient.fullAddress}</Fact>}
          {place && <Fact term="Konum">{place}</Fact>}
        </dl>
      </section>

      <section {...props(styles.section)}>
        <h3 {...props(styles.sectionTitle)}>Fatura</h3>
        <dl {...props(styles.facts)}>
          <Fact term="Fatura tipi">{invoiceTypeLabel(settings.invoiceType)}</Fact>
          <Fact term="Para birimi">{settings.currency}</Fact>
        </dl>
      </section>

      <section {...props(styles.section)}>
        <h3 {...props(styles.sectionTitle)}>Kalemler</h3>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Ad</TableHead>
              <TableHead style={styles.number}>Miktar</TableHead>
              <TableHead style={styles.number}>Birim fiyat</TableHead>
              <TableHead style={styles.number}>KDV</TableHead>
              <TableHead style={styles.number}>Tutar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell>{item.name || 'Adsız kalem'}</TableCell>
                <TableCell style={styles.number}>
                  {formatNumber(item.quantity)} {unitLabel(item.unitType)}
                </TableCell>
                <TableCell style={styles.number}>
                  {formatMoney(item.unitPrice, settings.currency)}
                </TableCell>
                <TableCell style={styles.number}>%{formatNumber(item.VATRate)}</TableCell>
                <TableCell style={styles.number}>
                  {formatMoney(lineNet(item), settings.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <div {...props(styles.totals)}>
          <div {...props(styles.totalRow)}>
            <span {...props(styles.totalLabel)}>Ara toplam</span>
            <span>{formatMoney(net, settings.currency)}</span>
          </div>
          <div {...props(styles.totalRow)}>
            <span {...props(styles.totalLabel)}>KDV</span>
            <span>{formatMoney(vat, settings.currency)}</span>
          </div>
          <div {...props(styles.totalRow, styles.totalStrong)}>
            <span>Toplam</span>
            <span>{formatMoney(total, settings.currency)}</span>
          </div>
        </div>
      </section>

      {note && (
        <section {...props(styles.section)}>
          <h3 {...props(styles.sectionTitle)}>Not</h3>
          <p {...props(styles.factValue)}>{note}</p>
        </section>
      )}
    </div>
  );
}

function RenameForm({
  initialName,
  onCancel,
  onRename,
}: {
  initialName: string;
  onCancel: () => void;
  onRename: (name: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const trimmed = name.trim();

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (trimmed) {
          onRename(trimmed);
        }
      }}
      {...props(styles.section)}
    >
      <DialogHeader>
        <DialogTitle>Şablonu yeniden adlandır</DialogTitle>
      </DialogHeader>
      <Field>
        <FieldLabel htmlFor="template-name">Şablon adı</FieldLabel>
        <Input
          autoFocus
          id="template-name"
          onChange={(event) => setName(event.target.value)}
          placeholder="Aylık danışmanlık faturası"
          value={name}
        />
      </Field>
      <DialogFooter>
        <Button onClick={onCancel} variant="outline">
          Vazgeç
        </Button>
        <Button disabled={!trimmed} type="submit">
          Kaydet
        </Button>
      </DialogFooter>
    </form>
  );
}

export function InvoiceTemplatesPage({ tabs }: { tabs: ReactNode }) {
  const navigate = useNavigate();
  const { newInvoice } = useAppActions();
  const { invoiceTemplates, setInvoiceTemplates } = useStore();
  const [query, setQuery] = useState('');
  const renaming = useDialogTarget<InvoiceTemplate>();
  const deleting = useDialogTarget<InvoiceTemplate>();

  // Most recently used first, so ↵ on the top row repeats the usual invoice.
  const visible = useMemo(
    () =>
      invoiceTemplates
        .filter((template) => matchesQuery(query, template.name, template.recipient.title))
        .toSorted((a, b) => lastUsed(b) - lastUsed(a)),
    [invoiceTemplates, query],
  );
  const { neighborOf, select, selected } = useListSelection(visible);

  const issue = (template: InvoiceTemplate) =>
    void navigate({ search: { sablon: template.id }, to: '/yeni' });

  const rename = (name: string) => {
    const id = renaming.target?.id;
    setInvoiceTemplates((prev) =>
      prev.map((template) => (template.id === id ? { ...template, name } : template)),
    );
    toast.success('Şablon adı değiştirildi');
    renaming.close();
  };

  const remove = () => {
    const id = deleting.target?.id;
    if (id) {
      select(neighborOf(id));
      setInvoiceTemplates((prev) => prev.filter((template) => template.id !== id));
      toast.success('Fatura şablonu silindi');
    }
    deleting.close();
  };

  return (
    <Screen scroll={false} title="Şablonlar" toolbar={tabs}>
      {invoiceTemplates.length === 0 ? (
        <EmptyState
          action={
            <Button onClick={newInvoice}>
              <FilePlusIcon />
              Yeni fatura
            </Button>
          }
          title="Henüz fatura şablonu yok"
        >
          Fatura keserken Şablon olarak kaydet deyin. Bir sonraki faturada müşteri, kalemler ve not
          hazır gelir.
        </EmptyState>
      ) : (
        <ListDetail
          detail={
            selected ? (
              <TemplateDetail
                onDelete={() => deleting.show(selected)}
                onIssue={() => issue(selected)}
                onRename={() => renaming.show(selected)}
                template={selected}
              />
            ) : (
              <p {...props(styles.placeholder)}>Aramayla eşleşen şablon yok</p>
            )
          }
          list={
            <SearchableList
              label="Fatura şablonları"
              onDelete={deleting.show}
              onOpen={issue}
              onQueryChange={setQuery}
              onSelect={select}
              openHint="fatura kes"
              query={query}
              row={(template) => {
                const { total } = templateTotals(template.items);
                return {
                  subtitle: template.recipient.title || 'Müşteri belirtilmedi',
                  title: template.name,
                  trailing: formatMoney(total, template.settings.currency),
                };
              }}
              searchPlaceholder="Şablon ara"
              selected={selected}
              visible={visible}
            />
          }
          storageKey="sablonlar-list-width"
        />
      )}

      <Dialog onOpenChange={(open) => !open && renaming.close()} open={renaming.open}>
        <DialogContent>
          {renaming.target && (
            <RenameForm
              initialName={renaming.target.name}
              onCancel={renaming.close}
              onRename={rename}
            />
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog onOpenChange={(open) => !open && deleting.close()} open={deleting.open}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Şablon silinsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleting.target?.name} şablonu silinir. Bu işlem geri alınamaz.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={remove} variant="destructive">
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Screen>
  );
}
