import { useState, useRef } from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { ReloadIcon, EyeIcon, Delete01Icon } from "@hugeicons/core-free-icons";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
import { parseGIB, toGIB, formatDateHuman } from "@/lib/utils.ts";
import * as angaria from "@/lib/angaria.ts";

export interface Invoice {
  belgeNumarasi?: string;
  aliciVknTckn?: string;
  aliciUnvanAdSoyad?: string;
  belgeTarihi?: string;
  belgeTuru?: string;
  onayDurumu?: string;
  ettn?: string;
}

async function fetchDrafts(
  username: string,
  password: string,
  testMode: boolean,
  startDate: string,
  endDate: string,
): Promise<Invoice[]> {
  const session = await angaria.login(username, password, testMode);
  try {
    return (await angaria.getDrafts(session, startDate, endDate)) as Invoice[];
  } finally {
    angaria.logout(session).catch(() => {});
  }
}

export function InvoicesPage({ onPreview }: { onPreview: (invoice: Invoice) => Promise<void> }) {
  const { creds, invoiceDateRange, setInvoiceDateRange } = useStore();
  const queryClient = useQueryClient();

  const listStartDate = invoiceDateRange.start;
  const listEndDate = invoiceDateRange.end;
  const setListStartDate = (d: string) => setInvoiceDateRange((prev) => ({ ...prev, start: d }));
  const setListEndDate = (d: string) => setInvoiceDateRange((prev) => ({ ...prev, end: d }));

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);

  // SMS signing state
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [smsCode, setSmsCode] = useState("");
  const [smsPhone, setSmsPhone] = useState("");
  const smsSessionRef = useRef<angaria.SessionInfo | null>(null);
  const smsOidRef = useRef("");
  const smsInvoiceIdsRef = useRef<string[]>([]);

  const hasCredentials = Boolean(creds.username && creds.password);

  const {
    data: invoiceList = [],
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["invoices", creds.username, creds.testMode, listStartDate, listEndDate],
    queryFn: () =>
      fetchDrafts(creds.username, creds.password, creds.testMode, listStartDate, listEndDate),
    enabled: hasCredentials && Boolean(listStartDate) && Boolean(listEndDate),
    staleTime: 60_000,
    retry: false,
    meta: { onError: true },
  });

  const cancelMutation = useMutation({
    mutationFn: async (invoice: Invoice) => {
      const session = await angaria.login(creds.username, creds.password, creds.testMode);
      try {
        await angaria.cancelInvoice(
          session,
          "Fatura iptal edildi",
          invoice as unknown as Record<string, unknown>,
        );
      } finally {
        angaria.logout(session).catch(() => {});
      }
    },
    onSuccess: () => {
      toast.success("Fatura silindi");
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  // Step 1: Start SMS sign flow — login, get phone, request SMS
  const startSignMutation = useMutation({
    mutationFn: async (invoice: Invoice) => {
      const session = await angaria.login(creds.username, creds.password, creds.testMode);
      const { phone, oid } = await angaria.startSMSSign(session);
      return { session, phone, oid, ettn: invoice.ettn! };
    },
    onSuccess: ({ session, phone, oid, ettn }) => {
      smsSessionRef.current = session;
      smsOidRef.current = oid;
      smsInvoiceIdsRef.current = [ettn];
      setSmsPhone(phone);
      setSmsCode("");
      setSmsDialogOpen(true);
    },
  });

  // Step 2: Verify SMS code and sign
  const verifySignMutation = useMutation({
    mutationFn: async () => {
      const session = smsSessionRef.current;
      if (!session) throw new Error("Oturum bulunamadı");
      return angaria.verifyAndSign(session, smsCode, smsOidRef.current, smsInvoiceIdsRef.current);
    },
    onSuccess: () => {
      // Logout only on success
      if (smsSessionRef.current) {
        angaria.logout(smsSessionRef.current).catch(() => {});
        smsSessionRef.current = null;
      }
      toast.success("Fatura onaylandı");
      setSmsDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
    onError: () => {
      // Clear the code so user can retry
      setSmsCode("");
    },
  });

  const mutating = cancelMutation.isPending || startSignMutation.isPending;
  const loading = isLoading || isFetching || mutating;

  function handleSign(invoice: Invoice) {
    if (invoice.onayDurumu === "Onaylandı") {
      toast.error("Bu fatura zaten onaylanmış!");
      return;
    }
    if (invoice.onayDurumu === "Silinmiş") {
      toast.error("Silinmiş fatura onaylanamaz!");
      return;
    }
    startSignMutation.mutate(invoice);
  }

  function handleCancel(invoice: Invoice) {
    if (invoice.onayDurumu === "Onaylandı") {
      toast.error("Onaylanmış belgeler silinemez!");
      return;
    }
    if (invoice.onayDurumu === "Silinmiş") {
      toast.error("Bu belge zaten silinmiş!");
      return;
    }
    cancelMutation.mutate(invoice);
  }

  function handleSmsDialogClose() {
    // Logout if dialog is closed without verifying
    if (smsSessionRef.current) {
      angaria.logout(smsSessionRef.current).catch(() => {});
      smsSessionRef.current = null;
    }
    setSmsDialogOpen(false);
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
      <div className="flex items-end gap-4">
        <div className="flex-1 space-y-1">
          <Label>Başlangıç</Label>
          <DatePicker
            value={parseGIB(listStartDate)}
            onChange={(d) => setListStartDate(toGIB(d))}
          />
        </div>
        <div className="flex-1 space-y-1">
          <Label>Bitiş</Label>
          <DatePicker value={parseGIB(listEndDate)} onChange={(d) => setListEndDate(toGIB(d))} />
        </div>
        <Button
          variant="outline"
          size="icon"
          disabled={loading}
          onClick={() => queryClient.invalidateQueries({ queryKey: ["invoices"] })}
        >
          <HugeiconsIcon
            icon={ReloadIcon}
            strokeWidth={1.5}
            className={loading ? "animate-spin" : ""}
          />
        </Button>
      </div>

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
                      <td className="px-3 py-2">{formatDateHuman(inv.belgeTarihi ?? "")}</td>
                      <td className="px-3 py-2">{statusBadge(inv.onayDurumu)}</td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {inv.onayDurumu !== "Onaylandı" && inv.onayDurumu !== "Silinmiş" && (
                            <Button
                              size="sm"
                              disabled={loadingPreview || mutating}
                              onClick={() => handleSign(inv)}
                            >
                              Onayla
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            disabled={loadingPreview}
                            onClick={() => {
                              setLoadingPreview(true);
                              void onPreview(inv).finally(() => setLoadingPreview(false));
                            }}
                          >
                            <HugeiconsIcon icon={EyeIcon} strokeWidth={1.5} />
                          </Button>
                          <Button
                            variant="destructive"
                            size="icon-sm"
                            disabled={loadingPreview || mutating}
                            onClick={() => setDeleteTarget(inv)}
                          >
                            <HugeiconsIcon icon={Delete01Icon} strokeWidth={1.5} />
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
            <p className="text-muted-foreground">Bu tarih aralığında fatura bulunamadı</p>
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
            handleCancel(deleteTarget);
            setDeleteTarget(null);
          }
        }}
      />

      {/* SMS Verification Dialog */}
      <Dialog open={smsDialogOpen} onOpenChange={(open) => !open && handleSmsDialogClose()}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>SMS Onay Kodu</DialogTitle>
            <DialogDescription>
              {smsPhone} numarasına gönderilen onay kodunu girin.
            </DialogDescription>
          </DialogHeader>
          <Input
            placeholder="SMS kodu"
            value={smsCode}
            onChange={(e) => setSmsCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && smsCode) verifySignMutation.mutate();
            }}
            autoFocus
          />
          <DialogFooter>
            <Button variant="outline" onClick={handleSmsDialogClose}>
              İptal
            </Button>
            <Button
              disabled={!smsCode || verifySignMutation.isPending}
              onClick={() => verifySignMutation.mutate()}
            >
              {verifySignMutation.isPending ? "Onaylanıyor..." : "Onayla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
