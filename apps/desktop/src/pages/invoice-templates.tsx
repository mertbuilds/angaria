import { Delete01Icon, PlusSignIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { Page } from '@/components/app-sidebar.tsx';
import { ConfirmDialog } from '@/components/confirm-dialog.tsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useStore } from '@/lib/store.tsx';

export function InvoiceTemplatesPage({ onNavigate }: { onNavigate: (page: Page) => void }) {
  const { invoiceTemplates, setInvoiceTemplates, loadTemplate } = useStore();

  const [deleteId, setDeleteId] = useState<string | null>(null);

  function useTemplate(id: string) {
    const name = loadTemplate(id);
    if (name) {
      toast.success(`"${name}" şablonu yüklendi`);
      onNavigate('create');
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {invoiceTemplates.map((t) => (
          <Card className="cursor-pointer transition-colors hover:bg-accent/50" key={t.id}>
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
                <Button onClick={() => useTemplate(t.id)} size="sm">
                  Kullan
                </Button>
                <Button onClick={() => setDeleteId(t.id)} size="icon-sm" variant="destructive">
                  <HugeiconsIcon icon={Delete01Icon} strokeWidth={1.5} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        <button
          className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
          onClick={() => onNavigate('create')}
          type="button"
        >
          <HugeiconsIcon className="size-6" icon={PlusSignIcon} strokeWidth={1.5} />
          <span className="text-sm font-medium">Yeni Şablon</span>
        </button>
      </div>

      <ConfirmDialog
        description="Bu şablonu silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        onConfirm={() => {
          if (deleteId) {
            setInvoiceTemplates((prev) => prev.filter((t) => t.id !== deleteId));
            toast.success('Fatura şablonu silindi');
            setDeleteId(null);
          }
        }}
        onOpenChange={(open) => !open && setDeleteId(null)}
        open={deleteId !== null}
        title="Fatura Şablonunu Sil"
      />
    </div>
  );
}
