import { expect, test } from "vite-plus/test";
import { fetchTCMBRates } from "../src";

test("fetchTCMBRates is exported", () => {
  expect(typeof fetchTCMBRates).toBe("function");
});
