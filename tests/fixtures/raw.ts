import { readFileSync } from "node:fs";

// Real response from https://lapras.com/public/shimomo.json, fetched 2026-10-20.
export const shimomoRaw: Record<string, unknown> = JSON.parse(
  readFileSync(new URL("./shimomo.json", import.meta.url), "utf8"),
);

// Someone who has just made their portfolio public: no scores, nothing linked,
// a name with no ASCII letters, and none of the fields the API README omits.
export const sparseRaw: Record<string, unknown> = {
  name: "下 雄一",
  description: "",
  e_score: 0,
  b_score: 0,
  i_score: 0,
  iconimage_url: "",
  github_html_url: "",
  twitter_html_url: "",
  qiita_html_url: null,
  zenn_html_url: "",
  speaker_deck_html_url: "",
  qiita_articles: [],
  zenn_articles: [],
  blog_articles: [],
  note_articles: [],
  hatena_articles: [],
  speaker_deck_slides: [],
  github_repositories: [],
  teratail_replies: [],
  events: [],
  activities: [],
};

const longTitle = "あ".repeat(150) + "W".repeat(150);

// Markup in every string, unsafe URLs, wrong types and a lot of items.
export const hostileRaw: Record<string, unknown> = {
  name: "<script>alert(1)</script>",
  description: `"&'<>`,
  e_score: 4.2,
  b_score: 1,
  i_score: 1,
  e_score_details: { e_score_percentile: 50, github_score: "x" },
  iconimage_url: "javascript:alert(1)",
  github_html_url: "javascript:x",
  zenn_html_url: "https://zenn.dev/<b>",
  zenn_articles: [
    {
      title: longTitle,
      url: "javascript:alert(1)",
      posted_at: "2026-10-01T00:00:00",
    },
    { title: "<img src=x onerror=alert(1)>", url: "https://zenn.dev/x" },
    "not an object",
    { title: "", url: "https://zenn.dev/empty" },
  ],
  github_repositories: Array.from({ length: 200 }, (_, i) => ({
    title: `owner/${"r".repeat(80)}-${i}`,
    url:
      i === 0 ? "data:text/html,x" : `https://github.com/owner/r-${i}?q="<x>"`,
    language: "<b>TS</b>",
    stargazers_count: i === 1 ? "9" : i,
    description: `${"d".repeat(400)} <script>`,
  })),
  skill_tags: {},
  programming_languages: [{ name: "<i>Go</i>", bytes: Number.NaN }],
  events: null,
  activities: [
    {
      title: "<svg onload=alert(1)>",
      url: "https://example.com/a",
      date: "2026-10-02T00:00:00",
      type: "<b>github</b>",
    },
  ],
  selections: [{ url: "javascript:void 0", title: "evil" }],
};
