import { useState, useCallback } from "react";
import { toast } from "sonner";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar, type Page } from "@/components/app-sidebar.tsx";
import { StoreProvider, useStore } from "@/lib/store.tsx";
import { CreateInvoicePage } from "@/pages/create-invoice.tsx";
import { InvoicesPage, type Invoice } from "@/pages/invoices.tsx";
import { InvoiceTemplatesPage } from "@/pages/invoice-templates.tsx";
import { ItemTemplatesPage } from "@/pages/item-templates.tsx";
import { CustomersPage } from "@/pages/customers.tsx";
import { SettingsPage } from "@/pages/settings.tsx";
import * as angaria from "@/lib/angaria.ts";

const pageConfig: Record<Page, { title: string; description: string }> = {
  create: { title: "Fatura Oluştur", description: "e-Arşiv fatura taslağı" },
  invoices: { title: "Faturalarım", description: "GİB portal faturaları" },
  "invoice-templates": { title: "Fatura Şablonları", description: "Kayıtlı fatura şablonları" },
  "item-templates": { title: "Kalem Şablonları", description: "Kayıtlı kalem şablonları" },
  customers: { title: "Müşteriler", description: "Kayıtlı alıcılar" },
  settings: { title: "Ayarlar", description: "Uygulama yapılandırması" },
};

interface PreviewTab {
  id: string;
  label: string;
  html: string;
}

function ViewModeToggle() {
  const { viewMode, setViewMode } = useStore();
  const advanced = viewMode === "advanced";
  return (
    <div className="flex items-center gap-1 rounded-lg border bg-muted/50 p-0.5">
      <button
        type="button"
        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
          !advanced
            ? "bg-background text-foreground shadow-sm ring-1 ring-border"
            : "text-muted-foreground hover:text-foreground"
        }`}
        onClick={() => setViewMode("simple")}
      >
        Basit
      </button>
      <button
        type="button"
        className={`rounded-md px-2.5 py-1 text-xs font-medium transition-all ${
          advanced
            ? "bg-background text-foreground shadow-sm ring-1 ring-border"
            : "text-muted-foreground hover:text-foreground"
        }`}
        onClick={() => setViewMode("advanced")}
      >
        Gelişmiş
      </button>
    </div>
  );
}

function Dashboard() {
  const { creds, resetInvoiceForm } = useStore();
  const [page, setPage] = useState<Page>("create");
  const [previewTabs, setPreviewTabs] = useState<PreviewTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);

  const isOnPreview = activeTabId !== null;
  const config = pageConfig[page];

  const handleDrag = useCallback((e: React.MouseEvent) => {
    if (e.buttons !== 1) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, [role=button]")) return;
    if (e.detail === 2) {
      void getCurrentWindow().toggleMaximize();
    } else {
      void getCurrentWindow().startDragging();
    }
  }, []);

  async function openPreview(invoice: Invoice) {
    const uuid = invoice.ettn ?? "";
    const existing = previewTabs.find((t) => t.id === uuid);
    if (existing) {
      setActiveTabId(uuid);
      return;
    }
    if (!creds.username || !creds.password) return;
    try {
      const session = await angaria.login(creds.username, creds.password, creds.testMode);
      try {
        const html = await angaria.getInvoiceHTML(session, uuid, invoice.onayDurumu ?? "");
        const label = invoice.belgeNumarasi || invoice.aliciUnvanAdSoyad || "Fatura";
        setPreviewTabs((prev) => {
          const next = [...prev, { id: uuid, label, html }];
          return next.length > 5 ? next.slice(-5) : next;
        });
        setActiveTabId(uuid);
      } finally {
        angaria.logout(session).catch(() => {});
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bilinmeyen hata");
    }
  }

  function closeTab(id: string) {
    setPreviewTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (activeTabId === id) {
        const idx = prev.findIndex((t) => t.id === id);
        const neighbor = prev[idx - 1] ?? prev[idx + 1];
        setActiveTabId(neighbor ? neighbor.id : null);
      }
      return next;
    });
  }

  const activePreview = previewTabs.find((t) => t.id === activeTabId);

  return (
    <SidebarProvider>
      <AppSidebar
        activePage={page}
        onNavigate={(p) => {
          if (p === "create") resetInvoiceForm();
          setPage(p);
          setActiveTabId(null);
        }}
      />
      <SidebarInset className="h-screen overflow-hidden">
        {/* Titlebar + tab bar — draggable region */}
        <header
          onMouseDown={handleDrag}
          className="flex h-11 shrink-0 items-center border-b bg-background/80 backdrop-blur-sm"
        >
          {previewTabs.length > 0 ? (
            <>
              <div className="flex h-full items-stretch">
                <button
                  type="button"
                  onClick={() => setActiveTabId(null)}
                  className={`flex items-center border-r px-4 text-xs font-medium transition-colors ${
                    !isOnPreview
                      ? "bg-muted text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {config.title}
                </button>
                {previewTabs.map((tab) => (
                  <div
                    key={tab.id}
                    className={`group flex items-center gap-1.5 border-r px-3 text-xs transition-colors ${
                      activeTabId === tab.id
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveTabId(tab.id)}
                      className="max-w-36 truncate"
                    >
                      {tab.label}
                    </button>
                    <button
                      type="button"
                      onClick={() => closeTab(tab.id)}
                      className="rounded-sm text-transparent transition-colors group-hover:text-muted-foreground hover:!bg-muted-foreground/10 hover:!text-foreground"
                    >
                      <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} className="size-3" />
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex-1 self-stretch" onMouseDown={handleDrag} />
            </>
          ) : (
            <div
              className="flex flex-1 self-stretch items-center gap-2 pl-2 pr-2"
              onMouseDown={handleDrag}
            >
              <h1 className="pointer-events-none text-sm font-semibold tracking-tight">
                {config.title}
              </h1>
              <span className="pointer-events-none hidden text-xs text-muted-foreground sm:inline">
                {config.description}
              </span>
            </div>
          )}

          {!isOnPreview && page === "create" && (
            <div className="pr-3">
              <ViewModeToggle />
            </div>
          )}
        </header>

        {/* Content */}
        {isOnPreview && activePreview ? (
          <iframe srcDoc={activePreview.html} className="flex-1" title="Fatura önizleme" />
        ) : (
          <div className="flex-1 overflow-auto">
            <div className="mx-auto max-w-3xl px-6 py-8">
              {page === "create" && <CreateInvoicePage />}
              {page === "invoices" && <InvoicesPage onPreview={openPreview} />}
              {page === "invoice-templates" && <InvoiceTemplatesPage onNavigate={setPage} />}
              {page === "item-templates" && <ItemTemplatesPage />}
              {page === "customers" && <CustomersPage />}
              {page === "settings" && <SettingsPage />}
            </div>
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}

const queryClient = new QueryClient();

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <StoreProvider>
          <Toaster position="top-right" richColors />
          <Dashboard />
        </StoreProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
