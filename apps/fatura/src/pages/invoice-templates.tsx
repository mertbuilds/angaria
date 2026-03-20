import { useState } from "react";
import { toast } from "sonner";
import { format, parse } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete01Icon, PlusSignIcon, Invoice01Icon } from "@hugeicons/core-free-icons";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker.tsx";
import { ConfirmDialog } from "@/components/confirm-dialog.tsx";
import { useStore } from "@/lib/store.tsx";
import type { Invoice } from "@/pages/invoices.tsx";
import type { Page } from "@/components/app-sidebar.tsx";
import * as angaria from "@/lib/angaria.ts";

const GIB_FORMAT = "dd/MM/yyyy";
const parseGIB = (s: string): Date | undefined => {
  if (!s) return undefined;
  try {
    return parse(s, GIB_FORMAT, new Date());
  } catch {
    return undefined;
  }
};
const toGIB = (d: Date | undefined): string => (d ? format(d, GIB_FORMAT) : "");

export function InvoiceTemplatesPage({
  onNavigate,
  onPreview,
}: {
  onNavigate: (page: Page) => void;
  onPreview: (invoice: Invoice) => Promise<void>;
}) {
  const { creds, invoiceTemplates, setInvoiceTemplates, loadTemplate, loadFromGIBInvoice } =
    useStore();

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showInvoicePicker, setShowInvoicePicker] = useState(false);
  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const today = `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()}`;
    return { start: today, end: today };
  });

  const hasCredentials = Boolean(creds.username && creds.password);

  const {
    data: invoiceList = [],
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["picker-invoices", creds.username, creds.testMode, dateRange.start, dateRange.end],
    queryFn: async () => {
      const session = await angaria.login(creds.username, creds.password, creds.testMode);
      try {
        return (await angaria.getDrafts(session, dateRange.start, dateRange.end)) as Invoice[];
      } finally {
        angaria.logout(session).catch(() => {});
      }
    },
    enabled:
      showInvoicePicker && hasCredentials && Boolean(dateRange.start) && Boolean(dateRange.end),
    staleTime: 60_000,
    retry: false,
  });

  const listLoading = isLoading || isFetching;

  function useTemplate(id: string) {
    const name = loadTemplate(id);
    if (name) {
      toast.success(`"${name}" şablonu yüklendi`);
      onNavigate("create");
    }
  }

  async function selectInvoice(invoice: Invoice) {
    if (!hasCredentials || !invoice.ettn) return;
    setLoadingInvoice(true);
    try {
      const session = await angaria.login(creds.username, creds.password, creds.testMode);
      try {
        const detail = await angaria.getInvoiceDetail(session, invoice.ettn);
        loadFromGIBInvoice(detail);
        setShowInvoicePicker(false);
        onNavigate("create");
      } finally {
        angaria.logout(session).catch(() => {});
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fatura detayı alınamadı");
    } finally {
      setLoadingInvoice(false);
    }
  }

  return (
    <div className="space-y-4">
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
                <Button size="sm" onClick={() => useTemplate(t.id)}>
                  Kullan
                </Button>
                <Button variant="destructive" size="icon-sm" onClick={() => setDeleteId(t.id)}>
                  <HugeiconsIcon icon={Delete01Icon} strokeWidth={1.5} />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
        <button
          type="button"
          onClick={() => onNavigate("create")}
          className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          <HugeiconsIcon icon={PlusSignIcon} strokeWidth={1.5} className="size-6" />
          <span className="text-sm font-medium">Yeni Şablon</span>
        </button>
        <button
          type="button"
          onClick={() => setShowInvoicePicker(true)}
          className="flex min-h-40 flex-col items-center justify-center gap-2 rounded-xl border border-dashed text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          <HugeiconsIcon icon={Invoice01Icon} strokeWidth={1.5} className="size-6" />
          <span className="text-sm font-medium">Eski Faturadan Oluştur</span>
        </button>
      </div>

      {/* Invoice Picker Dialog */}
      <Dialog open={showInvoicePicker} onOpenChange={setShowInvoicePicker}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Fatura Seç</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-end gap-4">
              <div className="flex-1 space-y-1">
                <Label>Başlangıç</Label>
                <DatePicker
                  value={parseGIB(dateRange.start)}
                  onChange={(d) => setDateRange((prev) => ({ ...prev, start: toGIB(d) }))}
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label>Bitiş</Label>
                <DatePicker
                  value={parseGIB(dateRange.end)}
                  onChange={(d) => setDateRange((prev) => ({ ...prev, end: toGIB(d) }))}
                />
              </div>
            </div>

            {listLoading && (
              <p className="py-8 text-center text-sm text-muted-foreground">Yükleniyor...</p>
            )}

            {!listLoading && invoiceList.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Bu tarih aralığında fatura bulunamadı
              </p>
            )}

            {invoiceList.length > 0 && (
              <div className="max-h-80 overflow-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-background">
                    <tr className="border-b">
                      <th className="px-3 py-2 text-left font-medium">Belge No</th>
                      <th className="px-3 py-2 text-left font-medium">Alıcı</th>
                      <th className="px-3 py-2 text-left font-medium">Tarih</th>
                      <th className="px-3 py-2 text-right font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceList.map((inv, idx) => (
                      <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-3 py-2 font-mono text-xs">{inv.belgeNumarasi ?? ""}</td>
                        <td className="px-3 py-2">{inv.aliciUnvanAdSoyad ?? ""}</td>
                        <td className="px-3 py-2">{inv.belgeTarihi ?? ""}</td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={loadingPreview || loadingInvoice}
                              onClick={() => {
                                setLoadingPreview(true);
                                void onPreview(inv).finally(() => setLoadingPreview(false));
                              }}
                            >
                              Görüntüle
                            </Button>
                            <Button
                              size="sm"
                              disabled={loadingInvoice}
                              onClick={() => selectInvoice(inv)}
                            >
                              Seç
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleteId !== null}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Fatura Şablonunu Sil"
        description="Bu şablonu silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        onConfirm={() => {
          if (deleteId) {
            setInvoiceTemplates((prev) => prev.filter((t) => t.id !== deleteId));
            toast.success("Fatura şablonu silindi");
            setDeleteId(null);
          }
        }}
      />
    </div>
  );
}
