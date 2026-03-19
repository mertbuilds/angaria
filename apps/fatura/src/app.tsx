import { useState } from "react";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar, type Page } from "@/components/app-sidebar.tsx";
import { StoreProvider } from "@/lib/store.tsx";
import { CreateInvoicePage } from "@/pages/create-invoice.tsx";
import { InvoicesPage } from "@/pages/invoices.tsx";
import { TemplatesPage } from "@/pages/templates.tsx";
import { CustomersPage } from "@/pages/customers.tsx";
import { SettingsPage } from "@/pages/settings.tsx";

const pageTitles: Record<Page, string> = {
  create: "Fatura Oluştur",
  invoices: "Faturalarım",
  templates: "Şablonlar",
  customers: "Müşteriler",
  settings: "Ayarlar",
};

function Dashboard() {
  const [page, setPage] = useState<Page>("create");

  return (
    <SidebarProvider>
      <AppSidebar activePage={page} onNavigate={setPage} />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <span className="text-sm font-medium">{pageTitles[page]}</span>
        </header>
        <div className="flex-1 overflow-auto p-6">
          <div className="mx-auto max-w-3xl">
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
