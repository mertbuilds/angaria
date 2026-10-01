import { Cancel01Icon, ReloadIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from '@tanstack/react-query';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { Copy } from 'lucide-react';
import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Toaster } from 'sonner';
import { AppSidebar, type Page } from '@/components/app-sidebar.tsx';
import { LicenseGate } from '@/components/license-gate.tsx';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { TooltipProvider } from '@/components/ui/tooltip';
import * as angaria from '@/lib/angaria.ts';
import { LicenseProvider } from '@/lib/license-context.tsx';
import { StoreProvider, useStore } from '@/lib/store.tsx';
import { CreateInvoicePage } from '@/pages/create-invoice.tsx';
import { CustomersPage } from '@/pages/customers.tsx';
import { InvoiceTemplatesPage } from '@/pages/invoice-templates.tsx';
import { InvoicesPage, type Invoice } from '@/pages/invoices.tsx';
import { ItemTemplatesPage } from '@/pages/item-templates.tsx';
import { SettingsPage } from '@/pages/settings.tsx';

const pageConfig: Record<Page, { description: string; title: string }> = {
  create: { title: 'Fatura Oluştur', description: 'e-Arşiv fatura taslağı' },
  invoices: { title: 'Faturalarım', description: 'GİB portal faturaları' },
  'invoice-templates': { title: 'Fatura Şablonları', description: 'Kayıtlı fatura şablonları' },
  'item-templates': { title: 'Kalem Şablonları', description: 'Kayıtlı kalem şablonları' },
  customers: { title: 'Müşteriler', description: 'Kayıtlı alıcılar' },
  settings: { title: 'Ayarlar', description: 'Uygulama yapılandırması' },
};

interface PreviewTab {
  html: string | null;
  id: string;
  label: string;
}

function Dashboard() {
  const { creds, activeEntityId, resetInvoiceForm, templateEditMode, loadFromGIBInvoice } =
    useStore();
  const [page, setPage] = useState<Page>('create');
  const [previewTabs, setPreviewTabs] = useState<Array<PreviewTab>>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [showCredsAlert, setShowCredsAlert] = useState(false);
  const [loadingTemplate, setLoadingTemplate] = useState(false);

  const requireCredentials = useCallback((): boolean => {
    if (creds.username && creds.password) {
      return true;
    }
    setShowCredsAlert(true);
    return false;
  }, [creds.username, creds.password]);

  const isOnPreview = activeTabId !== null;
  const rawConfig = pageConfig[page];
  const config =
    page === 'create' && templateEditMode
      ? { title: 'Şablon Düzenle', description: 'Faturadan şablon oluştur' }
      : rawConfig;

  const handleDrag = useCallback((e: React.MouseEvent) => {
    if (e.buttons !== 1) {
      return;
    }
    const target = e.target as HTMLElement;
    if (target.closest('button, a, input, [role=button]')) {
      return;
    }
    if (e.detail === 2) {
      void getCurrentWindow().toggleMaximize();
    } else {
      void getCurrentWindow().startDragging();
    }
  }, []);

  async function openPreview(invoice: Invoice) {
    const uuid = invoice.ettn ?? '';
    const existing = previewTabs.find((t) => t.id === uuid);
    if (existing) {
      setActiveTabId(uuid);
      return;
    }
    if (!requireCredentials()) {
      return;
    }

    const label = invoice.belgeNumarasi || invoice.aliciUnvanAdSoyad || 'Fatura';
    setPreviewTabs((prev) => {
      const next = [...prev, { id: uuid, label, html: null }];
      return next.length > 5 ? next.slice(-5) : next;
    });
    setActiveTabId(uuid);

    try {
      const session = await angaria.login(creds.username, creds.password, creds.testMode);
      try {
        const html = await angaria.getInvoiceHTML(session, uuid, invoice.onayDurumu ?? '');
        setPreviewTabs((prev) => prev.map((t) => (t.id === uuid ? { ...t, html } : t)));
      } finally {
        angaria.logout(session).catch(() => {});
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bilinmeyen hata');
      setPreviewTabs((prev) => prev.filter((t) => t.id !== uuid));
      setActiveTabId(null);
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

  async function usePreviewAsTemplate(ettn: string) {
    if (!requireCredentials()) {
      return;
    }
    setLoadingTemplate(true);
    try {
      const session = await angaria.login(creds.username, creds.password, creds.testMode);
      try {
        const detail = await angaria.getInvoiceDetail(session, ettn);
        loadFromGIBInvoice(detail);
        setActiveTabId(null);
        setPage('create');
      } finally {
        angaria.logout(session).catch(() => {});
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Fatura detayı alınamadı');
    } finally {
      setLoadingTemplate(false);
    }
  }

  const activePreview = previewTabs.find((t) => t.id === activeTabId);

  useEffect(() => {
    resetInvoiceForm();
    setPreviewTabs([]);
    setActiveTabId(null);
  }, [activeEntityId, resetInvoiceForm]);

  return (
    <SidebarProvider>
      <AppSidebar
        activePage={page}
        onNavigate={(p) => {
          if (p === 'create') {
            resetInvoiceForm();
          }
          setPage(p);
          setActiveTabId(null);
        }}
      />
      <SidebarInset className="h-screen overflow-hidden">
        {/* Titlebar + tab bar — draggable region */}
        <header
          className="flex h-11 shrink-0 items-center border-b bg-background/80 backdrop-blur-sm"
          onMouseDown={handleDrag}
        >
          {previewTabs.length > 0 ? (
            <>
              <div className="flex h-full items-stretch">
                <button
                  className={`flex items-center border-r px-4 text-xs font-medium transition-colors ${
                    !isOnPreview
                      ? 'bg-muted text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                  onClick={() => setActiveTabId(null)}
                  type="button"
                >
                  {config.title}
                </button>
                {previewTabs.map((tab) => (
                  <div
                    className={`group flex items-center gap-1.5 border-r px-3 text-xs transition-colors ${
                      activeTabId === tab.id
                        ? 'bg-muted text-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                    key={tab.id}
                  >
                    <button
                      className="max-w-36 truncate"
                      onClick={() => setActiveTabId(tab.id)}
                      type="button"
                    >
                      {tab.label}
                    </button>
                    <button
                      className="rounded-sm text-transparent transition-colors group-hover:text-muted-foreground hover:!bg-muted-foreground/10 hover:!text-foreground"
                      onClick={() => closeTab(tab.id)}
                      type="button"
                    >
                      <HugeiconsIcon className="size-3" icon={Cancel01Icon} strokeWidth={2} />
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
        </header>

        {/* Content */}
        {isOnPreview && activePreview ? (
          activePreview.html ? (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex shrink-0 items-center justify-end border-b px-3 py-1.5">
                <Button
                  disabled={loadingTemplate}
                  onClick={() => usePreviewAsTemplate(activePreview.id)}
                  size="sm"
                  variant="outline"
                >
                  <Copy className="size-4" />
                  {loadingTemplate ? 'Yükleniyor...' : 'Şablon olarak kullan'}
                </Button>
              </div>
              <iframe className="flex-1" srcDoc={activePreview.html} title="Fatura önizleme" />
            </div>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <HugeiconsIcon
                className="size-6 animate-spin text-muted-foreground"
                icon={ReloadIcon}
                strokeWidth={1.5}
              />
            </div>
          )
        ) : (
          <div className="flex-1 overflow-auto">
            <div className="mx-auto max-w-3xl px-6 py-8">
              {page === 'create' && <CreateInvoicePage requireCredentials={requireCredentials} />}
              {page === 'invoices' && (
                <InvoicesPage
                  onNavigate={setPage}
                  onPreview={openPreview}
                  requireCredentials={requireCredentials}
                />
              )}
              {page === 'invoice-templates' && <InvoiceTemplatesPage onNavigate={setPage} />}
              {page === 'item-templates' && <ItemTemplatesPage />}
              {page === 'customers' && <CustomersPage />}
              {page === 'settings' && <SettingsPage />}
            </div>
          </div>
        )}
      </SidebarInset>

      <AlertDialog onOpenChange={setShowCredsAlert} open={showCredsAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>GİB Kimlik Bilgileri Gerekli</AlertDialogTitle>
            <AlertDialogDescription>
              Bu işlemi gerçekleştirmek için GİB kullanıcı adı ve şifrenizi girmeniz gerekiyor.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setPage('settings');
                setActiveTabId(null);
              }}
            >
              Ayarlara Git
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </SidebarProvider>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (query.meta?.onError) {
        toast.error(error instanceof Error ? error.message : 'Bilinmeyen hata');
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Bilinmeyen hata');
    },
  }),
});

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <LicenseProvider>
          <StoreProvider>
            <Toaster position="top-right" richColors />
            <LicenseGate>
              <Dashboard />
            </LicenseGate>
          </StoreProvider>
        </LicenseProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
