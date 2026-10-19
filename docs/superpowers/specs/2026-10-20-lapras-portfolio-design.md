# lapras-portfolio 設計書

作成日: 2026-10-20

## 1. 目的と背景

LAPRAS の公開ページ API（`https://lapras.com/public/<lapras_id>.json`）からポートフォリオページを生成し、GitHub Pages で公開する仕組み。

主役はページそのものではなく**仕組み**。このリポジトリをフォークして、設定ファイルの ID を書き換えるだけで、LAPRAS に登録しているエンジニアなら誰でも自分のポートフォリオを公開できる。作者（shimomo）のページは最初の利用例であり、このリポジトリのデモ（店頭）でもある。

LAPRAS 側も、公開 API を個人のポートフォリオサイトに組み込む用途を想定している（[LAPRAS のお知らせ記事](https://note.lapras.com/lapras_news/method/public_api-release/)）。LAPRAS 公式の画面に似てしまうことは気にしなくてよい。

### なぜ作るか

- 成功の形は「面白がって試す人が出てくること」。見た人が「自分のも作ってみたい」と思い、実際に数分で作れる状態を目指す
- 既定テーマ（terminal）のインパクトは**ギャップ**。ぱっと見ではスカウトや仕事探しのための情報に見えないのに、中身は LAPRAS のスコア・記事・リポジトリ・登壇という、まさにその情報であること

### 先行例

- [lapras-card-readme](https://github.com/kawamataryo/lapras-card-readme): LAPRAS のスコアを GitHub プロフィールにカード表示するツール。「自分の ID で使える」という方向性が近い。README の書き方の参考に

## 2. ゴール / 非ゴール / アンチゴール

### ゴール

- 利用者は 4 ステップ、5 分程度で自分のページを公開できる（手順は 9 章）
- こちらで入れた修正（LAPRAS 側のデータ形式の変更への対応、テーマの改善など）を、利用者は GitHub の「Sync fork」ボタン 1 つで取り込める
- 公開後は 1 日 1 回自動で更新される。利用者の手動操作は不要
- 設定ファイルの 1 行でテーマを切り替えられる。初期テーマは `terminal`（既定）と `dashboard` の 2 つ
- データが少ない人（記事ゼロ、スコア未算出、GitHub 未連携など）でもページが崩れない
- 作者のリポジトリ自体が shimomo のデータで公開され、そのままデモになる
- ページを見た人が「自分も作れる」ことに辿り着ける（このリポジトリへの導線）

### 非ゴール（今回は作らない）

- フォークせずに ID を入力するだけで試せるお試しページ。LAPRAS の API はブラウザから呼べない（CORS）ため中継サーバーが必要になり、GitHub Pages だけで完結する方針と合わない
- サーバー、中継プロキシ、外部 DB、有料サービス
- LAPRAS 以外のデータ源の追加（ただし構造上は妨げない）
- 1 つのサイトに複数人を載せること
- アクセス解析
- 英語 UI。画面の説明文は日本語（terminal のコマンド名は英語）

### アンチゴール（これになったら失敗）

- 試した人のページが崩れる、空白だらけになる、JS エラーで止まる
- 他人（たとえば shimomo）のデータが、利用者のサイトに公開される
- 手順が 5 分を超える、またはコードを読まないと設定できない
- 利用者に Secrets や Personal Access Token の発行を求める
- terminal テーマが、ぱっと見で経歴書に見える
- LAPRAS からの取得に失敗したとき、壊れたページや空のページで上書きされる

## 3. 制約

- GitHub Actions と GitHub Pages だけで動かす。認証情報は Actions が自動発行する `GITHUB_TOKEN` だけを使う
- **LAPRAS の API には CORS ヘッダー（`Access-Control-Allow-Origin`）がない。** ブラウザからは取得できないので、取得はビルド時（Actions）だけで行う
- **`iconimage_url` は署名付き URL で、取得から約 1 時間で失効する**（2026-10-20 に実測）。ビルド時に画像をダウンロードしてサイトに同梱する
- API の README に載っていないフィールドも返ってくる（`e_score_details`、`skill_tags`、`programming_languages`、`selections`、`*_html_url`、`location`、`occupation`、`organization` など）。これらは使うが、すべて**無くても動く**扱いにする。README に載っているフィールドも欠けたり `null` だったりする前提で読む
- 取得できるのは、LAPRAS でポートフォリオを公開設定にしているユーザーだけ（非公開なら取得に失敗する）
- フォークしたリポジトリでは Actions（特に `schedule`）が最初は無効になっている。また public リポジトリでは、60 日間活動がないと `schedule` が自動で止まる
- Pages の公開 URL は `<user>.github.io/<repo>/`（サブパス）か、リポジトリ名が `<user>.github.io` のときは `<user>.github.io/`（ルート）。どちらでも動くよう、サイト内の参照は相対パスだけにする
- 技術は tech-trends に揃える: TypeScript（`tsx` で実行）、Node.js 22 以上（組み込み `fetch`）、Biome、Vitest。生成するページは素の HTML・CSS・JS で、フロントエンドのフレームワークやバンドラーは使わない
- リポジトリは `shimomo/lapras-portfolio`（public）。デモの URL は `https://shimomo.github.io/lapras-portfolio/`
- 利用者のリポジトリは**フォーク**が基本。GitHub の「Template repository」設定もオンにしておき、テンプレートから作っても動くようにする（ただしその場合、修正は届かない）
- **フォークに修正を届けるため、「Sync fork」で衝突しない作りにする:**
  - 整形済みデータは ID ごとのパス（例: `data/<lapras_id>/`）に保存する。上流は `data/shimomo/` だけ、利用者は `data/<自分の ID>/` だけを書き換えるので、ぶつからない
  - `config.json` は利用者のファイルとして扱い、上流では書き換えない。shimomo のデモの設定は既定値（`lapras_id: shimomo`、`theme: terminal`）と同じにしておく。設定項目を足すときも、`config.json` には書かずに既定値で動くようにする
  - 利用者が自分でテーマを足すときは、新しいディレクトリを足すだけで済むようにし、既存のファイルを書き換えずに済む作りにする
- LAPRAS へのアクセスは 1 回のビルドで JSON 1 件と画像 1 枚だけ
- ライセンスは MIT（tech-trends と同じ）

## 4. 全体像

```
config.json  (lapras_id, theme)
   │
[GitHub Actions: build-deploy]  きっかけ: 毎日 1 回 / main への push / 手動実行
   1. fetch   https://lapras.com/public/<lapras_id>.json
   2. shape   LAPRAS の JSON → 表示用データ（6 章）に整形・正規化
   3. avatar  iconimage_url の画像をダウンロード（失効する前に）
   4. render  選ばれたテーマで dist/ に静的サイトを生成（index.html + 画像 + CSS/JS）
   5. deploy  actions/upload-pages-artifact → actions/deploy-pages
   6. commit  整形済みデータ（data/）に変化があれば main にコミット
```

- 生成した HTML はリポジトリにコミットしない。Pages の公開元は「GitHub Actions」
- 取得・整形・生成のどこかで失敗したら、デプロイしない（前回のページがそのまま残る）。ワークフローは失敗（赤）にする
- 整形済みデータをコミットする理由は 2 つ。データの変化を履歴で追えること、定期実行の 60 日停止を避ける助けになること。コミットは中身が変わったときだけにし、署名付き画像 URL やビルド時刻のような毎回変わる値はコミット対象のデータに含めない
- フォークやテンプレートで作った直後のリポジトリには、shimomo の整形済みデータ（`data/shimomo/`）が入っている。サイトは常に「config.json の `lapras_id` でその場で取得したデータ」だけから生成し、コミット済みデータから生成しない（他人のデータを公開しないため）
- **まだ設定していないリポジトリでは何もしない。** `config.json` の `lapras_id` が上流の既定値（`shimomo`）のままで、実行しているリポジトリが `shimomo/lapras-portfolio` ではない場合は、取得もデプロイもせずに成功（緑）で終える。ジョブのサマリー（`$GITHUB_STEP_SUMMARY`）とログに「`config.json` の `lapras_id` を自分の ID に書き換えてください」と出す。こうすると、テンプレートから作った直後やフォークで Actions を有効にした直後の実行が赤くならない。また、設定を終えずに放置されたリポジトリから shimomo のページが毎日公開されることもない

## 5. 設定ファイル

リポジトリ直下の `config.json`。

```json
{
  "lapras_id": "shimomo",
  "theme": "terminal"
}
```

| キー | 必須 | 内容 |
| --- | --- | --- |
| `lapras_id` | 必須 | LAPRAS の公開ページ URL `https://lapras.com/public/<ここ>` の部分 |
| `theme` | 任意 | `terminal` または `dashboard`。省略時は `terminal` |

- 値が不正ならビルドを失敗させ、何が悪くてどう直すかをログに日本語で出す（例: 存在しないテーマ名なら、使えるテーマの一覧を出す）
- 設定項目はこの 2 つで始める。将来増やすときも、書かなければ既定値で動くようにする

## 6. 表示用データ（テーマとの約束）

共通の整形処理が LAPRAS の JSON をこの形に変換し、テーマはこれだけを受け取る。テーマは LAPRAS の JSON を直接読まない。型は TypeScript で定義し、テーマを作る人が参照できるようにする。

含めるもの（試作の `build.py` 相当。詳細な型はビルダーに任せる）:

- **プロフィール:** `lapras_id`、名前、bio（`description`）、肩書き（`occupation.name`）、所属（`organization.name`）、所在地（`location.name`）、アバター画像のサイト内パス（無ければ null）
- **スコア:** 技術力・ビジネス力・影響力、技術力の上位何%（`e_score_percentile` から）、技術力の内訳（GitHub・記事・イベント・スキルタグの各スコアと上位何%）
- **リンク:** GitHub、Zenn、Qiita、Speaker Deck、connpass、note、はてな、X、LinkedIn、AtCoder、Docswell、Wantedly のうち値があるもの。LAPRAS の公開ページ（`https://lapras.com/public/<lapras_id>`）。`selections` の 1 件目（本人が選んだサイトなど）
- **記事:** Zenn・Qiita・note・はてな・ブログをまとめて 1 本の一覧にし、日付の新しい順。出どころ（zenn など）を持つ
- **登壇:** Speaker Deck のスライド、日付の新しい順
- **リポジトリ:** スター数の多い順。名前、URL、主言語、スター数、説明
- **イベント:** connpass などの参加・登壇、日付の新しい順
- **言語:** `programming_languages`（バイト数）
- **スキルタグ:** `skill_tags`、レベルの高い順
- **活動ログ:** `activities`（日付、種類、タイトル、URL）
- **集計:** 公開リポジトリ数、合計スター数、フォロワー数
- **メタ:** ビルド時刻、このリポジトリ（`shimomo/lapras-portfolio`）の URL

正規化のルール:

- 欠けている・`null`・空のものは、空配列か null にそろえる。テーマ側で `undefined` を気にしなくてよいようにする
- スコアがすべて 0 なら「スコア未算出」として扱い、テーマはスコアを出さない
- パーセンタイルが 0 以下・欠けている項目には「上位何%」を付けない（試作で「top 100%」と出た不具合への対策）
- URL は `http://` か `https://` で始まるものだけ通す。それ以外は捨てる
- 日付は `YYYY-MM-DD` にそろえる

## 7. テーマ

### 7.1 共通

- テーマは「表示用データを受け取って HTML を返す関数」と、静的アセット（CSS・JS）のセット。テーマごとに HTML の構造から変えてよい（色だけの差し替えではない）
- 生成する HTML には内容をすべて含める。JS が動かなくても全部読める。JS は演出と操作の上乗せだけ
- データ由来の文字列はすべてエスケープする。クライアント側の JS でも `textContent` などで挿入し、`innerHTML` にデータを流さない
- 全テーマ共通で入れるもの: `<title>`、meta description、OGP（`og:title`・`og:description`・`og:type`）、LAPRAS の公開ページへのリンク、このリポジトリへの導線（「このページの作り方」）
- 新しいテーマの足し方を README に短く書く

### 7.2 terminal（既定）

作者が試作を触って「この形で良い」と確認済み。試作: [`2026-10-20-terminal-spike.html`](2026-10-20-terminal-spike.html)（使い捨ての参考実装。shimomo の実データを埋め込んだ単体 HTML で、ブラウザで開けばそのまま動く）。

見た目:

- 黒背景、等幅フォント、GitHub のダークテーマ系の配色
- デスクトップ幅とスマホ幅（390px）の両方で崩れない

最初の数秒（ブートシーケンス）:

1. `Last login: <日付> from lapras.com` を表示する
2. `neofetch` → `ls articles | head -3` → `ls repos | head -5` を 1 文字ずつ自動入力し、それぞれの結果を出す。データが無いものは打たない
3. `type help to see what else is here.` を出して入力待ちになる（カーソル点滅）

- 何かキーを押すかクリックすると、アニメーションを飛ばして最後まで一気に表示する
- OS の「動きを減らす」設定（`prefers-reduced-motion`）では、最初から全部を表示する
- JS が無効なら、ブートの 3 コマンドに続けて、データのある残りのコマンド（`ls talks`・`ls events`・`lapras score`・`langs`・`skills`・`git log`・`open` など）を実行し終えた状態の画面をそのまま見せる。入力欄は出さない。これで 7.1 の「JS が無くても全部読める」を満たす

出力の作り方:

- 各コマンドの出力は、ビルド時に TypeScript で HTML として生成しておく。エスケープもビルド時の 1 か所で行う
- クライアントの JS は、打たれたコマンドに対応する生成済みの出力を複製して表示するだけにする。データから HTML を組み立てない（試作はクライアント側で組み立てているが、本番ではこうする）
- `| head -N` は、生成済みの行の先頭 N 行だけを見せて実現する
- `history`・`echo`・存在しないコマンドへの返答のように、入力された文字列そのものを扱うものだけは JS で処理する。挿入は `textContent` で行う

`neofetch` の出力:

- 左に名前の ASCII アート（ビルド時に生成。名前が ASCII で表せないときは `lapras_id` を使う）
- 右に `<lapras_id>@lapras` と、Name・Role・Bio・Org・Location・Score・Langs・Repos・Output の各行（値の無い行は出さない）
- 最後にカラーパレットの帯

コマンド:

| コマンド | 内容 |
| --- | --- |
| `help` | 使えるコマンドの一覧 |
| `neofetch` | プロフィールの概要 |
| `whoami` | 名前と bio |
| `ls` / `ls <articles\|talks\|repos\|events>` | 一覧。引数なしならディレクトリ名だけ |
| `lapras score` | 3 つのスコアのバー表示と、技術力の内訳 |
| `langs` | 言語構成のバー表示（上位 8 件） |
| `skills` | スキルタグ |
| `git log` | 活動ログ（ハッシュ風の短い ID 付き） |
| `open` / `open <名前>` | リンク一覧 / 新しいタブで開く |
| `cat README.md` | このページは LAPRAS の API から自動生成されていること、このリポジトリ（作り方）へのリンク、ビルド時刻、LAPRAS のクレジット |
| `history` / `clear` | 履歴 / 画面クリア |
| 隠し: `sudo …` | `hire` を含むと「Access granted.」と LAPRAS へのリンク。それ以外は sudoers のジョーク |
| 隠し: `exit`、`echo` | ちょっとした遊び |

- `ls articles/`、`ls ~/articles` のような書き方も受け付ける
- パイプは `| head -N` と `| head -n N` だけ解釈する
- Tab で補完、↑↓ で履歴、Ctrl+L で画面クリア、Ctrl+C で入力を破棄
- `help` の一覧、`ls` のディレクトリ名、`open` の一覧はクリックでも実行できる（スマホ向け）
- データの無い項目はコマンドごと消す（`help`・補完・`ls` の一覧に出さない）
- 存在しないコマンドには `<cmd>: command not found. try help`
- コマンドの実行中は、次の入力を受け付けない（試作で、`sudo` の結果が次のコマンドに割り込んだ不具合への対策）

### 7.3 dashboard

ブラウザで見せたモックアップ B の方向性。作者の評価は「スタンダード」。

- 明るい背景にカードを並べたグリッド
- プロフィール（アバター・名前・肩書き・bio・リンク）、スコア（技術力には上位何%）、言語構成のバー、人気のリポジトリ、最近の活動、記事・登壇・イベント
- データの無いカードは出さない。スコアが未算出ならスコアのカードを出さない
- 配色、ダークモード対応の有無、カードの配置などの細部はビルダーに任せる

## 8. GitHub Actions

- ワークフロー `build-deploy`: きっかけは `schedule`（1 日 1 回）、`main` への push、手動実行（`workflow_dispatch`）
  - `config.json` を書き換えて push すれば、すぐに自分のページが生成される
- 権限は `contents: write`（データのコミット）、`pages: write`、`id-token: write`（デプロイ）
- `concurrency` で同時実行を防ぐ
- 失敗したら、デプロイせずにワークフローを赤にする。ログには原因と対処を日本語で出す
  - 404: 「LAPRAS でポートフォリオが公開設定になっているか、`config.json` の `lapras_id` が正しいかを確認してください」
  - ネットワークエラー・5xx: 一時的な失敗。次回の実行で回復する旨
  - 想定外のデータの形: どのフィールドで問題が起きたか
- 60 日停止への対策は必須。ただし利用者に追加の操作や Secrets を求めないこと。方式（データが変わったときのコミット、Actions API でのワークフロー再有効化など）はビルダーに任せる
- LAPRAS へのリクエストには、このプロジェクト名とリポジトリ URL を含む User-Agent を付ける
- lint・型チェック・テストは、tech-trends と同じく別のワークフロー `ci` で push と PR のたびに実行する

## 9. 利用者の手順（README）

README の冒頭には、デモ（`https://shimomo.github.io/lapras-portfolio/`）へのリンクと、terminal テーマのブートの GIF（難しければスクリーンショット）を置く。

手順:

0. 前提: LAPRAS でポートフォリオを公開設定にし、公開ページの URL（`https://lapras.com/public/<ID>`）の ID を確認しておく
1. このリポジトリをフォークする
2. フォークした先の Actions タブで、ワークフローを有効にする
3. Settings → Pages → Source を「GitHub Actions」にする
4. `config.json` の `lapras_id` を自分の ID に書き換えてコミットする。数分で `https://<user>.github.io/lapras-portfolio/` に公開される

そのほか README に書くこと:

- 修正の取り込み方: フォークの画面の「Sync fork」→「Update branch」。`config.json` と `data/<自分の ID>/` は上流と衝突しない
- 「Use this template」で作っても動くこと。手順 2 が要らないかわりに、修正は届かない
- テーマの切り替え方と、新しいテーマの足し方
- トラブルシューティング: ページが出ない（Pages の設定、Actions の失敗ログ）、404（公開設定と ID）、更新が止まった
- LAPRAS の API 仕様（[lapras-inc/public-api-schema](https://github.com/lapras-inc/public-api-schema)）へのリンクとクレジット

## 10. テスト

- 整形処理: 実データ（2026-10-20 に取得した `shimomo.json`）と、データの少ない人を想定したフィクスチャで確かめる
  - すべての配列が空、スコアがすべて 0、URL が `null` や空文字、名前が日本語のみ、とても長いタイトル、件数がとても多い、README に載っていないフィールドが丸ごと無い
- 各テーマ: すべてのフィクスチャで HTML が生成でき、データ由来の文字列がエスケープされていること
- terminal: ヘッドレスブラウザで、ブートの完走、スキップ、主なコマンドの実行、スマホ幅の表示で JS エラーが出ないこと（試作もこの方法で確認した。ヘッドレスブラウザによる確認をどこまで自動テストにするかはビルダーに任せる）
- dashboard: すべてのフィクスチャで描画エラーが出ないこと

## 11. ビルダーに任せること

- ディレクトリ構成と、テーマのテンプレートの書き方（タグ付きテンプレートリテラルなど）
- ASCII アートの生成方法とフォント
- dashboard の見た目の細部
- 定期実行の時刻
- 60 日停止対策の方式（条件は 8 章）
- OGP 画像（`og:image`）を入れるかどうか
- `data/` のファイル形式とコミットメッセージ
- 試作のコードをどこまで流用するか

## 12. 決定の出どころ

### 作者が決めたこと

- 目的は「このリポジトリをフォークして ID を書き換えれば自分のポートフォリオができる」という技術的な仕組み。誰かに見せるためのページが主ではない
- デザインを複数用意して切り替えられるようにする
- テーマは terminal（作者自身が使う）と dashboard（スタンダード）
- terminal のインパクトは「ギャップ」
- terminal は試作の形で良い
- 成功は「面白がって試す人が出てくること」
- 作り方の方針（tech-trends に揃える、データをコミット、設定は 2 行）
- 利用者のリポジトリは**フォーク中心**。修正は「Sync fork」で取り込めるようにする（レビュー後の確認で決定。テンプレートで作っても動くが、修正は届かない）
- 規模と方針（数ステップで作れる、壊れないことをテストで担保、OGP、お試しページは作らない）、リポジトリ名 `lapras-portfolio`
- LAPRAS 公式の画面に似ることは気にしない

### Claude の判断（作者が確認していないもの）

- ブラウザで見せたモックアップ A（Minimal）は、作者が触れなかったので外した
- テーマは CSS の差し替えではなく、HTML ごと差し替える方式
- 既定のテーマは terminal
- JS が無効でも全部読める、`prefers-reduced-motion` に従う
- データの無い項目は、表示もコマンドも出さない
- 隠しコマンド（`sudo hire-me` など）
- デプロイは `actions/deploy-pages` で行い、生成した HTML はコミットしない
- 取得に失敗したらデプロイしない。サイトはコミット済みデータからは生成しない
- 画面の説明文は日本語
- User-Agent を付ける
- CI は別ワークフロー
- ライセンスは MIT
- 試作を参考資料としてこのディレクトリに残す
- terminal の各コマンドの出力はビルド時に生成し、クライアントの JS はそれを見せるだけ。JS が無効なら全コマンドの実行後の画面を見せる
- 未設定のリポジトリ（`lapras_id` が `shimomo` のままで、`shimomo/lapras-portfolio` 以外）では何もせず緑で終え、書き換えを促す
- Sync fork で衝突しないための作り（データは ID ごとのパス、上流は `config.json` を書き換えない、テーマはディレクトリを足すだけ）
- Template repository の設定もオンにしておく
