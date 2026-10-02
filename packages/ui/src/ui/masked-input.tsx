'use client';

import type { MaskitoOptions } from '@maskito/core';
import { useMaskito } from '@maskito/react';
import { useCallback } from 'react';
import { Input, type InputProps } from './input.tsx';

export type MaskedInputProps = InputProps & {
  /** A fixed-shape mask (IBAN, phone, GTİP). Keep it a stable module constant. */
  mask: MaskitoOptions;
};

/**
 * An Input with a Maskito mask. Not implemented yet: paste normalization.
 */
const MaskedInput = ({ mask, ref, ...props }: MaskedInputProps) => {
  const maskRef = useMaskito({ options: mask });
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
  return <Input ref={mergedRef} {...props} />;
};

export { MaskedInput };
