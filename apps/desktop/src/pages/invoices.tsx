import { toast } from '@angaria/ui';
import { ReloadIcon, ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import {
  MoreVertical,
  Eye,
  Trash2,
  ShieldCheck,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  Download,
} from 'lucide-react';
import { useState, useRef, useMemo } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog.tsx';
import { downloadInvoicePDF } from '@/components/invoice-pdf.tsx';
import { PDFLanguageToggle } from '@/components/pdf-language-toggle.tsx';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker.tsx';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import * as angaria from '@/lib/angaria.ts';
import { resolvePDFLanguage } from '@/lib/invoice-pdf-i18n.ts';
import { useStore } from '@/lib/store.tsx';
import type { PDFLanguage } from '@/lib/types.ts';
import { parseGIB, toGIB, formatDateHuman } from '@/lib/utils.ts';
import type { Page } from '@/shell/legacy-page.tsx';

/** Safely convert unknown GIB field to string */
function str(v: unknown, fallback = ''): string {
  if (v == null) {
    return fallback;
  }
  return typeof v === 'string' ? v : fallback;
}

export interface Invoice {
  aliciUnvanAdSoyad?: string;
  aliciVknTckn?: string;
  belgeNumarasi?: string;
  belgeTarihi?: string;
  belgeTuru?: string;
  ettn?: string;
  onayDurumu?: string;
}

async function fetchDrafts(
  username: string,
  password: string,
  testMode: boolean,
  startDate: string,
  endDate: string,
): Promise<Array<Invoice>> {
  const session = await angaria.login(username, password, testMode);
  try {
    return (await angaria.getDrafts(session, startDate, endDate)) as Array<Invoice>;
  } finally {
    angaria.logout(session).catch(() => {});
  }
}

function StatusBadge({ status }: { status?: string }) {
  if (status === 'Onaylandı') {
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        Onaylı
      </Badge>
    );
  }
  if (status === 'Silinmiş') {
    return <Badge variant="destructive">Silinmiş</Badge>;
  }
  return <Badge variant="outline">Taslak</Badge>;
}

function SortableHeader({
  column,
  label,
}: {
  column: { getIsSorted: () => false | 'asc' | 'desc'; toggleSorting: (desc?: boolean) => void };
  label: string;
}) {
  const sorted = column.getIsSorted();
  return (
    <button
      className="-ml-2 flex items-center gap-1 rounded px-2 py-1 hover:bg-muted/50"
      onClick={() => column.toggleSorting()}
      type="button"
    >
      {label}
      {sorted === 'asc' ? (
        <ArrowUp className="size-3.5" />
      ) : sorted === 'desc' ? (
        <ArrowDown className="size-3.5" />
      ) : (
        <ArrowUpDown className="size-3.5 text-muted-foreground/50" />
      )}
    </button>
  );
}

export function InvoicesPage({
  onPreview,
  onNavigate,
  requireCredentials,
}: {
  onNavigate: (page: Page) => void;
  onPreview: (invoice: Invoice) => Promise<void>;
  requireCredentials: () => boolean;
}) {
  const {
    activeEntity,
    creds,
    getCredentials,
    hasCredentials,
    companyInfo,
    invoiceDateRange,
    setInvoiceDateRange,
    invoicePageSize,
    setInvoicePageSize,
    loadFromGIBInvoice,
    savedRecipients,
  } = useStore();
  const queryClient = useQueryClient();

  const listStartDate = invoiceDateRange.start;
  const listEndDate = invoiceDateRange.end;
  const setListStartDate = (d: string) => setInvoiceDateRange((prev) => ({ ...prev, start: d }));
  const setListEndDate = (d: string) => setInvoiceDateRange((prev) => ({ ...prev, end: d }));

  const [loadingPreview, setLoadingPreview] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Invoice | null>(null);
  const [globalFilter, setGlobalFilter] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [sorting, setSorting] = useState<SortingState>([]);
  // Per-invoice PDF language override, keyed by ETTN
  const [pdfLanguages, setPdfLanguages] = useState<Record<string, PDFLanguage>>({});

  function pdfLanguageFor(invoice: Invoice) {
    return resolvePDFLanguage(
      invoice.ettn ? pdfLanguages[invoice.ettn] : undefined,
      invoice.aliciVknTckn
        ? savedRecipients.find((r) => r.taxIDOrTRID === invoice.aliciVknTckn)?.pdfLanguage
        : undefined,
    );
  }

  // SMS signing state
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [smsCode, setSmsCode] = useState('');
  const [smsPhone, setSmsPhone] = useState('');
  const smsSessionRef = useRef<angaria.SessionInfo | null>(null);
  const smsOidRef = useRef('');
  const smsInvoiceIdsRef = useRef<Array<string>>([]);

  const {
    data: invoiceList = [],
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['invoices', creds.username, creds.testMode, listStartDate, listEndDate],
    queryFn: async () => {
      const { username, password, testMode } = await getCredentials(activeEntity.id);
      return fetchDrafts(username, password, testMode, listStartDate, listEndDate);
    },
    enabled: hasCredentials && Boolean(listStartDate) && Boolean(listEndDate),
    staleTime: 60_000,
    retry: false,
    meta: { onError: true },
  });

  const cancelMutation = useMutation({
    mutationFn: async (invoice: Invoice) => {
      const { username, password, testMode } = await getCredentials(activeEntity.id);
      const session = await angaria.login(username, password, testMode);
      try {
        await angaria.cancelInvoice(
          session,
          'Fatura iptal edildi',
          invoice as unknown as Record<string, unknown>,
        );
      } finally {
        angaria.logout(session).catch(() => {});
      }
    },
    onSuccess: () => {
      toast.success('Fatura silindi');
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });

  const startSignMutation = useMutation({
    mutationFn: async (invoice: Invoice) => {
      const { username, password, testMode } = await getCredentials(activeEntity.id);
      const session = await angaria.login(username, password, testMode);
      const { phone, oid } = await angaria.startSMSSign(session);
      return { session, phone, oid, ettn: invoice.ettn! };
    },
    onSuccess: ({ session, phone, oid, ettn }) => {
      smsSessionRef.current = session;
      smsOidRef.current = oid;
      smsInvoiceIdsRef.current = [ettn];
      setSmsPhone(phone);
      setSmsCode('');
      setSmsDialogOpen(true);
    },
  });

  const verifySignMutation = useMutation({
    mutationFn: async () => {
      const session = smsSessionRef.current;
      if (!session) {
        throw new Error('Oturum bulunamadı');
      }
      return angaria.verifyAndSign(session, smsCode, smsOidRef.current, smsInvoiceIdsRef.current);
    },
    onSuccess: () => {
      if (smsSessionRef.current) {
        angaria.logout(smsSessionRef.current).catch(() => {});
        smsSessionRef.current = null;
      }
      toast.success('Fatura onaylandı');
      setSmsDialogOpen(false);
      void queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
    onError: () => {
      setSmsCode('');
    },
  });

  const useAsTemplateMutation = useMutation({
    mutationFn: async (invoice: Invoice) => {
      if (!invoice.ettn) {
        throw new Error('Fatura ETTN bulunamadı');
      }
      const { username, password, testMode } = await getCredentials(activeEntity.id);
      const session = await angaria.login(username, password, testMode);
      try {
        return await angaria.getInvoiceDetail(session, invoice.ettn);
      } finally {
        angaria.logout(session).catch(() => {});
      }
    },
    onSuccess: (detail) => {
      loadFromGIBInvoice(detail);
      onNavigate('create');
    },
  });

  const pdfToastRef = useRef<string | number>('');

  const downloadPDFMutation = useMutation({
    mutationFn: async ({ invoice, language }: { invoice: Invoice; language: PDFLanguage }) => {
      if (!invoice.ettn) {
        throw new Error('Fatura ETTN bulunamadı');
      }
      pdfToastRef.current = toast.loading('PDF hazırlanıyor...');
      const { username, password, testMode } = await getCredentials(activeEntity.id);
      const session = await angaria.login(username, password, testMode);
      try {
        const detail = await angaria.getInvoiceDetail(session, invoice.ettn);
        const table = (detail.malHizmetTable as Array<Record<string, unknown>>) ?? [];
        const items = table.map((row, i) => ({
          id: String(i),
          name: str(row.malHizmet),
          quantity: Number(row.miktar) || 1,
          unitPrice: Number(row.birimFiyat) || 0,
          VATRate: Number(row.kdvOrani) || 0,
          unitType: str(row.birim, 'C62'),
          discountRate: Number(row.iskontoOrani) || 0,
          discountAmount: Number(row.iskontoTutari) || 0,
          discountReason: str(row.iskontoNedeni),
          gtip: str(row.gtip),
        }));
        const grandTotal = items.reduce(
          (s, i) => s + i.quantity * i.unitPrice - (i.discountAmount || 0),
          0,
        );
        const totalVAT = items.reduce(
          (s, i) => s + (i.quantity * i.unitPrice - (i.discountAmount || 0)) * (i.VATRate / 100),
          0,
        );
        const rate = str(detail.dovzTLkur);
        await downloadInvoicePDF({
          entityName: activeEntity.name,
          company: companyInfo,
          recipient: {
            id: '',
            taxIDOrTRID: str(detail.vknTckn),
            taxOffice: str(detail.vergiDairesi),
            title: str(detail.aliciUnvan),
            name: str(detail.aliciAdi),
            surname: str(detail.aliciSoyadi),
            fullAddress: str(detail.bulvarcaddesokak),
            country: str(detail.ulke),
            city: str(detail.sehir),
            district: str(detail.mahalleSemtIlce),
          },
          settings: {
            currency: str(detail.paraBirimi, 'TRY'),
            currencyRate: rate === '0' ? '' : rate,
            invoiceType: str(detail.faturaTipi, 'SATIS'),
          },
          items,
          date: invoice.belgeTarihi ?? '',
          invoiceNumber: invoice.belgeNumarasi,
          language,
          note: str(detail.not),
          grandTotal,
          totalVAT,
          total: grandTotal + totalVAT,
        });
      } finally {
        angaria.logout(session).catch(() => {});
      }
    },
    onSuccess: () => toast.success('PDF indirildi', { id: pdfToastRef.current }),
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'PDF oluşturulamadı', {
        id: pdfToastRef.current,
      });
    },
  });

  const mutating =
    cancelMutation.isPending ||
    startSignMutation.isPending ||
    useAsTemplateMutation.isPending ||
    downloadPDFMutation.isPending;
  const loading = isLoading || isFetching || mutating;

  function handleSign(invoice: Invoice) {
    if (invoice.onayDurumu === 'Onaylandı') {
      toast.error('Bu fatura zaten onaylanmış!');
      return;
    }
    if (invoice.onayDurumu === 'Silinmiş') {
      toast.error('Silinmiş fatura onaylanamaz!');
      return;
    }
    startSignMutation.mutate(invoice);
  }

  function handleCancel(invoice: Invoice) {
    if (invoice.onayDurumu === 'Onaylandı') {
      toast.error('Onaylanmış belgeler silinemez!');
      return;
    }
    if (invoice.onayDurumu === 'Silinmiş') {
      toast.error('Bu belge zaten silinmiş!');
      return;
    }
    cancelMutation.mutate(invoice);
  }

  function handleSmsDialogClose() {
    if (smsSessionRef.current) {
      angaria.logout(smsSessionRef.current).catch(() => {});
      smsSessionRef.current = null;
    }
    setSmsDialogOpen(false);
  }

  const columns = useMemo<Array<ColumnDef<Invoice>>>(
    () => [
      {
        accessorKey: 'belgeNumarasi',
        header: ({ column }) => <SortableHeader column={column} label="Belge No" />,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{(getValue() as string) ?? ''}</span>
        ),
      },
      {
        accessorKey: 'aliciUnvanAdSoyad',
        header: ({ column }) => <SortableHeader column={column} label="Alıcı" />,
        cell: ({ getValue }) => (
          <span className="block max-w-48 truncate">{(getValue() as string) ?? ''}</span>
        ),
      },
      {
        accessorKey: 'belgeTarihi',
        header: ({ column }) => <SortableHeader column={column} label="Tarih" />,
        cell: ({ getValue }) => formatDateHuman((getValue() as string) ?? ''),
      },
      {
        accessorKey: 'onayDurumu',
        header: ({ column }) => <SortableHeader column={column} label="Durum" />,
        cell: ({ getValue }) => <StatusBadge status={getValue() as string} />,
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const inv = row.original;
          const showSign = inv.onayDurumu !== 'Onaylandı' && inv.onayDurumu !== 'Silinmiş';
          const showDelete = inv.onayDurumu !== 'Onaylandı' && inv.onayDurumu !== 'Silinmiş';
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon-sm" variant="ghost">
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem
                    onClick={() => {
                      setLoadingPreview(true);
                      void onPreview(inv).finally(() => setLoadingPreview(false));
                    }}
                  >
                    <Eye className="size-4" />
                    Önizle
                  </DropdownMenuItem>
                  {showSign && (
                    <DropdownMenuItem onClick={() => handleSign(inv)}>
                      <ShieldCheck className="size-4" />
                      Onayla
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={() => useAsTemplateMutation.mutate(inv)}>
                    <Copy className="size-4" />
                    Şablon olarak kullan
                  </DropdownMenuItem>
                  {inv.onayDurumu === 'Onaylandı' && (
                    <div className="flex items-center gap-1">
                      <DropdownMenuItem
                        className="flex-1"
                        onClick={() => {
                          if (!requireCredentials()) {
                            return;
                          }
                          downloadPDFMutation.mutate({
                            invoice: inv,
                            language: pdfLanguageFor(inv),
                          });
                        }}
                      >
                        <Download className="size-4" />
                        PDF indir
                      </DropdownMenuItem>
                      <PDFLanguageToggle
                        onChange={(language) => {
                          const { ettn } = inv;
                          if (ettn) {
                            setPdfLanguages((prev) => ({ ...prev, [ettn]: language }));
                          }
                        }}
                        value={pdfLanguageFor(inv)}
                      />
                    </div>
                  )}
                  {showDelete && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem onClick={() => setDeleteTarget(inv)} variant="destructive">
                        <Trash2 className="size-4" />
                        Sil
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        },
      },
    ],
    [loadingPreview, mutating, pdfLanguages, savedRecipients],
  );

  const table = useReactTable({
    data: invoiceList,
    columns,
    state: { globalFilter, sorting, pagination: { pageIndex, pageSize: invoicePageSize } },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onPaginationChange: (updater) => {
      const prev = { pageIndex, pageSize: invoicePageSize };
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setPageIndex(next.pageIndex);
      setInvoicePageSize(next.pageSize);
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-4">
        <div className="flex-1 space-y-1">
          <Label>Başlangıç</Label>
          <DatePicker
            onChange={(d) => setListStartDate(toGIB(d))}
            value={parseGIB(listStartDate)}
          />
        </div>
        <div className="flex-1 space-y-1">
          <Label>Bitiş</Label>
          <DatePicker onChange={(d) => setListEndDate(toGIB(d))} value={parseGIB(listEndDate)} />
        </div>
        <Button
          disabled={loading}
          onClick={() => {
            if (!requireCredentials()) {
              return;
            }
            void queryClient.invalidateQueries({ queryKey: ['invoices'] });
          }}
          size="icon"
          variant="outline"
        >
          <HugeiconsIcon
            className={loading ? 'animate-spin' : ''}
            icon={ReloadIcon}
            strokeWidth={1.5}
          />
        </Button>
      </div>

      {(isLoading || isFetching) && invoiceList.length === 0 && (
        <div className="space-y-4">
          <Skeleton className="h-9 w-full" />
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Belge No</TableHead>
                  <TableHead>Alıcı</TableHead>
                  <TableHead>Tarih</TableHead>
                  <TableHead>Durum</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {Array.from({ length: 5 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <Skeleton className="h-4 w-28" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-36" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Skeleton className="h-7 w-7" />
                        <Skeleton className="h-7 w-7" />
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {invoiceList.length > 0 && (
        <div className="space-y-4">
          <Input
            onChange={(e) => setGlobalFilter(e.target.value)}
            placeholder="Belge no, alıcı veya tarih ile ara..."
            value={globalFilter}
          />

          <div className="rounded-md border">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.length > 0 ? (
                  table.getRowModel().rows.map((row) => (
                    <TableRow key={row.id}>
                      {row.getVisibleCells().map((cell) => (
                        <TableCell key={cell.id}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell className="h-24 text-center" colSpan={columns.length}>
                      Sonuç bulunamadı
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>
                {table.getFilteredRowModel().rows.length} sonuçtan{' '}
                {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–
                {Math.min(
                  (table.getState().pagination.pageIndex + 1) *
                    table.getState().pagination.pageSize,
                  table.getFilteredRowModel().rows.length,
                )}
              </span>
              <Select
                onValueChange={(val) => table.setPageSize(Number(val))}
                value={String(table.getState().pagination.pageSize)}
              >
                <SelectTrigger className="h-8 w-[70px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[10, 20, 50, 100].map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Sayfa {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
              </span>
              <Button
                disabled={!table.getCanPreviousPage()}
                onClick={() => table.previousPage()}
                size="icon-sm"
                variant="outline"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={1.5} />
              </Button>
              <Button
                disabled={!table.getCanNextPage()}
                onClick={() => table.nextPage()}
                size="icon-sm"
                variant="outline"
              >
                <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={1.5} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {invoiceList.length === 0 && !loading && !isLoading && !isFetching && (
        <div className="rounded-md border py-12 text-center">
          <p className="text-muted-foreground">Bu tarih aralığında fatura bulunamadı</p>
        </div>
      )}

      <ConfirmDialog
        description="Bu faturayı GİB portaldan silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        onConfirm={() => {
          if (deleteTarget) {
            handleCancel(deleteTarget);
            setDeleteTarget(null);
          }
        }}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        open={deleteTarget !== null}
        title="Faturayı Sil"
      />

      <Dialog onOpenChange={(open) => !open && handleSmsDialogClose()} open={smsDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>SMS Onay Kodu</DialogTitle>
            <DialogDescription>
              {smsPhone} numarasına gönderilen onay kodunu girin.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            onChange={(e) => setSmsCode(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && smsCode) {
                verifySignMutation.mutate();
              }
            }}
            placeholder="SMS kodu"
            value={smsCode}
          />
          <DialogFooter>
            <Button onClick={handleSmsDialogClose} variant="outline">
              İptal
            </Button>
            <Button
              disabled={!smsCode || verifySignMutation.isPending}
              onClick={() => verifySignMutation.mutate()}
            >
              {verifySignMutation.isPending ? 'Onaylanıyor...' : 'Onayla'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
