import { expect, test } from "vitest";
import { shape } from "../../src/shape.js";
import dashboard from "../../themes/dashboard/index.js";
import { hostileRaw, shimomoRaw, sparseRaw } from "../fixtures/raw.js";

const meta = { builtAt: "2026-10-20T06:23:00.000Z" };
const shimomo = shape(shimomoRaw, "shimomo").data;
const sparse = shape(sparseRaw, "someone").data;
const hostile = shape(hostileRaw, "hostile").data;
const render = (data: typeof shimomo) => dashboard.render(data, meta);

test("theme declares its assets and has no script", () => {
  expect(dashboard.assets).toEqual(["style.css"]);
  expect(render(shimomo)).not.toContain("<script");
});

test("title and footer", () => {
  const page = render(shimomo);
  expect(page).toContain("<title>Yuichi Shimo | ポートフォリオ</title>");
  expect(page).toContain(
    "LAPRAS のデータから自動生成 · 最終更新 2026-10-20 · ",
  );
  expect(page).toContain(
    '<a href="https://github.com/shimomo/lapras-portfolio">このページの作り方</a>',
  );
});

test("shows scores with top percent", () => {
  const page = render(shimomo);
  expect(page).toContain("技術力");
  expect(page).toContain("3.43");
  expect(page).toContain("上位 19%");
  expect(page).toContain("ビジネス力");
  expect(page).toContain("影響力");
});

test("shows every card that has data", () => {
  const page = render(shimomo);
  for (const heading of [
    "言語",
    "人気のリポジトリ",
    "記事",
    "登壇",
    "イベント",
    "最近の活動",
  ]) {
    expect(page).toContain(`<h2>${heading}</h2>`);
  }
  expect(page.match(/class="repo"/g)).toHaveLength(6);
  expect(page.match(/class="activity"/g)).toHaveLength(10);
});

test("cards without data are omitted", () => {
  const page = render(sparse);
  for (const gone of [
    "技術力",
    "人気のリポジトリ",
    "記事",
    "登壇",
    "イベント",
    "最近の活動",
    "<h2>言語</h2>",
  ]) {
    expect(page).not.toContain(gone);
  }
  expect(page).toContain("下 雄一");
  expect(page).toContain('href="https://lapras.com/public/someone"');
});

test("avatar or initials", () => {
  expect(render({ ...shimomo, avatar: "avatar.jpg" })).toContain(
    '<img src="avatar.jpg" alt="">',
  );
  const page = render(shimomo);
  expect(page).not.toContain("<img");
  expect(page).toMatch(/class="initials"[^>]*>YS</);
});

test("hostile data is escaped and has no script", () => {
  const page = render(hostile);
  expect(page).not.toContain("<script");
  expect(page).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
  expect(page).not.toMatch(/href="javascript:/i);
  expect(page).not.toContain("<b>TS</b>");
});

test("only relative references", () => {
  for (const data of [
    shimomo,
    sparse,
    hostile,
    { ...shimomo, avatar: "avatar.png" },
  ]) {
    expect(/(?:href|src)="\//.test(render(data))).toBe(false);
  }
});
