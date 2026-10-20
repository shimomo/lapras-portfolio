import figlet from "figlet";
import { initials } from "../../src/format.js";
import type { PortfolioData } from "../../src/types.js";

// Initials only: a full name in a figlet font is too wide for a phone.
export function banner(data: PortfolioData): string {
  return figlet.textSync(initials(data), { font: "Big" }).replace(/\s+$/, "");
}
