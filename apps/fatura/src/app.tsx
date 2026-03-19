import { useState } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar, type Page } from "@/components/app-sidebar.tsx";
import { StoreProvider } from "@/lib/store.tsx";
import { CreateInvoicePage } from "@/pages/create-invoice.tsx";
import { InvoicesPage } from "@/pages/invoices.tsx";
import { TemplatesPage } from "@/pages/templates.tsx";
import { CustomersPage } from "@/pages/customers.tsx";
import { SettingsPage } from "@/pages/settings.tsx";

const pageConfig: Record<Page, { title: string; description: string }> = {
  create: { title: "Fatura Oluştur", description: "e-Arşiv fatura taslağı" },
  invoices: { title: "Faturalarım", description: "GİB portal faturaları" },
  templates: { title: "Şablonlar", description: "Fatura şablonları" },
  customers: { title: "Müşteriler", description: "Kayıtlı alıcılar" },
  settings: { title: "Ayarlar", description: "Uygulama yapılandırması" },
};

function Dashboard() {
  const [page, setPage] = useState<Page>("create");
  const config = pageConfig[page];

  return (
    <SidebarProvider>
      <AppSidebar activePage={page} onNavigate={setPage} />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur-sm">
          <SidebarTrigger />
          <div className="ml-1 flex items-baseline gap-2">
            <h1 className="text-sm font-semibold tracking-tight">{config.title}</h1>
            <span className="hidden text-xs text-muted-foreground sm:inline">
              {config.description}
            </span>
          </div>
        </header>
        <div className="flex-1 overflow-auto">
          <div className="mx-auto max-w-3xl px-6 py-8">
            {page === "create" && <CreateInvoicePage />}
            {page === "invoices" && <InvoicesPage />}
            {page === "templates" && <TemplatesPage onNavigate={setPage} />}
            {page === "customers" && <CustomersPage />}
            {page === "settings" && <SettingsPage />}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export function App() {
  return (
    <TooltipProvider>
      <StoreProvider>
        <Toaster position="top-right" richColors />
        <Dashboard />
      </StoreProvider>
    </TooltipProvider>
  );
}
