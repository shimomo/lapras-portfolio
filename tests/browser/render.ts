// Renders every theme with every fixture into tests/browser/.out/<theme>/<fixture>/
// so the Playwright specs can open them over file://.
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { shape } from "../../src/shape.js";
import { writeSite } from "../../src/site.js";
import { loadThemes } from "../../src/themes.js";
import { hostileRaw, shimomoRaw, sparseRaw } from "../fixtures/raw.js";

const root = fileURLToPath(new URL("../..", import.meta.url));
const outRoot = join(root, "tests/browser/.out");
const fixtures = {
  shimomo: shimomoRaw,
  sparse: sparseRaw,
  hostile: hostileRaw,
};
const meta = { builtAt: "2026-10-20T00:00:00.000Z" };

const themes = await loadThemes(join(root, "themes"));
for (const theme of themes.values()) {
  for (const [name, raw] of Object.entries(fixtures)) {
    const { data } = shape(raw, name);
    await writeSite(join(outRoot, theme.name, name), {
      html: theme.theme.render(data, meta),
      theme,
      avatar: null,
    });
  }
}
console.log(
  `rendered ${themes.size} themes × ${Object.keys(fixtures).length} fixtures`,
);
