import { useState } from "react";
import { toast } from "sonner";
import { format, parse } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardAction } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DatePicker } from "@/components/ui/date-picker.tsx";
import { ConfirmDialog } from "@/components/confirm-dialog.tsx";
import { useStore } from "@/lib/store.tsx";
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

interface Invoice {
  belgeNumarasi?: string;
  aliciVknTckn?: string;
  aliciUnvanAdSoyad?: string;
  belgeTarihi?: string;
  belgeTuru?: string;
  onayDurumu?: string;
  ettn?: string;
}

export function InvoicesPage() {
  const { creds } = useStore();

  const [listStartDate, setListStartDate] = useState(() => {
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()}`;
  });
  const [listEndDate, setListEndDate] = useState(() => listStartDate);
  const [invoiceList, setInvoiceList] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [viewHTML, setViewHTML] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);

  async function fetchInvoices() {
    if (!creds.username || !creds.password) {
      toast.error("GİB kullanıcı bilgileri gerekli — Ayarlar'dan girin");
      return;
    }
    setLoading(true);
    try {
      const session = await angaria.login(creds.username, creds.password, creds.testMode);
      try {
        const drafts = await angaria.getDrafts(session, listStartDate, listEndDate);
        setInvoiceList(drafts as Invoice[]);
      } finally {
        angaria.logout(session).catch(() => {});
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  }

  async function viewInvoice(uuid: string, onayDurumu: string) {
    if (!creds.username || !creds.password) return;
    setLoading(true);
    try {
      const session = await angaria.login(creds.username, creds.password, creds.testMode);
      try {
        const html = await angaria.getInvoiceHTML(session, uuid, onayDurumu);
        setViewHTML(html);
      } finally {
        angaria.logout(session).catch(() => {});
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  }

  async function cancelInvoice(invoice: Invoice) {
    if (invoice.onayDurumu === "Onaylandı") {
      toast.error("Onaylanmış belgeler silinemez!");
      return;
    }
    if (invoice.onayDurumu === "Silinmiş") {
      toast.error("Bu belge zaten silinmiş!");
      return;
    }
    if (!creds.username || !creds.password) return;
    setLoading(true);
    try {
      const session = await angaria.login(creds.username, creds.password, creds.testMode);
      try {
        await angaria.cancelInvoice(
          session,
          "Fatura iptal edildi",
          invoice as unknown as Record<string, unknown>,
        );
        toast.success("Fatura silindi");
        await fetchInvoices();
      } finally {
        angaria.logout(session).catch(() => {});
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  }

  function statusBadge(status?: string) {
    if (status === "Onaylandı")
      return (
        <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
          Onaylı
        </Badge>
      );
    if (status === "Silinmiş") return <Badge variant="destructive">Silinmiş</Badge>;
    return <Badge variant="outline">Taslak</Badge>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight">Faturalarım</h2>
        <p className="text-sm text-muted-foreground">GİB portalda düzenlenen faturalar</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tarih Aralığı</CardTitle>
          <CardAction>
            <Button size="sm" disabled={loading} onClick={fetchInvoices}>
              {loading ? "Yükleniyor..." : "Sorgula"}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Başlangıç</Label>
              <DatePicker
                value={parseGIB(listStartDate)}
                onChange={(d) => setListStartDate(toGIB(d))}
              />
            </div>
            <div className="space-y-2">
              <Label>Bitiş</Label>
              <DatePicker
                value={parseGIB(listEndDate)}
                onChange={(d) => setListEndDate(toGIB(d))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {invoiceList.length > 0 && (
        <Card>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-3 py-2 text-left font-medium">Belge No</th>
                    <th className="px-3 py-2 text-left font-medium">Alıcı</th>
                    <th className="px-3 py-2 text-left font-medium">Tarih</th>
                    <th className="px-3 py-2 text-left font-medium">Durum</th>
                    <th className="px-3 py-2 text-right font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {invoiceList.map((inv, idx) => (
                    <tr key={idx} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="px-3 py-2 font-mono text-xs">{inv.belgeNumarasi ?? ""}</td>
                      <td className="px-3 py-2">{inv.aliciUnvanAdSoyad ?? ""}</td>
                      <td className="px-3 py-2">{inv.belgeTarihi ?? ""}</td>
                      <td className="px-3 py-2">{statusBadge(inv.onayDurumu)}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => viewInvoice(inv.ettn ?? "", inv.onayDurumu ?? "")}
                          >
                            Görüntüle
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => setDeleteTarget(inv)}
                          >
                            Sil
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {invoiceList.length === 0 && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Tarih aralığı seçip Sorgula butonuna tıklayın</p>
          </CardContent>
        </Card>
      )}

      {viewHTML && (
        <Card>
          <CardHeader>
            <CardTitle>Fatura Önizleme</CardTitle>
            <CardAction>
              <Button variant="ghost" size="sm" onClick={() => setViewHTML(null)}>
                Kapat
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <iframe
              srcDoc={viewHTML}
              className="h-[600px] w-full rounded-md border"
              title="Fatura önizleme"
            />
          </CardContent>
        </Card>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Faturayı Sil"
        description="Bu faturayı GİB portaldan silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        onConfirm={() => {
          if (deleteTarget) {
            void cancelInvoice(deleteTarget);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
}
