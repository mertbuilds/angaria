// The selection rule of SearchableList's useListSelection, free of React so
// tests can run it render by render.

export interface ListSelection {
  id: string | null;
  /** The search `id` was last listed under; null right after a pick. */
  query: string | null;
}

/**
 * The rows `query` lists and the selected one. A selection the search hides,
 * or none yet, falls back to the first row. A selected row edited so that it
 * no longer matches stays listed and selected until the search changes.
 * `next` is the selection to store, `selection` itself when nothing changed.
 */
export function listRows<T extends { id: string }>(
  items: ReadonlyArray<T>,
  query: string,
  matches: (item: T, query: string) => boolean,
  selection: ListSelection,
) {
  const kept = selection.query === null || selection.query === query ? selection.id : null;
  const visible = items.filter((item) => item.id === kept || matches(item, query));
  const selected = visible.find((item) => item.id === selection.id) ?? visible[0] ?? null;
  const next =
    selected && (selected.id !== selection.id || selection.query !== query)
      ? { id: selected.id, query }
      : selection;
  return { next, selected, visible };
}
