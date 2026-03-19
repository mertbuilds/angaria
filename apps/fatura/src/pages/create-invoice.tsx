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
import { useStore } from "@/lib/store.tsx";
import * as angaria from "@/lib/angaria.ts";

const formatMoney = (currency: string, n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(n);

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
    setSavedRecipients,
    savedItems,
    setSavedItems,
    setInvoiceTemplates,
    newId,
  } = useStore();

  const [loading, setLoading] = useState(false);
  const [invoiceHTML, setInvoiceHTML] = useState<string | null>(null);
  const [showTemplateSaveDialog, setShowTemplateSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [selectedRecipientId, setSelectedRecipientId] = useState("");

  const grandTotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const totalVAT = items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.VATRate / 100), 0);
  const total = grandTotal + totalVAT;

  function selectRecipient(id: string) {
    setSelectedRecipientId(id);
    const found = savedRecipients.find((r) => r.id === id);
    if (found) setRecipient({ ...found });
  }

  function saveRecipient() {
    if (!recipient.taxIDOrTRID || !recipient.title) {
      toast.error("VKN/TCKN ve ünvan gerekli");
      return;
    }
    setSavedRecipients((prev) => {
      const idx = prev.findIndex((r) => r.id === recipient.id);
      if (idx >= 0) return prev.map((r, i) => (i === idx ? { ...recipient } : r));
      return [...prev, { ...recipient }];
    });
    toast.success("Alıcı kaydedildi");
  }

  function deleteRecipient(id: string) {
    setSavedRecipients((prev) => prev.filter((r) => r.id !== id));
    if (selectedRecipientId === id) setSelectedRecipientId("");
    toast.success("Alıcı silindi");
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
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { id: newId(), name: "", quantity: 1, unitPrice: 0, VATRate: 20 },
    ]);
  }

  function removeItem(id: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
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
    const date = `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()}`;
    const time = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;

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
          items: items.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            price: i.quantity * i.unitPrice,
            unitType: "HUR",
            VATRate: i.VATRate,
            VATAmount: i.quantity * i.unitPrice * (i.VATRate / 100),
          })),
          grandTotal,
          totalVAT,
          grandTotalInclVAT: total,
          paymentTotal: total,
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
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Fatura Oluştur</h2>
        <p className="text-muted-foreground">e-Arşiv fatura taslağı oluşturun</p>
      </div>

      {/* Recipient */}
      <Card>
        <CardHeader>
          <CardTitle>Alıcı Bilgileri</CardTitle>
          <CardAction>
            <div className="flex items-center gap-2">
              {savedRecipients.length > 0 && (
                <div className="flex items-center gap-1">
                  <Select value={selectedRecipientId} onValueChange={selectRecipient}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Kayıtlı alıcı seç..." />
                    </SelectTrigger>
                    <SelectContent>
                      {savedRecipients.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          {r.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedRecipientId && (
                    <Button
                      variant="destructive"
                      size="icon-sm"
                      onClick={() => deleteRecipient(selectedRecipientId)}
                    >
                      <HugeiconsIcon icon={Delete01Icon} strokeWidth={1.5} />
                    </Button>
                  )}
                </div>
              )}
              <Button variant="outline" size="sm" onClick={saveRecipient}>
                <HugeiconsIcon icon={SaveAllIcon} strokeWidth={1.5} data-icon="inline-start" />
                Kaydet
              </Button>
            </div>
          </CardAction>
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
        </CardContent>
      </Card>

      {/* Invoice Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Fatura Ayarları</CardTitle>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

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
                      onClick={() => removeItem(item.id)}
                    >
                      <HugeiconsIcon icon={Delete01Icon} strokeWidth={1.5} />
                    </Button>
                  )}
                </div>
              </div>
              <Input
                value={item.name}
                onChange={(e) => updateItem(item.id, "name", e.target.value)}
                placeholder="Ürün / Hizmet adı"
              />
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Miktar</Label>
                  <Input
                    type="number"
                    min={1}
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))}
                  />
                </div>
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
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>
                  Tutar: {formatMoney(invoiceSettings.currency, item.quantity * item.unitPrice)}
                </span>
                <span>
                  KDV:{" "}
                  {formatMoney(
                    invoiceSettings.currency,
                    item.quantity * item.unitPrice * (item.VATRate / 100),
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
      <Card>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Ara Toplam</span>
            <span>{formatMoney(invoiceSettings.currency, grandTotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">KDV Toplam</span>
            <span>{formatMoney(invoiceSettings.currency, totalVAT)}</span>
          </div>
          <div className="border-t pt-2">
            <div className="flex justify-between text-lg font-bold">
              <span>Genel Toplam</span>
              <span>{formatMoney(invoiceSettings.currency, total)}</span>
            </div>
          </div>
        </CardContent>
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
    </div>
  );
}
