import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  SidebarMenuButton,
} from '@angaria/ui';
import { colors, font, radius } from '@angaria/ui/tokens.stylex';
import { create, props } from '@stylexjs/stylex';
import { Building2Icon, ChevronsUpDownIcon, PlusIcon } from 'lucide-react';
import { useStore } from '@/lib/store.tsx';

const styles = create({
  badge: {
    alignItems: 'center',
    backgroundColor: colors.subtle,
    borderRadius: `calc(${radius.base} - 2px)`,
    display: 'flex',
    flexShrink: 0,
    height: '1.75rem',
    justifyContent: 'center',
    width: '1.75rem',
  },
  chevron: {
    color: colors.muted,
    marginInlineStart: 'auto',
  },
  // The trigger's data-slot is the menu's, so the sidebar's icon sizing from
  // base.css does not reach these.
  icon: {
    flexShrink: 0,
    height: '1rem',
    width: '1rem',
  },
  detail: {
    color: colors.muted,
    fontSize: font.sizeXs,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  menu: {
    minWidth: '14rem',
  },
  name: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  text: {
    display: 'flex',
    flexDirection: 'column',
    lineHeight: 1.3,
    minWidth: 0,
  },
  trigger: {
    height: '2.75rem',
  },
});

/** The active entity (company) at the sidebar's foot; opens a menu to switch or add one. */
export function EntitySwitcher() {
  const { activeEntity, activeEntityId, createEntity, entities, setActiveEntityId } = useStore();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Varlık değiştir"
        render={<SidebarMenuButton style={styles.trigger} />}
      >
        <span {...props(styles.badge)}>
          <Building2Icon {...props(styles.icon)} />
        </span>
        <span {...props(styles.text)}>
          <span {...props(styles.name)}>{activeEntity.name}</span>
          <span {...props(styles.detail)}>
            {activeEntity.companyInfo.name || 'Firma bilgisi eklenmedi'}
          </span>
        </span>
        <ChevronsUpDownIcon {...props(styles.icon, styles.chevron)} />
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" style={styles.menu}>
        <DropdownMenuLabel>Varlıklar</DropdownMenuLabel>
        <DropdownMenuRadioGroup
          onValueChange={(value: string) => setActiveEntityId(value)}
          value={activeEntityId}
        >
          {entities.map((entity) => (
            <DropdownMenuRadioItem key={entity.id} value={entity.id}>
              <span {...props(styles.text)}>
                <span {...props(styles.name)}>{entity.name}</span>
                <span {...props(styles.detail)}>{entity.companyInfo.name || 'Boş varlık'}</span>
              </span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={createEntity}>
          <PlusIcon />
          Yeni varlık
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
