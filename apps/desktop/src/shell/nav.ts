import { FilePlusIcon, FileTextIcon, SettingsIcon, UsersIcon } from 'lucide-react';

/**
 * The app's sections, in sidebar order. `key` is the digit of the ⌘1-4
 * shortcut; `shortcut` is the hint shown next to the item.
 */
export const sections = [
  { icon: FileTextIcon, key: '1', label: 'Faturalar', shortcut: '⌘1', to: '/faturalar' },
  { icon: FilePlusIcon, key: '2', label: 'Yeni fatura', shortcut: '⌘N', to: '/yeni' },
  { icon: UsersIcon, key: '3', label: 'Müşteriler', shortcut: '⌘3', to: '/musteriler' },
  { icon: SettingsIcon, key: '4', label: 'Ayarlar', shortcut: '⌘,', to: '/ayarlar' },
] as const;

export type Section = (typeof sections)[number];

export type SectionPath = Section['to'];
