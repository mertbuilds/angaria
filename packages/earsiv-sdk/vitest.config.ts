import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Starts the GİB emulator once on a random port for tests/emulator.test.ts.
    globalSetup: ['./tests/emulator-setup.ts'],
  },
});
