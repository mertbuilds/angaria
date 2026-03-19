import { useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete01Icon, PlusSignIcon } from "@hugeicons/core-free-icons";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/confirm-dialog.tsx";
import { useStore } from "@/lib/store.tsx";
import type { Recipient } from "@/lib/types.ts";

export function CustomersPage() {
  const { savedRecipients, setSavedRecipients, setRecipient, newId } = useStore();
  const [editing, setEditing] = useState<Recipient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  function startNew() {
    setEditing({
      id: newId(),
      taxIDOrTRID: "",
      taxOffice: "",
      title: "",
      name: "",
      surname: "",
      fullAddress: "",
      country: "",
      city: "",
      district: "",
    });
  }

  function saveCustomer() {
    if (!editing) return;
    if (!editing.taxIDOrTRID || !editing.title) {
      toast.error("VKN/TCKN ve ünvan gerekli");
      return;
    }
    setSavedRecipients((prev) => {
      const idx = prev.findIndex((r) => r.id === editing.id);
      if (idx >= 0) return prev.map((r, i) => (i === idx ? { ...editing } : r));
      return [...prev, { ...editing }];
    });
    toast.success("Müşteri kaydedildi");
    setEditing(null);
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setSavedRecipients((prev) => prev.filter((r) => r.id !== deleteTarget));
    toast.success("Müşteri silindi");
    setDeleteTarget(null);
  }

  function useCustomer(r: Recipient) {
    setRecipient({ ...r });
    toast.success(`"${r.title}" alıcı olarak seçildi`);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Müşteriler</h2>
        <p className="text-muted-foreground">Kayıtlı alıcı bilgileriniz</p>
      </div>

      {/* Add / Edit Form */}
      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {savedRecipients.some((r) => r.id === editing.id)
                ? "Müşteri Düzenle"
                : "Yeni Müşteri"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>VKN / TCKN</Label>
                <Input
                  value={editing.taxIDOrTRID}
                  onChange={(e) => setEditing((p) => p && { ...p, taxIDOrTRID: e.target.value })}
                  placeholder="1234567890"
                />
              </div>
              <div className="space-y-2">
                <Label>Vergi Dairesi</Label>
                <Input
                  value={editing.taxOffice}
                  onChange={(e) => setEditing((p) => p && { ...p, taxOffice: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Ünvan</Label>
              <Input
                value={editing.title}
                onChange={(e) => setEditing((p) => p && { ...p, title: e.target.value })}
                placeholder="Firma Adı"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Ad</Label>
                <Input
                  value={editing.name}
                  onChange={(e) => setEditing((p) => p && { ...p, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Soyad</Label>
                <Input
                  value={editing.surname}
                  onChange={(e) => setEditing((p) => p && { ...p, surname: e.target.value })}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Adres</Label>
                <Input
                  value={editing.fullAddress}
                  onChange={(e) => setEditing((p) => p && { ...p, fullAddress: e.target.value })}
                  placeholder="Tam adres"
                />
              </div>
              <div className="space-y-2">
                <Label>Ülke</Label>
                <Input
                  value={editing.country}
                  onChange={(e) => setEditing((p) => p && { ...p, country: e.target.value })}
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditing(null)}>
                İptal
              </Button>
              <Button onClick={saveCustomer}>Kaydet</Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" onClick={startNew}>
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={1.5} data-icon="inline-start" />
          Yeni Müşteri
        </Button>
      )}

      {/* Customer List */}
      {savedRecipients.length === 0 && !editing && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Henüz müşteri yok. Yeni Müşteri butonuna tıklayarak ekleyin.
            </p>
          </CardContent>
        </Card>
      )}

      {savedRecipients.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {savedRecipients.map((r) => (
            <Card key={r.id}>
              <CardHeader>
                <CardTitle>{r.title}</CardTitle>
                <CardAction>
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    onClick={() => setDeleteTarget(r.id)}
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
                  <Button size="sm" onClick={() => useCustomer(r)}>
                    Faturada Kullan
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setEditing({ ...r })}>
                    Düzenle
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Müşteriyi Sil"
        description="Bu müşteriyi silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        onConfirm={confirmDelete}
      />
    </div>
  );
}
