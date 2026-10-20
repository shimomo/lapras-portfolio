import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const pageUrl = (fixture: string) =>
  `file://${fileURLToPath(new URL(`./.out/dashboard/${fixture}/index.html`, import.meta.url))}`;

for (const fixture of ["shimomo", "sparse", "hostile"]) {
  test(`renders without page errors (${fixture})`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(pageUrl(fixture));
    await expect(page.locator("h1")).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("width has no horizontal scroll", async ({ page }) => {
    for (const fixture of ["shimomo", "hostile"]) {
      await page.goto(pageUrl(fixture));
      const width = await page.evaluate(
        () => document.documentElement.scrollWidth,
      );
      expect(width).toBeLessThanOrEqual(390);
    }
  });
});
