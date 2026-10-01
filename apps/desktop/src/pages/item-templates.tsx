import { Delete01Icon, PlusSignIcon, Edit01Icon, Tick02Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useState } from 'react';
import { toast } from 'sonner';
import { ConfirmDialog } from '@/components/confirm-dialog.tsx';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useStore } from '@/lib/store.tsx';
import type { InvoiceItem } from '@/lib/types.ts';

const formatMoney = (n: number) =>
  new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(n);

export function ItemTemplatesPage() {
  const { savedItems, setSavedItems, newId, defaultItemAdvanced } = useStore();

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  function updateSavedItem(id: string, field: keyof InvoiceItem, value: string | number) {
    setSavedItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  }

  function addNewItem() {
    const id = newId();
    setSavedItems((prev) => [
      ...prev,
      { id, name: '', quantity: 1, unitPrice: 0, VATRate: 20, ...defaultItemAdvanced },
    ]);
    setEditingItemId(id);
  }

  return (
    <div className="space-y-4">
      <Card className="gap-0">
        <CardHeader>
          <CardTitle className="mb-1.5">Kalem Şablonları</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {savedItems.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground">
                Henüz kalem şablonu yok. Aşağıdaki butona tıklayarak ekleyin.
              </p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="px-4 py-2 text-left font-medium">Ad</th>
                  <th className="w-20 px-2 py-2 text-right font-medium">Miktar</th>
                  <th className="w-28 px-2 py-2 text-right font-medium">Birim Fiyat</th>
                  <th className="w-20 px-2 py-2 text-right font-medium">KDV %</th>
                  <th className="w-[4.5rem] px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {savedItems.map((item) => {
                  const isEditing = editingItemId === item.id;
                  return (
                    <tr className="group border-b last:border-0 hover:bg-muted/30" key={item.id}>
                      <td className="px-4 py-2">
                        {isEditing ? (
                          <Input
                            autoFocus
                            className="h-8"
                            onChange={(e) => updateSavedItem(item.id, 'name', e.target.value)}
                            placeholder="Kalem adı"
                            value={item.name}
                          />
                        ) : (
                          <span className="inline-flex h-8 items-center font-medium">
                            {item.name || '—'}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {isEditing ? (
                          <Input
                            className="h-8 text-right"
                            inputMode="numeric"
                            onChange={(e) =>
                              updateSavedItem(item.id, 'quantity', Number(e.target.value) || 0)
                            }
                            value={item.quantity}
                          />
                        ) : (
                          <span className="inline-flex h-8 items-center tabular-nums">
                            {item.quantity}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {isEditing ? (
                          <Input
                            className="h-8 text-right"
                            inputMode="decimal"
                            onChange={(e) =>
                              updateSavedItem(item.id, 'unitPrice', Number(e.target.value) || 0)
                            }
                            value={item.unitPrice || ''}
                          />
                        ) : (
                          <span className="inline-flex h-8 items-center tabular-nums">
                            {formatMoney(item.unitPrice)}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right">
                        {isEditing ? (
                          <Input
                            className="h-8 text-right"
                            inputMode="numeric"
                            onChange={(e) =>
                              updateSavedItem(item.id, 'VATRate', Number(e.target.value) || 0)
                            }
                            value={item.VATRate}
                          />
                        ) : (
                          <span className="inline-flex h-8 items-center tabular-nums">
                            %{item.VATRate}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            onClick={() => {
                              if (isEditing) {
                                setEditingItemId(null);
                                toast.success('Kaydedildi');
                              } else {
                                setEditingItemId(item.id);
                              }
                            }}
                            size="icon-xs"
                            variant={isEditing ? 'outline' : 'ghost'}
                          >
                            <HugeiconsIcon
                              icon={isEditing ? Tick02Icon : Edit01Icon}
                              strokeWidth={1.5}
                            />
                          </Button>
                          <Button
                            onClick={() => setDeleteId(item.id)}
                            size="icon-xs"
                            variant="destructive"
                          >
                            <HugeiconsIcon icon={Delete01Icon} strokeWidth={1.5} />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
        <button
          className="flex w-full items-center justify-center gap-2 border-t py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          onClick={addNewItem}
          type="button"
        >
          <HugeiconsIcon className="size-4" icon={PlusSignIcon} strokeWidth={1.5} />
          Yeni Kalem
        </button>
      </Card>

      <ConfirmDialog
        description="Bu şablonu silmek istediğinize emin misiniz? Bu işlem geri alınamaz."
        onConfirm={() => {
          if (deleteId) {
            setSavedItems((prev) => prev.filter((t) => t.id !== deleteId));
            toast.success('Kalem şablonu silindi');
            setDeleteId(null);
          }
        }}
        onOpenChange={(open) => !open && setDeleteId(null)}
        open={deleteId !== null}
        title="Kalem Şablonunu Sil"
      />
    </div>
  );
}
