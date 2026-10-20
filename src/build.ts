import { join } from "node:path";
import { loadConfig } from "./config.js";
import { isUnconfigured, UNCONFIGURED_MESSAGE } from "./guard.js";
import { fetchAvatar, fetchLapras, type Http, type Sleep } from "./lapras.js";
import { shape } from "./shape.js";
import { writeSite, writeSnapshot } from "./site.js";
import { loadThemes } from "./themes.js";
import type { PortfolioData } from "./types.js";

export type BuildResult =
  | { status: "skipped"; message: string }
  | { status: "built"; data: PortfolioData; theme: string };

export interface BuildOptions {
  rootDir: string;
  themesDir: string;
  outDir: string;
  repository: string | undefined;
  http: Http;
  sleep: Sleep;
  now: () => Date;
}

// Nothing is written until fetching and rendering have both succeeded, so a
// failed run leaves the previous site and snapshot untouched.
export async function runBuild(opts: BuildOptions): Promise<BuildResult> {
  const themes = await loadThemes(opts.themesDir);
  const config = await loadConfig(join(opts.rootDir, "config.json"), [
    ...themes.keys(),
  ]);
  if (isUnconfigured(config, opts.repository)) {
    return { status: "skipped", message: UNCONFIGURED_MESSAGE };
  }
  const theme = themes.get(config.theme);
  if (!theme) throw new Error(`unreachable: theme ${config.theme}`);

  const raw = await fetchLapras(config.laprasId, opts.http, opts.sleep);
  const { data, avatarUrl } = shape(raw, config.laprasId);
  const avatar = await fetchAvatar(avatarUrl, opts.http);
  if (avatar) data.avatar = `avatar.${avatar.ext}`;

  const html = theme.theme.render(data, {
    builtAt: opts.now().toISOString(),
  });
  await writeSite(opts.outDir, { html, theme, avatar });
  await writeSnapshot(opts.rootDir, data);
  return { status: "built", data, theme: config.theme };
}
