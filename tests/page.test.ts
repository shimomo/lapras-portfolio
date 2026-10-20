import { expect, test } from "vitest";
import { renderHead } from "../src/page.js";
import { shape } from "../src/shape.js";
import { hostileRaw, shimomoRaw, sparseRaw } from "./fixtures/raw.js";

test("head carries escaped OGP and relative stylesheets", () => {
  const { data } = shape(hostileRaw, "hostile");
  const head = renderHead({
    title: "t",
    data,
    stylesheets: ["style.css"],
  }).value;
  expect(head).toContain(
    '<meta property="og:title" content="&lt;script&gt;alert(1)&lt;/script&gt; のポートフォリオ">',
  );
  expect(head).toContain(
    '<meta name="description" content="&quot;&amp;&#39;&lt;&gt;">',
  );
  expect(head).toContain('<link rel="stylesheet" href="style.css">');
  expect(head).not.toContain("<script");
  expect(head).not.toContain("og:image");
});

test("head has charset, viewport, title and og:type", () => {
  const { data } = shape(shimomoRaw, "shimomo");
  const head = renderHead({
    title: "shimomo@lapras: ~",
    data,
    stylesheets: [],
  }).value;
  expect(head).toContain('<meta charset="utf-8">');
  expect(head).toContain('name="viewport"');
  expect(head).toContain("<title>shimomo@lapras: ~</title>");
  expect(head).toContain('<meta property="og:type" content="website">');
  expect(head).toContain(
    '<meta property="og:description" content="バックエンド寄りのフルスタックエンジニア">',
  );
});

test("head falls back to a generated description", () => {
  const { data } = shape(sparseRaw, "someone");
  expect(renderHead({ title: "t", data, stylesheets: [] }).value).toContain(
    'content="下 雄一 のポートフォリオ（LAPRAS のデータから自動生成）"',
  );
});
