import { expect, test } from "vitest";
import { isUnconfigured } from "../src/guard.js";

const config = (laprasId: string) => ({ laprasId, theme: "terminal" });

test("upstream id in another repository is unconfigured", () => {
  expect(isUnconfigured(config("shimomo"), "alice/lapras-portfolio")).toBe(
    true,
  );
});

test("upstream repository itself is configured", () => {
  expect(isUnconfigured(config("shimomo"), "shimomo/lapras-portfolio")).toBe(
    false,
  );
});

test("local runs are never skipped", () => {
  expect(isUnconfigured(config("shimomo"), undefined)).toBe(false);
});

test("own id is configured", () => {
  expect(isUnconfigured(config("alice"), "alice/lapras-portfolio")).toBe(false);
});
