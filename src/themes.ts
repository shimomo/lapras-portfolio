import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import type { Theme } from "./types.js";

export type LoadedTheme = { name: string; dir: string; theme: Theme };

const isTheme = (value: unknown): value is Theme =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as Theme).render === "function" &&
  Array.isArray((value as Theme).assets);

const hasIndex = (dir: string) =>
  stat(join(dir, "index.ts")).then(
    (s) => s.isFile(),
    () => false,
  );

// Every directory with an index.ts is a theme, so adding one never means
// editing a file that upstream also changes.
export async function loadThemes(
  themesDir: string,
): Promise<Map<string, LoadedTheme>> {
  const entries = await readdir(themesDir, { withFileTypes: true });
  const names = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();
  const themes = new Map<string, LoadedTheme>();
  for (const name of names) {
    const dir = join(themesDir, name);
    if (!(await hasIndex(dir))) continue;
    const module = await import(pathToFileURL(join(dir, "index.ts")).href);
    if (!isTheme(module.default)) {
      throw new Error(
        `テーマ "${name}" の index.ts が Theme を default export していません`,
      );
    }
    themes.set(name, { name, dir, theme: module.default });
  }
  return themes;
}
