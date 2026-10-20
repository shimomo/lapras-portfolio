import { readFileSync } from "node:fs";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { runBuild } from "../src/build.js";
import { ConfigError } from "../src/config.js";
import { UNCONFIGURED_MESSAGE } from "../src/guard.js";
import { FetchError, type Http, laprasJsonUrl } from "../src/lapras.js";

const themesDir = fileURLToPath(new URL("./fixtures/themes", import.meta.url));
const shimomoText = readFileSync(
  new URL("./fixtures/shimomo.json", import.meta.url),
  "utf8",
);
const AVATAR_PREFIX = "https://media.scout.lapras.com/";
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);

let root: string;
let out: string;
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "lapras-build-"));
  out = join(root, "dist");
});
afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  vi.restoreAllMocks();
});

async function writeConfig(value: unknown) {
  await writeFile(join(root, "config.json"), JSON.stringify(value));
}

function stubHttp(opts: { json?: Response; avatar?: Response } = {}) {
  const calls: string[] = [];
  const http: Http = async (url) => {
    calls.push(url);
    if (url === laprasJsonUrl("shimomo")) {
      return opts.json ?? new Response(shimomoText);
    }
    if (url.startsWith(AVATAR_PREFIX)) {
      return (
        opts.avatar ??
        new Response(PNG, { headers: { "content-type": "image/png" } })
      );
    }
    return new Response("", { status: 404 });
  };
  return { http, calls };
}

const build = (http: Http, repository?: string) =>
  runBuild({
    rootDir: root,
    themesDir,
    outDir: out,
    repository,
    http,
    sleep: async () => {},
    now: () => new Date("2026-10-20T00:00:00Z"),
  });

const exists = async (path: string) =>
  readFile(path).then(
    () => true,
    () => false,
  );
const snapshot = () => join(root, "data/shimomo/portfolio.json");

test("builds the site and the snapshot", async () => {
  await writeConfig({ lapras_id: "shimomo", theme: "plain" });
  const result = await build(stubHttp().http, "shimomo/lapras-portfolio");
  expect(result.status).toBe("built");
  if (result.status !== "built") return;
  expect(result.theme).toBe("plain");
  expect(result.data.name).toBe("Yuichi Shimo");
  expect(await readFile(join(out, "index.html"), "utf8")).toContain(
    "<h1>Yuichi Shimo</h1>",
  );
  expect((await readdir(out)).sort()).toEqual([
    "avatar.png",
    "index.html",
    "plain.css",
  ]);
  expect([...(await readFile(join(out, "avatar.png")))]).toEqual([...PNG]);
  const snapText = await readFile(snapshot(), "utf8");
  const snap = JSON.parse(snapText);
  expect(snap.avatar).toBe("avatar.png");
  expect(snapText).not.toContain("Signature=");
  expect(snapText).not.toContain("2026-10-20T00:00:00");
  expect(snapText.endsWith("}\n")).toBe(true);
});

test("unconfigured repository is skipped without network", async () => {
  await writeConfig({ lapras_id: "shimomo", theme: "plain" });
  const { http, calls } = stubHttp();
  const result = await build(http, "alice/lapras-portfolio");
  expect(result).toEqual({ status: "skipped", message: UNCONFIGURED_MESSAGE });
  expect(calls).toEqual([]);
  expect(await exists(join(out, "index.html"))).toBe(false);
  expect(await exists(snapshot())).toBe(false);
});

test("404 writes nothing", async () => {
  await writeConfig({ lapras_id: "shimomo", theme: "plain" });
  const { http } = stubHttp({ json: new Response("", { status: 404 }) });
  await expect(build(http)).rejects.toBeInstanceOf(FetchError);
  expect(await exists(join(out, "index.html"))).toBe(false);
  expect(await exists(snapshot())).toBe(false);
});

test("a 200 in an unexpected shape writes nothing", async () => {
  await writeConfig({ lapras_id: "shimomo", theme: "plain" });
  const { http } = stubHttp({ json: new Response("{}") });
  const error = await build(http).catch((e) => e);
  expect(error).toBeInstanceOf(FetchError);
  expect(error.message).toContain("想定外のデータ");
  expect(await exists(join(out, "index.html"))).toBe(false);
  expect(await exists(snapshot())).toBe(false);
});

test("avatar failure still builds", async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  await writeConfig({ lapras_id: "shimomo", theme: "plain" });
  const { http } = stubHttp({ avatar: new Response("", { status: 500 }) });
  const result = await build(http);
  expect(result.status).toBe("built");
  expect(JSON.parse(await readFile(snapshot(), "utf8")).avatar).toBeNull();
  expect(await readdir(out)).not.toContain("avatar.png");
});

test("rebuilding the same data leaves the snapshot byte-identical", async () => {
  await writeConfig({ lapras_id: "shimomo", theme: "plain" });
  await build(stubHttp().http);
  const first = await readFile(snapshot(), "utf8");
  await build(stubHttp().http);
  expect(await readFile(snapshot(), "utf8")).toBe(first);
});

test("a rebuild replaces stale files in dist", async () => {
  await writeConfig({ lapras_id: "shimomo", theme: "plain" });
  await build(stubHttp().http);
  await writeFile(join(out, "stale.txt"), "old");
  await build(stubHttp().http);
  expect(await readdir(out)).not.toContain("stale.txt");
});

test("unknown theme name fails with the available list", async () => {
  await writeConfig({ lapras_id: "shimomo", theme: "neon" });
  const error = await build(stubHttp().http).catch((e) => e);
  expect(error).toBeInstanceOf(ConfigError);
  expect(error.message).toBe('テーマ "neon" はありません。使えるテーマ: plain');
});
