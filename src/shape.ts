import type {
  Activity,
  Article,
  EventItem,
  Language,
  Link,
  PortfolioData,
  Repo,
  ScorePart,
  Scores,
  Skill,
  Talk,
} from "./types.js";

type Obj = Record<string, unknown>;

const isObj = (value: unknown): value is Obj =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const objects = (value: unknown): Obj[] =>
  Array.isArray(value) ? value.filter(isObj) : [];
const str = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";
const num = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0;
const optionalNum = (value: unknown): number | null =>
  typeof value === "number" && Number.isFinite(value) ? value : null;
const url = (value: unknown): string => {
  const s = str(value);
  return /^https?:\/\//i.test(s) ? s : "";
};
const day = (value: unknown): string => {
  const s = str(value);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : "";
};
const round = (value: number, digits: number) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const percentile = (value: unknown): number | null => {
  const p = optionalNum(value);
  return p !== null && p > 0 ? round(p, 1) : null;
};

// Plain string comparison (not localeCompare) so the order never depends on
// the machine running the build.
const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const newestFirst = <T extends { date: string; title: string; url: string }>(
  a: T,
  b: T,
) => cmp(b.date, a.date) || cmp(a.title, b.title) || cmp(a.url, b.url);

const ARTICLE_SOURCES: [string, Article["source"], string][] = [
  ["zenn_articles", "zenn", "posted_at"],
  ["qiita_articles", "qiita", "updated_at"],
  ["note_articles", "note", "published_at"],
  ["hatena_articles", "hatena", "published_at"],
  ["blog_articles", "blog", "posted_at"],
];

const LINK_FIELDS: [key: string, field: string, label: string][] = [
  ["github", "github_html_url", "GitHub"],
  ["zenn", "zenn_html_url", "Zenn"],
  ["qiita", "qiita_html_url", "Qiita"],
  ["speakerdeck", "speaker_deck_html_url", "Speaker Deck"],
  ["connpass", "connpass_html_url", "connpass"],
  ["note", "note_html_url", "note"],
  ["hatena", "hatena_html_url", "はてなブログ"],
  ["x", "twitter_html_url", "X"],
  ["linkedin", "linkedin_html_url", "LinkedIn"],
  ["atcoder", "atcoder_html_url", "AtCoder"],
  ["docswell", "docswell_html_url", "Docswell"],
  ["wantedly", "wantedly_html_url", "Wantedly"],
];

const BREAKDOWN: [ScorePart["key"], string][] = [
  ["github", "github_score"],
  ["articles", "tech_article_score"],
  ["events", "tech_event_score"],
  ["skill tags", "tag_count_score"],
];

function shapeScores(raw: Obj): Scores | null {
  const tech = round(num(raw.e_score), 2);
  const business = round(num(raw.b_score), 2);
  const influence = round(num(raw.i_score), 2);
  if (tech === 0 && business === 0 && influence === 0) return null;
  const details = isObj(raw.e_score_details) ? raw.e_score_details : {};
  const breakdown: ScorePart[] = [];
  for (const [key, field] of BREAKDOWN) {
    const score = optionalNum(details[field]);
    if (score === null) continue;
    breakdown.push({
      key,
      score: round(score, 2),
      percentile: percentile(details[`${field}_percentile`]),
    });
  }
  return {
    tech,
    business,
    influence,
    techPercentile: percentile(details.e_score_percentile),
    breakdown,
  };
}

function shapeLinks(raw: Obj, laprasId: string): Link[] {
  const links: Link[] = [];
  for (const [key, field, label] of LINK_FIELDS) {
    const href = url(raw[field]);
    if (href) links.push({ key, label, url: href });
  }
  links.push({
    key: "lapras",
    label: "LAPRAS",
    url: `https://lapras.com/public/${laprasId}`,
  });
  const site = objects(raw.selections)[0];
  if (site && url(site.url)) {
    links.push({
      key: "site",
      label: str(site.title) || "Website",
      url: url(site.url),
    });
  }
  return links;
}

function shapeArticles(raw: Obj): Article[] {
  return ARTICLE_SOURCES.flatMap(([field, source, dateField]) =>
    objects(raw[field]).map((a) => ({
      date: day(a[dateField]),
      title: str(a.title),
      url: url(a.url),
      source,
    })),
  )
    .filter((a) => a.title)
    .sort(newestFirst);
}

function shapeTalks(raw: Obj): Talk[] {
  return objects(raw.speaker_deck_slides)
    .map((s) => ({
      date: day(s.presentation_date),
      title: str(s.title),
      url: url(s.url),
    }))
    .filter((t) => t.title)
    .sort(newestFirst);
}

function shapeRepos(raw: Obj): Repo[] {
  return objects(raw.github_repositories)
    .map((r) => ({
      name: str(r.title),
      url: url(r.url),
      language: str(r.language),
      stars: num(r.stargazers_count),
      description: str(r.description),
    }))
    .filter((r) => r.name)
    .sort(
      (a, b) => b.stars - a.stars || cmp(a.name, b.name) || cmp(a.url, b.url),
    );
}

function shapeEvents(raw: Obj): EventItem[] {
  return objects(raw.events)
    .map(
      (e): EventItem => ({
        date: day(e.date),
        title: str(e.title),
        url: url(e.url),
        role:
          e.is_presenter === true
            ? "speaker"
            : e.is_organizer === true
              ? "organizer"
              : "attendee",
      }),
    )
    .filter((e) => e.title)
    .sort(newestFirst);
}

function shapeLanguages(raw: Obj): Language[] {
  return objects(raw.programming_languages)
    .map((l) => ({ name: str(l.name), bytes: num(l.bytes) }))
    .filter((l) => l.name)
    .sort((a, b) => b.bytes - a.bytes || cmp(a.name, b.name));
}

function shapeSkills(raw: Obj): Skill[] {
  return objects(raw.skill_tags)
    .map((s) => ({ name: str(s.name), level: num(s.level) }))
    .filter((s) => s.name)
    .sort((a, b) => b.level - a.level || cmp(a.name, b.name));
}

function shapeActivities(raw: Obj): Activity[] {
  return objects(raw.activities)
    .map((a) => ({
      at: str(a.date),
      title: str(a.title),
      url: url(a.url),
      type: str(a.type),
    }))
    .filter((a) => a.title)
    .sort(
      (a, b) =>
        cmp(b.at, a.at) ||
        cmp(a.title, b.title) ||
        cmp(a.url, b.url) ||
        cmp(a.type, b.type),
    )
    .map(({ at, ...rest }) => ({ date: day(at), ...rest }));
}

export function shape(
  input: unknown,
  laprasId: string,
): { data: PortfolioData; avatarUrl: string | null } {
  const raw = isObj(input) ? input : {};
  const repos = shapeRepos(raw);
  const data: PortfolioData = {
    laprasId,
    name: str(raw.name) || laprasId,
    bio: str(raw.description),
    role: isObj(raw.occupation) ? str(raw.occupation.name) : "",
    organization: isObj(raw.organization) ? str(raw.organization.name) : "",
    location: isObj(raw.location) ? str(raw.location.name) : "",
    avatar: null,
    scores: shapeScores(raw),
    links: shapeLinks(raw, laprasId),
    articles: shapeArticles(raw),
    talks: shapeTalks(raw),
    repos,
    events: shapeEvents(raw),
    languages: shapeLanguages(raw),
    skills: shapeSkills(raw),
    activities: shapeActivities(raw),
    counts: {
      publicRepos: num(raw.github_public_repos),
      stars: repos.reduce((total, r) => total + r.stars, 0),
      followers: num(raw.github_followers),
    },
  };
  return { data, avatarUrl: url(raw.iconimage_url) || null };
}
