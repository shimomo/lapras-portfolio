import { html, type SafeHtml } from "./html.js";
import type { PortfolioData } from "./types.js";

export const REPO_URL = "https://github.com/shimomo/lapras-portfolio";

export function pageDescription(data: PortfolioData): string {
  return (
    data.bio || `${data.name} のポートフォリオ（LAPRAS のデータから自動生成）`
  );
}

// Shared by every theme. No og:image: it needs an absolute URL, and the site
// may live under any <user>.github.io path.
export function renderHead(opts: {
  title: string;
  data: PortfolioData;
  stylesheets: string[];
}): SafeHtml {
  const description = pageDescription(opts.data);
  return html`<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${opts.title}</title>
<meta name="description" content="${description}">
<meta property="og:title" content="${opts.data.name} のポートフォリオ">
<meta property="og:description" content="${description}">
<meta property="og:type" content="website">
${opts.stylesheets.map((href) => html`<link rel="stylesheet" href="${href}">\n`)}`;
}
