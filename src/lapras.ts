export type Http = (url: string, init?: RequestInit) => Promise<Response>;
export type Sleep = (ms: number) => Promise<void>;

export const USER_AGENT =
  "lapras-portfolio (+https://github.com/shimomo/lapras-portfolio)";

const RETRY_WAIT_MS = 3000;

export class FetchError extends Error {
  override name = "FetchError";
}

export function laprasJsonUrl(id: string): string {
  return `https://lapras.com/public/${id}.json`;
}

const notFound = (id: string) =>
  new FetchError(
    `LAPRAS のポートフォリオが見つかりません（lapras_id: ${id}）。LAPRAS でポートフォリオが公開設定になっているか、config.json の lapras_id が正しいかを確認してください。`,
  );
const transient = (detail: string) =>
  new FetchError(
    `LAPRAS からの取得に失敗しました（${detail}）。一時的な失敗の可能性があります。次回の実行で回復しない場合は、Actions のログを確認してください。`,
  );
const unexpected = (detail: string) =>
  new FetchError(`LAPRAS から想定外のデータが返りました（${detail}）。`);

type Attempt =
  | { ok: true; response: Response }
  | { ok: false; retry: boolean; error: FetchError };

async function attempt(id: string, http: Http): Promise<Attempt> {
  let response: Response;
  try {
    response = await http(laprasJsonUrl(id), {
      headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    });
  } catch (error) {
    return {
      ok: false,
      retry: true,
      error: transient((error as Error).message),
    };
  }
  if (response.ok) return { ok: true, response };
  if (response.status === 404) {
    return { ok: false, retry: false, error: notFound(id) };
  }
  const retry = response.status === 429 || response.status >= 500;
  return { ok: false, retry, error: transient(`HTTP ${response.status}`) };
}

export async function fetchLapras(
  id: string,
  http: Http,
  sleep: Sleep,
): Promise<Record<string, unknown>> {
  let result = await attempt(id, http);
  if (!result.ok && result.retry) {
    await sleep(RETRY_WAIT_MS);
    result = await attempt(id, http);
  }
  if (!result.ok) throw result.error;

  let body: unknown;
  try {
    body = await result.response.json();
  } catch (error) {
    throw unexpected((error as Error).message);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    throw unexpected(Array.isArray(body) ? "array" : String(body));
  }
  // Every public portfolio has a name. Without one the format has changed,
  // and publishing would overwrite the page with an empty one.
  const name = (body as Record<string, unknown>).name;
  if (typeof name !== "string" || !name.trim()) {
    throw unexpected("name フィールドがありません");
  }
  return body as Record<string, unknown>;
}

export type Avatar = { bytes: Uint8Array; ext: "jpg" | "png" | "webp" | "gif" };

const IMAGE_EXT: Record<string, Avatar["ext"]> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export async function fetchAvatar(
  url: string | null,
  http: Http,
): Promise<Avatar | null> {
  if (url === null) return null;
  try {
    const response = await http(url, { headers: { "User-Agent": USER_AGENT } });
    if (!response.ok) {
      console.warn(
        `アバター画像を取得できませんでした（HTTP ${response.status}）`,
      );
      return null;
    }
    const type = (response.headers.get("content-type") ?? "")
      .split(";")[0]
      .trim()
      .toLowerCase();
    const ext = IMAGE_EXT[type];
    if (!ext) {
      console.warn(`アバター画像の形式に対応していません（${type || "不明"}）`);
      return null;
    }
    return { bytes: new Uint8Array(await response.arrayBuffer()), ext };
  } catch (error) {
    console.warn(
      `アバター画像を取得できませんでした（${(error as Error).message}）`,
    );
    return null;
  }
}
