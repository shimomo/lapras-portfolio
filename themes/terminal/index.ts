import { html } from "../../src/html.js";
import { renderHead } from "../../src/page.js";
import type { BuildMeta, PortfolioData, Theme } from "../../src/types.js";
import { bootLines, buildCommands, HOST } from "./commands.js";

function render(data: PortfolioData, meta: BuildMeta): string {
  const commands = buildCommands(data, meta);
  const boots = new Map(bootLines(data).map((b) => [b.split(" | ")[0], b]));
  const ps1 = html`<span class="ps1"><span class="u">${data.laprasId}@${HOST}</span>:<span class="p">~</span>$ </span>`;
  const lastLogin = new Date(meta.builtAt).toUTCString().slice(0, 16);

  const sections = commands
    .filter((c) => c.transcript)
    .map((c) => {
      const boot = boots.get(c.key);
      return html`<section class="cmd" data-cmd="${c.key}"${boot ? html` data-boot="${boot}"` : ""}>
<div class="line">${ps1}<span class="typed">${boot ?? c.key}</span></div>
<div class="out">${c.body}</div>
</section>
`;
    });
  const templates = commands
    .filter((c) => !c.transcript)
    .map(
      (c) =>
        html`<template data-cmd="${c.key}" data-usage="${c.usage}"><div class="out">${c.body}</div></template>
`,
    );

  return html`<!DOCTYPE html>
<html lang="ja">
<head>
${renderHead({ title: `${data.laprasId}@${HOST}: ~`, data, stylesheets: ["style.css"] })}</head>
<body class="terminal">
<main id="term" data-user="${data.laprasId}" data-host="${HOST}">
<div id="out">
<p class="line dim" id="last-login">Last login: ${lastLogin} from lapras.com</p>
${sections}</div>
<div id="inputline" class="line" hidden>${ps1}<input id="in" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="command"></div>
</main>
${templates}<template id="hint"><div class="line"><span class="dim">type </span><span class="run" data-run="help">help</span><span class="dim"> to see what else is here.</span></div></template>
<div id="skip" hidden>press any key to skip</div>
<script src="terminal.js" defer></script>
</body>
</html>
`.value;
}

const theme: Theme = { assets: ["style.css", "terminal.js"], render };
export default theme;
