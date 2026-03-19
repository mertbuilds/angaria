import { HugeiconsIcon } from "@hugeicons/react";
import {
  Invoice01Icon,
  FileAddIcon,
  ClipboardIcon,
  Settings01Icon,
  UserAccountIcon,
} from "@hugeicons/core-free-icons";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

export type Page = "create" | "invoices" | "templates" | "customers" | "settings";

const mainNav: { page: Page; label: string; icon: typeof Invoice01Icon }[] = [
  { page: "create", label: "Fatura Oluştur", icon: FileAddIcon },
  { page: "invoices", label: "Faturalarım", icon: Invoice01Icon },
];

const manageNav: { page: Page; label: string; icon: typeof Invoice01Icon }[] = [
  { page: "customers", label: "Müşteriler", icon: UserAccountIcon },
  { page: "templates", label: "Şablonlar", icon: ClipboardIcon },
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
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupLabel>Yönetim</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {manageNav.map((item) => (
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
        <SidebarSeparator />
        <SidebarGroup>
          <SidebarGroupContent>
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
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
