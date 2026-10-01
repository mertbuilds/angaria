import { toast } from '@angaria/ui';
import { Delete01Icon, PlusSignIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog.tsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GIB_COUNTRIES } from '@/lib/gib-constants.ts';
import { isPDFLanguage, resolvePDFLanguage } from '@/lib/invoice-pdf-i18n.ts';
import { useStore } from '@/lib/store.tsx';
import type { Recipient } from '@/lib/types.ts';

export function CustomersPage() {
  const { savedRecipients, setSavedRecipients, setRecipient, newId } = useStore();
  const [editing, setEditing] = useState<Recipient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  function startNew() {
    setEditing({
      id: newId(),
      taxIDOrTRID: '',
      taxOffice: '',
      title: '',
      name: '',
      surname: '',
      fullAddress: '',
      country: '',
      city: '',
      district: '',
    });
  }

  function saveCustomer() {
    if (!editing) {
      return;
    }
    if (!editing.taxIDOrTRID || !editing.title) {
      toast.error('VKN/TCKN ve ünvan gerekli');
      return;
    }
    setSavedRecipients((prev) => {
      const idx = prev.findIndex((r) => r.id === editing.id);
      if (idx >= 0) {
        return prev.map((r, i) => (i === idx ? { ...editing } : r));
      }
      return [...prev, { ...editing }];
    });
    toast.success('Müşteri kaydedildi');
    setEditing(null);
  }

  function confirmDelete() {
    if (!deleteTarget) {
      return;
    }
    setSavedRecipients((prev) => prev.filter((r) => r.id !== deleteTarget));
    toast.success('Müşteri silindi');
    setDeleteTarget(null);
  }

  function useCustomer(r: Recipient) {
    setRecipient({ ...r });
    toast.success(`"${r.title}" alıcı olarak seçildi`);
  }

  return (
    <div className="space-y-6">
      {/* Add / Edit Form */}
      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {savedRecipients.some((r) => r.id === editing.id)
                ? 'Müşteri Düzenle'
                : 'Yeni Müşteri'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>VKN / TCKN</Label>
                <Input
                  onChange={(e) => setEditing((p) => p && { ...p, taxIDOrTRID: e.target.value })}
                  placeholder="1234567890"
                  value={editing.taxIDOrTRID}
                />
              </div>
              <div className="space-y-2">
                <Label>Vergi Dairesi</Label>
                <Input
                  onChange={(e) => setEditing((p) => p && { ...p, taxOffice: e.target.value })}
                  value={editing.taxOffice}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ünvan</Label>
              <Input
                onChange={(e) => setEditing((p) => p && { ...p, title: e.target.value })}
                placeholder="Firma Adı"
                value={editing.title}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ad</Label>
                <Input
                  onChange={(e) => setEditing((p) => p && { ...p, name: e.target.value })}
                  value={editing.name}
                />
              </div>
              <div className="space-y-2">
                <Label>Soyad</Label>
                <Input
                  onChange={(e) => setEditing((p) => p && { ...p, surname: e.target.value })}
                  value={editing.surname}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Adres</Label>
                <Input
                  onChange={(e) => setEditing((p) => p && { ...p, fullAddress: e.target.value })}
                  placeholder="Tam adres"
                  value={editing.fullAddress}
                />
              </div>
              <div className="space-y-2">
                <Label>Ülke</Label>
                <Select
                  onValueChange={(v) => setEditing((p) => p && { ...p, country: v })}
                  value={editing.country}
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Varsayılan PDF Dili</Label>
                <Select
                  onValueChange={(v) =>
                    isPDFLanguage(v) && setEditing((p) => p && { ...p, pdfLanguage: v })
                  }
                  value={resolvePDFLanguage(editing.pdfLanguage)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tr">Türkçe</SelectItem>
                    <SelectItem value="en">İngilizce</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button onClick={() => setEditing(null)} variant="outline">
                İptal
              </Button>
              <Button onClick={saveCustomer}>Kaydet</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {savedRecipients.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle>{r.title}</CardTitle>
                <CardAction>
                  <Button
                    onClick={() => setDeleteTarget(r.id)}
                    size="icon-sm"
                    variant="destructive"
                  >
                    <HugeiconsIcon icon={Delete01Icon} strokeWidth={1.5} />
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                <div className="space-y-1 text-sm text-muted-foreground">
                  <p>VKN/TCKN: {r.taxIDOrTRID}</p>
                  {r.taxOffice && <p>V.D.: {r.taxOffice}</p>}
                  {r.fullAddress && <p>{r.fullAddress}</p>}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.country && <Badge variant="outline">{r.country}</Badge>}
                  {r.name && (
                    <Badge variant="outline">
                      {r.name} {r.surname}
                    </Badge>
                  )}
                </div>
                <div className="mt-4 flex gap-2">
                  <Button onClick={() => useCustomer(r)} size="sm">
                    Faturada Kullan
                  </Button>
                  <Button onClick={() => setEditing({ ...r })} size="sm" variant="outline">
                    Düzenle
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
          <button
            className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            onClick={startNew}
            type="button"
          >
            <HugeiconsIcon className="size-6" icon={PlusSignIcon} strokeWidth={1.5} />
            <span className="text-sm font-medium">Yeni Müşteri</span>
          </button>
        </div>
      )}

      <ConfirmDialog
        description="Bu müşteriyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        onConfirm={confirmDelete}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        open={deleteTarget !== null}
        title="Müşteriyi Sil"
      />
    </div>
  );
}
