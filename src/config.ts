import { readFile } from "node:fs/promises";
import type { Config } from "./types.js";

export const DEFAULT_THEME = "terminal";

export class ConfigError extends Error {
  override name = "ConfigError";
}

const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const PASTED_URL = /^https?:\/\/lapras\.com\/public\/([^/?#]+?)(?:\.json)?\/?$/;
const INVALID_ID =
  "config.json の lapras_id が正しくありません。LAPRAS の公開ページ https://lapras.com/public/<ID> の <ID> の部分を書いてください（英数字・ハイフン・アンダースコアのみ）";

function normalizeId(value: unknown): string {
  if (typeof value !== "string") throw new ConfigError(INVALID_ID);
  const trimmed = value.trim();
  const id = trimmed.match(PASTED_URL)?.[1] ?? trimmed;
  if (!ID_PATTERN.test(id)) throw new ConfigError(INVALID_ID);
  return id;
}

export function parseConfig(text: string, themes: readonly string[]): Config {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (error) {
    throw new ConfigError(
      `config.json を JSON として読めませんでした: ${(error as Error).message}`,
    );
  }
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ConfigError(
      "config.json の中身はオブジェクト（{ ... }）にしてください",
    );
  }
  const record = raw as Record<string, unknown>;
  const laprasId = normalizeId(record.lapras_id);
  const theme = record.theme ?? DEFAULT_THEME;
  if (typeof theme !== "string" || !themes.includes(theme)) {
    throw new ConfigError(
      `テーマ "${String(theme)}" はありません。使えるテーマ: ${themes.join(", ")}`,
    );
  }
  return { laprasId, theme };
}

export async function loadConfig(
  path: string,
  themes: readonly string[],
): Promise<Config> {
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      throw new ConfigError(
        "config.json が見つかりません。リポジトリの直下に置いてください",
      );
    }
    throw error;
  }
  return parseConfig(text, themes);
}
