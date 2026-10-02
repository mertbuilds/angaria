import { useEffect } from 'react';
import { useStore } from '@/lib/store.tsx';
import { fillEmulatorSamples } from './emulator-seed.ts';

// Dev only, mounted while the emulator switch is on: turning it on reloads the
// app, so this covers both the switch and a launch with it on.

let seeded = false;

/** Fills the active company's empty fields with the emulator samples, once per launch. */
export default function EmulatorSeedOnStart() {
  const store = useStore();

  useEffect(() => {
    if (!seeded) {
      seeded = true;
      void fillEmulatorSamples(store, { quiet: true });
    }
  }, [store]);

  return null;
}
