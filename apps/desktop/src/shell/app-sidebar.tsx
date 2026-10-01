import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  Wordmark,
} from '@angaria/ui';
import { font, spacing } from '@angaria/ui/tokens.stylex';
import { create } from '@stylexjs/stylex';
import { Link, useMatchRoute } from '@tanstack/react-router';
import { SearchIcon } from 'lucide-react';
import { useStore } from '@/lib/store.tsx';
import { EntitySwitcher } from './entity-switcher.tsx';
import { sections, type Section } from './nav.ts';
import { shell } from './shell.stylex.ts';

const styles = create({
  header: {
    paddingBottom: spacing.s2,
    paddingInline: spacing.s4,
    paddingTop: shell.toolbarHeight,
  },
  wordmark: {
    fontSize: font.sizeLg,
    // Clicks fall through to the header, so the wordmark drags the window too.
    pointerEvents: 'none',
  },
});

function SectionItem({ section }: { section: Section }) {
  const matchRoute = useMatchRoute();
  const { resetInvoiceForm } = useStore();
  const isActive = Boolean(matchRoute({ fuzzy: true, to: section.to }));

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        // Yeni fatura always starts a blank form, as it did before the router.
        onClick={section.to === '/yeni' ? resetInvoiceForm : undefined}
        render={<Link to={section.to} />}
      >
        <section.icon />
        {section.label}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/**
 * The app's source list: wordmark under the traffic lights, ⌘K search, the
 * sections, then Ayarlar and the entity switcher at the foot.
 */
export function AppSidebar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const settings = sections.find((section) => section.to === '/ayarlar');

  return (
    <Sidebar>
      <SidebarHeader data-tauri-drag-region style={styles.header}>
        <Wordmark style={styles.wordmark} />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={onOpenPalette}>
                <SearchIcon />
                Ara
                <SidebarMenuBadge>⌘K</SidebarMenuBadge>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarMenu>
            {sections
              .filter((section) => section !== settings)
              .map((section) => (
                <SectionItem key={section.to} section={section} />
              ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          {settings && <SectionItem section={settings} />}
          <SidebarMenuItem>
            <EntitySwitcher />
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
