import type { Config } from "./types.js";

export const UPSTREAM_REPOSITORY = "shimomo/lapras-portfolio";
export const UPSTREAM_LAPRAS_ID = "shimomo";

export const UNCONFIGURED_MESSAGE =
  "config.json の lapras_id がまだ上流の既定値（shimomo）のままです。自分の LAPRAS の ID に書き換えてコミットしてください。書き換えるまで、ページの生成と公開はしません。";

// A fork that still carries the upstream id would publish someone else's page,
// so it does nothing until its owner sets their own id. Local runs (no
// GITHUB_REPOSITORY) are never skipped.
export function isUnconfigured(
  config: Config,
  repository: string | undefined,
): boolean {
  return (
    config.laprasId === UPSTREAM_LAPRAS_ID &&
    repository !== undefined &&
    repository !== UPSTREAM_REPOSITORY
  );
}
