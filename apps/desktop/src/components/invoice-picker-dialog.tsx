import { toast } from '@angaria/ui';
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useQuery } from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table';
import { ArrowUpDown, ArrowUp, ArrowDown, Eye, FileInput } from 'lucide-react';
import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { DatePicker } from '@/components/ui/date-picker.tsx';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import { useStore } from '@/lib/store.tsx';
import type { Invoice } from '@/lib/types.ts';
import { parseGIB, toGIB, formatDateHuman } from '@/lib/utils.ts';

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

export function InvoicePickerDialog({
  open,
  onOpenChange,
  onSelect,
  onPreview,
}: {
  onOpenChange: (open: boolean) => void;
  onPreview?: (invoice: Invoice) => Promise<void>;
  onSelect: (invoice: Invoice) => void;
  open: boolean;
}) {
  const { activeEntityId, creds, getCredentials, hasCredentials } = useStore();

  const [loadingInvoice, setLoadingInvoice] = useState(false);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([]);

  const [dateRange, setDateRange] = useState(() => {
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    const today = `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()}`;
    return { start: today, end: today };
  });

  const {
    data: invoiceList = [],
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ['picker-invoices', creds.username, creds.testMode, dateRange.start, dateRange.end],
    queryFn: async () => {
      const { username, password, testMode } = await getCredentials(activeEntityId);
      const session = await angaria.login(username, password, testMode);
      try {
        return (await angaria.getDrafts(session, dateRange.start, dateRange.end)) as Array<Invoice>;
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
    if (!hasCredentials || !invoice.ettn) {
      return;
    }
    setLoadingInvoice(true);
    try {
      const { username, password, testMode } = await getCredentials(activeEntityId);
      const session = await angaria.login(username, password, testMode);
      try {
        const detail = await angaria.getInvoiceDetail(session, invoice.ettn);
        onSelect(detail as unknown as Invoice);
      } finally {
        angaria.logout(session).catch(() => {});
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fatura detayı alınamadı');
    } finally {
      setLoadingInvoice(false);
    }
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
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const inv = row.original;
          return (
            <div className="flex items-center justify-end gap-1">
              {onPreview && (
                <Button
                  disabled={loadingPreview || loadingInvoice}
                  onClick={() => {
                    setLoadingPreview(true);
                    void onPreview(inv).finally(() => setLoadingPreview(false));
                  }}
                  size="icon-sm"
                  variant="ghost"
                >
                  <Eye className="size-4" />
                </Button>
              )}
              <Button disabled={loadingInvoice} onClick={() => selectInvoice(inv)} size="sm">
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
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>Fatura Seç</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-1">
              <Label>Başlangıç</Label>
              <DatePicker
                onChange={(d) => setDateRange((prev) => ({ ...prev, start: toGIB(d) }))}
                value={parseGIB(dateRange.start)}
              />
            </div>
            <div className="flex-1 space-y-1">
              <Label>Bitiş</Label>
              <DatePicker
                onChange={(d) => setDateRange((prev) => ({ ...prev, end: toGIB(d) }))}
                value={parseGIB(dateRange.end)}
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
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder="Belge no, alıcı veya tarih ile ara..."
                value={globalFilter}
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
                        <TableCell className="h-24 text-center" colSpan={columns.length}>
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
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
