import { copyFile, mkdir, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { Avatar } from "./lapras.js";
import type { LoadedTheme } from "./themes.js";
import type { PortfolioData } from "./types.js";

export async function writeSite(
  outDir: string,
  opts: { html: string; theme: LoadedTheme; avatar: Avatar | null },
): Promise<void> {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });
  await writeFile(join(outDir, "index.html"), opts.html);
  for (const asset of opts.theme.theme.assets) {
    await copyFile(join(opts.theme.dir, asset), join(outDir, asset));
  }
  if (opts.avatar) {
    await writeFile(
      join(outDir, `avatar.${opts.avatar.ext}`),
      opts.avatar.bytes,
    );
  }
}

export function snapshotPath(rootDir: string, laprasId: string): string {
  return join(rootDir, "data", laprasId, "portfolio.json");
}

// One directory per id, so a fork's data never collides with upstream's on
// "Sync fork".
export async function writeSnapshot(
  rootDir: string,
  data: PortfolioData,
): Promise<void> {
  const path = snapshotPath(rootDir, data.laprasId);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(data, null, 2)}\n`);
}
