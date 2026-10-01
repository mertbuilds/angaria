import { expect, test } from 'vitest';
import { GIB_UNIT_TYPES as EMULATOR_UNIT_TYPES } from '../../../packages/gib-emulator/src/units.ts';
import { GIB_UNIT_TYPES } from '../src/lib/gib-constants.ts';

test('the GİB emulator knows every unit the app offers, by the same name', () => {
  expect(EMULATOR_UNIT_TYPES).toEqual(GIB_UNIT_TYPES);
});
