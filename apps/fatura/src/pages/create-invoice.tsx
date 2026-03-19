import { useState, useRef, useEffect } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { PlusSignIcon, Delete01Icon } from "@hugeicons/core-free-icons";
import { Checkbox } from "@/components/ui/checkbox";
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

import { AutocompleteInput } from "@/components/autocomplete-input.tsx";
import { ConfirmDialog } from "@/components/confirm-dialog.tsx";
import { useStore } from "@/lib/store.tsx";
import {
  GIB_COUNTRIES,
  GIB_CURRENCIES,
  GIB_UNIT_TYPES,
  GIB_INVOICE_TYPES,
  GIB_CITIES,
} from "@/lib/gib-constants.ts";
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
    newId,
    defaultItemAdvanced,
  } = useStore();

  const [loading, setLoading] = useState(false);
  const [invoiceHTML, setInvoiceHTML] = useState<string | null>(null);
  const [showTemplateSaveDialog, setShowTemplateSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const lastCheckedRef = useRef<string | null>(null);

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

  // Auto-sync items with non-empty names to saved item templates
  useEffect(() => {
    const namedItems = items.filter((i) => i.name.trim());
    if (namedItems.length === 0) return;
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
      { id: newId(), name: "", quantity: 1, unitPrice: 0, VATRate: 20, ...defaultItemAdvanced },
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
        for (let i = start; i <= end; i++) next.add(ids[i]);
      } else {
        if (next.has(id)) next.delete(id);
        else next.add(id);
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
    if (selectedItemIds.size === 0) return;
    setItems((prev) => {
      const remaining = prev.filter((i) => !selectedItemIds.has(i.id));
      return remaining.length > 0 ? remaining : [prev[0]];
    });
    setSelectedItemIds(new Set());
    setShowDeleteConfirm(false);
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
                value={invoiceSettings.currency}
                onValueChange={(v) => setInvoiceSettings((s) => ({ ...s, currency: v }))}
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
                  className="appearance-none tabular-nums [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
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
              <Select
                value={recipient.country}
                onValueChange={(v) => setRecipient((r) => ({ ...r, country: v }))}
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

          {/* Advanced: City/District */}
          {advanced && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Şehir</Label>
                <Select
                  value={recipient.city}
                  onValueChange={(v) => setRecipient((r) => ({ ...r, city: v }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Şehir seçin..." />
                  </SelectTrigger>
                  <SelectContent>
                    {GIB_CITIES.map((city) => (
                      <SelectItem key={city} value={city}>
                        {city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
          <CardTitle className="leading-8">Kalemler</CardTitle>
          <CardAction>
            <Button
              variant="destructive"
              size="sm"
              className={selectedItemIds.size > 0 ? "" : "invisible"}
              onClick={() => setShowDeleteConfirm(true)}
            >
              <HugeiconsIcon icon={Delete01Icon} strokeWidth={1.5} data-icon="inline-start" />
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
                {advanced && <th className="w-24 px-2 py-2 text-left font-medium">Birim</th>}
                <th className="w-28 px-2 py-2 text-left font-medium">Birim Fiyat</th>
                <th className="w-20 px-2 py-2 text-left font-medium">KDV %</th>
                <th className="w-28 px-2 py-2 text-right font-medium">Tutar</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="group border-b last:border-0">
                  <td
                    className="w-10 px-3 py-2 cursor-pointer"
                    onClick={(e) => toggleSelectItem(item.id, e.shiftKey)}
                  >
                    <Checkbox checked={selectedItemIds.has(item.id)} onCheckedChange={() => {}} />
                  </td>
                  <td className="px-2 py-2">
                    <AutocompleteInput
                      value={item.name}
                      onChange={(v) => updateItem(item.id, "name", v)}
                      onSelect={(id) => loadItemTemplate(id, item.id)}
                      onCreate={(name) =>
                        setSavedItems((prev) => [...prev, { ...item, id: newId(), name }])
                      }
                      suggestions={savedItems.map((s) => ({ id: s.id, label: s.name }))}
                      placeholder="Mal / Hizmet adı"
                      className="h-8"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      inputMode="numeric"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value) || 0)}
                      className="h-8"
                    />
                  </td>
                  {advanced && (
                    <td className="px-2 py-2">
                      <Select
                        value={item.unitType}
                        onValueChange={(v) => updateItem(item.id, "unitType", v)}
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
                  )}
                  <td className="px-2 py-2">
                    <Input
                      inputMode="decimal"
                      value={item.unitPrice || ""}
                      onChange={(e) =>
                        updateItem(item.id, "unitPrice", Number(e.target.value) || 0)
                      }
                      className="h-8"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <Input
                      inputMode="numeric"
                      value={item.VATRate}
                      onChange={(e) => updateItem(item.id, "VATRate", Number(e.target.value) || 0)}
                      className="h-8"
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
                      )}{" "}
                      KDV
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Advanced: expanded discount/GTIP fields below table */}
          {advanced &&
            items.some((i) => i.discountRate || i.discountAmount || i.discountReason || i.gtip) && (
              <div className="space-y-3 border-t px-4 py-3">
                {items.map(
                  (item) =>
                    (item.discountRate ||
                      item.discountAmount ||
                      item.discountReason ||
                      item.gtip) && (
                      <div key={item.id} className="space-y-2">
                        <span className="text-xs font-medium text-muted-foreground">
                          {item.name || "Adsız kalem"} — İskonto & GTİP
                        </span>
                        <div className="grid grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">İskonto %</Label>
                            <Input
                              inputMode="numeric"
                              value={item.discountRate || ""}
                              onChange={(e) =>
                                updateItem(item.id, "discountRate", Number(e.target.value) || 0)
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">İskonto Tutarı</Label>
                            <Input
                              inputMode="decimal"
                              value={item.discountAmount || ""}
                              onChange={(e) =>
                                updateItem(item.id, "discountAmount", Number(e.target.value) || 0)
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">İskonto Nedeni</Label>
                            <Input
                              value={item.discountReason}
                              onChange={(e) =>
                                updateItem(item.id, "discountReason", e.target.value)
                              }
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
                      </div>
                    ),
                )}
              </div>
            )}
        </CardContent>
        <button
          type="button"
          onClick={addItem}
          className="flex w-full items-center justify-center gap-2 border-t py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={1.5} className="size-4" />
          Kalem Ekle
        </button>
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
                inputMode="decimal"
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
        open={showDeleteConfirm}
        onOpenChange={setShowDeleteConfirm}
        title="Kalemleri Sil"
        description={`${selectedItemIds.size} kalemi silmek istediğinize emin misiniz?`}
        onConfirm={confirmRemoveItems}
      />
    </div>
  );
}
