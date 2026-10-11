import { useEffect, useRef } from 'react';
import { onGIBLogin } from '@/lib/gib.ts';
import { useStore } from '@/lib/store.tsx';
import type { GIBIdentity } from '@/lib/types.ts';

const sameIdentity = (a: GIBIdentity | undefined, b: GIBIdentity) =>
  a?.name === b.name && a.taxID === b.taxID && a.taxOffice === b.taxOffice;

/**
 * Keeps, per company, the taxpayer its GİB account belongs to as GİB said at
 * each login, the app's and agents' alike. The company details never change
 * from it: Ayarlar and get_company_details only point out a difference.
 */
export function useLearnGIBIdentity() {
  const { entities, updateEntity } = useStore();
  const latest = useRef(entities);
  useEffect(() => {
    latest.current = entities;
  }, [entities]);

  useEffect(
    () =>
      onGIBLogin((username, identity) => {
        if (!identity) {
          return;
        }
        for (const entity of latest.current) {
          if (
            entity.creds.username.trim() === username.trim() &&
            !sameIdentity(entity.gibIdentity, identity)
          ) {
            updateEntity(entity.id, (current) => ({ ...current, gibIdentity: identity }));
          }
        }
      }),
    [updateEntity],
  );
}
