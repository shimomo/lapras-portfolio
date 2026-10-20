import { expect, test } from "vitest";
import { shape } from "../../src/shape.js";
import { banner } from "../../themes/terminal/banner.js";
import { bootLines, buildCommands } from "../../themes/terminal/commands.js";
import terminal from "../../themes/terminal/index.js";
import { hostileRaw, shimomoRaw, sparseRaw } from "../fixtures/raw.js";

const meta = { builtAt: "2026-10-20T06:23:00.000Z" };
const shimomo = shape(shimomoRaw, "shimomo").data;
const sparse = shape(sparseRaw, "someone").data;
const hostile = shape(hostileRaw, "hostile").data;
const render = (data: typeof shimomo) => terminal.render(data, meta);

const sectionKeys = (page: string) =>
  [...page.matchAll(/<section class="cmd" data-cmd="([^"]+)"/g)].map(
    (m) => m[1],
  );
const templateKeys = (page: string) =>
  [...page.matchAll(/<template data-cmd="([^"]+)"/g)].map((m) => m[1]);
const helpBody = (page: string) =>
  page.match(/<template data-cmd="help"[^>]*>([\s\S]*?)<\/template>/)?.[1] ??
  "";

test("theme declares its assets", () => {
  expect(terminal.assets).toEqual(["style.css", "terminal.js"]);
});

test("boot lines follow the data", () => {
  expect(bootLines(shimomo)).toEqual([
    "neofetch",
    "ls articles | head -3",
    "ls repos | head -5",
  ]);
  expect(bootLines(sparse)).toEqual(["neofetch"]);
  const page = render(shimomo);
  expect([...page.matchAll(/data-boot="([^"]+)"/g)].map((m) => m[1])).toEqual(
    bootLines(shimomo),
  );
});

test("transcript holds every available command in order", () => {
  expect(sectionKeys(render(shimomo))).toEqual([
    "neofetch",
    "ls articles",
    "ls repos",
    "ls talks",
    "ls events",
    "lapras score",
    "langs",
    "skills",
    "git log",
    "open",
    "cat README.md",
  ]);
  expect(templateKeys(render(shimomo))).toEqual([
    "help",
    "whoami",
    "ls",
    "sudo",
    "sudo hire",
    "exit",
  ]);
});

test("commands without data disappear everywhere", () => {
  const page = render(sparse);
  expect(sectionKeys(page)).toEqual(["neofetch", "open", "cat README.md"]);
  expect(templateKeys(page)).toEqual([
    "help",
    "whoami",
    "sudo",
    "sudo hire",
    "exit",
  ]);
  const help = helpBody(page);
  for (const gone of [
    "lapras score",
    "langs",
    "git log",
    "skills",
    'data-run="ls"',
  ]) {
    expect(help).not.toContain(gone);
  }
});

test("help lists usages plus history and clear, not hidden ones", () => {
  const runs = [
    ...helpBody(render(shimomo)).matchAll(/data-run="([^"]+)"/g),
  ].map((m) => m[1]);
  expect(runs).toEqual([
    "help",
    "neofetch",
    "whoami",
    "ls",
    "lapras score",
    "langs",
    "skills",
    "git log",
    "open",
    "cat README.md",
    "history",
    "clear",
  ]);
});

test("ls lists only directories that have data, as clickable runs", () => {
  const ls = buildCommands(shimomo, meta).find((c) => c.key === "ls");
  expect(
    [...(ls?.body.value ?? "").matchAll(/data-run="([^"]+)"/g)].map(
      (m) => m[1],
    ),
  ).toEqual(["ls articles", "ls repos", "ls talks", "ls events"]);
});

test("score shows top percent only where it exists", () => {
  const score = buildCommands(shimomo, meta).find(
    (c) => c.key === "lapras score",
  );
  expect(score?.body.value).toContain("top 19%");
  expect(score?.body.value).toContain("top 2%");
  expect(score?.body.value).not.toContain("top 100%");
});

test("open rows carry the link key", () => {
  const open = buildCommands(shimomo, meta).find((c) => c.key === "open");
  const keys = [
    ...(open?.body.value ?? "").matchAll(/data-key="([^"]+)"/g),
  ].map((m) => m[1]);
  expect(keys).toEqual([
    "github",
    "zenn",
    "speakerdeck",
    "connpass",
    "lapras",
    "site",
  ]);
  expect(open?.body.value).toContain(
    '<a href="https://github.com/shimomo" target="_blank" rel="noopener">',
  );
});

test("readme points at this repository and LAPRAS", () => {
  const readme = buildCommands(shimomo, meta).find(
    (c) => c.key === "cat README.md",
  );
  expect(readme?.body.value).toContain(
    "このページは LAPRAS の公開 API から毎日自動で生成されています。",
  );
  expect(readme?.body.value).toContain("built at 2026-10-20 06:23 UTC");
  expect(readme?.body.value).toContain(
    'href="https://github.com/shimomo/lapras-portfolio"',
  );
  expect(readme?.body.value).toContain(
    'href="https://lapras.com/public/shimomo"',
  );
});

test("sudo hire reveals its punchline after a delay", () => {
  const hire = buildCommands(shimomo, meta).find((c) => c.key === "sudo hire");
  expect(hire?.body.value.replace(/<[^>]+>/g, "")).toContain(
    "[sudo] password for recruiter: ********",
  );
  expect(hire?.body.value).toMatch(
    /data-delay="600"[^>]*>[\s\S]*Access granted\./,
  );
});

test("page shell matches the contract terminal.js relies on", () => {
  const page = render(shimomo);
  expect(page.startsWith("<!DOCTYPE html>")).toBe(true);
  expect(page).toContain("<title>shimomo@lapras: ~</title>");
  expect(page).toContain(
    '<main id="term" data-user="shimomo" data-host="lapras">',
  );
  expect(page).toContain('<p class="line dim" id="last-login">Last login: ');
  expect(page).toContain('<div id="inputline" class="line" hidden>');
  expect(page).toContain('<template id="hint">');
  expect(page).toContain('<div id="skip" hidden>press any key to skip</div>');
  expect(page).toContain('<script src="terminal.js" defer></script>');
  expect(page).toContain(
    '<span class="ps1"><span class="u">shimomo@lapras</span>:<span class="p">~</span>$ </span>',
  );
});

test("hostile data is escaped", () => {
  const page = render(hostile);
  expect(page).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  expect(page).not.toContain("<script>alert");
  expect(page.match(/<script/g)).toHaveLength(1);
  expect(page).not.toMatch(/href="javascript:/i);
  expect(page).not.toContain("<img src=x");
});

test("only relative references", () => {
  for (const data of [shimomo, sparse, hostile]) {
    expect(/(?:href|src)="\//.test(render(data))).toBe(false);
  }
});

test("banner uses initials in the Big font", () => {
  const art = banner(shimomo);
  expect(art.split("\n").length).toBeLessThanOrEqual(7);
  expect(art).toContain("__");
  expect(art.endsWith("\n")).toBe(false);
  expect(render(shimomo)).toContain('<pre class="art">');
});

test("whoami is described as what it prints", () => {
  const whoami = buildCommands(shimomo, meta).find((c) => c.key === "whoami");
  expect(whoami?.desc).toBe("名前と bio");
});
