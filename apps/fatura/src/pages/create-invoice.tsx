import { useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon, Delete01Icon, SaveAllIcon } from "@hugeicons/core-free-icons";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker.tsx";
import { ConfirmDialog } from "@/components/confirm-dialog.tsx";
import { useStore } from "@/lib/store.tsx";
import * as angaria from "@/lib/angaria.ts";
import { format, parse } from "date-fns";

const formatMoney = (currency: string, n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(n);

const GIB_FORMAT = "dd/MM/yyyy";

/** DD/MM/YYYY string → Date */
const parseGIB = (s: string): Date | undefined => {
  if (!s) return undefined;
  try {
    return parse(s, GIB_FORMAT, new Date());
  } catch {
    return undefined;
  }
};

/** Date → DD/MM/YYYY string */
const toGIB = (d: Date | undefined): string => (d ? format(d, GIB_FORMAT) : "");

const UNIT_TYPES = [
  { value: "C62", label: "Adet" },
  { value: "HUR", label: "Saat" },
  { value: "DAY", label: "Gün" },
  { value: "MON", label: "Ay" },
  { value: "KGM", label: "Kilogram" },
  { value: "LTR", label: "Litre" },
  { value: "MTR", label: "Metre" },
  { value: "MTK", label: "Metrekare" },
  { value: "MTQ", label: "Metreküp" },
  { value: "SET", label: "Set" },
  { value: "PA", label: "Paket" },
  { value: "BX", label: "Kutu" },
];

export function CreateInvoicePage() {
  const {
    creds,
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
    setInvoiceTemplates,
    advancedFields,
    setAdvancedFields,
    viewMode,
    setViewMode,
    newId,
    defaultItemAdvanced,
  } = useStore();

  const [loading, setLoading] = useState(false);
  const [invoiceHTML, setInvoiceHTML] = useState<string | null>(null);
  const [showTemplateSaveDialog, setShowTemplateSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);

  const advanced = viewMode === "advanced";

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
    if (found) setRecipient({ ...found });
  }

  function saveItemTemplate(item: (typeof items)[0]) {
    setSavedItems((prev) => {
      const idx = prev.findIndex((i) => i.id === item.id);
      if (idx >= 0) return prev.map((i, j) => (j === idx ? { ...item } : i));
      return [...prev, { ...item }];
    });
    toast.success("Kalem şablonu kaydedildi");
  }

  function updateItem(id: string, field: string, value: string | number) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i;
        const updated = { ...i, [field]: value };
        // Auto-calculate discount amount from rate
        if (field === "discountRate") {
          updated.discountAmount = updated.quantity * updated.unitPrice * (Number(value) / 100);
        }
        return updated;
      }),
    );
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { id: newId(), name: "", quantity: 1, unitPrice: 0, VATRate: 20, ...defaultItemAdvanced },
    ]);
  }

  function confirmRemoveItem() {
    if (!deleteItemId) return;
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== deleteItemId) : prev));
    setDeleteItemId(null);
  }

  function loadItemTemplate(templateId: string, itemId: string) {
    const t = savedItems.find((x) => x.id === templateId);
    if (t) setItems((prev) => prev.map((i) => (i.id === itemId ? { ...t, id: itemId } : i)));
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
    toast.success("Fatura şablonu kaydedildi");
  }

  async function createInvoice() {
    if (!creds.username || !creds.password) {
      toast.error("GİB kullanıcı bilgileri gerekli — Ayarlar'dan girin");
      return;
    }
    if (!recipient.taxIDOrTRID || !recipient.title || !recipient.fullAddress) {
      toast.error("Alıcı bilgileri eksik");
      return;
    }
    if (items.some((i) => !i.name || i.unitPrice <= 0)) {
      toast.error("Kalem bilgileri eksik veya hatalı");
      return;
    }

    setLoading(true);
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const autoDate = `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()}`;
    const autoTime = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;
    const date = advancedFields.manualDate || autoDate;
    const time = advancedFields.manualTime || autoTime;
    const paymentTotal = advancedFields.paymentTotal ? Number(advancedFields.paymentTotal) : total;

    try {
      const session = await angaria.login(creds.username, creds.password, creds.testMode);
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
            unitType: i.unitType || "C62",
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

        toast.success("Taslak fatura oluşturuldu!");
        try {
          const html = await angaria.getInvoiceHTML(session, draft.uuid, "Onaylanmadı");
          setInvoiceHTML(html);
        } catch {
          // preview is optional
        }
        setTemplateName("");
        setShowTemplateSaveDialog(true);
      } finally {
        angaria.logout(session).catch(() => {});
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div className="space-y-1">
          <h2 className="text-xl font-semibold tracking-tight">Yeni Fatura</h2>
          <p className="text-sm text-muted-foreground">Tüm alanları doldurup taslak oluşturun</p>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border bg-muted/50 p-1">
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              !advanced
                ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setViewMode("simple")}
          >
            Basit
          </button>
          <button
            type="button"
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              advanced
                ? "bg-background text-foreground shadow-sm ring-1 ring-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setViewMode("advanced")}
          >
            Gelişmiş
          </button>
        </div>
      </div>

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
                value={invoiceSettings.invoiceType}
                onValueChange={(v) => setInvoiceSettings((s) => ({ ...s, invoiceType: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ISTISNA">İstisna</SelectItem>
                  <SelectItem value="SATIS">Satış</SelectItem>
                  <SelectItem value="IADE">İade</SelectItem>
                  <SelectItem value="TEVKIFAT">Tevkifat</SelectItem>
                  <SelectItem value="OZELMATRAH">Özel Matrah</SelectItem>
                  <SelectItem value="IHRACKAYITLI">İhraç Kayıtlı</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Para Birimi</Label>
              <Select
                value={invoiceSettings.currency}
                onValueChange={(v) => setInvoiceSettings((s) => ({ ...s, currency: v }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="TRY">TRY</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Döviz Kuru</Label>
              <Input
                value={invoiceSettings.currencyRate}
                onChange={(e) =>
                  setInvoiceSettings((s) => ({ ...s, currencyRate: e.target.value }))
                }
                placeholder={invoiceSettings.currency === "TRY" ? "-" : "ör: 38.50"}
                disabled={invoiceSettings.currency === "TRY"}
              />
            </div>
          </div>

          {/* Advanced: Date/Time override */}
          {advanced && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Düzenlenme Tarihi</Label>
                <DatePicker
                  value={parseGIB(advancedFields.manualDate)}
                  onChange={(d) => setAdvancedFields((f) => ({ ...f, manualDate: toGIB(d) }))}
                  placeholder="Otomatik"
                />
              </div>
              <div className="space-y-2">
                <Label>Düzenlenme Saati</Label>
                <Input
                  type="time"
                  step="1"
                  value={advancedFields.manualTime}
                  onChange={(e) => setAdvancedFields((f) => ({ ...f, manualTime: e.target.value }))}
                />
              </div>
            </div>
          )}
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
                value={recipient.taxIDOrTRID}
                onChange={(e) => setRecipient((r) => ({ ...r, taxIDOrTRID: e.target.value }))}
                placeholder="1234567890"
              />
            </div>
            <div className="space-y-2">
              <Label>Vergi Dairesi</Label>
              <Input
                value={recipient.taxOffice}
                onChange={(e) => setRecipient((r) => ({ ...r, taxOffice: e.target.value }))}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Ünvan</Label>
            <Input
              value={recipient.title}
              onChange={(e) => setRecipient((r) => ({ ...r, title: e.target.value }))}
              placeholder="Firma Adı"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Ad</Label>
              <Input
                value={recipient.name}
                onChange={(e) => setRecipient((r) => ({ ...r, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Soyad</Label>
              <Input
                value={recipient.surname}
                onChange={(e) => setRecipient((r) => ({ ...r, surname: e.target.value }))}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Adres</Label>
              <Input
                value={recipient.fullAddress}
                onChange={(e) => setRecipient((r) => ({ ...r, fullAddress: e.target.value }))}
                placeholder="Tam adres"
              />
            </div>
            <div className="space-y-2">
              <Label>Ülke</Label>
              <Input
                value={recipient.country}
                onChange={(e) => setRecipient((r) => ({ ...r, country: e.target.value }))}
              />
            </div>
          </div>

          {/* Advanced: City/District */}
          {advanced && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Şehir</Label>
                <Input
                  value={recipient.city}
                  onChange={(e) => setRecipient((r) => ({ ...r, city: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>İlçe</Label>
                <Input
                  value={recipient.district}
                  onChange={(e) => setRecipient((r) => ({ ...r, district: e.target.value }))}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Advanced: İrsaliye Bilgisi */}
      {advanced && (
        <Card>
          <CardHeader>
            <CardTitle>İrsaliye Bilgisi</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>İrsaliye Numarası</Label>
                <Input
                  value={advancedFields.irsaliyeNumarasi}
                  onChange={(e) =>
                    setAdvancedFields((f) => ({ ...f, irsaliyeNumarasi: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>İrsaliye Tarihi</Label>
                <DatePicker
                  value={parseGIB(advancedFields.irsaliyeTarihi)}
                  onChange={(d) => setAdvancedFields((f) => ({ ...f, irsaliyeTarihi: toGIB(d) }))}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Items */}
      <Card>
        <CardHeader>
          <CardTitle>Kalemler</CardTitle>
          <CardAction>
            <Button variant="outline" size="sm" onClick={addItem}>
              <HugeiconsIcon icon={PlusSignIcon} strokeWidth={1.5} data-icon="inline-start" />
              Kalem Ekle
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="space-y-4">
          {items.map((item, idx) => (
            <div key={item.id} className="space-y-3 rounded-lg border p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-muted-foreground">#{idx + 1}</span>
                <div className="flex items-center gap-1">
                  {savedItems.length > 0 && (
                    <Select onValueChange={(v) => loadItemTemplate(v, item.id)}>
                      <SelectTrigger size="sm" className="w-36">
                        <SelectValue placeholder="Şablon yükle..." />
                      </SelectTrigger>
                      <SelectContent>
                        {savedItems.map((t) => (
                          <SelectItem key={t.id} value={t.id}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => saveItemTemplate(item)}
                    title="Şablon olarak kaydet"
                  >
                    <HugeiconsIcon icon={SaveAllIcon} strokeWidth={1.5} />
                  </Button>
                  {items.length > 1 && (
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      onClick={() => setDeleteItemId(item.id)}
                    >
                      <HugeiconsIcon icon={Delete01Icon} strokeWidth={1.5} />
                    </Button>
                  )}
                </div>
              </div>
              <Input
                value={item.name}
                onChange={(e) => updateItem(item.id, "name", e.target.value)}
                placeholder="Mal / Hizmet adı"
              />
              <div className={`grid gap-3 ${advanced ? "grid-cols-4" : "grid-cols-3"}`}>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Miktar</Label>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))}
                  />
                </div>
                {advanced && (
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Birim</Label>
                    <Select
                      value={item.unitType}
                      onValueChange={(v) => updateItem(item.id, "unitType", v)}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {UNIT_TYPES.map((u) => (
                          <SelectItem key={u.value} value={u.value}>
                            {u.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Birim Fiyat</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={item.unitPrice || ""}
                    onChange={(e) => updateItem(item.id, "unitPrice", Number(e.target.value))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">KDV %</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={item.VATRate}
                    onChange={(e) => updateItem(item.id, "VATRate", Number(e.target.value))}
                  />
                </div>
              </div>

              {/* Advanced: Discount & GTIP */}
              {advanced && (
                <div className="grid grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">İskonto %</Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={item.discountRate || ""}
                      onChange={(e) => updateItem(item.id, "discountRate", Number(e.target.value))}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">İskonto Tutarı</Label>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={item.discountAmount || ""}
                      onChange={(e) =>
                        updateItem(item.id, "discountAmount", Number(e.target.value))
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">İskonto Nedeni</Label>
                    <Input
                      value={item.discountReason}
                      onChange={(e) => updateItem(item.id, "discountReason", e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">GTİP</Label>
                    <Input
                      value={item.gtip}
                      onChange={(e) => updateItem(item.id, "gtip", e.target.value)}
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-between text-sm text-muted-foreground">
                <span>
                  Tutar: {formatMoney(invoiceSettings.currency, item.quantity * item.unitPrice)}
                </span>
                {advanced && item.discountAmount > 0 && (
                  <span>
                    İskonto: -{formatMoney(invoiceSettings.currency, item.discountAmount)}
                  </span>
                )}
                <span>
                  KDV:{" "}
                  {formatMoney(
                    invoiceSettings.currency,
                    (item.quantity * item.unitPrice - (item.discountAmount || 0)) *
                      (item.VATRate / 100),
                  )}
                </span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Note */}
      <Card>
        <CardContent>
          <div className="space-y-2">
            <Label>Not (opsiyonel)</Label>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Fatura notu"
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
          {advanced && totalDiscount > 0 && (
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
          {advanced && (
            <div className="mt-3 flex items-center justify-between border-t border-border/50 pt-3">
              <span className="text-sm text-muted-foreground">Ödenecek Tutar</span>
              <Input
                type="number"
                min={0}
                step="0.01"
                className="w-40 text-right"
                value={advancedFields.paymentTotal || ""}
                onChange={(e) => setAdvancedFields((f) => ({ ...f, paymentTotal: e.target.value }))}
                placeholder={total.toFixed(2)}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Action */}
      <Button className="w-full" size="lg" disabled={loading} onClick={createInvoice}>
        {loading ? "Oluşturuluyor..." : "Fatura Oluştur"}
      </Button>

      {/* Invoice Preview */}
      {invoiceHTML && (
        <Card>
          <CardHeader>
            <CardTitle>Fatura Önizleme</CardTitle>
            <CardAction>
              <Button variant="ghost" size="sm" onClick={() => setInvoiceHTML(null)}>
                Kapat
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <iframe
              srcDoc={invoiceHTML}
              className="h-[600px] w-full rounded-md border"
              title="Fatura önizleme"
            />
          </CardContent>
        </Card>
      )}

      {/* Template Save Dialog */}
      <Dialog open={showTemplateSaveDialog} onOpenChange={setShowTemplateSaveDialog}>
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
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              placeholder="ör: Aylık danışmanlık faturası"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && templateName.trim()) {
                  saveInvoiceTemplate(templateName.trim());
                  setShowTemplateSaveDialog(false);
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateSaveDialog(false)}>
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
        open={deleteItemId !== null}
        onOpenChange={(open) => !open && setDeleteItemId(null)}
        title="Kalemi Sil"
        description="Bu kalemi silmek istediğinize emin misiniz?"
        onConfirm={confirmRemoveItem}
      />
    </div>
  );
}
