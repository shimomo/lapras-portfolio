import { html } from "../../../../src/html.js";
import type { Theme } from "../../../../src/types.js";

// The smallest possible theme, used to test the build pipeline on its own.
const theme: Theme = {
  assets: ["plain.css"],
  render: (data) => html`<h1>${data.name}</h1>`.value,
};

export default theme;
