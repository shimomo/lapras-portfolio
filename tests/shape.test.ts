import { expect, test } from "vitest";
import { shape } from "../src/shape.js";
import { hostileRaw, shimomoRaw, sparseRaw } from "./fixtures/raw.js";

test("shapes the real shimomo data", () => {
  const { data, avatarUrl } = shape(shimomoRaw, "shimomo");
  expect(data.laprasId).toBe("shimomo");
  expect(data.name).toBe("Yuichi Shimo");
  expect(data.bio).toBe("バックエンド寄りのフルスタックエンジニア");
  expect(data.role).toBe("バックエンドエンジニア");
  expect(data.location).toBe("Japan");
  expect(data.organization).toBe("");
  expect(data.scores?.tech).toBe(3.43);
  expect(data.scores?.business).toBe(3.48);
  expect(data.scores?.influence).toBe(2.65);
  expect(data.scores?.techPercentile).toBe(80.7);
  expect(data.scores?.breakdown).toEqual([
    { key: "github", score: 3.37, percentile: 77.4 },
    { key: "articles", score: 3.32, percentile: 74.1 },
    { key: "events", score: 0, percentile: null },
    { key: "skill tags", score: 4.03, percentile: 98.1 },
  ]);
  expect(data.links.map((l) => l.key)).toEqual([
    "github",
    "zenn",
    "speakerdeck",
    "connpass",
    "lapras",
    "site",
  ]);
  expect(data.links[0]).toEqual({
    key: "github",
    label: "GitHub",
    url: "https://github.com/shimomo",
  });
  expect(data.links.find((l) => l.key === "lapras")?.url).toBe(
    "https://lapras.com/public/shimomo",
  );
  expect(data.links.at(-1)).toEqual({
    key: "site",
    label: "Yuichi Shimo | 経歴と作ったもの",
    url: "https://shimomo.net/",
  });
  expect(data.articles).toHaveLength(3);
  expect(data.articles[0]).toMatchObject({
    date: "2026-10-17",
    source: "zenn",
  });
  expect(data.repos.slice(0, 3).map((r) => r.name)).toEqual([
    "boatraceopenapi/programs",
    "boatraceopenapi/results",
    "shimomo/narikiri",
  ]);
  expect(data.repos[0]).toMatchObject({ stars: 9, language: "PHP" });
  expect(data.talks.map((t) => t.date)).toEqual([
    "2019-03-21",
    "2018-09-12",
    "2018-09-12",
  ]);
  expect(data.events).toHaveLength(1);
  expect(data.events[0].role).toBe("attendee");
  expect(data.activities).toHaveLength(48);
  expect(data.activities[0]).toMatchObject({
    date: "2026-10-20",
    type: "connpass",
  });
  expect(data.languages[0]).toEqual({ name: "PHP", bytes: 2197429 });
  expect(data.skills).toHaveLength(110);
  expect(data.counts).toEqual({ publicRepos: 26, stars: 41, followers: 12 });
  expect(data.avatar).toBeNull();
  expect(avatarUrl).toMatch(/^https:\/\/media\.scout\.lapras\.com\//);
});

test("sparse data becomes empty, not broken", () => {
  const { data, avatarUrl } = shape(sparseRaw, "someone");
  expect(data.name).toBe("下 雄一");
  expect(data.bio).toBe("");
  expect(data.scores).toBeNull();
  expect(data.links).toEqual([
    {
      key: "lapras",
      label: "LAPRAS",
      url: "https://lapras.com/public/someone",
    },
  ]);
  for (const list of [
    data.articles,
    data.talks,
    data.repos,
    data.events,
    data.languages,
    data.skills,
    data.activities,
  ]) {
    expect(list).toEqual([]);
  }
  expect(data.counts).toEqual({ publicRepos: 0, stars: 0, followers: 0 });
  expect(avatarUrl).toBeNull();
});

test("wrong types are dropped, not thrown", () => {
  const { data } = shape(hostileRaw, "hostile");
  expect(data.skills).toEqual([]);
  expect(data.events).toEqual([]);
  expect(data.languages).toEqual([{ name: "<i>Go</i>", bytes: 0 }]);
  expect(data.repos.find((r) => r.name.endsWith("-1"))?.stars).toBe(0);
  expect(data.repos).toHaveLength(200);
  expect(data.scores?.breakdown).toEqual([]);
  // the non-object article and the one with an empty title are gone
  expect(data.articles).toHaveLength(2);
});

test("unsafe URLs never survive", () => {
  const { data, avatarUrl } = shape(hostileRaw, "hostile");
  const text = JSON.stringify(data);
  expect(text).not.toContain("javascript:");
  expect(text).not.toContain("data:text");
  expect(avatarUrl).toBeNull();
  expect(data.links.map((l) => l.key)).toEqual(["zenn", "lapras"]);
  expect(data.articles.find((a) => a.title.startsWith("あ"))?.url).toBe("");
  expect(data.repos.find((r) => r.name.endsWith("-0"))?.url).toBe("");
});

test("output is deterministic regardless of input order", () => {
  const reversed = Object.fromEntries(
    Object.entries(shimomoRaw).map(([key, value]) => [
      key,
      Array.isArray(value) ? [...value].reverse() : value,
    ]),
  );
  expect(shape(reversed, "shimomo")).toEqual(shape(shimomoRaw, "shimomo"));
});

test("non-object input yields a minimal profile", () => {
  const { data, avatarUrl } = shape(null, "x");
  expect(data.name).toBe("x");
  expect(data.links.map((l) => l.key)).toEqual(["lapras"]);
  expect(data.scores).toBeNull();
  expect(avatarUrl).toBeNull();
});
