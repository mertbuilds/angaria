import { startEmulator } from '@angaria/gib-emulator';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    gibEmulatorUrl: string;
  }
}

export default async function setup(project: TestProject) {
  const emulator = await startEmulator();
  project.provide('gibEmulatorUrl', emulator.url);
  return () => emulator.close();
}
