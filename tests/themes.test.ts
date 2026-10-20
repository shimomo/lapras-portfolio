import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, test } from "vitest";
import { loadThemes } from "../src/themes.js";

const fixtureThemes = fileURLToPath(
  new URL("./fixtures/themes", import.meta.url),
);

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "lapras-themes-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

test("loads theme directories with index.ts", async () => {
  const themes = await loadThemes(fixtureThemes);
  expect([...themes.keys()]).toEqual(["plain"]);
  const plain = themes.get("plain");
  expect(plain?.dir).toBe(join(fixtureThemes, "plain"));
  expect(plain?.theme.assets).toEqual(["plain.css"]);
});

test("directories without index.ts are ignored and names are sorted", async () => {
  for (const name of ["zeta", "alpha"]) {
    await mkdir(join(dir, name));
    await writeFile(
      join(dir, name, "index.ts"),
      "export default { assets: [], render: () => '' };\n",
    );
  }
  await mkdir(join(dir, "notes"));
  await writeFile(join(dir, "README.md"), "not a theme\n");
  expect([...(await loadThemes(dir)).keys()]).toEqual(["alpha", "zeta"]);
});

test("rejects a theme without a proper default export", async () => {
  await mkdir(join(dir, "broken"));
  await writeFile(join(dir, "broken", "index.ts"), "export default {};\n");
  await expect(loadThemes(dir)).rejects.toThrow(
    'テーマ "broken" の index.ts が Theme を default export していません',
  );
});
