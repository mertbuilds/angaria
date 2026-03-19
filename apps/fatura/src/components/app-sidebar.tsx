import { HugeiconsIcon } from "@hugeicons/react";
import {
  Invoice01Icon,
  FileAddIcon,
  ClipboardIcon,
  Settings01Icon,
} from "@hugeicons/core-free-icons";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export type Page = "create" | "invoices" | "templates" | "settings";

const navItems: { page: Page; label: string; icon: typeof Invoice01Icon }[] = [
  { page: "create", label: "Fatura Oluştur", icon: FileAddIcon },
  { page: "invoices", label: "Faturalarım", icon: Invoice01Icon },
  { page: "templates", label: "Şablonlar", icon: ClipboardIcon },
  { page: "settings", label: "Ayarlar", icon: Settings01Icon },
];

export function AppSidebar({
  activePage,
  onNavigate,
}: {
  activePage: Page;
  onNavigate: (page: Page) => void;
}) {
  return (
    <Sidebar>
      <SidebarHeader className="px-4 py-5">
        <span className="text-lg font-bold tracking-tight">Angaria</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
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
    </Sidebar>
  );
}
