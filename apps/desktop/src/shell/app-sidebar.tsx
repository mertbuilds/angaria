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
import { create, props } from '@stylexjs/stylex';
import { Link, useMatchRoute } from '@tanstack/react-router';
import { SearchIcon } from 'lucide-react';
import { appIcon } from '@/lib/app-icon.ts';
import { useStore } from '@/lib/store.tsx';
import { EntitySwitcher } from './entity-switcher.tsx';
import { sections, type Section } from './nav.ts';
import { tones } from './palette.stylex.ts';
import { shell } from './shell.stylex.ts';

const styles = create({
  active: {
    backgroundColor: tones.navActive,
    color: tones.navActiveForeground,
  },
  activeIcon: {
    color: tones.navActiveIcon,
  },
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
  const isActive = Boolean(matchRoute({ fuzzy: true, to: section.to }));

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        isActive={isActive}
        render={<Link to={section.to} />}
        style={isActive ? styles.active : undefined}
      >
        <section.icon {...props(isActive && styles.activeIcon)} />
        {section.label}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/**
 * The app's source list: icon and wordmark under the traffic lights, ⌘K search, the
 * sections, then Ayarlar at the foot, and the company switcher once there are
 * two companies (Ayarlar › Şirketler adds them).
 */
export function AppSidebar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const { entities } = useStore();
  const settings = sections.find((section) => section.to === '/ayarlar');

  return (
    <Sidebar>
      <SidebarHeader data-tauri-drag-region style={styles.header}>
        <Wordmark icon={appIcon} style={styles.wordmark} />
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
          {entities.length > 1 && (
            <SidebarMenuItem>
              <EntitySwitcher />
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
