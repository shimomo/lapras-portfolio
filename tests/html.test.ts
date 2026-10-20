import { expect, test } from "vitest";
import { escapeHtml, html, raw, SafeHtml } from "../src/html.js";

test("interpolations are escaped", () => {
  expect(html`<p>${'<a href="x">&\''}</p>`.value).toBe(
    "<p>&lt;a href=&quot;x&quot;&gt;&amp;&#39;</p>",
  );
});

test("numbers are stringified", () => {
  expect(html`<b>${3.5}</b>`.value).toBe("<b>3.5</b>");
});

test("SafeHtml and arrays nest without double escaping", () => {
  const list = html`<ul>${["a<", "b"].map((x) => html`<li>${x}</li>`)}</ul>`;
  expect(list).toBeInstanceOf(SafeHtml);
  expect(list.value).toBe("<ul><li>a&lt;</li><li>b</li></ul>");
  expect(`${list}`).toBe(list.value);
});

test("raw is inserted as is", () => {
  expect(html`<div>${raw("<br>")}</div>`.value).toBe("<div><br></div>");
});

test("null, undefined and false render nothing", () => {
  expect(html`[${null}${undefined}${false}]`.value).toBe("[]");
});

test("escapeHtml covers the five characters", () => {
  expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
});
