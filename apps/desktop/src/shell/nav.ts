import {
  FilePlusIcon,
  FileTextIcon,
  PackageIcon,
  PlugIcon,
  SettingsIcon,
  UsersIcon,
} from 'lucide-react';

/**
 * The app's sections, in sidebar order. `key` is the digit of the ⌘1-6
 * shortcut; `shortcut` is the hint shown next to the item.
 */
export const sections = [
  { icon: FileTextIcon, key: '1', label: 'Faturalar', shortcut: '⌘1', to: '/faturalar' },
  { icon: FilePlusIcon, key: '2', label: 'Yeni fatura', shortcut: '⌘N', to: '/yeni' },
  { icon: UsersIcon, key: '3', label: 'Müşteriler', shortcut: '⌘3', to: '/musteriler' },
  { icon: PackageIcon, key: '4', label: 'Hizmetler', shortcut: '⌘4', to: '/hizmetler' },
  { icon: PlugIcon, key: '5', label: 'MCP', shortcut: '⌘5', to: '/mcp' },
  { icon: SettingsIcon, key: '6', label: 'Ayarlar', shortcut: '⌘,', to: '/ayarlar' },
] as const;

export type Section = (typeof sections)[number];

export type SectionPath = Section['to'];
