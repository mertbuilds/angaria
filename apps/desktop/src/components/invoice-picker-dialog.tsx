import { useState, useMemo } from "react";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import { ArrowUpDown, ArrowUp, ArrowDown, Eye, FileInput } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DatePicker } from "@/components/ui/date-picker.tsx";
import { useStore } from "@/lib/store.tsx";
import { parseGIB, toGIB, formatDateHuman } from "@/lib/utils.ts";
import type { Invoice } from "@/pages/invoices.tsx";
import * as angaria from "@/lib/angaria.ts";

function SortableHeader({
  column,
  label,
}: {
  column: { getIsSorted: () => false | "asc" | "desc"; toggleSorting: (desc?: boolean) => void };
  label: string;
}) {
  const sorted = column.getIsSorted();
  return (
    <button
      type="button"
      className="-ml-2 flex items-center gap-1 rounded px-2 py-1 hover:bg-muted/50"
      onClick={() => column.toggleSorting()}
    >
      {label}
      {sorted === "asc" ? (
        <ArrowUp className="size-3.5" />
      ) : sorted === "desc" ? (
        <ArrowDown className="size-3.5" />
      ) : (
        <ArrowUpDown className="size-3.5 text-muted-foreground/50" />
      )}
    </button>
  );
}

export function InvoicePickerDialog({
  open,
  onOpenChange,
  onSelect,
  onPreview,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (invoice: Invoice) => void;
  onPreview?: (invoice: Invoice) => Promise<void>;
}) {
  const { creds } = useStore();

  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [globalFilter, setGlobalFilter] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);

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
    enabled: open && hasCredentials && Boolean(dateRange.start) && Boolean(dateRange.end),
    staleTime: 60_000,
    retry: false,
  });

  const listLoading = isLoading || isFetching;

  async function selectInvoice(invoice: Invoice) {
    if (!hasCredentials || !invoice.ettn) return;
    setLoadingInvoice(true);
    try {
      const session = await angaria.login(creds.username, creds.password, creds.testMode);
      try {
        const detail = await angaria.getInvoiceDetail(session, invoice.ettn);
        onSelect(detail as unknown as Invoice);
      } finally {
        angaria.logout(session).catch(() => {});
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Fatura detayı alınamadı");
    } finally {
      setLoadingInvoice(false);
    }
  }

  const columns = useMemo<ColumnDef<Invoice>[]>(
    () => [
      {
        accessorKey: "belgeNumarasi",
        header: ({ column }) => <SortableHeader column={column} label="Belge No" />,
        cell: ({ getValue }) => (
          <span className="font-mono text-xs">{(getValue() as string) ?? ""}</span>
        ),
      },
      {
        accessorKey: "aliciUnvanAdSoyad",
        header: ({ column }) => <SortableHeader column={column} label="Alıcı" />,
        cell: ({ getValue }) => (
          <span className="block max-w-48 truncate">{(getValue() as string) ?? ""}</span>
        ),
      },
      {
        accessorKey: "belgeTarihi",
        header: ({ column }) => <SortableHeader column={column} label="Tarih" />,
        cell: ({ getValue }) => formatDateHuman((getValue() as string) ?? ""),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const inv = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              {onPreview && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  disabled={loadingPreview || loadingInvoice}
                  onClick={() => {
                    setLoadingPreview(true);
                    void onPreview(inv).finally(() => setLoadingPreview(false));
                  }}
                >
                  <Eye className="size-4" />
                </Button>
              )}
              <Button size="sm" disabled={loadingInvoice} onClick={() => selectInvoice(inv)}>
                <FileInput className="size-4" />
                Seç
              </Button>
            </div>
          );
        },
      },
    ],
    [loadingPreview, loadingInvoice, onPreview],
  );

  const table = useReactTable({
    data: invoiceList,
    columns,
    state: { globalFilter, sorting },
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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

          {listLoading && invoiceList.length === 0 && (
            <div className="space-y-4">
              <Skeleton className="h-9 w-full" />
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Belge No</TableHead>
                      <TableHead>Alıcı</TableHead>
                      <TableHead>Tarih</TableHead>
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
                          <div className="flex justify-end">
                            <Skeleton className="h-7 w-14" />
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {!listLoading && invoiceList.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Bu tarih aralığında fatura bulunamadı
            </p>
          )}

          {invoiceList.length > 0 && (
            <>
              <Input
                placeholder="Belge no, alıcı veya tarih ile ara..."
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
              />

              <div className="max-h-[400px] overflow-auto rounded-md border">
                <Table>
                  <TableHeader className="sticky top-0 bg-background">
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
                        <TableCell colSpan={columns.length} className="h-24 text-center">
                          Sonuç bulunamadı
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {table.getFilteredRowModel().rows.length} sonuç
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Sayfa {table.getState().pagination.pageIndex + 1} / {table.getPageCount()}
                  </span>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={!table.getCanPreviousPage()}
                    onClick={() => table.previousPage()}
                  >
                    <HugeiconsIcon icon={ArrowLeft01Icon} strokeWidth={1.5} />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon-sm"
                    disabled={!table.getCanNextPage()}
                    onClick={() => table.nextPage()}
                  >
                    <HugeiconsIcon icon={ArrowRight01Icon} strokeWidth={1.5} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
