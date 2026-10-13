import { describe, expect, test } from 'vitest';
import { listRows, type ListSelection } from '../src/shell/list-selection.ts';

interface Row {
  id: string;
  name: string;
}

const matches = (row: Row, query: string) => row.name.toLowerCase().includes(query.toLowerCase());

/** Renders like useListSelection: until the stored selection stops changing. */
function render(items: ReadonlyArray<Row>, query: string, selection: ListSelection) {
  let current = selection;
  for (;;) {
    const { next, selected, visible } = listRows(items, query, matches, current);
    if (next === current) {
      return {
        selected: selected?.id ?? null,
        selection: current,
        visible: visible.map((row) => row.id),
      };
    }
    current = next;
  }
}

const customers: ReadonlyArray<Row> = [
  { id: 'acme', name: 'Acme' },
  { id: 'beta', name: 'Beta' },
  { id: 'acme-two', name: 'Acme Two' },
];
const nothing: ListSelection = { id: null, query: null };

describe('listRows', () => {
  test('selects the first match, and the first match again when a search hides the pick', () => {
    const first = render(customers, '', nothing);
    expect(first.selected).toBe('acme');

    const picked = render(customers, '', { id: 'beta', query: null });
    expect(picked.selected).toBe('beta');

    const searched = render(customers, 'acme', picked.selection);
    expect(searched).toMatchObject({ selected: 'acme', visible: ['acme', 'acme-two'] });
  });

  test('keeps a row edited out of the search selected and listed until the search changes', () => {
    const picked = render(customers, 'acme', { id: 'acme-two', query: null });
    expect(picked).toMatchObject({ selected: 'acme-two', visible: ['acme', 'acme-two'] });

    const edited = customers.map((row) => (row.id === 'acme-two' ? { ...row, name: 'Zeta' } : row));
    const afterEdit = render(edited, 'acme', picked.selection);
    expect(afterEdit).toMatchObject({ selected: 'acme-two', visible: ['acme', 'acme-two'] });

    const newSearch = render(edited, 'acm', afterEdit.selection);
    expect(newSearch).toMatchObject({ selected: 'acme', visible: ['acme'] });
  });

  test('moves to the first row when the selected one is deleted', () => {
    const picked = render(customers, '', { id: 'beta', query: null });
    const deleted = render(
      customers.filter((row) => row.id !== 'beta'),
      '',
      picked.selection,
    );
    expect(deleted.selected).toBe('acme');
  });

  test('keeps a pick for a list that is still loading', () => {
    const waiting = render([], '', { id: 'acme-two', query: null });
    expect(waiting.selected).toBeNull();
    expect(render(customers, '', waiting.selection).selected).toBe('acme-two');
  });
});
