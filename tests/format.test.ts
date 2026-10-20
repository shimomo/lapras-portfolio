import { expect, test } from "vitest";
import { formatScore, initials, topPercent } from "../src/format.js";
import { shape } from "../src/shape.js";

const person = (name: string, laprasId: string) =>
  shape({ name }, laprasId).data;

test("topPercent", () => {
  expect(topPercent(80.7)).toBe(19);
  expect(topPercent(99.9)).toBe(1);
  expect(topPercent(null)).toBeNull();
});

test("formatScore keeps two decimals", () => {
  expect(formatScore(3)).toBe("3.00");
  expect(formatScore(3.43)).toBe("3.43");
});

test("initials", () => {
  expect(initials(person("Yuichi Shimo", "shimomo"))).toBe("YS");
  expect(initials(person("John Ronald Reuel Tolkien", "jrr"))).toBe("JRR");
  expect(initials(person("下 雄一", "shimomo"))).toBe("S");
  expect(initials(person("下 雄一", "foo-bar_baz"))).toBe("FBB");
  expect(initials(person("yuichi 下", "x"))).toBe("Y");
});
