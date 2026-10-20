import { formatScore, topPercent } from "../../src/format.js";
import { html, type SafeHtml } from "../../src/html.js";
import { REPO_URL } from "../../src/page.js";
import type { BuildMeta, PortfolioData } from "../../src/types.js";
import { banner } from "./banner.js";

export const HOST = "lapras";

export interface Command {
  /** Canonical command line, e.g. "ls articles". */
  key: string;
  /** What help shows and runs. */
  usage: string;
  /** Help text; an empty string keeps the command out of help. */
  desc: string;
  /** true: shown already run on the page (and without JS). false: kept in a <template>. */
  transcript: boolean;
  body: SafeHtml;
}

const s = (cls: string, text: unknown) =>
  html`<span class="${cls}">${text}</span>`;
const link = (text: unknown, url: string) =>
  url
    ? html`<a href="${url}" target="_blank" rel="noopener">${text}</a>`
    : html`<span>${text}</span>`;
const run = (cmd: string, label: unknown = cmd) =>
  html`<span class="run" data-run="${cmd}">${label}</span>`;
const line = (...parts: unknown[]) => html`<div class="line">${parts}</div>`;
const rows = (kind: string, items: SafeHtml[]) =>
  html`<div class="rows rows-${kind}">${items}</div>`;
const row = (...cells: unknown[]) => html`<div class="row">${cells}</div>`;
const bar = (ratio: number, width: number) => {
  const n = Math.round(Math.max(0, Math.min(1, ratio)) * width);
  return html`<span class="bar">${s("g", "█".repeat(n))}${s("dim", "░".repeat(width - n))}</span>`;
};
const top = (p: number | null) => {
  const t = topPercent(p);
  return t === null ? "" : `top ${t}%`;
};

// git-log-looking short hash; stable for the same activity.
function shortHash(text: string): string {
  let x = 0;
  for (const ch of text) x = (Math.imul(x, 31) + ch.charCodeAt(0)) >>> 0;
  return x.toString(16).padStart(8, "0").slice(0, 7);
}

const LIST_DIRS = ["articles", "repos", "talks", "events"] as const;
type ListDir = (typeof LIST_DIRS)[number];

function listBody(data: PortfolioData, dir: ListDir): SafeHtml {
  switch (dir) {
    case "articles":
      return rows(
        "articles",
        data.articles.map((a) =>
          row(s("dim", a.date), link(a.title, a.url), s("dim", a.source)),
        ),
      );
    case "repos":
      return rows(
        "repos",
        data.repos.map((r) =>
          row(
            s("y", `★${r.stars}`),
            link(r.name, r.url),
            s("m", r.language || "-"),
            s("dim", r.description),
          ),
        ),
      );
    case "talks":
      return rows(
        "talks",
        data.talks.map((t) => row(s("dim", t.date), link(t.title, t.url))),
      );
    case "events":
      return rows(
        "events",
        data.events.map((e) =>
          row(
            s("dim", e.date),
            link(e.title, e.url),
            s("g", e.role === "attendee" ? "" : e.role),
          ),
        ),
      );
  }
}

function neofetch(data: PortfolioData): SafeHtml {
  const kv = (key: string, ...value: unknown[]) =>
    html`<div><b>${key}</b>: ${value}</div>`;
  const prompt = `${data.laprasId}@${HOST}`;
  const sc = data.scores;
  const output = [
    `${data.articles.length} articles`,
    `${data.talks.length} talks`,
    `${data.events.length} events`,
  ].join(" · ");
  const palette = ["r", "y", "g", "c", "b", "m", "fg"].map(
    (c) => html`<span class="swatch sw-${c}"></span>`,
  );
  return html`<div class="neo"><pre class="art">${banner(data)}</pre><div class="kv">
<div>${s("g", data.laprasId)}@${s("g", HOST)}</div>
<div class="dim">${"-".repeat(prompt.length)}</div>
${kv("Name", data.name)}
${data.role && kv("Role", data.role)}
${data.bio && kv("Bio", data.bio)}
${data.organization && kv("Org", data.organization)}
${data.location && kv("Location", data.location)}
${
  sc &&
  kv(
    "Score",
    `tech ${formatScore(sc.tech)} · biz ${formatScore(sc.business)} · infl ${formatScore(sc.influence)}`,
    sc.techPercentile !== null && s("dim", ` (tech ${top(sc.techPercentile)})`),
  )
}
${
  data.languages.length > 0 &&
  kv(
    "Langs",
    data.languages
      .slice(0, 4)
      .map((l) => l.name)
      .join(", "),
  )
}
${(data.counts.publicRepos > 0 || data.repos.length > 0) && kv("Repos", `${data.counts.publicRepos} public · ★ ${data.counts.stars}`)}
${data.articles.length + data.talks.length + data.events.length > 0 && kv("Output", output)}
<div class="palette">${palette}</div>
</div></div>`;
}

function score(data: PortfolioData): SafeHtml | null {
  const sc = data.scores;
  if (!sc) return null;
  const main = rows("score", [
    row(
      "tech",
      s("y", formatScore(sc.tech)),
      bar(sc.tech / 5, 24),
      s("dim", top(sc.techPercentile)),
    ),
    row(
      "business",
      s("y", formatScore(sc.business)),
      bar(sc.business / 5, 24),
      s("dim", ""),
    ),
    row(
      "influence",
      s("y", formatScore(sc.influence)),
      bar(sc.influence / 5, 24),
      s("dim", ""),
    ),
  ]);
  if (sc.breakdown.length === 0) return main;
  return html`${main}${line(s("dim", "tech score breakdown"))}${rows(
    "score",
    sc.breakdown.map((p) =>
      row(
        s("dim", `  ${p.key}`),
        s("y", formatScore(p.score)),
        bar(p.score / 5, 16),
        s("dim", top(p.percentile)),
      ),
    ),
  )}`;
}

function langs(data: PortfolioData): SafeHtml | null {
  if (data.languages.length === 0) return null;
  const total = data.languages.reduce((t, l) => t + l.bytes, 0) || 1;
  const max = data.languages[0].bytes || 1;
  return rows(
    "langs",
    data.languages
      .slice(0, 8)
      .map((l) =>
        row(
          s("m", l.name),
          bar(l.bytes / max, 28),
          s("dim", `${((l.bytes / total) * 100).toFixed(1)}%`),
        ),
      ),
  );
}

function skills(data: PortfolioData): SafeHtml | null {
  if (data.skills.length === 0) return null;
  return html`<div class="tags">${data.skills.map(
    (t) =>
      html`<span class="row tag">${s("dim", "[")}${s("c", t.name)}${s("dim", "]")}</span>`,
  )}</div>`;
}

function gitLog(data: PortfolioData): SafeHtml | null {
  if (data.activities.length === 0) return null;
  return rows(
    "log",
    data.activities.map((a) =>
      row(
        s("y", shortHash(`${a.url} ${a.date} ${a.title}`)),
        s("dim", a.date),
        s("g", `(${a.type})`),
        link(a.title, a.url),
      ),
    ),
  );
}

function open(data: PortfolioData): SafeHtml {
  return rows(
    "open",
    data.links.map(
      (l) =>
        html`<div class="row" data-key="${l.key}">${run(`open ${l.key}`, l.key)}${link(
          l.key === "site" ? l.label : l.url,
          l.url,
        )}</div>`,
    ),
  );
}

function readme(data: PortfolioData, meta: BuildMeta): SafeHtml {
  const lapras = data.links.find((l) => l.key === "lapras")?.url ?? "";
  const builtAt = `${meta.builtAt.slice(0, 16).replace("T", " ")} UTC`;
  return html`${line(s("c", "# README.md"))}
${line("このページは LAPRAS の公開 API から毎日自動で生成されています。")}
${line("このリポジトリをフォークして ID を書き換えるだけで、同じページを GitHub Pages に作れます。")}
${line(s("dim", `built at ${builtAt} · source: `), link("lapras-portfolio", REPO_URL), s("dim", " · data: "), link("LAPRAS", lapras))}`;
}

function help(entries: Command[]): SafeHtml {
  const listed = [
    ["help", "このヘルプを表示"] as const,
    ...entries.filter((c) => c.desc).map((c) => [c.usage, c.desc] as const),
    ["history", "入力したコマンドの履歴"] as const,
    ["clear", "画面をクリア"] as const,
  ];
  return html`${line(s("dim", "クリックでも実行できます"))}${rows(
    "help",
    listed.map(([usage, desc]) => row(run(usage), s("dim", desc))),
  )}`;
}

export function bootLines(data: PortfolioData): string[] {
  const lines = ["neofetch"];
  if (data.articles.length > 0) lines.push("ls articles | head -3");
  if (data.repos.length > 0) lines.push("ls repos | head -5");
  return lines;
}

// Every command's output is rendered here, at build time. terminal.js only
// shows these pieces; it never builds markup from data.
export function buildCommands(data: PortfolioData, meta: BuildMeta): Command[] {
  const dirs = LIST_DIRS.filter((d) => data[d].length > 0);
  const lapras = data.links.find((l) => l.key === "lapras")?.url ?? "";
  const cmd = (
    key: string,
    desc: string,
    transcript: boolean,
    body: SafeHtml | null,
    usage = key,
  ): Command[] => (body ? [{ key, usage, desc, transcript, body }] : []);

  const listed: Command[] = [
    ...cmd("neofetch", "プロフィールの概要", true, neofetch(data)),
    ...cmd(
      "whoami",
      "名前と bio",
      false,
      line(data.name, data.bio ? s("dim", ` — ${data.bio}`) : ""),
    ),
    ...cmd(
      "ls",
      `一覧を表示（${dirs.join(" / ")}）`,
      false,
      dirs.length > 0
        ? line(
            dirs.map(
              (d) =>
                html`${run(`ls ${d}`, html`<span class="b">${d}/</span>`)}  `,
            ),
          )
        : null,
    ),
    ...dirs.map(
      (d): Command => ({
        key: `ls ${d}`,
        usage: `ls ${d}`,
        desc: "",
        transcript: true,
        body: listBody(data, d),
      }),
    ),
    ...cmd("lapras score", "LAPRAS のスコア", true, score(data)),
    ...cmd("langs", "よく書く言語", true, langs(data)),
    ...cmd("skills", "スキルタグ", true, skills(data)),
    ...cmd("git log", "最近の活動", true, gitLog(data)),
    ...cmd("open", "リンクを開く（open github など）", true, open(data)),
    ...cmd("cat README.md", "このページについて", true, readme(data, meta)),
    ...cmd(
      "sudo",
      "",
      false,
      line(
        "recruiter is not in the sudoers file. This incident will be reported. ",
        s("dim", "(hint: sudo hire-me)"),
      ),
    ),
    ...cmd(
      "sudo hire",
      "",
      false,
      html`${line(s("dim", "[sudo] password for recruiter: "), "********")}<div class="line" data-delay="600">${s("g", "Access granted.")} 続きは ${link("LAPRAS", lapras)} でどうぞ。</div>`,
    ),
    ...cmd(
      "exit",
      "",
      false,
      html`${line("logout")}${line(s("dim", "……と見せかけて、まだここにいます。"))}`,
    ),
  ];
  return [...cmd("help", "このヘルプを表示", false, help(listed)), ...listed];
}
