import { formatScore, initials, topPercent } from "../../src/format.js";
import { html, type SafeHtml } from "../../src/html.js";
import { REPO_URL, renderHead } from "../../src/page.js";
import type { BuildMeta, PortfolioData, Theme } from "../../src/types.js";

const LANGUAGE_COLORS = [
  "#4f7cff",
  "#8a5cff",
  "#f05340",
  "#2fb380",
  "#f2a33a",
  "#2ab3c9",
  "#d4569a",
  "#8d99ae",
];

const link = (text: unknown, url: string) =>
  url ? html`<a href="${url}">${text}</a>` : html`<span>${text}</span>`;

const card = (cls: string, heading: string, body: SafeHtml) =>
  html`<section class="card ${cls}"><h2>${heading}</h2>${body}</section>`;

const datedList = (
  items: { date: string; title: string; url: string }[],
  extra?: (i: number) => unknown,
) =>
  html`<ul class="dated">${items.map(
    (item, i) =>
      html`<li><span class="date">${item.date}</span>${link(item.title, item.url)}${extra?.(i)}</li>`,
  )}</ul>`;

function profile(data: PortfolioData): SafeHtml {
  const facts = [data.role, data.organization, data.location]
    .filter(Boolean)
    .join(" · ");
  return html`<section class="card profile">
<div class="who">
${data.avatar ? html`<img src="${data.avatar}" alt="">` : html`<div class="initials" aria-hidden="true">${initials(data)}</div>`}
<div><h1>${data.name}</h1>${facts && html`<p class="facts">${facts}</p>`}</div>
</div>
${data.bio && html`<p class="bio">${data.bio}</p>`}
<ul class="links">${data.links.map((l) => html`<li>${link(l.label, l.url)}</li>`)}</ul>
</section>`;
}

function scores(data: PortfolioData): SafeHtml | null {
  const sc = data.scores;
  if (!sc) return null;
  const meter = (label: string, value: number, extra: string) =>
    html`<div class="meter"><div class="label">${label}</div><div class="value">${formatScore(value)}${extra && html`<small>${extra}</small>`}</div><div class="bar"><i style="width:${Math.round((Math.min(value, 5) / 5) * 100)}%"></i></div></div>`;
  const top = topPercent(sc.techPercentile);
  return html`<section class="card scores">
${meter("技術力", sc.tech, top === null ? "" : `上位 ${top}%`)}
${meter("ビジネス力", sc.business, "")}
${meter("影響力", sc.influence, "")}
</section>`;
}

function languages(data: PortfolioData): SafeHtml | null {
  const top = data.languages.slice(0, 8);
  if (top.length === 0) return null;
  const total = data.languages.reduce((t, l) => t + l.bytes, 0) || 1;
  const share = (bytes: number) => ((bytes / total) * 100).toFixed(1);
  return card(
    "languages",
    "言語",
    html`<div class="stack">${top.map(
      (l, i) =>
        html`<i style="flex:${l.bytes};background:${LANGUAGE_COLORS[i]}"></i>`,
    )}</div><ul class="legend">${top.map(
      (l, i) =>
        html`<li><i style="background:${LANGUAGE_COLORS[i]}"></i>${l.name} <small>${share(l.bytes)}%</small></li>`,
    )}</ul>`,
  );
}

function repos(data: PortfolioData): SafeHtml | null {
  if (data.repos.length === 0) return null;
  return card(
    "repos",
    "人気のリポジトリ",
    html`<ul class="plain">${data.repos
      .slice(0, 6)
      .map(
        (r) =>
          html`<li class="repo"><div class="repo-head">${link(r.name, r.url)}<span class="stars">★ ${r.stars}</span></div>${r.description && html`<p>${r.description}</p>`}${r.language && html`<span class="lang">${r.language}</span>`}</li>`,
      )}</ul>`,
  );
}

function activities(data: PortfolioData): SafeHtml | null {
  if (data.activities.length === 0) return null;
  return card(
    "activities",
    "最近の活動",
    html`<ul class="plain">${data.activities
      .slice(0, 10)
      .map(
        (a) =>
          html`<li class="activity"><span class="date">${a.date}</span><span class="type">${a.type}</span>${link(a.title, a.url)}</li>`,
      )}</ul>`,
  );
}

function render(data: PortfolioData, meta: BuildMeta): string {
  const cards = [
    profile(data),
    scores(data),
    languages(data),
    repos(data),
    data.articles.length > 0 &&
      card("articles", "記事", datedList(data.articles)),
    data.talks.length > 0 && card("talks", "登壇", datedList(data.talks)),
    data.events.length > 0 &&
      card(
        "events",
        "イベント",
        datedList(data.events, (i) => {
          const role = data.events[i].role;
          return role === "attendee"
            ? ""
            : html`<span class="role">${role === "speaker" ? "登壇" : "運営"}</span>`;
        }),
      ),
    activities(data),
  ];
  return html`<!DOCTYPE html>
<html lang="ja">
<head>
${renderHead({ title: `${data.name} | ポートフォリオ`, data, stylesheets: ["style.css"] })}</head>
<body class="dashboard">
<main class="grid">
${cards}
</main>
<footer>LAPRAS のデータから自動生成 · 最終更新 ${meta.builtAt.slice(0, 10)} · <a href="${REPO_URL}">このページの作り方</a></footer>
</body>
</html>
`.value;
}

const theme: Theme = { assets: ["style.css"], render };
export default theme;
