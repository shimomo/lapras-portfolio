import { readFileSync } from "node:fs";
import { afterEach, expect, test, vi } from "vitest";
import {
  FetchError,
  fetchAvatar,
  fetchLapras,
  type Http,
  USER_AGENT,
} from "../src/lapras.js";

const shimomoText = readFileSync(
  new URL("./fixtures/shimomo.json", import.meta.url),
  "utf8",
);

type Reply = Response | Error;

function stubHttp(replies: Reply[]) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const http: Http = async (url, init) => {
    calls.push({ url, init });
    const reply = replies.shift();
    if (!reply) throw new Error("no more replies");
    if (reply instanceof Error) throw reply;
    return reply;
  };
  return { http, calls };
}

function stubSleep() {
  const waits: number[] = [];
  return { sleep: async (ms: number) => void waits.push(ms), waits };
}

const status = (code: number, body = "") =>
  new Response(body, { status: code });

afterEach(() => {
  vi.restoreAllMocks();
});

test("fetches JSON with the user agent", async () => {
  const { http, calls } = stubHttp([new Response(shimomoText)]);
  const raw = await fetchLapras("shimomo", http, stubSleep().sleep);
  expect(calls).toHaveLength(1);
  expect(calls[0].url).toBe("https://lapras.com/public/shimomo.json");
  const headers = new Headers(calls[0].init?.headers);
  expect(headers.get("User-Agent")).toBe(USER_AGENT);
  expect(headers.get("Accept")).toBe("application/json");
  expect(raw.name).toBe("Yuichi Shimo");
});

test("404 is not retried and explains what to check", async () => {
  const { http, calls } = stubHttp([status(404)]);
  const { sleep, waits } = stubSleep();
  const error = await fetchLapras("nobody", http, sleep).catch((e) => e);
  expect(error).toBeInstanceOf(FetchError);
  expect(error.message).toBe(
    "LAPRAS のポートフォリオが見つかりません（lapras_id: nobody）。LAPRAS でポートフォリオが公開設定になっているか、config.json の lapras_id が正しいかを確認してください。",
  );
  expect(calls).toHaveLength(1);
  expect(waits).toEqual([]);
});

test("503 then 200 succeeds after one retry", async () => {
  const { http, calls } = stubHttp([status(503), new Response(shimomoText)]);
  const { sleep, waits } = stubSleep();
  const raw = await fetchLapras("shimomo", http, sleep);
  expect(raw.name).toBe("Yuichi Shimo");
  expect(calls).toHaveLength(2);
  expect(waits).toEqual([3000]);
});

test("429 is retried too", async () => {
  const { http, calls } = stubHttp([status(429), new Response(shimomoText)]);
  await fetchLapras("shimomo", http, stubSleep().sleep);
  expect(calls).toHaveLength(2);
});

test("network error twice fails as transient", async () => {
  const { http, calls } = stubHttp([
    new TypeError("fetch failed"),
    new TypeError("fetch failed"),
  ]);
  const error = await fetchLapras("shimomo", http, stubSleep().sleep).catch(
    (e) => e,
  );
  expect(error).toBeInstanceOf(FetchError);
  expect(error.message).toBe(
    "LAPRAS からの取得に失敗しました（fetch failed）。一時的な失敗の可能性があります。次回の実行で回復しない場合は、Actions のログを確認してください。",
  );
  expect(calls).toHaveLength(2);
});

test("403 is not retried", async () => {
  const { http, calls } = stubHttp([status(403)]);
  const error = await fetchLapras("shimomo", http, stubSleep().sleep).catch(
    (e) => e,
  );
  expect(error).toBeInstanceOf(FetchError);
  expect(error.message).toContain("（HTTP 403）");
  expect(error.message).toContain("一時的な失敗");
  expect(calls).toHaveLength(1);
});

test.each(["not json", "[]", "null"])("unexpected body %s", async (body) => {
  const { http } = stubHttp([new Response(body)]);
  const error = await fetchLapras("shimomo", http, stubSleep().sleep).catch(
    (e) => e,
  );
  expect(error).toBeInstanceOf(FetchError);
  expect(error.message).toMatch(
    /^LAPRAS から想定外のデータが返りました（.+）。$/,
  );
});

test("avatar keeps bytes and maps content-type to ext", async () => {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  const { http } = stubHttp([
    new Response(bytes, { headers: { "content-type": "image/png" } }),
  ]);
  const avatar = await fetchAvatar("https://example.com/a.png", http);
  expect(avatar?.ext).toBe("png");
  expect([...(avatar?.bytes ?? [])]).toEqual([...bytes]);
});

test("avatar maps jpeg with parameters to jpg", async () => {
  const { http } = stubHttp([
    new Response("x", { headers: { "content-type": "image/jpeg; q=1" } }),
  ]);
  expect((await fetchAvatar("https://example.com/a", http))?.ext).toBe("jpg");
});

test.each([
  [500, "image/png"],
  [200, "text/html"],
])("avatar failure returns null (%i %s)", async (code, type) => {
  const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  const { http } = stubHttp([
    new Response("x", { status: code, headers: { "content-type": type } }),
  ]);
  expect(await fetchAvatar("https://example.com/a", http)).toBeNull();
  expect(warn).toHaveBeenCalledOnce();
});

test("avatar network error returns null", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  const { http } = stubHttp([new TypeError("fetch failed")]);
  expect(await fetchAvatar("https://example.com/a", http)).toBeNull();
});

test("avatar with null url does not call http", async () => {
  const { http, calls } = stubHttp([]);
  expect(await fetchAvatar(null, http)).toBeNull();
  expect(calls).toHaveLength(0);
});
