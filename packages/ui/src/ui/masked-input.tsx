'use client';

import type { MaskitoOptions, MaskitoPreprocessor } from '@maskito/core';
import { useMaskito } from '@maskito/react';
import { useCallback, useMemo } from 'react';
import { Input, type InputProps } from './input.tsx';

export type MaskedInputProps = InputProps & {
  /** A fixed-shape mask (IBAN, phone, GTİP). Keep it a stable module constant. */
  mask: MaskitoOptions;
};

/**
 * Typed and pasted text loses its spaces (the mask puts its own back) and is
 * upper-cased, so `tr33 0006 1005…` fills an IBAN mask. Masks here are for
 * fixed-shape IDs only, where case never matters.
 */
const normalizeInsert: MaskitoPreprocessor = ({ data, elementState }, actionType) =>
  actionType === 'insert'
    ? { data: data.replaceAll(/\s/g, '').toUpperCase(), elementState }
    : { data, elementState };

/** An Input with a Maskito mask for a fixed-shape ID. */
const MaskedInput = ({ mask, ref, ...props }: MaskedInputProps) => {
  const options = useMemo(
    () => ({ ...mask, preprocessors: [normalizeInsert, ...(mask.preprocessors ?? [])] }),
    [mask],
  );
  const maskRef = useMaskito({ options });
  const mergedRef = useCallback(
    (element: HTMLInputElement | null) => {
      maskRef(element);
      if (typeof ref === 'function') {
        ref(element);
      } else if (ref) {
        ref.current = element;
      }
    },
    [maskRef, ref],
  );
  return <Input autoCorrect="off" ref={mergedRef} spellCheck={false} {...props} />;
};

export { MaskedInput };
