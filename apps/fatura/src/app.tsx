import { useState, useEffect } from "react";
import { Toaster, toast } from "sonner";
import { Plus, Trash2, Save, Settings, FileText, LogOut, ClipboardList, X } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Input,
  Label,
  Button,
  Select,
} from "./components/ui.tsx";
import * as angaria from "./lib/angaria.ts";

interface Recipient {
  id: string;
  taxIDOrTRID: string;
  taxOffice: string;
  title: string;
  name: string;
  surname: string;
  fullAddress: string;
  country: string;
}

interface InvoiceSettings {
  currency: string;
  currencyRate: string;
  invoiceType: string;
}

interface InvoiceItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  VATRate: number;
}

interface Credentials {
  username: string;
  password: string;
  testMode: boolean;
}

interface InvoiceTemplate {
  id: string;
  name: string;
  recipient: Recipient;
  settings: InvoiceSettings;
  items: InvoiceItem[];
  note: string;
}

const newId = () => crypto.randomUUID();
const formatMoney = (currency: string, n: number) =>
  new Intl.NumberFormat("tr-TR", { style: "currency", currency }).format(n);

function loadLocal<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") ?? fallback;
  } catch {
    return fallback;
  }
}

export function App() {
  const [creds, setCreds] = useState<Credentials>(() =>
    loadLocal("fatura-creds", { username: "", password: "", testMode: true }),
  );

  const [showSettings, setShowSettings] = useState(false);
  const [savedRecipients, setSavedRecipients] = useState<Recipient[]>(() =>
    loadLocal("fatura-saved-recipients", []),
  );
  const [savedItems, setSavedItems] = useState<InvoiceItem[]>(() =>
    loadLocal("fatura-saved-items", []),
  );
  const [selectedRecipientId, setSelectedRecipientId] = useState("");

  const [recipient, setRecipient] = useState<Recipient>(() =>
    loadLocal("fatura-v2-recipient", {
      id: newId(),
      taxIDOrTRID: "2222222222",
      taxOffice: "",
      title: "PLASTIC SOFTWARE LLC",
      name: "",
      surname: "",
      fullAddress: "500 Westover Dr #10034\nSanford, NC 27330",
      country: "Amerika Birleşik Dev",
    }),
  );

  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>(() =>
    loadLocal("fatura-v2-settings", {
      currency: "USD",
      currencyRate: "44.1325",
      invoiceType: "ISTISNA",
    }),
  );

  const [items, setItems] = useState<InvoiceItem[]>(() =>
    loadLocal("fatura-v2-items", [
      {
        id: newId(),
        name: "Engineering Services - Muhendislik Hizmetleri",
        quantity: 3,
        unitPrice: 100,
        VATRate: 0,
      },
    ]),
  );

  const [note, setNote] = useState(() => loadLocal("fatura-v2-note", ""));
  const [loading, setLoading] = useState(false);
  const [invoiceHTML, setInvoiceHTML] = useState<string | null>(null);

  // Page navigation
  const [page, setPage] = useState<"create" | "list">("create");

  // Invoice list state
  const [listStartDate, setListStartDate] = useState(() => {
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()}`;
  });
  const [listEndDate, setListEndDate] = useState(() => listStartDate);
  const [invoiceList, setInvoiceList] = useState<
    Array<{
      belgeNumarasi?: string;
      aliciVknTckn?: string;
      aliciUnvanAdSoyad?: string;
      belgeTarihi?: string;
      belgeTuru?: string;
      onayDurumu?: string;
      ettn?: string;
    }>
  >([]);
  const [listLoading, setListLoading] = useState(false);
  const [viewHTML, setViewHTML] = useState<string | null>(null);

  const [invoiceTemplates, setInvoiceTemplates] = useState<InvoiceTemplate[]>(() =>
    loadLocal("fatura-templates", []),
  );
  const [showTemplateSaveDialog, setShowTemplateSaveDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");

  // Persist form state to localStorage
  useEffect(() => localStorage.setItem("fatura-creds", JSON.stringify(creds)), [creds]);
  useEffect(
    () => localStorage.setItem("fatura-saved-recipients", JSON.stringify(savedRecipients)),
    [savedRecipients],
  );
  useEffect(
    () => localStorage.setItem("fatura-saved-items", JSON.stringify(savedItems)),
    [savedItems],
  );
  useEffect(
    () => localStorage.setItem("fatura-v2-settings", JSON.stringify(invoiceSettings)),
    [invoiceSettings],
  );
  useEffect(
    () => localStorage.setItem("fatura-v2-recipient", JSON.stringify(recipient)),
    [recipient],
  );
  useEffect(() => localStorage.setItem("fatura-v2-items", JSON.stringify(items)), [items]);
  useEffect(() => localStorage.setItem("fatura-v2-note", JSON.stringify(note)), [note]);
  useEffect(
    () => localStorage.setItem("fatura-templates", JSON.stringify(invoiceTemplates)),
    [invoiceTemplates],
  );

  // Computed totals
  const grandTotal = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const totalVAT = items.reduce((s, i) => s + i.quantity * i.unitPrice * (i.VATRate / 100), 0);
  const total = grandTotal + totalVAT;

  async function doLogout() {
    try {
      const session = await angaria.login(creds.username, creds.password, creds.testMode);
      await angaria.logout(session);
      toast.success("GİB oturumu kapatıldı");
    } catch {
      toast.error("Çıkış yapılamadı");
    }
  }

  function selectRecipient(id: string) {
    setSelectedRecipientId(id);
    const found = savedRecipients.find((r) => r.id === id);
    if (found) setRecipient({ ...found });
  }

  function saveRecipient() {
    if (!recipient.taxIDOrTRID || !recipient.title) {
      toast.error("VKN/TCKN ve ünvan gerekli");
      return;
    }
    setSavedRecipients((prev) => {
      const idx = prev.findIndex((r) => r.id === recipient.id);
      if (idx >= 0) return prev.map((r, i) => (i === idx ? { ...recipient } : r));
      return [...prev, { ...recipient }];
    });
    toast.success("Alıcı kaydedildi");
  }

  function deleteRecipient(id: string) {
    setSavedRecipients((prev) => prev.filter((r) => r.id !== id));
    if (selectedRecipientId === id) setSelectedRecipientId("");
    toast.success("Alıcı silindi");
  }

  function saveItemTemplate(item: InvoiceItem) {
    setSavedItems((prev) => {
      const idx = prev.findIndex((i) => i.id === item.id);
      if (idx >= 0) return prev.map((i, j) => (j === idx ? { ...item } : i));
      return [...prev, { ...item }];
    });
    toast.success("Kalem şablonu kaydedildi");
  }

  function updateItem(id: string, field: keyof InvoiceItem, value: string | number) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { id: newId(), name: "", quantity: 1, unitPrice: 0, VATRate: 20 },
    ]);
  }

  function removeItem(id: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((i) => i.id !== id) : prev));
  }

  function loadTemplate(templateId: string, itemId: string) {
    const t = savedItems.find((x) => x.id === templateId);
    if (t) setItems((prev) => prev.map((i) => (i.id === itemId ? { ...t, id: itemId } : i)));
  }

  function saveInvoiceTemplate(name: string) {
    const template: InvoiceTemplate = {
      id: newId(),
      name,
      recipient: { ...recipient },
      settings: { ...invoiceSettings },
      items: items.map((i) => ({ ...i })),
      note,
    };
    setInvoiceTemplates((prev) => [...prev, template]);
    toast.success("Fatura şablonu kaydedildi");
  }

  function loadInvoiceTemplate(id: string) {
    const t = invoiceTemplates.find((x) => x.id === id);
    if (!t) return;
    setRecipient({ ...t.recipient, id: newId() });
    setInvoiceSettings({ ...t.settings });
    setItems(t.items.map((i) => ({ ...i, id: newId() })));
    setNote(t.note);
    setSelectedRecipientId("");
    toast.success(`"${t.name}" şablonu yüklendi`);
  }

  function deleteInvoiceTemplate(id: string) {
    setInvoiceTemplates((prev) => prev.filter((t) => t.id !== id));
    toast.success("Şablon silindi");
  }

  async function fetchInvoices() {
    if (!creds.username || !creds.password) {
      toast.error("GİB kullanıcı bilgileri gerekli");
      setShowSettings(true);
      return;
    }
    setListLoading(true);
    try {
      const session = await angaria.login(creds.username, creds.password, creds.testMode);
      try {
        const drafts = await angaria.getDrafts(session, listStartDate, listEndDate);
        setInvoiceList(drafts as typeof invoiceList);
      } finally {
        angaria.logout(session).catch(() => {});
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setListLoading(false);
    }
  }

  async function viewInvoice(uuid: string, onayDurumu: string) {
    if (!creds.username || !creds.password) return;
    setListLoading(true);
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
      setListLoading(false);
    }
  }

  async function doCancelInvoice(invoice: (typeof invoiceList)[0]) {
    if (invoice.onayDurumu === "Onaylandı") {
      toast.error("Onaylanmış belgeler silinemez!");
      return;
    }
    if (invoice.onayDurumu === "Silinmiş") {
      toast.error("Bu belge zaten silinmiş!");
      return;
    }
    if (!creds.username || !creds.password) return;
    setListLoading(true);
    try {
      const session = await angaria.login(creds.username, creds.password, creds.testMode);
      try {
        await angaria.cancelInvoice(
          session,
          "Fatura iptal edildi",
          invoice as Record<string, unknown>,
        );
        toast.success("Fatura silindi");
        await fetchInvoices();
      } finally {
        angaria.logout(session).catch(() => {});
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setListLoading(false);
    }
  }

  async function createInvoice() {
    if (!creds.username || !creds.password) {
      toast.error("GİB kullanıcı bilgileri gerekli");
      setShowSettings(true);
      return;
    }
    if (!recipient.taxIDOrTRID || !recipient.title || !recipient.fullAddress) {
      toast.error("Alıcı bilgileri eksik");
      return;
    }
    if (items.some((i) => !i.name || i.unitPrice <= 0)) {
      toast.error("Kalem bilgileri eksik veya hatalı");
      return;
    }

    setLoading(true);
    const now = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    const date = `${p(now.getDate())}/${p(now.getMonth() + 1)}/${now.getFullYear()}`;
    const time = `${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())}`;

    try {
      const session = await angaria.login(creds.username, creds.password, creds.testMode);
      try {
        const draft = await angaria.createDraftInvoice(session, {
          date,
          time,
          currency: invoiceSettings.currency,
          currencyRate: invoiceSettings.currencyRate || undefined,
          invoiceType: invoiceSettings.invoiceType,
          taxIDOrTRID: recipient.taxIDOrTRID,
          taxOffice: recipient.taxOffice,
          title: recipient.title,
          name: recipient.name,
          surname: recipient.surname,
          fullAddress: recipient.fullAddress,
          country: recipient.country || undefined,
          items: items.map((i) => ({
            name: i.name,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            price: i.quantity * i.unitPrice,
            unitType: "HUR",
            VATRate: i.VATRate,
            VATAmount: i.quantity * i.unitPrice * (i.VATRate / 100),
          })),
          grandTotal,
          totalVAT,
          grandTotalInclVAT: total,
          paymentTotal: total,
          note,
        });

        toast.success("Taslak fatura oluşturuldu!");

        // Try to get HTML preview
        try {
          const html = await angaria.getInvoiceHTML(session, draft.uuid, "Onaylanmadı");
          setInvoiceHTML(html);
        } catch {
          // HTML preview is optional
        }

        setTemplateName("");
        setShowTemplateSaveDialog(true);
      } finally {
        angaria.logout(session).catch(() => {});
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Toaster position="top-right" richColors />

      <div className="mx-auto max-w-2xl space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="size-7" />
            <h1 className="text-2xl font-bold tracking-tight">e-Arşiv Fatura</h1>
          </div>
          <div className="flex items-center gap-2">
            {invoiceTemplates.length > 0 && (
              <div className="flex items-center gap-1">
                <Select
                  className="h-9 w-48 text-sm"
                  defaultValue=""
                  onChange={(e) => {
                    if (e.target.value) loadInvoiceTemplate(e.target.value);
                    e.target.value = "";
                  }}
                >
                  <option value="">Şablon seç...</option>
                  {invoiceTemplates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            <Button variant="outline" size="icon" onClick={doLogout} title="GİB Çıkış">
              <LogOut />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setShowSettings((s) => !s)}>
              <Settings />
            </Button>
          </div>
        </div>

        {/* Settings */}
        {showSettings && (
          <Card>
            <CardHeader>
              <CardTitle>GİB Ayarları</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cred-user">Kullanıcı Adı</Label>
                  <Input
                    id="cred-user"
                    value={creds.username}
                    onChange={(e) => setCreds((c) => ({ ...c, username: e.target.value }))}
                    placeholder="GİB kullanıcı adı"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cred-pass">Şifre</Label>
                  <Input
                    id="cred-pass"
                    type="password"
                    value={creds.password}
                    onChange={(e) => setCreds((c) => ({ ...c, password: e.target.value }))}
                    placeholder="GİB şifre"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={creds.testMode}
                  onChange={(e) => setCreds((c) => ({ ...c, testMode: e.target.checked }))}
                  className="rounded border-input"
                />
                Test modu (earsivportaltestv.efatura.gov.tr)
              </label>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg border border-border p-1">
          <button
            type="button"
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              page === "create" ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-accent"
            }`}
            onClick={() => setPage("create")}
          >
            Fatura Oluştur
          </button>
          <button
            type="button"
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              page === "list" ? "bg-primary text-primary-foreground shadow-sm" : "hover:bg-accent"
            }`}
            onClick={() => setPage("list")}
          >
            Faturalarım
          </button>
        </div>

        {/* === Invoice List Page === */}
        {page === "list" && (
          <>
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Düzenlenen Faturalar</CardTitle>
                <Button variant="outline" size="sm" disabled={listLoading} onClick={fetchInvoices}>
                  {listLoading ? "Yükleniyor..." : "Sorgula"}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Başlangıç</Label>
                    <Input
                      value={listStartDate}
                      onChange={(e) => setListStartDate(e.target.value)}
                      placeholder="DD/MM/YYYY"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Bitiş</Label>
                    <Input
                      value={listEndDate}
                      onChange={(e) => setListEndDate(e.target.value)}
                      placeholder="DD/MM/YYYY"
                    />
                  </div>
                </div>

                {invoiceList.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/50">
                          <th className="px-3 py-2 text-left font-medium">Belge No</th>
                          <th className="px-3 py-2 text-left font-medium">Alıcı</th>
                          <th className="px-3 py-2 text-left font-medium">Tarih</th>
                          <th className="px-3 py-2 text-left font-medium">Onay</th>
                          <th className="px-3 py-2 text-right font-medium" />
                        </tr>
                      </thead>
                      <tbody>
                        {invoiceList.map((inv, idx) => (
                          <tr
                            key={idx}
                            className="border-b border-border last:border-0 hover:bg-muted/30"
                          >
                            <td className="px-3 py-2 font-mono text-xs">
                              {inv.belgeNumarasi ?? ""}
                            </td>
                            <td className="px-3 py-2">{inv.aliciUnvanAdSoyad ?? ""}</td>
                            <td className="px-3 py-2">{inv.belgeTarihi ?? ""}</td>
                            <td className="px-3 py-2">
                              {inv.onayDurumu === "Onaylandı" && (
                                <span className="text-green-600">Onaylı</span>
                              )}
                              {inv.onayDurumu === "Silinmiş" && (
                                <span className="text-destructive">Silinmiş</span>
                              )}
                              {inv.onayDurumu === "Onaylanmadı" && (
                                <span className="text-muted-foreground">Taslak</span>
                              )}
                            </td>
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
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => doCancelInvoice(inv)}
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
                )}

                {invoiceList.length === 0 && !listLoading && (
                  <p className="py-4 text-center text-sm text-muted-foreground">
                    Sorgula butonuna tıklayın
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Invoice View */}
            {viewHTML && (
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle>Fatura Önizleme</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setViewHTML(null)}>
                    Kapat
                  </Button>
                </CardHeader>
                <CardContent>
                  <iframe
                    srcDoc={viewHTML}
                    className="h-[600px] w-full rounded-md border border-border"
                    title="Fatura önizleme"
                  />
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* === Create Invoice Page === */}
        {page === "create" && (
          <>
            {/* Recipient */}
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Alıcı Bilgileri</CardTitle>
                <div className="flex items-center gap-2">
                  {savedRecipients.length > 0 && (
                    <>
                      <Select
                        value={selectedRecipientId}
                        onChange={(e) => selectRecipient(e.target.value)}
                        className="w-48"
                      >
                        <option value="">Kayıtlı alıcı seç...</option>
                        {savedRecipients.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.title}
                          </option>
                        ))}
                      </Select>
                      {selectedRecipientId && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => deleteRecipient(selectedRecipientId)}
                          title="Alıcıyı sil"
                        >
                          <Trash2 />
                        </Button>
                      )}
                    </>
                  )}
                  <Button variant="outline" size="sm" onClick={saveRecipient}>
                    <Save /> Kaydet
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>VKN / TCKN</Label>
                    <Input
                      value={recipient.taxIDOrTRID}
                      onChange={(e) =>
                        setRecipient((r) => ({
                          ...r,
                          taxIDOrTRID: e.target.value,
                        }))
                      }
                      placeholder="1234567890"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Vergi Dairesi</Label>
                    <Input
                      value={recipient.taxOffice}
                      onChange={(e) =>
                        setRecipient((r) => ({
                          ...r,
                          taxOffice: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Ünvan</Label>
                  <Input
                    value={recipient.title}
                    onChange={(e) => setRecipient((r) => ({ ...r, title: e.target.value }))}
                    placeholder="Firma Adı"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Ad</Label>
                    <Input
                      value={recipient.name}
                      onChange={(e) => setRecipient((r) => ({ ...r, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Soyad</Label>
                    <Input
                      value={recipient.surname}
                      onChange={(e) =>
                        setRecipient((r) => ({
                          ...r,
                          surname: e.target.value,
                        }))
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Adres</Label>
                    <Input
                      value={recipient.fullAddress}
                      onChange={(e) =>
                        setRecipient((r) => ({
                          ...r,
                          fullAddress: e.target.value,
                        }))
                      }
                      placeholder="Tam adres"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Ülke</Label>
                    <Input
                      value={recipient.country}
                      onChange={(e) => setRecipient((r) => ({ ...r, country: e.target.value }))}
                      placeholder="Amerika Birleşik Dev"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Invoice Settings */}
            <Card>
              <CardHeader>
                <CardTitle>Fatura Ayarları</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>Fatura Tipi</Label>
                    <Select
                      value={invoiceSettings.invoiceType}
                      onChange={(e) =>
                        setInvoiceSettings((s) => ({ ...s, invoiceType: e.target.value }))
                      }
                    >
                      <option value="ISTISNA">İstisna</option>
                      <option value="SATIS">Satış</option>
                      <option value="IADE">İade</option>
                      <option value="TEVKIFAT">Tevkifat</option>
                      <option value="OZELMATRAH">Özel Matrah</option>
                      <option value="IHRACKAYITLI">İhraç Kayıtlı</option>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Para Birimi</Label>
                    <Select
                      value={invoiceSettings.currency}
                      onChange={(e) =>
                        setInvoiceSettings((s) => ({ ...s, currency: e.target.value }))
                      }
                    >
                      <option value="TRY">TRY</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Döviz Kuru</Label>
                    <Input
                      value={invoiceSettings.currencyRate}
                      onChange={(e) =>
                        setInvoiceSettings((s) => ({ ...s, currencyRate: e.target.value }))
                      }
                      placeholder={invoiceSettings.currency === "TRY" ? "-" : "ör: 38.50"}
                      disabled={invoiceSettings.currency === "TRY"}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Items */}
            <Card>
              <CardHeader className="flex-row items-center justify-between space-y-0">
                <CardTitle>Kalemler</CardTitle>
                <Button variant="outline" size="sm" onClick={addItem}>
                  <Plus /> Kalem Ekle
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {items.map((item, idx) => (
                  <div key={item.id} className="space-y-3 rounded-lg border border-border p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-muted-foreground">#{idx + 1}</span>
                      <div className="flex items-center gap-1">
                        {savedItems.length > 0 && (
                          <Select
                            className="h-7 w-36 text-xs"
                            defaultValue=""
                            onChange={(e) => {
                              if (e.target.value) loadTemplate(e.target.value, item.id);
                              e.target.value = "";
                            }}
                          >
                            <option value="">Şablon yükle...</option>
                            {savedItems.map((t) => (
                              <option key={t.id} value={t.id}>
                                {t.name}
                              </option>
                            ))}
                          </Select>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-7"
                          onClick={() => saveItemTemplate(item)}
                          title="Şablon olarak kaydet"
                        >
                          <Save />
                        </Button>
                        {items.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-7 text-destructive hover:text-destructive"
                            onClick={() => removeItem(item.id)}
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                    </div>
                    <Input
                      value={item.name}
                      onChange={(e) => updateItem(item.id, "name", e.target.value)}
                      placeholder="Ürün / Hizmet adı"
                    />
                    <div className="grid grid-cols-3 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Miktar</Label>
                        <Input
                          type="number"
                          min={1}
                          value={item.quantity}
                          onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Birim Fiyat (₺)</Label>
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          value={item.unitPrice || ""}
                          onChange={(e) => updateItem(item.id, "unitPrice", Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">KDV %</Label>
                        <Input
                          type="number"
                          min={0}
                          max={100}
                          value={item.VATRate}
                          onChange={(e) => updateItem(item.id, "VATRate", Number(e.target.value))}
                        />
                      </div>
                    </div>
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>
                        Tutar:{" "}
                        {formatMoney(invoiceSettings.currency, item.quantity * item.unitPrice)}
                      </span>
                      <span>
                        KDV:{" "}
                        {formatMoney(
                          invoiceSettings.currency,
                          item.quantity * item.unitPrice * (item.VATRate / 100),
                        )}
                      </span>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Note */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <Label>Not (opsiyonel)</Label>
                  <Input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Fatura notu"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Totals */}
            <Card>
              <CardContent className="space-y-2 pt-6">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ara Toplam</span>
                  <span>{formatMoney(invoiceSettings.currency, grandTotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">KDV Toplam</span>
                  <span>{formatMoney(invoiceSettings.currency, totalVAT)}</span>
                </div>
                <div className="border-t border-border pt-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Genel Toplam</span>
                    <span>{formatMoney(invoiceSettings.currency, total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Actions */}
            <div className="flex gap-3">
              <Button className="flex-1" disabled={loading} onClick={createInvoice}>
                {loading ? "Oluşturuluyor..." : "Fatura Oluştur"}
              </Button>
            </div>

            {/* Invoice Preview */}
            {invoiceHTML && (
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle>Fatura Önizleme</CardTitle>
                  <Button variant="ghost" size="sm" onClick={() => setInvoiceHTML(null)}>
                    Kapat
                  </Button>
                </CardHeader>
                <CardContent>
                  <iframe
                    srcDoc={invoiceHTML}
                    className="h-[600px] w-full rounded-md border border-border"
                    title="Fatura önizleme"
                  />
                </CardContent>
              </Card>
            )}

            {/* Saved Templates */}
            {invoiceTemplates.length > 0 && (
              <Card>
                <CardHeader className="flex-row items-center justify-between space-y-0">
                  <CardTitle className="flex items-center gap-2">
                    <ClipboardList className="size-5" />
                    Kayıtlı Şablonlar
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {invoiceTemplates.map((t) => (
                      <div
                        key={t.id}
                        className="flex items-center justify-between rounded-lg border border-border p-3"
                      >
                        <button
                          type="button"
                          className="flex-1 text-left"
                          onClick={() => loadInvoiceTemplate(t.id)}
                        >
                          <span className="font-medium">{t.name}</span>
                          <span className="ml-2 text-sm text-muted-foreground">
                            {t.recipient.title} · {t.items.length} kalem · {t.settings.currency}
                          </span>
                        </button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive hover:text-destructive"
                          onClick={() => deleteInvoiceTemplate(t.id)}
                          title="Şablonu sil"
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>

      {/* Template Save Dialog */}
      {showTemplateSaveDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <Card className="w-full max-w-md">
            <CardHeader className="flex-row items-center justify-between space-y-0">
              <CardTitle>Şablon Olarak Kaydet</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                onClick={() => setShowTemplateSaveDialog(false)}
              >
                <X />
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Bu faturayı şablon olarak kaydetmek ister misiniz? Sonraki faturalarda tüm alanlar
                otomatik doldurulur.
              </p>
              <div className="space-y-2">
                <Label>Şablon Adı</Label>
                <Input
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="ör: Aylık danışmanlık faturası"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && templateName.trim()) {
                      saveInvoiceTemplate(templateName.trim());
                      setShowTemplateSaveDialog(false);
                    }
                  }}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowTemplateSaveDialog(false)}>
                  Hayır
                </Button>
                <Button
                  disabled={!templateName.trim()}
                  onClick={() => {
                    saveInvoiceTemplate(templateName.trim());
                    setShowTemplateSaveDialog(false);
                  }}
                >
                  <Save /> Kaydet
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
