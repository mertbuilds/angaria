import { PlusSignIcon, Delete01Icon, FileAddIcon, Invoice01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Download } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { toast } from 'sonner';
import { AutocompleteInput } from '@/components/autocomplete-input.tsx';
import { ConfirmDialog } from '@/components/confirm-dialog.tsx';
import { downloadInvoicePDF, type InvoicePDFData } from '@/components/invoice-pdf.tsx';
import { InvoicePickerDialog } from '@/components/invoice-picker-dialog.tsx';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
  CardDescription,
} from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { DatePicker } from '@/components/ui/date-picker.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import * as angaria from '@/lib/angaria.ts';
import {
  GIB_COUNTRIES,
  GIB_CURRENCIES,
  GIB_UNIT_TYPES,
  GIB_INVOICE_TYPES,
} from '@/lib/gib-constants.ts';
import { useStore } from '@/lib/store.tsx';
import { parseGIB, toGIB } from '@/lib/utils.ts';

const formatMoney = (currency: string, n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(n);

const p = (n: number) => String(n).padStart(2, '0');

export function CreateInvoicePage({ requireCredentials }: { requireCredentials: () => boolean }) {
  const {
    activeEntity,
    getCredentials,
    recipient,
    setRecipient,
    invoiceSettings,
    setInvoiceSettings,
    items,
    setItems,
    note,
    setNote,
    savedRecipients,
    savedItems,
    setSavedItems,
    companyInfo,
    setInvoiceTemplates,
    advancedFields,
    setAdvancedFields,
    newId,
    defaultItemAdvanced,
    invoiceStarted,
    invoiceTemplates,
    loadTemplate,
    startBlankInvoice,
    sourceTemplateId,
    templateEditMode,
    loadFromGIBInvoice,
    setInvoiceDateRange,
  } = useStore();

  const queryClient = useQueryClient();

  const [invoiceHTML, setInvoiceHTML] = useState<string | null>(null);
  const [showInvoicePicker, setShowInvoicePicker] = useState(false);
  const [showTemplateSaveDialog, setShowTemplateSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const lastCheckedRef = useRef<string | null>(null);

  const isForeignCurrency = invoiceSettings.currency !== 'TRY';
  const invoiceDate = advancedFields.manualDate || '';
  const tcmbQuery = useQuery({
    queryKey: ['tcmb-rates', invoiceDate],
    queryFn: () => angaria.fetchTCMBRates(parseGIB(invoiceDate)),
    enabled: isForeignCurrency,
    staleTime: 5 * 60 * 1000,
  });
  const ratesLoading = tcmbQuery.isLoading && isForeignCurrency;

  // Auto-fill currency rate when rates arrive or currency changes
  useEffect(() => {
    if (!isForeignCurrency || !tcmbQuery.data) {
      return;
    }
    const rate = tcmbQuery.data.get(invoiceSettings.currency);
    if (rate) {
      setInvoiceSettings((s) => ({ ...s, currencyRate: rate.toFixed(4) }));
    }
  }, [tcmbQuery.data, invoiceSettings.currency]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (tcmbQuery.error && isForeignCurrency) {
      toast.error('TCMB döviz kurları alınamadı');
    }
  }, [tcmbQuery.error, isForeignCurrency]);

  const totalDiscount = items.reduce((s, i) => s + (i.discountAmount || 0), 0);
  const grandTotal = items.reduce(
    (s, i) => s + i.quantity * i.unitPrice - (i.discountAmount || 0),
    0,
  );
  const totalVAT = items.reduce(
    (s, i) => s + (i.quantity * i.unitPrice - (i.discountAmount || 0)) * (i.VATRate / 100),
    0,
  );
  const total = grandTotal + totalVAT;

  function selectRecipient(id: string) {
    const found = savedRecipients.find((r) => r.id === id);
    if (found) {
      setRecipient({ ...found });
    }
  }

  function updateItem(id: string, field: string, value: string | number) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) {
          return i;
        }
        const updated = { ...i, [field]: value };
        // Auto-calculate discount amount from rate
        if (field === 'discountRate') {
          updated.discountAmount = updated.quantity * updated.unitPrice * (Number(value) / 100);
        }
        return updated;
      }),
    );
  }

  // Auto-sync items with non-empty names to saved item templates
  useEffect(() => {
    const namedItems = items.filter((i) => i.name.trim());
    if (namedItems.length === 0) {
      return;
    }
    setSavedItems((prev) => {
      let next = [...prev];
      for (const item of namedItems) {
        const idx = next.findIndex((s) => s.name === item.name);
        if (idx >= 0) {
          next[idx] = { ...item, id: next[idx].id };
        } else {
          next = [...next, { ...item }];
        }
      }
      return next;
    });
  }, [items, setSavedItems]);

  function addItem() {
    setItems((prev) => [
      ...prev,
      { id: newId(), name: '', quantity: 1, unitPrice: 0, VATRate: 20, ...defaultItemAdvanced },
    ]);
  }

  function toggleSelectItem(id: string, shiftKey: boolean) {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (shiftKey && lastCheckedRef.current) {
        const ids = items.map((i) => i.id);
        const from = ids.indexOf(lastCheckedRef.current);
        const to = ids.indexOf(id);
        const [start, end] = from < to ? [from, to] : [to, from];
        for (let i = start; i <= end; i++) {
          next.add(ids[i]);
        }
      } else {
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });
    lastCheckedRef.current = id;
  }

  function toggleSelectAll() {
    if (selectedItemIds.size === items.length) {
      setSelectedItemIds(new Set());
    } else {
      setSelectedItemIds(new Set(items.map((i) => i.id)));
    }
  }

  function confirmRemoveItems() {
    if (selectedItemIds.size === 0) {
      return;
    }
    setItems((prev) => {
      const remaining = prev.filter((i) => !selectedItemIds.has(i.id));
      return remaining.length > 0 ? remaining : [prev[0]];
    });
    setSelectedItemIds(new Set());
    setShowDeleteConfirm(false);
  }

  function loadItemTemplate(templateId: string, itemId: string) {
    const t = savedItems.find((x) => x.id === templateId);
    if (t) {
      setItems((prev) => prev.map((i) => (i.id === itemId ? { ...t, id: itemId } : i)));
    }
  }

  function saveInvoiceTemplate(name: string) {
    setInvoiceTemplates((prev) => [
      ...prev,
      {
        id: newId(),
        name,
        recipient: { ...recipient },
        settings: { ...invoiceSettings },
        items: items.map((i) => ({ ...i })),
        note,
      },
    ]);
    toast.success('Fatura şablonu kaydedildi');
  }

  function buildPDFData(invoiceNumber?: string): InvoicePDFData {
    const now = new Date();
    const autoDate = `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()}`;
    const date = advancedFields.manualDate || autoDate;
    const paymentTotal = advancedFields.paymentTotal ? Number(advancedFields.paymentTotal) : total;
    return {
      entityName: activeEntity.name,
      company: companyInfo,
      recipient,
      settings: invoiceSettings,
      items,
      date,
      invoiceNumber,
      note,
      grandTotal,
      totalVAT,
      total,
      totalDiscount: totalDiscount || undefined,
      paymentTotal,
    };
  }

  function handleDownloadPDF() {
    const pdfData = buildPDFData();
    const id = toast.loading('PDF hazırlanıyor...');
    downloadInvoicePDF(pdfData)
      .then(() => toast.success('PDF indirildi', { id }))
      .catch(() => toast.error('PDF oluşturulamadı', { id }));
  }

  const createMutation = useMutation({
    mutationFn: async () => {
      const now = new Date();
      const autoDate = `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()}`;
      const autoTime = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
      const date = advancedFields.manualDate || autoDate;
      const time = advancedFields.manualTime || autoTime;
      const paymentTotal = advancedFields.paymentTotal
        ? Number(advancedFields.paymentTotal)
        : total;

      const { username, password, testMode } = await getCredentials(activeEntity.id);
      const session = await angaria.login(username, password, testMode);
      try {
        const draft = await angaria.createDraftInvoice(session, {
          date,
          time,
          currency: invoiceSettings.currency,
          currencyRate: invoiceSettings.currencyRate || undefined,
          invoiceType: invoiceSettings.invoiceType,
          taxIDOrTRID: recipient.taxIDOrTRID,
          taxOffice: recipient.taxOffice,
          title: recipient.title,
          name: recipient.name,
          surname: recipient.surname,
          fullAddress: recipient.fullAddress,
          country: recipient.country || undefined,
          city: recipient.city || undefined,
          district: recipient.district || undefined,
          items: items.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            price: i.quantity * i.unitPrice,
            unitType: i.unitType || 'C62',
            VATRate: i.VATRate,
            VATAmount: (i.quantity * i.unitPrice - (i.discountAmount || 0)) * (i.VATRate / 100),
            discountRate: i.discountRate || undefined,
            discountAmount: i.discountAmount || undefined,
            discountReason: i.discountReason || undefined,
            gtip: i.gtip || undefined,
          })),
          grandTotal,
          totalVAT,
          grandTotalInclVAT: total,
          paymentTotal,
          totalDiscount: totalDiscount || undefined,
          irsaliyeNumarasi: advancedFields.irsaliyeNumarasi || undefined,
          irsaliyeTarihi: advancedFields.irsaliyeTarihi || undefined,
          note,
        });

        let html: string | undefined;
        if (draft.uuid) {
          try {
            html = await angaria.getInvoiceHTML(session, draft.uuid, 'Onaylanmadı');
          } catch {
            // preview is optional
          }
        }

        return { draft, html };
      } finally {
        angaria.logout(session).catch(() => {});
      }
    },
    onSuccess: ({ draft, html }) => {
      if (html) {
        toast.success('Taslak fatura oluşturuldu!');
        setInvoiceHTML(html);
      } else {
        toast.warning(
          "Taslak fatura oluşturuldu ancak GİB'den doğrulanamadı. Faturalarım sayfasından kontrol edin.",
        );
      }

      // Make the new draft visible in the invoices list: refetch it and
      // widen the date range to cover the invoice date if needed.
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
      const createdDate = parseGIB(draft.date);
      if (createdDate) {
        setInvoiceDateRange((prev) => {
          const start = parseGIB(prev.start);
          const end = parseGIB(prev.end);
          return {
            start: start && start <= createdDate ? prev.start : draft.date,
            end: end && end >= createdDate ? prev.end : draft.date,
          };
        });
      }

      // Only show save-as-template dialog if form differs from source template
      const sourceTemplate = sourceTemplateId
        ? invoiceTemplates.find((t) => t.id === sourceTemplateId)
        : null;
      const formMatchesTemplate =
        sourceTemplate &&
        sourceTemplate.recipient.taxIDOrTRID === recipient.taxIDOrTRID &&
        sourceTemplate.recipient.title === recipient.title &&
        sourceTemplate.recipient.fullAddress === recipient.fullAddress &&
        sourceTemplate.settings.currency === invoiceSettings.currency &&
        sourceTemplate.settings.invoiceType === invoiceSettings.invoiceType &&
        sourceTemplate.note === note &&
        sourceTemplate.items.length === items.length &&
        sourceTemplate.items.every(
          (ti, idx) =>
            items[idx] &&
            ti.name === items[idx].name &&
            ti.quantity === items[idx].quantity &&
            ti.unitPrice === items[idx].unitPrice &&
            ti.VATRate === items[idx].VATRate,
        );
      if (!formMatchesTemplate) {
        setTemplateName(recipient.title);
        setShowTemplateSaveDialog(true);
      }
    },
  });

  function createInvoice() {
    if (!requireCredentials()) {
      return;
    }
    if (!recipient.taxIDOrTRID || !recipient.title || !recipient.fullAddress) {
      toast.error('Alıcı bilgileri eksik');
      return;
    }
    if (items.some((i) => !i.name || i.unitPrice <= 0)) {
      toast.error('Kalem bilgileri eksik veya hatalı');
      return;
    }
    if (invoiceSettings.currency !== 'TRY' && !invoiceSettings.currencyRate) {
      toast.error('Döviz kuru zorunludur');
      return;
    }
    createMutation.mutate();
  }

  if (!invoiceStarted) {
    const recentTemplates = [...invoiceTemplates]
      .sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0))
      .slice(0, 3);

    return (
      <div className="space-y-6">
        {recentTemplates.length > 0 && (
          <>
            <h2 className="text-sm font-medium text-muted-foreground">Şablondan oluştur</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {recentTemplates.map((t) => (
                <Card
                  className="cursor-pointer transition-colors hover:bg-accent/50"
                  key={t.id}
                  onClick={() => {
                    loadTemplate(t.id);
                    toast.success(`"${t.name}" şablonu yüklendi`);
                  }}
                >
                  <CardHeader>
                    <CardTitle className="text-sm">{t.name}</CardTitle>
                    <CardDescription className="text-xs">{t.recipient.title}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="text-xs text-muted-foreground">
                      {t.items.length} kalem · {t.settings.currency}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </>
        )}

        <div className="relative">
          {recentTemplates.length > 0 && (
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
          )}
          {recentTemplates.length > 0 && (
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">veya</span>
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            onClick={startBlankInvoice}
            type="button"
          >
            <HugeiconsIcon className="size-6" icon={FileAddIcon} strokeWidth={1.5} />
            <span className="text-sm font-medium">Sıfırdan Oluştur</span>
          </button>
          <button
            className="flex min-h-32 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            onClick={() => {
              if (!requireCredentials()) {
                return;
              }
              setShowInvoicePicker(true);
            }}
            type="button"
          >
            <HugeiconsIcon className="size-6" icon={Invoice01Icon} strokeWidth={1.5} />
            <span className="text-sm font-medium">Eski Faturadan Oluştur</span>
          </button>
        </div>

        <InvoicePickerDialog
          onOpenChange={setShowInvoicePicker}
          onSelect={(detail) => {
            loadFromGIBInvoice(detail as unknown as Record<string, unknown>);
            setShowInvoicePicker(false);
          }}
          open={showInvoicePicker}
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Invoice Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Fatura Ayarları</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Fatura Tipi</Label>
              <Select
                onValueChange={(v) => setInvoiceSettings((s) => ({ ...s, invoiceType: v }))}
                value={invoiceSettings.invoiceType}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GIB_INVOICE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Para Birimi</Label>
              <Select
                onValueChange={(v) =>
                  setInvoiceSettings((s) => ({
                    ...s,
                    currency: v,
                    currencyRate: v === 'TRY' ? '' : s.currencyRate,
                  }))
                }
                value={invoiceSettings.currency}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GIB_CURRENCIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.value} - {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                Döviz Kuru
                {invoiceSettings.currency !== 'TRY' && <span className="text-destructive"> *</span>}
              </Label>
              <Input
                disabled={invoiceSettings.currency === 'TRY' || ratesLoading}
                onChange={(e) =>
                  setInvoiceSettings((s) => ({ ...s, currencyRate: e.target.value }))
                }
                placeholder={
                  invoiceSettings.currency === 'TRY'
                    ? '-'
                    : ratesLoading
                      ? "TCMB'den alınıyor..."
                      : 'ör: 38.50'
                }
                value={invoiceSettings.currencyRate}
              />
              {invoiceSettings.currency !== 'TRY' && invoiceSettings.currencyRate && (
                <p className="text-xs text-muted-foreground">
                  TCMB alış kuru otomatik alındı, değiştirebilirsiniz
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Düzenlenme Tarihi</Label>
              <DatePicker
                maxDate={new Date()}
                onChange={(d) => setAdvancedFields((f) => ({ ...f, manualDate: toGIB(d) }))}
                value={parseGIB(advancedFields.manualDate) ?? new Date()}
              />
            </div>
            <div className="space-y-2">
              <Label>Düzenlenme Saati</Label>
              <Input
                className="appearance-none tabular-nums [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
                onChange={(e) => setAdvancedFields((f) => ({ ...f, manualTime: e.target.value }))}
                step="1"
                type="time"
                value={advancedFields.manualTime}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recipient */}
      <Card>
        <CardHeader>
          <CardTitle>Alıcı Bilgileri</CardTitle>
          {savedRecipients.length > 0 && (
            <CardAction>
              <Select onValueChange={selectRecipient}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Müşteri seç..." />
                </SelectTrigger>
                <SelectContent>
                  {savedRecipients.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>VKN / TCKN</Label>
              <Input
                onChange={(e) => setRecipient((r) => ({ ...r, taxIDOrTRID: e.target.value }))}
                placeholder="1234567890"
                value={recipient.taxIDOrTRID}
              />
            </div>
            <div className="space-y-2">
              <Label>Ünvan</Label>
              <Input
                onChange={(e) => setRecipient((r) => ({ ...r, title: e.target.value }))}
                placeholder="Firma Adı"
                value={recipient.title}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Adı</Label>
              <Input
                onChange={(e) => setRecipient((r) => ({ ...r, name: e.target.value }))}
                value={recipient.name}
              />
            </div>
            <div className="space-y-2">
              <Label>Soyadı</Label>
              <Input
                onChange={(e) => setRecipient((r) => ({ ...r, surname: e.target.value }))}
                value={recipient.surname}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Vergi Dairesi</Label>
              <Input
                onChange={(e) => setRecipient((r) => ({ ...r, taxOffice: e.target.value }))}
                value={recipient.taxOffice}
              />
            </div>
            <div className="space-y-2">
              <Label>Ülke</Label>
              <Select
                onValueChange={(v) => setRecipient((r) => ({ ...r, country: v }))}
                value={recipient.country}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Ülke seçin..." />
                </SelectTrigger>
                <SelectContent>
                  {GIB_COUNTRIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Adres</Label>
            <Textarea
              onChange={(e) => setRecipient((r) => ({ ...r, fullAddress: e.target.value }))}
              placeholder="Tam adres"
              rows={3}
              value={recipient.fullAddress}
            />
          </div>
        </CardContent>
      </Card>

      {/* İrsaliye Bilgisi */}
      <Card>
        <CardHeader>
          <CardTitle>İrsaliye Bilgisi</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>İrsaliye Numarası</Label>
              <Input
                onChange={(e) =>
                  setAdvancedFields((f) => ({ ...f, irsaliyeNumarasi: e.target.value }))
                }
                value={advancedFields.irsaliyeNumarasi}
              />
            </div>
            <div className="space-y-2">
              <Label>İrsaliye Tarihi</Label>
              <DatePicker
                maxDate={new Date()}
                onChange={(d) => setAdvancedFields((f) => ({ ...f, irsaliyeTarihi: toGIB(d) }))}
                value={parseGIB(advancedFields.irsaliyeTarihi)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle className="leading-8">Kalemler</CardTitle>
          <CardAction>
            <Button
              className={selectedItemIds.size > 0 ? '' : 'invisible'}
              onClick={() => setShowDeleteConfirm(true)}
              size="sm"
              variant="destructive"
            >
              <HugeiconsIcon data-icon="inline-start" icon={Delete01Icon} strokeWidth={1.5} />
              {selectedItemIds.size} Sil
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="w-10 px-3 py-2">
                  <Checkbox
                    checked={items.length > 0 && selectedItemIds.size === items.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </th>
                <th className="px-2 py-2 text-left font-medium">Mal / Hizmet</th>
                <th className="w-20 px-2 py-2 text-left font-medium">Miktar</th>
                <th className="w-24 px-2 py-2 text-left font-medium">Birim</th>
                <th className="w-28 px-2 py-2 text-left font-medium">Birim Fiyat</th>
                <th className="w-20 px-2 py-2 text-left font-medium">KDV %</th>
                <th className="w-28 px-2 py-2 text-right font-medium">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr className="group border-b last:border-0" key={item.id}>
                  <td
                    className="w-10 px-3 py-2 cursor-pointer"
                    onClick={(e) => toggleSelectItem(item.id, e.shiftKey)}
                  >
                    <Checkbox checked={selectedItemIds.has(item.id)} onCheckedChange={() => {}} />
                  </td>
                  <td className="px-2 py-2">
                    <AutocompleteInput
                      className="h-8"
                      onChange={(v) => updateItem(item.id, 'name', v)}
                      onCreate={(name) =>
                        setSavedItems((prev) => [...prev, { ...item, id: newId(), name }])
                      }
                      onSelect={(id) => loadItemTemplate(id, item.id)}
                      placeholder="Mal / Hizmet adı"
                      suggestions={savedItems.map((s) => ({ id: s.id, label: s.name }))}
                      value={item.name}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      className="h-8"
                      inputMode="numeric"
                      onChange={(e) => updateItem(item.id, 'quantity', Number(e.target.value) || 0)}
                      value={item.quantity}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Select
                      onValueChange={(v) => updateItem(item.id, 'unitType', v)}
                      value={item.unitType}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GIB_UNIT_TYPES.map((u) => (
                          <SelectItem key={u.value} value={u.value}>
                            {u.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      className="h-8"
                      inputMode="decimal"
                      onChange={(e) =>
                        updateItem(item.id, 'unitPrice', Number(e.target.value) || 0)
                      }
                      value={item.unitPrice || ''}
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      className="h-8"
                      inputMode="numeric"
                      onChange={(e) => updateItem(item.id, 'VATRate', Number(e.target.value) || 0)}
                      value={item.VATRate}
                    />
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums">
                    {formatMoney(
                      invoiceSettings.currency,
                      item.quantity * item.unitPrice - (item.discountAmount || 0),
                    )}
                    <div className="whitespace-nowrap text-xs text-muted-foreground">
                      +
                      {formatMoney(
                        invoiceSettings.currency,
                        (item.quantity * item.unitPrice - (item.discountAmount || 0)) *
                          (item.VATRate / 100),
                      )}{' '}
                      KDV
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Expanded discount/GTIP fields below table */}
          {items.some((i) => i.discountRate || i.discountAmount || i.discountReason || i.gtip) && (
            <div className="space-y-3 border-t px-4 py-3">
              {items.map(
                (item) =>
                  (item.discountRate ||
                    item.discountAmount ||
                    item.discountReason ||
                    item.gtip) && (
                    <div className="space-y-2" key={item.id}>
                      <span className="text-xs font-medium text-muted-foreground">
                        {item.name || 'Adsız kalem'} — İskonto & GTİP
                      </span>
                      <div className="grid grid-cols-4 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">İskonto %</Label>
                          <Input
                            inputMode="numeric"
                            onChange={(e) =>
                              updateItem(item.id, 'discountRate', Number(e.target.value) || 0)
                            }
                            value={item.discountRate || ''}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">İskonto Tutarı</Label>
                          <Input
                            inputMode="decimal"
                            onChange={(e) =>
                              updateItem(item.id, 'discountAmount', Number(e.target.value) || 0)
                            }
                            value={item.discountAmount || ''}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">İskonto Nedeni</Label>
                          <Input
                            onChange={(e) => updateItem(item.id, 'discountReason', e.target.value)}
                            value={item.discountReason}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground">GTİP</Label>
                          <Input
                            onChange={(e) => updateItem(item.id, 'gtip', e.target.value)}
                            value={item.gtip}
                          />
                        </div>
                      </div>
                    </div>
                  ),
              )}
            </div>
          )}
        </CardContent>
        <button
          className="flex w-full items-center justify-center gap-2 border-t py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={addItem}
          type="button"
        >
          <HugeiconsIcon className="size-4" icon={PlusSignIcon} strokeWidth={1.5} />
          Kalem Ekle
        </button>
      </Card>

      {/* Note */}
      <Card>
        <CardContent>
          <div className="space-y-2">
            <Label>Not (opsiyonel)</Label>
            <Textarea
              onChange={(e) => setNote(e.target.value)}
              placeholder="Fatura notu"
              value={note}
            />
          </div>
        </CardContent>
      </Card>

      {/* Totals */}
      <Card className="overflow-hidden">
        <CardContent className="space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Mal/Hizmet Toplam</span>
            <span className="tabular-nums">
              {formatMoney(
                invoiceSettings.currency,
                items.reduce((s, i) => s + i.quantity * i.unitPrice, 0),
              )}
            </span>
          </div>
          {totalDiscount > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Toplam İskonto</span>
              <span className="tabular-nums text-destructive">
                -{formatMoney(invoiceSettings.currency, totalDiscount)}
              </span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Hesaplanan KDV</span>
            <span className="tabular-nums">{formatMoney(invoiceSettings.currency, totalVAT)}</span>
          </div>
        </CardContent>
        <div className="border-t bg-muted/30 px-4 py-4">
          <div className="flex items-baseline justify-between">
            <span className="text-sm font-medium text-muted-foreground">Toplam</span>
            <span className="text-2xl font-bold tabular-nums tracking-tight">
              {formatMoney(invoiceSettings.currency, total)}
            </span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
            <span className="text-sm text-muted-foreground">Ödenecek Tutar</span>
            <Input
              className="w-40 text-right"
              inputMode="decimal"
              onChange={(e) => setAdvancedFields((f) => ({ ...f, paymentTotal: e.target.value }))}
              placeholder={total.toFixed(2)}
              value={advancedFields.paymentTotal || ''}
            />
          </div>
        </div>
      </Card>

      {/* Action */}
      {templateEditMode ? (
        <Button
          className="w-full"
          onClick={() => {
            setTemplateName(recipient.title);
            setShowTemplateSaveDialog(true);
          }}
          size="lg"
        >
          Şablon Olarak Kaydet
        </Button>
      ) : (
        <div className="flex gap-3">
          <Button
            className="flex-1"
            disabled={createMutation.isPending}
            onClick={createInvoice}
            size="lg"
          >
            {createMutation.isPending ? 'Oluşturuluyor...' : 'Taslak Fatura Oluştur'}
          </Button>
          <Button onClick={handleDownloadPDF} size="lg" variant="outline">
            <Download className="size-4" />
            PDF
          </Button>
        </div>
      )}

      {/* Invoice Preview */}
      {invoiceHTML && (
        <Card>
          <CardHeader>
            <CardTitle>Fatura Önizleme</CardTitle>
            <CardAction>
              <Button onClick={() => setInvoiceHTML(null)} size="sm" variant="ghost">
                Kapat
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <iframe
              className="h-[600px] w-full rounded-md border"
              srcDoc={invoiceHTML}
              title="Fatura önizleme"
            />
          </CardContent>
        </Card>
      )}

      {/* Template Save Dialog */}
      <Dialog onOpenChange={setShowTemplateSaveDialog} open={showTemplateSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Şablon Olarak Kaydet</DialogTitle>
            <DialogDescription>
              Bu faturayı şablon olarak kaydetmek ister misiniz? Sonraki faturalarda tüm alanlar
              otomatik doldurulur.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Şablon Adı</Label>
            <Input
              autoFocus
              onChange={(e) => setTemplateName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && templateName.trim()) {
                  saveInvoiceTemplate(templateName.trim());
                  setShowTemplateSaveDialog(false);
                }
              }}
              placeholder="ör: Aylık danışmanlık faturası"
              value={templateName}
            />
          </div>
          <DialogFooter>
            <Button onClick={() => setShowTemplateSaveDialog(false)} variant="outline">
              Hayır
            </Button>
            <Button
              disabled={!templateName.trim()}
              onClick={() => {
                saveInvoiceTemplate(templateName.trim());
                setShowTemplateSaveDialog(false);
              }}
            >
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        description={`${selectedItemIds.size} kalemi silmek istediğinize emin misiniz?`}
        onConfirm={confirmRemoveItems}
        onOpenChange={setShowDeleteConfirm}
        open={showDeleteConfirm}
        title="Kalemleri Sil"
      />
    </div>
  );
}
