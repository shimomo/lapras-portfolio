import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { ConfigError, loadConfig, parseConfig } from "../src/config.js";

const themes = ["dashboard", "terminal"] as const;
const json = (value: unknown) => JSON.stringify(value);

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "lapras-config-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

test("parses lapras_id and theme", () => {
  expect(
    parseConfig(json({ lapras_id: "shimomo", theme: "dashboard" }), themes),
  ).toEqual({ laprasId: "shimomo", theme: "dashboard" });
});

test("theme defaults to terminal", () => {
  expect(parseConfig(json({ lapras_id: "shimomo" }), themes)).toEqual({
    laprasId: "shimomo",
    theme: "terminal",
  });
});

test("trims and accepts a pasted LAPRAS URL", () => {
  const config = parseConfig(
    json({ lapras_id: " https://lapras.com/public/shimomo.json " }),
    themes,
  );
  expect(config.laprasId).toBe("shimomo");
  expect(
    parseConfig(json({ lapras_id: "https://lapras.com/public/a_b-1/" }), themes)
      .laprasId,
  ).toBe("a_b-1");
});

test.each(["", "../etc", "a/b", "shimomo.json", 123, null])(
  "rejects lapras_id %s",
  (laprasId) => {
    const run = () => parseConfig(json({ lapras_id: laprasId }), themes);
    expect(run).toThrow(ConfigError);
    expect(run).toThrow("lapras_id が正しくありません");
  },
);

test("missing lapras_id is rejected", () => {
  expect(() => parseConfig(json({ theme: "terminal" }), themes)).toThrow(
    "lapras_id が正しくありません",
  );
});

test("unknown theme lists the available ones", () => {
  expect(() =>
    parseConfig(json({ lapras_id: "shimomo", theme: "neon" }), themes),
  ).toThrow('テーマ "neon" はありません。使えるテーマ: dashboard, terminal');
});

test("broken JSON reports the parse error", () => {
  try {
    parseConfig("{ lapras_id: shimomo", themes);
    expect.unreachable();
  } catch (error) {
    expect(error).toBeInstanceOf(ConfigError);
    expect((error as Error).message).toMatch(
      /^config\.json を JSON として読めませんでした: ./,
    );
  }
});

test("non-object JSON is rejected", () => {
  expect(() => parseConfig("[]", themes)).toThrow(
    "config.json の中身はオブジェクト（{ ... }）にしてください",
  );
});

test("loads from a file", async () => {
  const path = join(dir, "config.json");
  await writeFile(path, json({ lapras_id: "alice", theme: "terminal" }));
  expect(await loadConfig(path, themes)).toEqual({
    laprasId: "alice",
    theme: "terminal",
  });
});

test("missing file", async () => {
  await expect(loadConfig(join(dir, "nope.json"), themes)).rejects.toThrow(
    "config.json が見つかりません。リポジトリの直下に置いてください",
  );
});
