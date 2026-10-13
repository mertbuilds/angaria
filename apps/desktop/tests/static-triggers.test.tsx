// @vitest-environment jsdom
import {
  AlertDialog,
  AlertDialogTrigger,
  Button,
  Combobox,
  ComboboxInput,
  DateField,
  Dialog,
  DialogTrigger,
  DropdownMenu,
  DropdownMenuTrigger,
  Popover,
  PopoverTrigger,
  Select,
  SelectTrigger,
  SelectValue,
  SplitButton,
  Tooltip,
  TooltipTrigger,
} from '@angaria/ui';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, expect, test, vi } from 'vitest';

// Popup triggers never move: Base UI measures the trigger as its popup opens,
// so a trigger that shrinks on press opens the popup off by the press, and the
// popup jumps when the trigger springs back. Tests run StyleX with runtime
// injection, so the kit's real CSS is in the document.

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
vi.stubGlobal(
  'ResizeObserver',
  class {
    disconnect() {}
    observe() {}
    unobserve() {}
  },
);

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const render = (node: ReactNode) => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  act(() => root?.render(node));
};

const POINTER_STATE = /:active|:hover/g;
const GEOMETRY =
  /^(?:scale|rotate|translate|transform|zoom|width|height|(?:min|max)-(?:width|height)|inset.*|top|right|bottom|left|margin.*|padding.*|border(?:-[a-z]+)*-width|font-(?:size|weight)|letter-spacing|line-height)$/;

const isStyleRule = (rule: CSSRule): rule is CSSStyleRule => 'selectorText' in rule;

/**
 * The geometry declarations of the rules that apply to `element`: with
 * `pressed`, only the rules under :active or :hover (as if the pointer were
 * on it and down, or on `target` and down: then only `target` and its
 * ancestors are pressed); without, the rest.
 */
function geometry(element: Element, pressed: boolean, target?: Element) {
  const pointed: Array<Element> = [];
  for (let node = target ?? null; node; node = node.parentElement) {
    node.setAttribute('data-pointer', '');
    pointed.push(node);
  }
  const state = target ? '[data-pointer]' : '';
  const found: Array<string> = [];
  const visit = (rules: CSSRuleList) => {
    for (const rule of rules) {
      if (isStyleRule(rule)) {
        const selector = rule.selectorText.replaceAll(POINTER_STATE, state);
        const onPointer = selector !== rule.selectorText;
        if (onPointer === pressed && element.matches(selector)) {
          for (const property of rule.style) {
            if (GEOMETRY.test(property)) {
              found.push(`${property}: ${rule.style.getPropertyValue(property)}`);
            }
          }
        }
      } else if ('cssRules' in rule) {
        visit(rule.cssRules as CSSRuleList);
      }
    }
  };
  for (const sheet of document.styleSheets) {
    visit(sheet.cssRules);
  }
  for (const node of pointed) {
    node.removeAttribute('data-pointer');
  }
  return found;
}

const trigger = (label: string) => {
  const element = document.querySelector(`[aria-label="${label}"]`);
  if (!element) {
    throw new Error(`No trigger labelled ${label}`);
  }
  return element;
};

const triggers: Array<{ label: string; name: string; node: ReactNode }> = [
  {
    label: 'Menü',
    name: 'DropdownMenuTrigger with a Button',
    node: (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button aria-label="Menü" variant="outline" />}>
          Son 3 ay
        </DropdownMenuTrigger>
      </DropdownMenu>
    ),
  },
  {
    label: 'İndirme seçenekleri',
    name: 'DropdownMenuTrigger with an icon Button',
    node: (
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button aria-label="İndirme seçenekleri" size="icon" />} />
      </DropdownMenu>
    ),
  },
  {
    label: 'Kur bilgisi',
    name: 'PopoverTrigger with a Button',
    node: (
      <Popover>
        <PopoverTrigger render={<Button aria-label="Kur bilgisi" variant="outline" />}>
          Kur
        </PopoverTrigger>
      </Popover>
    ),
  },
  {
    label: 'Yenile',
    name: 'TooltipTrigger with a Button',
    node: (
      <Tooltip>
        <TooltipTrigger render={<Button aria-label="Yenile" size="icon" variant="ghost" />} />
      </Tooltip>
    ),
  },
  {
    label: 'Müşteri ekle',
    name: 'DialogTrigger with a Button',
    node: (
      <Dialog>
        <DialogTrigger render={<Button aria-label="Müşteri ekle" variant="outline" />}>
          Ekle
        </DialogTrigger>
      </Dialog>
    ),
  },
  {
    label: 'Sil',
    name: 'AlertDialogTrigger with a Button',
    node: (
      <AlertDialog>
        <AlertDialogTrigger render={<Button aria-label="Sil" variant="destructive" />}>
          Sil
        </AlertDialogTrigger>
      </AlertDialog>
    ),
  },
  {
    label: 'Durum',
    name: 'SelectTrigger',
    node: (
      <Select defaultValue="all">
        <SelectTrigger aria-label="Durum" size="sm">
          <SelectValue />
        </SelectTrigger>
      </Select>
    ),
  },
  {
    label: 'Listeyi aç',
    name: 'ComboboxTrigger',
    node: (
      <Combobox items={['Ankara', 'İzmir']}>
        <ComboboxInput aria-label="Şehir" />
      </Combobox>
    ),
  },
  {
    label: 'Temizle',
    name: 'ComboboxClear',
    node: (
      <Combobox defaultValue="Ankara" items={['Ankara', 'İzmir']}>
        <ComboboxInput aria-label="Şehir" showClear />
      </Combobox>
    ),
  },
  {
    label: 'Takvimi aç',
    name: 'the DateField calendar button',
    node: <DateField aria-label="Tarih" id="tarih" onChange={() => {}} value={null} />,
  },
  {
    label: 'İndirme seçenekleri',
    name: 'the SplitButton menu half',
    node: (
      <SplitButton menu={null} menuLabel="İndirme seçenekleri">
        İndir
      </SplitButton>
    ),
  },
  {
    label: 'Seçenekler',
    name: 'a Button that names its popup itself',
    node: <Button aria-expanded={false} aria-haspopup="menu" aria-label="Seçenekler" />,
  },
  {
    label: 'Bağlantı',
    name: 'a Button with pressMotion off',
    node: <Button aria-label="Bağlantı" pressMotion={false} />,
  },
];

test('a plain Button still shrinks on press', () => {
  render(<Button aria-label="Kaydet">Kaydet</Button>);
  expect(geometry(trigger('Kaydet'), true)).toEqual(['scale: 0.96']);
});

test.each(triggers)('$name never moves on press or hover', ({ label, node }) => {
  render(node);
  expect(geometry(trigger(label), true)).toEqual([]);
});

test('a Button trigger keeps its geometry while its menu is open', () => {
  render(
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button aria-label="Menü" variant="outline" />}>
        Son 3 ay
      </DropdownMenuTrigger>
    </DropdownMenu>,
  );
  const element = trigger('Menü');
  const closed = geometry(element, false);
  act(() => (element as HTMLElement).click());
  expect(element.getAttribute('aria-expanded')).toBe('true');
  expect(geometry(element, false)).toEqual(closed);
  expect(geometry(element, true)).toEqual([]);
});

const renderSplitButton = () => {
  render(
    <SplitButton menu={null} menuLabel="İndirme seçenekleri">
      İndir
    </SplitButton>,
  );
  const menu = trigger('İndirme seçenekleri');
  const group = menu.closest('[data-slot="split-button"]');
  const main = group?.querySelector('[data-split-main]');
  if (!group || !main) {
    throw new Error('No SplitButton');
  }
  return { group, main, menu };
};

test('a SplitButton shrinks as one piece when its main half is pressed', () => {
  const { group, main, menu } = renderSplitButton();
  expect(geometry(group, true, main)).toContain('scale: 0.96');
  expect(geometry(main, true, main)).toEqual([]);
  expect(geometry(menu, true, main)).toEqual([]);
});

test('a SplitButton moves nothing when its menu half is pressed', () => {
  const { group, main, menu } = renderSplitButton();
  for (const element of [group, main, menu]) {
    expect(geometry(element, true, menu)).toEqual([]);
  }
});
