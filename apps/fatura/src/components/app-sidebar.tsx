import { useCallback } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { HugeiconsIcon } from "@hugeicons/react";
import {
  Invoice01Icon,
  FileAddIcon,
  ClipboardIcon,
  Settings01Icon,
  UserAccountIcon,
  AddToListIcon,
} from "@hugeicons/core-free-icons";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export type Page =
  | "create"
  | "invoices"
  | "invoice-templates"
  | "item-templates"
  | "customers"
  | "settings";

const mainNav: { page: Page; label: string; icon: typeof Invoice01Icon }[] = [
  { page: "create", label: "Fatura Oluştur", icon: FileAddIcon },
  { page: "invoices", label: "Faturalarım", icon: Invoice01Icon },
];

const templateNav: { page: Page; label: string; icon: typeof Invoice01Icon }[] = [
  { page: "invoice-templates", label: "Faturalar", icon: ClipboardIcon },
  { page: "item-templates", label: "Kalemler", icon: AddToListIcon },
  { page: "customers", label: "Müşteriler", icon: UserAccountIcon },
];

export function AppSidebar({
  activePage,
  onNavigate,
}: {
  activePage: Page;
  onNavigate: (page: Page) => void;
}) {
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

  return (
    <Sidebar>
      <SidebarHeader className="px-4 pt-9 pb-5" onMouseDown={handleDrag}>
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <span className="text-sm font-bold">A</span>
          </div>
          <div>
            <span className="text-base font-bold tracking-tight">Angaria</span>
            <p className="text-[10px] leading-none text-muted-foreground">e-Arşiv Fatura</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Faturalama</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => (
                <SidebarMenuItem key={item.page}>
                  <SidebarMenuButton
                    isActive={activePage === item.page}
                    onClick={() => onNavigate(item.page)}
                    tooltip={item.label}
                  >
                    <HugeiconsIcon icon={item.icon} strokeWidth={1.5} />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Şablonlar</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {templateNav.map((item) => (
                <SidebarMenuItem key={item.page}>
                  <SidebarMenuButton
                    isActive={activePage === item.page}
                    onClick={() => onNavigate(item.page)}
                    tooltip={item.label}
                  >
                    <HugeiconsIcon icon={item.icon} strokeWidth={1.5} />
                    <span>{item.label}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={activePage === "settings"}
              onClick={() => onNavigate("settings")}
              tooltip="Ayarlar"
            >
              <HugeiconsIcon icon={Settings01Icon} strokeWidth={1.5} />
              <span>Ayarlar</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="px-2 pb-1 pt-2">
          <p className="text-[10px] text-muted-foreground/60">Angaria v0.1.0</p>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
