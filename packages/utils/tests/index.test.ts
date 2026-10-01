import { expect, test } from "vitest";
import { fetchTCMBRates } from "../src";

test("fetchTCMBRates is exported", () => {
  expect(typeof fetchTCMBRates).toBe("function");
});
