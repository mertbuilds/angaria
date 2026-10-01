import type { ReactNode } from 'react';

/**
 * Where a link stands inside a sentence. The message carries the link as a
 * placeholder and is split on it, so the words around it keep their own order
 * and spacing instead of being stitched together from pieces.
 */
const SLOT = '\u0000';

export function Sentence({
  message,
  slot,
}: {
  message: (slot: string) => string;
  slot: ReactNode;
}) {
  const [before, after] = message(SLOT).split(SLOT);
  return (
    <>
      {before}
      {slot}
      {after}
    </>
  );
}
