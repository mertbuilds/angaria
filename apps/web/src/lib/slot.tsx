import { Fragment, type ReactNode } from 'react';

/**
 * Where links stand inside a sentence. The message carries each link as a
 * placeholder and is split on them, so the words around them keep their own
 * order and spacing instead of being stitched together from pieces.
 */
const marker = (index: number) => `\uE000${index}\uE000`;
const MARKERS = /\uE000(\d+)\uE000/;

export function Sentence({
  message,
  slots,
}: {
  message: (...slots: Array<string>) => string;
  slots: ReadonlyArray<ReactNode>;
}) {
  // Split with a capture group: text, slot index, text, slot index, text.
  const parts = message(...slots.map((_, index) => marker(index))).split(MARKERS);
  return parts.map((part, index) => (
    <Fragment key={index}>{index % 2 === 0 ? part : slots[Number(part)]}</Fragment>
  ));
}
