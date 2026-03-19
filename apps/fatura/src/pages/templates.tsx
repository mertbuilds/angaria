import { useState } from "react";
import { toast } from "sonner";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete01Icon } from "@hugeicons/core-free-icons";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/confirm-dialog.tsx";
import { useStore } from "@/lib/store.tsx";
import type { Page } from "@/components/app-sidebar.tsx";

export function TemplatesPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const {
    invoiceTemplates,
    setInvoiceTemplates,
    setRecipient,
    setInvoiceSettings,
    setItems,
    setNote,
    newId,
  } = useStore();

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  function loadTemplate(id: string) {
    const t = invoiceTemplates.find((x) => x.id === id);
    if (!t) return;
    setRecipient({ ...t.recipient, id: newId() });
    setInvoiceSettings({ ...t.settings });
    setItems(t.items.map((i) => ({ ...i, id: newId() })));
    setNote(t.note);
    toast.success(`"${t.name}" şablonu yüklendi`);
    onNavigate("create");
  }

  function confirmDelete() {
    if (!deleteTarget) return;
    setInvoiceTemplates((prev) => prev.filter((t) => t.id !== deleteTarget));
    toast.success("Şablon silindi");
    setDeleteTarget(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Şablonlar</h2>
        <p className="text-sm text-muted-foreground">Kayıtlı fatura şablonlarınız</p>
      </div>

      {invoiceTemplates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Henüz şablon yok. Fatura oluşturduktan sonra şablon olarak kaydedebilirsiniz.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {invoiceTemplates.map((t) => (
            <Card key={t.id} className="cursor-pointer transition-colors hover:bg-accent/50">
              <CardHeader>
                <CardTitle>{t.name}</CardTitle>
                <CardDescription>{t.recipient.title}</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{t.settings.currency}</Badge>
                  <Badge variant="outline">{t.items.length} kalem</Badge>
                  <Badge variant="outline">{t.settings.invoiceType}</Badge>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm" onClick={() => loadTemplate(t.id)}>
                    Kullan
                  </Button>
                  <Button
                    variant="destructive"
                    size="icon-sm"
                    onClick={() => setDeleteTarget(t.id)}
                  >
                    <HugeiconsIcon icon={Delete01Icon} strokeWidth={1.5} />
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
        title="Şablonu Sil"
        description="Bu şablonu silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        onConfirm={confirmDelete}
      />
    </div>
  );
}
