# lapras-portfolio 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** LAPRAS の公開ページ API からポートフォリオを生成して GitHub Pages に公開する仕組みを作る。フォークして `config.json` の ID を書き換えれば、誰でも自分のページを持てるようにする。

**Architecture:** TypeScript のビルドスクリプト（`src/`）が、GitHub Actions 上で次の順に処理する。

1. LAPRAS の JSON を取得し、表示用データ `PortfolioData` に整形する
2. アバター画像をダウンロードする
3. `themes/<name>/index.ts` のテーマで `dist/` に静的サイトを生成し、`actions/deploy-pages` で公開する
4. 整形済みデータを `data/<lapras_id>/portfolio.json` にコミットする

テーマは「`PortfolioData` を受け取って HTML を返す関数」と静的アセットの組み合わせで、ディレクトリを足すだけで増やせる。terminal テーマは各コマンドの出力をビルド時に HTML として生成しておき、ブラウザ側の `terminal.js` はそれを見せるだけにする。

**Tech Stack:** Node.js 22（組み込み fetch）、TypeScript（ESM、strict、NodeNext、import は `.js` 拡張子）、tsx、Vitest、Biome、figlet（ASCII アート）、Playwright（ブラウザでの確認）。生成されるページは素の HTML・CSS・JS。

**Spec:** `docs/superpowers/specs/2026-10-20-lapras-portfolio-design.md`（terminal の試作: `docs/superpowers/specs/2026-10-20-terminal-spike.html`）

## Global Constraints

- Node.js 22 以上（`package.json` の `engines.node` は `">=22"`）。`"type": "module"`。tech-trends と同じ設定（`tsconfig` の NodeNext・strict、Biome の recommended、インデントはスペース 2 つ）
- 実行時の依存は `figlet` だけ。開発用は `typescript`・`tsx`・`vitest`・`@biomejs/biome`・`@types/node`・`@playwright/test`（`1.62.1`）。バージョンは tech-trends の `package.json` に合わせる
- 認証情報は Actions の `GITHUB_TOKEN` だけ。利用者に Secrets や PAT を求めない
- LAPRAS の JSON は `https://lapras.com/public/<lapras_id>.json`。1 回のビルドでの取得は JSON 1 件（失敗したら 1 回だけ再試行）と画像 1 枚だけ。User-Agent は `lapras-portfolio (+https://github.com/shimomo/lapras-portfolio)`
- サイト内の参照は相対パスだけ（`href="/…"` や `src="/…"` は禁止）。`<user>.github.io/<repo>/` でも `<user>.github.io/` でも動くこと
- データ由来の文字列は、生成時にすべてエスケープする。URL は `http://` か `https://` で始まるものだけ通す。ブラウザ側の JS が入力された文字列を画面に出すときは `textContent` を使い、`innerHTML` は使わない
- 画面の説明文は日本語、terminal のコマンド名と出力の見出しは英語
- 上流の `config.json` は `{"lapras_id": "shimomo", "theme": "terminal"}` から変えない（Sync fork で利用者の `config.json` とぶつからないようにするため）
- 整形済みデータの置き場所は `data/<lapras_id>/portfolio.json`。ビルド時刻・署名付き画像 URL のような毎回変わる値は入れない
- 未設定の判定: `lapras_id` が `"shimomo"` で、`GITHUB_REPOSITORY` が `"shimomo/lapras-portfolio"` ではない（未定義でもない）
- 並べ替えで同じ値が並んだときは、文字列の単純比較（`<`、`localeCompare` は使わない）で順序を決める。出力は毎回同じになること
- コミットは Conventional Commits（`feat:` `test:` `docs:` `chore:` `ci:`）。メッセージの末尾に `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` を付ける。git の user 設定は上書きしない（GPG 署名つき）
- ライセンスは MIT（`Copyright (c) 2026 shimomo`）

## Review Focus

1. **LAPRAS の JSON で、フィールドの型が想定と違う。** 例: `skill_tags` がオブジェクト、`stargazers_count` が文字列、`events` が `null`。落ちずに、その項目を空や 0 として扱うこと → Task 3「wrong types are dropped, not thrown」
2. **データに HTML の特殊文字や危険な URL が入っている。** 例: 名前やタイトルに `<script>`・`"`・`'`・`&`、URL が `javascript:` や `data:`。どのテーマでもエスケープされ、URL は捨てられること → Task 3・6・8 の hostile フィクスチャのテスト
3. **区切りのない長い文字列や大量の件数を、スマホ幅（390px）で表示する。** 横スクロールが出ないこと → Task 7・8 の「mobile width has no horizontal scroll」
4. **ブート中にキーを打つ、実行中に Enter を連打する。** 出力が混ざらず、実行中の Enter は無視されること → Task 7「Enter during a running command is ignored」
5. **リポジトリ名が `<user>.github.io` で、ルートに公開される。** 生成した HTML に `/` で始まる参照が無いこと → Task 6・8 の「only relative references」

## File Structure

```
lapras-portfolio/
├── .github/workflows/build-deploy.yml  # 毎日・push・手動: 取得 → 整形 → 生成 → 公開 → データのコミット
├── .github/workflows/ci.yml            # lint・型チェック・テスト・ブラウザテスト
├── config.json                         # 利用者が書き換える唯一のファイル
├── package.json, tsconfig.json, biome.json, playwright.config.ts, .gitignore, LICENSE, README.md
├── data/<lapras_id>/portfolio.json     # 整形済みデータ（Actions がコミット）
├── docs/screenshot.png                 # README 用（Task 10）
├── src/
│   ├── types.ts      # Config, PortfolioData とその部品, BuildMeta, Theme
│   ├── config.ts     # config.json の読み込みと検証
│   ├── guard.ts      # 未設定リポジトリの判定
│   ├── lapras.ts     # Http/Sleep 型, LAPRAS の JSON と画像の取得
│   ├── shape.ts      # LAPRAS の JSON → PortfolioData（正規化）
│   ├── html.ts       # エスケープつきの html`` タグ, raw()
│   ├── format.ts     # 上位何%、スコアの表示、頭文字
│   ├── page.ts       # 全テーマ共通の <head>（title, description, OGP）と REPO_URL
│   ├── themes.ts     # themes/ の読み込み
│   ├── site.ts       # dist/ とデータスナップショットの書き出し
│   ├── build.ts      # runBuild(): 全体の流れ
│   └── cli.ts        # エントリポイント（GITHUB_OUTPUT・GITHUB_STEP_SUMMARY・終了コード）
├── themes/
│   ├── terminal/index.ts, commands.ts, banner.ts, style.css, terminal.js
│   └── dashboard/index.ts, style.css
└── tests/
    ├── fixtures/shimomo.json           # 2026-10-20 に取得した実データ（コミット済み）
    ├── fixtures/raw.ts                 # sparseRaw, hostileRaw
    ├── fixtures/themes/plain/          # ビルドの流れのテスト用の最小テーマ
    ├── *.test.ts, themes/*.test.ts     # Vitest
    └── browser/render.ts, *.spec.ts    # Playwright（render.ts が tests/browser/.out/ に HTML を出力する）
```

---

### Task 1: プロジェクトの雛形、設定ファイル、未設定の判定

**Files:**
- Create: `package.json`, `tsconfig.json`, `biome.json`, `.gitignore`, `LICENSE`, `config.json`, `src/types.ts`, `src/config.ts`, `src/guard.ts`
- Test: `tests/config.test.ts`, `tests/guard.test.ts`

**Interfaces:**
- Produces:
  - `src/types.ts`: `interface Config { laprasId: string; theme: string }`
  - `src/config.ts`: `DEFAULT_THEME = "terminal"`、`class ConfigError extends Error`、`parseConfig(text: string, themes: readonly string[]): Config`、`loadConfig(path: string, themes: readonly string[]): Promise<Config>`
  - `src/guard.ts`: `UPSTREAM_REPOSITORY = "shimomo/lapras-portfolio"`、`UPSTREAM_LAPRAS_ID = "shimomo"`、`UNCONFIGURED_MESSAGE`、`isUnconfigured(config: Config, repository: string | undefined): boolean`

**設定ファイルの中身:**

- `package.json` の scripts: `build: "tsx src/cli.ts"`、`test: "vitest run"`、`typecheck: "tsc --noEmit"`、`lint: "biome check ."`、`format: "biome format --write ."`。`private: true`、`license: "MIT"`
- `tsconfig.json`: tech-trends と同じ。ただし `"lib": ["ES2022", "DOM"]`、`"include": ["src", "tests", "themes", "playwright.config.ts"]`
- `biome.json`: tech-trends と同じ。除外は `dist`・`data`・`tests/fixtures/*.json`・`tests/browser/.out`・`docs/superpowers/specs/*.html`・`node_modules`・`.superpowers`
- `.gitignore`: `node_modules/`、`dist/`、`tests/browser/.out/`、`test-results/`、`playwright-report/`、`.superpowers/`
- `config.json`: `{ "lapras_id": "shimomo", "theme": "terminal" }`

**エラーメッセージ（この文言で固定）:**

- JSON として読めない: `` `config.json を JSON として読めませんでした: ${error.message}` ``
- オブジェクトではない: `config.json の中身はオブジェクト（{ ... }）にしてください`
- ファイルが無い: `config.json が見つかりません。リポジトリの直下に置いてください`
- `lapras_id` が不正: `config.json の lapras_id が正しくありません。LAPRAS の公開ページ https://lapras.com/public/<ID> の <ID> の部分を書いてください（英数字・ハイフン・アンダースコアのみ）`
- テーマが無い: `` `テーマ "${theme}" はありません。使えるテーマ: ${themes.join(", ")}` ``
- `UNCONFIGURED_MESSAGE`: `config.json の lapras_id がまだ上流の既定値（shimomo）のままです。自分の LAPRAS の ID に書き換えてコミットしてください。書き換えるまで、ページの生成と公開はしません。`

**`lapras_id` の受け付け方:** 前後の空白は取り除く。`https://lapras.com/public/<ID>`（末尾の `/` や `.json` があってもよい）を貼られたら `<ID>` を取り出す。最後に `/^[A-Za-z0-9_-]{1,64}$/` に合わなければエラーにする。

- [ ] **Step 1: 失敗するテストを書く**

```ts
// tests/config.test.ts（themes は ["dashboard", "terminal"]）
test("parses lapras_id and theme", ...);              // → { laprasId: "shimomo", theme: "dashboard" }
test("theme defaults to terminal", ...);              // theme を省略 → "terminal"
test("trims and accepts a pasted LAPRAS URL", ...);   // " https://lapras.com/public/shimomo.json " → "shimomo"
test.each(["", "../etc", "a/b", "shimomo.json", 123, null])("rejects lapras_id %s", ...); // ConfigError、message に "lapras_id が正しくありません"
test("unknown theme lists the available ones", ...);  // message === 'テーマ "neon" はありません。使えるテーマ: dashboard, terminal'
test("broken JSON reports the parse error", ...);     // message が "config.json を JSON として読めませんでした: " で始まる
test("missing file", ...);                            // loadConfig(存在しないパス) → "config.json が見つかりません。…"
// tests/guard.test.ts
test("upstream id in another repository is unconfigured", ...); // ("shimomo", "alice/lapras-portfolio") → true
test("upstream repository itself is configured", ...);          // ("shimomo", "shimomo/lapras-portfolio") → false
test("local runs are never skipped", ...);                      // ("shimomo", undefined) → false
test("own id is configured", ...);                              // ("alice", "alice/lapras-portfolio") → false
```

- [ ] **Step 2: `npm install` 後、`npx vitest run tests/config.test.ts tests/guard.test.ts` → FAIL（モジュールが無い）**
- [ ] **Step 3: `src/types.ts`・`src/config.ts`・`src/guard.ts` を実装する。LICENSE は tech-trends からコピーする**
- [ ] **Step 4: `npm test && npm run typecheck && npm run lint` → すべて PASS**
- [ ] **Step 5: Commit** `chore: scaffold project with config loading and unconfigured guard`

---

### Task 2: LAPRAS からの取得

**Files:**
- Create: `src/lapras.ts`
- Test: `tests/lapras.test.ts`

**Interfaces:**
- Produces:
  - `type Http = (url: string, init?: RequestInit) => Promise<Response>`、`type Sleep = (ms: number) => Promise<void>`
  - `USER_AGENT = "lapras-portfolio (+https://github.com/shimomo/lapras-portfolio)"`
  - `class FetchError extends Error`
  - `laprasJsonUrl(id: string): string` → `` `https://lapras.com/public/${id}.json` ``
  - `fetchLapras(id: string, http: Http, sleep: Sleep): Promise<Record<string, unknown>>` — ヘッダは `User-Agent` と `Accept: application/json`
    - 404 は再試行しない
    - ネットワークエラー、429、5xx は `sleep(3000)` のあと 1 回だけ再試行する
    - そのほかの 4xx は再試行しない
    - JSON として読めない、またはプレーンなオブジェクトではない場合は「想定外」
  - `type Avatar = { bytes: Uint8Array; ext: "jpg" | "png" | "webp" | "gif" }`
  - `fetchAvatar(url: string | null, http: Http): Promise<Avatar | null>` — url が null なら null。2xx 以外、ネットワークエラー、`content-type` が `image/jpeg|png|webp|gif` 以外の場合は `console.warn` して null。再試行しない

**エラーメッセージ（この文言で固定）:**

- 404: `` `LAPRAS のポートフォリオが見つかりません（lapras_id: ${id}）。LAPRAS でポートフォリオが公開設定になっているか、config.json の lapras_id が正しいかを確認してください。` ``
- 取得の失敗: `` `LAPRAS からの取得に失敗しました（${detail}）。一時的な失敗の可能性があります。次回の実行で回復しない場合は、Actions のログを確認してください。` ``（`detail` は `HTTP 503` や例外のメッセージ）
- 想定外: `` `LAPRAS から想定外のデータが返りました（${detail}）。` ``

- [ ] **Step 1: 失敗するテストを書く**（`http` は呼び出しを記録するスタブ、`sleep` は待ち時間を記録するスタブ）

```ts
test("fetches JSON with the user agent", ...);        // URL は https://lapras.com/public/shimomo.json、headers["User-Agent"] === USER_AGENT、結果の name === "Yuichi Shimo"
test("404 is not retried and explains what to check", ...); // 呼び出し 1 回、FetchError、message に "公開設定"
test("503 then 200 succeeds after one retry", ...);   // 呼び出し 2 回、sleep に [3000]
test("network error twice fails as transient", ...);  // 呼び出し 2 回、message に "一時的な失敗"
test("403 is not retried", ...);                      // 呼び出し 1 回、message に "HTTP 403"
test.each(["not json", "[]", "null"])("unexpected body %s", ...); // message に "想定外のデータ"
test("avatar keeps bytes and maps content-type to ext", ...);     // image/png → ext "png"
test.each([[500, "image/png"], [200, "text/html"]])("avatar failure returns null", ...);
test("avatar with null url does not call http", ...);
```

- [ ] **Step 2: `npx vitest run tests/lapras.test.ts` → FAIL**
- [ ] **Step 3: `src/lapras.ts` を実装する**
- [ ] **Step 4: → PASS**
- [ ] **Step 5: Commit** `feat: fetch LAPRAS public JSON and avatar`

---

### Task 3: 表示用データへの整形

**Files:**
- Modify: `src/types.ts`
- Create: `src/shape.ts`, `tests/fixtures/raw.ts`
- Test: `tests/shape.test.ts`（`tests/fixtures/shimomo.json` はコミット済み）

**Interfaces:**
- Produces（`src/types.ts`）:

```ts
export interface Link { key: string; label: string; url: string }
export interface Article { date: string; title: string; url: string; source: "zenn" | "qiita" | "note" | "hatena" | "blog" }
export interface Talk { date: string; title: string; url: string }
export interface Repo { name: string; url: string; language: string; stars: number; description: string }
export interface EventItem { date: string; title: string; url: string; role: "speaker" | "organizer" | "attendee" }
export interface Language { name: string; bytes: number }
export interface Skill { name: string; level: number }
export interface Activity { date: string; title: string; url: string; type: string }
export interface ScorePart { key: "github" | "articles" | "events" | "skill tags"; score: number; percentile: number | null }
export interface Scores { tech: number; business: number; influence: number; techPercentile: number | null; breakdown: ScorePart[] }
export interface PortfolioData {
  laprasId: string; name: string; bio: string; role: string; organization: string; location: string;
  avatar: string | null;            // サイト内のパス（例 "avatar.jpg"）。整形直後は null、ビルドで設定
  scores: Scores | null;            // 3 つとも 0 なら null（未算出）
  links: Link[]; articles: Article[]; talks: Talk[]; repos: Repo[]; events: EventItem[];
  languages: Language[]; skills: Skill[]; activities: Activity[];
  counts: { publicRepos: number; stars: number; followers: number };
}
```

- `shape(raw: unknown, laprasId: string): { data: PortfolioData; avatarUrl: string | null }`（`src/shape.ts`）。例外は投げない
- `tests/fixtures/raw.ts`: `sparseRaw`、`hostileRaw`（後続のテーマのテストでも使う）

**変換の決まり**（試作の `build.py` が元。下の表に無いものはその実装に倣う）:

| 出力 | 元 | 決まり |
| --- | --- | --- |
| `name` | `name` | 空なら `laprasId` |
| `bio` / `role` / `organization` / `location` | `description` / `occupation.name` / `organization.name` / `location.name` | 文字列でなければ `""`。前後の空白を除く |
| `scores` | `e_score`・`b_score`・`i_score`・`e_score_details` | 小数第 2 位で丸める。percentile は 0 より大きいときだけ小数第 1 位で丸めて残し、それ以外は null。breakdown は github=`github_score`、articles=`tech_article_score`、events=`tech_event_score`、skill tags=`tag_count_score`（それぞれ `*_percentile`）。スコアが無い項目は外す |
| `links` | 設計書 6 章の順: github, zenn, qiita, speakerdeck, connpass, note, hatena, x, linkedin, atcoder, docswell, wantedly | `*_html_url`（x は `twitter_html_url`、speakerdeck は `speaker_deck_html_url`）。label は GitHub / Zenn / Qiita / Speaker Deck / connpass / note / はてなブログ / X / LinkedIn / AtCoder / Docswell / Wantedly。続けて `lapras`（label `LAPRAS`、`https://lapras.com/public/<laprasId>`、常に入れる）、最後に `site`（`selections[0]`、label はその title。title が空なら `Website`） |
| `articles` | zenn(`posted_at`)・qiita(`updated_at`)・note(`published_at`)・hatena(`published_at`)・blog(`posted_at`) | 日付の新しい順、同じ日付ならタイトル順 |
| `talks` | `speaker_deck_slides`（`presentation_date`） | 日付の新しい順、同じ日付ならタイトル順 |
| `repos` | `github_repositories`（`title`・`language`・`stargazers_count`・`description`） | スター数の多い順、同じなら名前順 |
| `events` | `events` | role は `is_presenter` → speaker、`is_organizer` → organizer、それ以外は attendee。日付の新しい順 |
| `languages` / `skills` | `programming_languages` / `skill_tags` | bytes の多い順 / level の高い順。同じなら名前順 |
| `activities` | `activities` | 元の日時の新しい順に並べてから `date` を `YYYY-MM-DD` に切る |
| `counts` | `github_public_repos`・`repos` のスター合計・`github_followers` | |
| `avatarUrl` | `iconimage_url` | http(s) でなければ null |

共通の決まり:

- 配列でないもの、オブジェクトでない要素、タイトルが空の要素は捨てる
- 数値は `typeof === "number"` かつ有限のときだけ使い、それ以外は 0 にする
- URL は http(s) のときだけ残す。そうでなければ要素の `url` を `""` にする（links は要素ごと捨てる）
- 日付は `/^\d{4}-\d{2}-\d{2}/` に合えば先頭 10 文字、合わなければ `""`

- [ ] **Step 1: フィクスチャを書く**
  - `sparseRaw`: name `"下 雄一"`、description `""`、スコアはすべて 0、配列はすべて `[]`、`*_html_url` は `""` か `null`、README に載っていないフィールドは無し、`iconimage_url` は `""`
  - `hostileRaw`: name `'<script>alert(1)</script>'`、description `` `"&'<>` ``、区切りのない 300 文字の記事タイトル、記事 URL `javascript:alert(1)`、リポジトリ 200 件（1 件は URL `data:text/html,x`、1 件は `stargazers_count: "9"`）、`skill_tags: {}`、`events: null`、`github_html_url: "javascript:x"`
- [ ] **Step 2: 失敗するテストを書く**

```ts
test("shapes the real shimomo data", () => {
  const { data, avatarUrl } = shape(shimomoRaw, "shimomo");
  expect(data.name).toBe("Yuichi Shimo"); expect(data.role).toBe("バックエンドエンジニア");
  expect(data.scores?.tech).toBe(3.43); expect(data.scores?.techPercentile).toBe(80.7);
  expect(data.scores?.breakdown.find((p) => p.key === "events")?.percentile).toBeNull();
  expect(data.links.map((l) => l.key)).toEqual(["github", "zenn", "speakerdeck", "connpass", "lapras", "site"]);
  expect(data.links.at(-1)).toEqual({ key: "site", label: "Yuichi Shimo | 経歴と作ったもの", url: "https://shimomo.net/" });
  expect(data.articles).toHaveLength(3); expect(data.articles[0]).toMatchObject({ date: "2026-10-17", source: "zenn" });
  expect(data.repos.slice(0, 3).map((r) => r.name)).toEqual(["boatraceopenapi/programs", "boatraceopenapi/results", "shimomo/narikiri"]);
  expect(data.talks.map((t) => t.date)).toEqual(["2019-03-21", "2018-09-12", "2018-09-12"]);
  expect(data.events[0].role).toBe("attendee"); expect(data.activities[0]).toMatchObject({ date: "2026-10-20", type: "connpass" });
  expect(data.counts).toEqual({ publicRepos: 26, stars: 41, followers: 12 });
  expect(data.avatar).toBeNull(); expect(avatarUrl).toMatch(/^https:\/\/media\.scout\.lapras\.com\//);
});
test("sparse data becomes empty, not broken", ...);    // scores null、配列はすべて []、links は lapras だけ、name "下 雄一"、avatarUrl null
test("wrong types are dropped, not thrown", ...);       // hostile: skills []、events []、"9" のリポジトリは stars 0
test("unsafe URLs never survive", ...);                 // JSON.stringify(hostile の data) に "javascript:" と "data:text" が含まれない
test("output is deterministic regardless of input order", ...); // 各配列を逆順にした raw でも toEqual
test("non-object input yields a minimal profile", ...); // shape(null, "x") → name "x"、links は lapras だけ
```

- [ ] **Step 3: `npx vitest run tests/shape.test.ts` → FAIL**
- [ ] **Step 4: `src/shape.ts` を実装する**
- [ ] **Step 5: → PASS、`npm run typecheck` → PASS**
- [ ] **Step 6: Commit** `feat: shape LAPRAS JSON into portfolio data`

---

### Task 4: HTML の部品と共通の `<head>`

**Files:**
- Create: `src/html.ts`, `src/format.ts`, `src/page.ts`
- Modify: `src/types.ts`
- Test: `tests/html.test.ts`, `tests/page.test.ts`

**Interfaces:**
- Produces:
  - `src/types.ts`: `interface BuildMeta { builtAt: string /* ISO 8601 UTC。runBuild が now().toISOString() を入れる */ }`（このリポジトリの URL は定数 `REPO_URL` を使う）
  - `src/html.ts`: `class SafeHtml { constructor(readonly value: string); toString(): string }`、`escapeHtml(s: string): string`（`& < > " '` を置き換える）、`raw(s: string): SafeHtml`、`` html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml `` — 値は文字列化してエスケープする。ただし `SafeHtml` はそのまま埋め込み、配列は平らにして連結し、`null`・`undefined`・`false` は空文字にする
  - `src/format.ts`: `topPercent(p: number | null): number | null`（`Math.max(1, Math.round(100 - p))`）、`formatScore(n: number): string`（`toFixed(2)`）、`initials(data: PortfolioData): string`（name の単語のうち ASCII 英字で始まるものの頭文字を最大 3 文字、大文字で。無ければ `laprasId` を `-` と `_` で区切った単語の頭文字で同じようにする）
  - `src/page.ts`: `REPO_URL = "https://github.com/shimomo/lapras-portfolio"`、`renderHead(opts: { title: string; data: PortfolioData; stylesheets: string[] }): SafeHtml` — 中身は charset、viewport、`<title>`、`meta description`、`og:title`（`` `${name} のポートフォリオ` ``）、`og:description`、`og:type`（`website`）、`<link rel="stylesheet">`（相対パス）。description は bio、bio が空なら `` `${name} のポートフォリオ（LAPRAS のデータから自動生成）` ``。`og:image` は入れない（絶対 URL が要るため。設計書 11 章でビルダーに任された点の判断）

- [ ] **Step 1: 失敗するテストを書く**

```ts
test("interpolations are escaped", ...);          // html`<p>${'<a href="x">&\''}</p>`.value === '<p>&lt;a href=&quot;x&quot;&gt;&amp;&#39;</p>'
test("SafeHtml and arrays nest without double escaping", ...); // html`<ul>${["a<", "b"].map((x) => html`<li>${x}</li>`)}</ul>` → "<ul><li>a&lt;</li><li>b</li></ul>"
test("null, undefined and false render nothing", ...);
test("topPercent", ...);                          // 80.7 → 19、99.9 → 1、null → null
test("initials", ...);                            // "Yuichi Shimo" → "YS"、"John Ronald Reuel Tolkien" → "JRR"、"下 雄一" + "shimomo" → "S"、"下 雄一" + "foo-bar_baz" → "FBB"
test("head carries escaped OGP and relative stylesheets", ...); // hostile の name がエスケープされている、href="style.css"、"og:image" を含まない
test("head falls back to a generated description", ...);        // sparse → content="下 雄一 のポートフォリオ（LAPRAS のデータから自動生成）"
```

- [ ] **Step 2: → FAIL**
- [ ] **Step 3: 実装する**
- [ ] **Step 4: → PASS**
- [ ] **Step 5: Commit** `feat: add escaped html helper, formatting and shared head`

---

### Task 5: テーマの読み込みとビルドの流れ（CLI）

**Files:**
- Modify: `src/types.ts`
- Create: `src/themes.ts`, `src/site.ts`, `src/build.ts`, `src/cli.ts`, `tests/fixtures/themes/plain/index.ts`, `tests/fixtures/themes/plain/plain.css`
- Test: `tests/themes.test.ts`, `tests/build.test.ts`

**Interfaces:**
- Consumes: `loadConfig`・`ConfigError`（Task 1）、`isUnconfigured`・`UNCONFIGURED_MESSAGE`（Task 1）、`fetchLapras`・`fetchAvatar`・`FetchError`・`Http`・`Sleep`・`Avatar`（Task 2）、`shape`（Task 3）、`REPO_URL`（Task 4）
- Produces:
  - `src/types.ts`: `interface Theme { assets: string[]; render(data: PortfolioData, meta: BuildMeta): string }` — `themes/<name>/index.ts` の default export。`assets` はそのディレクトリ内のファイル名で、`dist/` 直下に同じ名前でコピーされる
  - `src/themes.ts`: `type LoadedTheme = { name: string; dir: string; theme: Theme }`、`loadThemes(themesDir: string): Promise<Map<string, LoadedTheme>>`
    - `index.ts` があるサブディレクトリだけを読み、名前順に並べる
    - 読み込みは `import(pathToFileURL(...).href)`
    - default export に `render` 関数と `assets` 配列が無ければ、`` `テーマ "${name}" の index.ts が Theme を default export していません` `` で throw する
  - `src/site.ts`: `writeSite(outDir: string, opts: { html: string; theme: LoadedTheme; avatar: Avatar | null }): Promise<void>`（`outDir` を作り直し、`index.html`・assets・`avatar.<ext>` を書く）、`snapshotPath(rootDir: string, laprasId: string): string`（`data/<id>/portfolio.json`）、`writeSnapshot(rootDir: string, data: PortfolioData): Promise<void>`（`JSON.stringify(data, null, 2) + "\n"`）
  - `src/build.ts`: `type BuildResult = { status: "skipped"; message: string } | { status: "built"; data: PortfolioData; theme: string }`、`interface BuildOptions { rootDir: string; themesDir: string; outDir: string; repository: string | undefined; http: Http; sleep: Sleep; now: () => Date }`、`runBuild(opts: BuildOptions): Promise<BuildResult>`
    - 流れ: テーマを読む → 設定を読む → 未設定なら skipped → 取得 → 整形 → 画像 → 生成 → `writeSite` → `writeSnapshot`
    - 書き出しは、取得と生成がすべて成功してから行う。`ConfigError`・`FetchError` はそのまま投げる
    - 画像が取れたら `data.avatar = "avatar.<ext>"`
  - `src/cli.ts`: `rootDir = process.cwd()`、`themesDir = rootDir/themes`、`outDir = rootDir/dist`、`repository = process.env.GITHUB_REPOSITORY`、`http = fetch`、`sleep = setTimeout` の Promise 版
    - `GITHUB_OUTPUT` があれば `skipped=true|false` を追記する
    - `GITHUB_STEP_SUMMARY` があれば、次の文言を追記する
      - skipped: `` `## まだ設定されていません\n\n${message}\n` ``
      - built: `` `## ${data.name} のページを生成しました（テーマ: ${theme}）\n` ``
      - 失敗: `` `## ビルドに失敗しました\n\n${message}\n` ``
    - `ConfigError`・`FetchError` は `console.error(message)` を出して終了コード 1。それ以外の例外はスタックを出して終了コード 1
- `tests/fixtures/themes/plain/index.ts`: `{ assets: ["plain.css"], render: (d) => html\`<h1>${d.name}</h1>\`.value }`

- [ ] **Step 1: 失敗するテストを書く**（一時ディレクトリに `config.json` を置く。`themesDir` は `tests/fixtures/themes`。http は URL で返し分けるスタブ）

```ts
test("builds the site and the snapshot", async () => {
  // config { lapras_id: "shimomo", theme: "plain" }、JSON は shimomo.json、画像は 200 + image/png
  expect(result.status).toBe("built");
  expect(await readFile(join(out, "index.html"), "utf8")).toContain("<h1>Yuichi Shimo</h1>");
  // dist/plain.css と dist/avatar.png がある
  const snap = JSON.parse(await readFile(join(root, "data/shimomo/portfolio.json"), "utf8"));
  expect(snap.avatar).toBe("avatar.png"); expect(JSON.stringify(snap)).not.toContain("Signature=");
});
test("unconfigured repository is skipped without network", ...); // repository "alice/lapras-portfolio" → skipped、message === UNCONFIGURED_MESSAGE、http は呼ばれない、dist が無い
test("404 writes nothing", ...);                  // FetchError、dist も data/ も無い
test("avatar failure still builds", ...);         // 画像が 500 → built、snap.avatar null、avatar.* が無い
test("rebuilding the same data leaves the snapshot byte-identical", ...);
test("unknown theme name fails with the available list", ...); // theme "neon" → ConfigError、"使えるテーマ: plain"
// tests/themes.test.ts
test("loads theme directories with index.ts", ...); // tests/fixtures/themes → ["plain"]
test("rejects a theme without a proper default export", ...); // 一時ディレクトリに default export {} の index.ts → 決まった文言
```

- [ ] **Step 2: → FAIL**
- [ ] **Step 3: 実装する**
- [ ] **Step 4: → PASS、typecheck・lint → PASS**（CLI を実際に動かす確認は、テーマができる Task 6 で行う）
- [ ] **Step 5: Commit** `feat: load themes and run the build pipeline`

---

### Task 6: terminal テーマ（HTML の生成）

**Files:**
- Modify: `package.json`（依存に `figlet` を追加）
- Create: `themes/terminal/index.ts`, `themes/terminal/commands.ts`, `themes/terminal/banner.ts`, `themes/terminal/style.css`, `themes/terminal/terminal.js`（この Task では空のファイル。中身は Task 7）
- Test: `tests/themes/terminal.test.ts`

**Interfaces:**
- Consumes: `PortfolioData`・`BuildMeta`・`Theme`、`html`・`raw`・`SafeHtml`、`renderHead`・`REPO_URL`、`topPercent`・`formatScore`・`initials`
- Produces:
  - `banner.ts`: `banner(data: PortfolioData): string` — `figlet.textSync(initials(data), { font: "Big" })` の末尾の空行を削ったもの
  - `commands.ts`: `interface Command { key: string; usage: string; desc: string; transcript: boolean; body: SafeHtml }`、`buildCommands(data: PortfolioData, meta: BuildMeta): Command[]`、`bootLines(data: PortfolioData): string[]`
  - `index.ts`: default export `{ assets: ["style.css", "terminal.js"], render }`

**コマンドと出力**（試作の出力を、データのあるものだけビルド時に生成する。コマンドは設計書 7.2 の表、`neofetch` は同じ節の「neofetch の出力」のとおり）:

- 実行済みの画面に並べるもの（`transcript: true`）。この順で、データがあるときだけ:
  - `neofetch`
  - `ls articles`、`ls repos`、`ls talks`、`ls events`
  - `lapras score`（scores があるとき）
  - `langs`、`skills`、`git log`
  - `open`、`cat README.md`
- テンプレートとしてだけ持つもの（`transcript: false`）: `help`、`whoami`、`ls`、`sudo`、`sudo hire`、`exit`
- `help` の一覧に出すのは、存在するコマンドの usage と `history`・`clear`（説明は試作の文言）。`sudo`・`exit`・`echo` は出さない
- `bootLines`: `"neofetch"`。記事があれば `"ls articles | head -3"`、リポジトリがあれば `"ls repos | head -5"` を足す
- `cat README.md` の本文: `このページは LAPRAS の公開 API から毎日自動で生成されています。` / `このリポジトリをフォークして ID を書き換えるだけで、同じページを GitHub Pages に作れます。` / `built at <builtAt の YYYY-MM-DD HH:mm UTC> · source: <REPO_URL へのリンク> · data: <LAPRAS へのリンク>`
- `sudo hire` は 2 行: `[sudo] password for recruiter: ********` と、`data-delay="600"` を付けた `Access granted. 続きは <LAPRAS へのリンク> でどうぞ。`。`sudo` は `recruiter is not in the sudoers file. This incident will be reported. (hint: sudo hire-me)`
- `exit` は `logout` と `……と見せかけて、まだここにいます。`

**HTML の約束**（Task 7 の `terminal.js` がこの形を前提にする。クラス名と属性名はこのとおりにする）:

```html
<body class="terminal">
<main id="term" data-user="{laprasId}" data-host="lapras">
  <div id="out">
    <p class="line dim" id="last-login">Last login: {builtAt の toDateString 相当} from lapras.com</p>
    <section class="cmd" data-cmd="{key}" data-boot="{boot 行。boot で打つものだけ}">
      <div class="line">{PS1}<span class="typed">{boot 行 または key}</span></div>
      <div class="out">…</div>
    </section>
    …
  </div>
  <div id="inputline" class="line" hidden>{PS1}<input id="in" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="command"></div>
</main>
<template data-cmd="{key}" data-usage="{usage}"><div class="out">…</div></template>   <!-- transcript: false のもの -->
<template id="hint"><div class="line"><span class="dim">type </span><span class="run" data-run="help">help</span><span class="dim"> to see what else is here.</span></div></template>
<div id="skip" hidden>press any key to skip</div>
<script src="terminal.js" defer></script>
```

- PS1 は `<span class="ps1"><span class="u">{id}@lapras</span>:<span class="p">~</span>$ </span>`
- 一覧の出力は `<div class="rows">` の中に、1 件ずつ `<div class="row">` を並べる。`.row` は `display: contents` にして、セルの位置を `.rows` のグリッドでそろえる
- クリックで実行できる要素は `<span class="run" data-run="{コマンド}">`。対象は help の各行、`ls` のディレクトリ名、`open` の名前
- `open` の各行は `<div class="row" data-key="{link.key}">` で、URL のリンクを `<a href target="_blank" rel="noopener">` で持つ
- `<title>` は `{laprasId}@lapras: ~`。`renderHead` を使う

- [ ] **Step 1: 失敗するテストを書く**（shimomo・sparse・hostile を `shape` で整形して `render` する）

```ts
test("boot lines follow the data", ...);           // shimomo → ["neofetch", "ls articles | head -3", "ls repos | head -5"]、sparse → ["neofetch"]
test("transcript holds every available command in order", ...); // shimomo の section[data-cmd] の並び === ["neofetch","ls articles","ls repos","ls talks","ls events","lapras score","langs","skills","git log","open","cat README.md"]
test("commands without data disappear everywhere", ...); // sparse: "lapras score"・"langs"・"git log" の section も template も無く、help の本文にも出ない
test("help lists usages plus history and clear, not hidden ones", ...);
test("score shows top percent only where it exists", ...); // shimomo: "top 19%" を含み、"top 100%" を含まない
test("hostile data is escaped", ...);              // "&lt;script&gt;alert(1)&lt;/script&gt;" を含む。<script は terminal.js の 1 つだけ。href に javascript: が無い
test("only relative references", ...);             // /(?:href|src)="\//.test(html) === false
test("banner uses initials in the Big font", ...); // banner(shimomo) の行数 ≤ 7、"__" を含む
```

- [ ] **Step 2: → FAIL**
- [ ] **Step 3: `npm install figlet` のうえで実装する。`style.css` は試作の CSS を土台にし、`.rows` のグリッド、`.row { display: contents }`、長い文字列の折り返し（`overflow-wrap: anywhere`）を入れる**
- [ ] **Step 4: → PASS、typecheck・lint → PASS。CLI も確かめる: `GITHUB_REPOSITORY=alice/lapras-portfolio npm run build` → 終了コード 0 で `UNCONFIGURED_MESSAGE` を出し、`dist/` を作らない**
- [ ] **Step 5: Commit** `feat: render the terminal theme at build time`

---

### Task 7: terminal テーマ（ブラウザ側の動き）

**Files:**
- Modify: `themes/terminal/terminal.js`, `package.json`（devDependency `@playwright/test@1.62.1`、script `"test:browser": "tsx tests/browser/render.ts && playwright test"`）
- Create: `playwright.config.ts`（`testDir: "tests/browser"`、`timeout: 60_000`、`workers: 1`、`reporter: "list"`）、`tests/browser/render.ts`、`tests/browser/terminal.spec.ts`

**Interfaces:**
- Consumes: Task 6 の HTML の約束、`writeSite`・`loadThemes`（Task 5）、`shape`・フィクスチャ（Task 3）
- Produces: `tests/browser/render.ts` — shimomo・sparse・hostile を、読み込んだ全テーマで `tests/browser/.out/<theme>/<fixture>/` に書き出す（avatar は null、builtAt は `2026-10-20T00:00:00Z`）。Task 8 もこれを使う

**`terminal.js` の動き**（設計書 7.2。試作の JS が土台。ただしデータから HTML を組み立てず、生成済みの出力を複製して使う）:

- 読み込み時の準備
  - `section.cmd` と `template[data-cmd]` から、key → 出力ノードの対応表を作る
  - `#out` の中身を空にし、`#last-login` だけを残して日付を現在に置き換える
  - `#skip` と `#inputline` の `hidden` を切り替える
- ブート
  - `section[data-boot]` の boot 行を順に 1 文字ずつ打って実行する（35〜90ms/文字、各行の前に 350ms、実行後に 500ms）
  - 最後に `#hint` を出して入力待ちにする
  - 何かキーを押すかクリック（pointerdown）するとスキップする。`prefers-reduced-motion: reduce` なら待ち時間をすべて 0 にする
- 入力の解釈
  - `|` で分け、`head -N` と `head -n N` だけを解釈して先頭 N 個の `.row` 以外を消す
  - 空白をまとめる。`ls` の引数の `~/` と末尾の `/` を除く。`-` で始まる引数は無視する
  - 別名を正規化する: `lapras` → `lapras score`、`git` → `git log`、`cat`・`cat readme.md`（大文字小文字は問わない）→ `cat README.md`、`ll`・`dir` → `ls`
  - `sudo` の引数に `hire` を含めば `sudo hire`、それ以外は `sudo`
- JS で処理するもの
  - `clear`・Ctrl+L は画面をクリアする
  - `history` は入力した順に番号つきで出す
  - `echo` は引数をそのまま出す
  - `open <名前>` は `open` の出力から `[data-key]` のリンクを探し、`opening <url> …` と出して `window.open(url, "_blank", "noopener")` を呼ぶ。名前が無ければ `` open: unknown target '<名前>'. try `` と、`open` を実行するリンク
  - 存在しないコマンドは `<名前>: command not found. try help`（`help` はクリックで実行できる）
  - 入力された文字列は、どれも `textContent` で出す
- 出力と入力の補助
  - `data-delay` の付いた行は、その ms だけ待ってから出す
  - コマンドの実行中は Enter を無視する
  - Tab で補完する。1 語目はコマンド名と `git`・`lapras`、2 語目は `ls` ならディレクトリ名、`open` なら `[data-key]` の名前。候補が複数なら一覧を出す
  - ↑↓ で履歴をたどる。Ctrl+C は入力を破棄して `^C` を出す
  - `.run[data-run]` のクリックで、そのコマンドを実行する
  - リンクやボタン以外をクリックして、文字列を選択していなければ入力欄にフォーカスする

- [ ] **Step 1: 失敗するテストを書く**（`file://` で `.out/terminal/<fixture>/index.html` を開く。`pageerror` を集め、各テストの最後に空であることを確かめる）

```ts
test("boot plays to the end and waits for input", ...);     // shimomo: 30s 以内に #inputline が見える。打たれた行が bootLines と同じ順
test("any key skips the boot", ...);                        // 500ms 後に Space → 2s 以内に入力待ち、ブートの出力が 3 つともある
test("reduced motion shows everything immediately", ...);   // reducedMotion: "reduce" → 1s 以内に入力待ち
test("without JS the full transcript is visible", ...);     // javaScriptEnabled: false → section.cmd が 11 個見える、#inputline は見えない
test("commands produce their outputs", ...);                // help、lapras score（"top 19%"）、ls ~/talks/（.row 3 つ）、git log | head -n 2（.row 2 つ）、foo（"foo: command not found. try help"）
test("typed text is shown literally", ...);                 // echo <b>x</b> → 出力の textContent が "<b>x</b>"、b 要素は増えない
test("sudo hire-me reveals the punchline", ...);            // "Access granted." が出る
test("Enter during a running command is ignored", ...);     // sudo hire-me を Enter、すぐに help を Enter → "Access granted." が出たあと、help の出力が無い
test("tab completion and history", ...);                    // "la"+Tab → "lapras "、"ls ta"+Tab → "ls talks "、↑ で直前のコマンド
test("help entries are clickable", ...);                    // help の "langs" をクリック → langs の出力
test("sparse data boots with neofetch only", ...);          // sparse: section[data-boot] が 1 つ、help に "langs" が無い
test("mobile width has no horizontal scroll", ...);         // 390x844、hostile、スキップ後 → documentElement.scrollWidth <= 390
```

- [ ] **Step 2: `npm install -D @playwright/test@1.62.1 && npx playwright install chromium && npm run test:browser` → FAIL**
- [ ] **Step 3: `terminal.js` を実装する**
- [ ] **Step 4: `npm run test:browser` → PASS、`npm test` → PASS**
- [ ] **Step 5: Commit** `feat: drive the terminal theme in the browser`

---

### Task 8: dashboard テーマ

**Files:**
- Create: `themes/dashboard/index.ts`, `themes/dashboard/style.css`
- Test: `tests/themes/dashboard.test.ts`, `tests/browser/dashboard.spec.ts`

**Interfaces:**
- Consumes: Task 4 の部品、`Theme`、`tests/browser/render.ts`（Task 7。dashboard は自動的に書き出される）
- Produces: default export `{ assets: ["style.css"], render }`。JS は持たない

**中身**（設計書 7.3。ブラウザで見せたモックアップ B の方向性。明るい背景のカードグリッド）:

| カード | 見出し | 中身 | データが無いとき |
| --- | --- | --- | --- |
| プロフィール | なし | アバター（`data.avatar` があれば `<img src="{avatar}" alt="">`、無ければ `initials` を入れた四角）、名前、肩書き・所属・所在地、bio、`links` のリンク | （常に出す） |
| スコア | `技術力`・`ビジネス力`・`影響力` | `formatScore` の値とバー。技術力には `上位 N%`（`topPercent`） | scores が null なら出さない |
| 言語 | `言語` | 上位 8 件の構成比の帯と凡例 | 0 件なら出さない |
| リポジトリ | `人気のリポジトリ` | 上位 6 件。名前・説明・言語・★ | 0 件なら出さない |
| 記事 | `記事` | 一覧 | 0 件なら出さない |
| 登壇 | `登壇` | 一覧 | 0 件なら出さない |
| イベント | `イベント` | 一覧 | 0 件なら出さない |
| 活動 | `最近の活動` | 上位 10 件 | 0 件なら出さない |

- フッター: `LAPRAS のデータから自動生成 · 最終更新 {builtAt の YYYY-MM-DD} · ` に続けて、`このページの作り方` を `REPO_URL` へのリンクにする
- `<title>` は `` `${name} | ポートフォリオ` ``
- 配色やカードの配置はおまかせ。スマホ幅では 1 列にする

- [ ] **Step 1: 失敗するテストを書く**

```ts
test("shows scores with top percent", ...);          // shimomo: "上位 19%"、"3.43"
test("cards without data are omitted", ...);         // sparse: "技術力"・"人気のリポジトリ"・"記事" を含まない。名前と LAPRAS へのリンクは含む
test("avatar or initials", ...);                     // avatar "avatar.jpg" → <img src="avatar.jpg"、null → "YS" を含む
test("hostile data is escaped and has no script", ...); // "<script" を含まない、href に javascript: が無い
test("only relative references", ...);
// tests/browser/dashboard.spec.ts
test("renders without page errors", ...);            // shimomo・sparse・hostile
test("mobile width has no horizontal scroll", ...);  // 390x844、hostile
```

- [ ] **Step 2: → FAIL**
- [ ] **Step 3: 実装する**
- [ ] **Step 4: `npm test && npm run test:browser` → PASS**
- [ ] **Step 5: Commit** `feat: add the dashboard theme`

---

### Task 9: GitHub Actions と README

**Files:**
- Create: `.github/workflows/build-deploy.yml`, `.github/workflows/ci.yml`, `README.md`

**`build-deploy.yml`**（値はこのとおりにする）:

```yaml
name: build-deploy
on:
  schedule:
    - cron: "23 21 * * *"   # 06:23 JST
  push:
    branches: [main]
    paths-ignore: ["data/**", "docs/**", "tests/**", "**.md"]
  workflow_dispatch:
permissions:
  contents: write
  pages: write
  id-token: write
  actions: write
concurrency:
  group: build-deploy
  cancel-in-progress: false
jobs:
  build:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    outputs:
      skipped: ${{ steps.build.outputs.skipped }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: npm }
      - run: npm ci
      - id: build
        run: npm run build
      - if: steps.build.outputs.skipped == 'false'
        uses: actions/upload-pages-artifact@v3
        with: { path: dist }
      - name: Commit data
        if: steps.build.outputs.skipped == 'false'
        run: |   # tech-trends の collect.yml と同じ手順。add するのは data/、メッセージは "data: <lapras_id> YYYY-MM-DD"（JST）
      - name: Keep the schedule alive
        if: github.event_name == 'schedule' && steps.build.outputs.skipped == 'false'
        env: { GH_TOKEN: "${{ github.token }}" }
        run: gh api -X PUT "repos/${{ github.repository }}/actions/workflows/build-deploy.yml/enable"
  deploy:
    needs: build
    if: needs.build.outputs.skipped == 'false'
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- 「Keep the schedule alive」は、60 日停止への対策として、ワークフロー自身を Actions API で有効化し直すもの（keepalive-workflow の API モードと同じ考え方。設計書 8 章でビルダーに任された点の判断）。データが変わった日のコミットも活動として数えられる
- `lapras_id` は `node -p "require('./config.json').lapras_id"` で読む

**`ci.yml`**: push（main）と pull_request で、`npm ci` → `npm run lint` → `npm run typecheck` → `npm test` → `npx playwright install --with-deps chromium` → `npm run test:browser`

**README.md**（日本語。設計書 9 章の内容を、この順で書く）:

1. タイトルと 1 行の説明
2. デモへのリンク（`https://shimomo.github.io/lapras-portfolio/`）と `docs/screenshot.png`（Task 10 で作る）
3. 「自分のページを作る」: 前提と手順 1〜4
4. 「修正を取り込む」: Sync fork → Update branch。`config.json` と `data/<自分の ID>/` は上流とぶつからないこと
5. 「テンプレートから作る場合」: 手順 2 が要らないかわりに、修正が届かないこと
6. 「テーマ」: 切り替え方（`theme` に `terminal` か `dashboard` を書く）、terminal のコマンドの一覧
7. 「テーマを足す」: `themes/<name>/index.ts` で `Theme`（`src/types.ts`）を default export する。`assets` に CSS や JS を並べる。データの形は `PortfolioData`
8. 「うまくいかないとき」: Pages の Source、Actions が有効か、404（公開設定と ID）、更新が止まった（Actions タブで有効化）、「まだ設定されていません」が出る（`lapras_id` を書き換える）
9. クレジット（[lapras-inc/public-api-schema](https://github.com/lapras-inc/public-api-schema)）とライセンス

- [ ] **Step 1: 2 つのワークフローと README を書く**
- [ ] **Step 2: ワークフローを読み直し、上の値と一致しているかを確かめる（検証ツールは入れない。実際に動くかは Task 10 の実行で確かめる）**
- [ ] **Step 3: `npm run lint && npm run typecheck && npm test && npm run test:browser` → PASS**
- [ ] **Step 4: Commit** `ci: build and deploy to GitHub Pages daily` と `docs: add README`（2 つに分ける）

---

### Task 10: 実データでの確認と公開

**ここから先は外向きの操作。手順 3 の前に、作者に確認を取る。**

- [ ] **Step 1: 実データでビルドする。** `npm run build` → `dist/index.html` と `dist/avatar.jpg`（拡張子は実際の content-type による）ができ、`data/shimomo/portfolio.json` に `Signature=` が含まれないこと。続けて `GITHUB_REPOSITORY=alice/lapras-portfolio npm run build` → 終了コード 0 で、`UNCONFIGURED_MESSAGE` が出ること
- [ ] **Step 2: スクリーンショットを撮る。** Playwright で `dist/index.html` を 1100x760 で開き、ブートをスキップしたあと `docs/screenshot.png` に保存する。Read で画像を開いて、崩れていないことを目で確かめる。`data/` と `docs/screenshot.png` をコミットする: `chore: add initial data snapshot and screenshot`
- [ ] **Step 3: 作者に確認する。** 確認する内容は次の 3 つ
  - public リポジトリ `shimomo/lapras-portfolio` を作って push する
  - Pages を Source「GitHub Actions」で有効にする
  - Template repository の設定をオンにする
- [ ] **Step 4: 公開する（作者が了承したら）**

```bash
gh repo create shimomo/lapras-portfolio --public --source . --push --description "LAPRAS の公開 API から、フォークするだけで作れるポートフォリオ"
gh api -X POST repos/shimomo/lapras-portfolio/pages -f build_type=workflow
gh api -X PATCH repos/shimomo/lapras-portfolio -F is_template=true -f homepage=https://shimomo.github.io/lapras-portfolio/
gh workflow run build-deploy.yml --repo shimomo/lapras-portfolio
```

- [ ] **Step 5: 確かめる。**
  - `gh run watch` で `build-deploy` と `ci` が緑になる
  - `curl -sS https://shimomo.github.io/lapras-portfolio/` が 200 で、`shimomo@lapras` を含む
  - Actions のサマリーに「Yuichi Shimo のページを生成しました（テーマ: terminal）」が出ている
- [ ] **Step 6: メモリ `lapras-portfolio-project.md` を更新する**（公開日、URL、状態）
