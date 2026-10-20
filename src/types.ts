export interface Config {
  laprasId: string;
  theme: string;
}

export interface Link {
  key: string;
  label: string;
  url: string;
}

export interface Article {
  date: string;
  title: string;
  url: string;
  source: "zenn" | "qiita" | "note" | "hatena" | "blog";
}

export interface Talk {
  date: string;
  title: string;
  url: string;
}

export interface Repo {
  name: string;
  url: string;
  language: string;
  stars: number;
  description: string;
}

export interface EventItem {
  date: string;
  title: string;
  url: string;
  role: "speaker" | "organizer" | "attendee";
}

export interface Language {
  name: string;
  bytes: number;
}

export interface Skill {
  name: string;
  level: number;
}

export interface Activity {
  date: string;
  title: string;
  url: string;
  type: string;
}

export interface ScorePart {
  key: "github" | "articles" | "events" | "skill tags";
  score: number;
  percentile: number | null;
}

export interface Scores {
  tech: number;
  business: number;
  influence: number;
  techPercentile: number | null;
  breakdown: ScorePart[];
}

// Everything a theme gets. Themes never read the LAPRAS JSON directly.
export interface PortfolioData {
  laprasId: string;
  name: string;
  bio: string;
  role: string;
  organization: string;
  location: string;
  /** Site-relative path such as "avatar.jpg"; null until the build downloads one. */
  avatar: string | null;
  /** null when all three scores are 0 (not computed yet). */
  scores: Scores | null;
  links: Link[];
  articles: Article[];
  talks: Talk[];
  repos: Repo[];
  events: EventItem[];
  languages: Language[];
  skills: Skill[];
  activities: Activity[];
  counts: { publicRepos: number; stars: number; followers: number };
}
