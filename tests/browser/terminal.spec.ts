import { fileURLToPath } from "node:url";
import { expect, type Page, test } from "@playwright/test";

const pageUrl = (fixture: string) =>
  `file://${fileURLToPath(new URL(`./.out/terminal/${fixture}/index.html`, import.meta.url))}`;

let errors: string[] = [];
test.beforeEach(({ page }) => {
  errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
});
test.afterEach(() => {
  expect(errors).toEqual([]);
});

const input = (page: Page) => page.locator("#in");
const outputs = (page: Page) => page.locator("#out > .out");

async function ready(page: Page, fixture = "shimomo") {
  await page.goto(pageUrl(fixture));
  await page.waitForTimeout(300);
  await page.keyboard.press("Space");
  await expect(page.locator("#inputline")).toBeVisible({ timeout: 2000 });
}

async function run(page: Page, line: string) {
  await input(page).fill(line);
  await input(page).press("Enter");
}

test("boot plays to the end and waits for input", async ({ page }) => {
  await page.goto(pageUrl("shimomo"));
  await expect(page.locator("#skip")).toBeVisible();
  await expect(page.locator("#inputline")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("#skip")).toBeHidden();
  await expect(page.locator("#out .typed")).toHaveText([
    "neofetch",
    "ls articles | head -3",
    "ls repos | head -5",
  ]);
  await expect(outputs(page).nth(1).locator(".row")).toHaveCount(3);
  await expect(outputs(page).nth(2).locator(".row")).toHaveCount(5);
  await expect(page.locator("#out")).toContainText("to see what else is here.");
  await expect(input(page)).toBeFocused();
});

test("any key skips the boot", async ({ page }) => {
  await page.goto(pageUrl("shimomo"));
  await page.waitForTimeout(500);
  await page.keyboard.press("Space");
  await expect(page.locator("#inputline")).toBeVisible({ timeout: 2000 });
  await expect(outputs(page)).toHaveCount(3);
  await expect(page.locator("#last-login")).not.toContainText("2026-10-20");
});

test.describe("reduced motion", () => {
  test.use({ contextOptions: { reducedMotion: "reduce" } });
  test("shows everything immediately", async ({ page }) => {
    await page.goto(pageUrl("shimomo"));
    await expect(page.locator("#inputline")).toBeVisible({ timeout: 1000 });
    await expect(outputs(page)).toHaveCount(3);
  });
});

test.describe("without JS", () => {
  test.use({ javaScriptEnabled: false });
  test("the full transcript is visible", async ({ page }) => {
    await page.goto(pageUrl("shimomo"));
    const sections = page.locator("section.cmd");
    await expect(sections).toHaveCount(11);
    for (const section of await sections.all()) {
      await expect(section).toBeVisible();
    }
    await expect(page.locator("#inputline")).toBeHidden();
    await expect(page.locator("#skip")).toBeHidden();
    await expect(page.locator("body")).not.toContainText("to see what else");
  });
});

test("commands produce their outputs", async ({ page }) => {
  await ready(page);
  await run(page, "help");
  await expect(outputs(page).last()).toContainText("クリックでも実行できます");
  await run(page, "lapras score");
  await expect(outputs(page).last()).toContainText("top 19%");
  await run(page, "ls ~/talks/");
  await expect(outputs(page).last().locator(".row")).toHaveCount(3);
  await run(page, "git log | head -n 2");
  await expect(outputs(page).last().locator(".row")).toHaveCount(2);
  await run(page, "cat readme.md");
  await expect(outputs(page).last()).toContainText("# README.md");
  await run(page, "ls nope");
  await expect(page.locator("#out")).toContainText(
    "ls: cannot access 'nope': No such file or directory",
  );
  await run(page, "foo");
  await expect(page.locator("#out > .line").last()).toHaveText(
    "foo: command not found. try help",
  );
});

test("typed text is shown literally", async ({ page }) => {
  await ready(page);
  const before = await page.locator("#out b").count();
  await run(page, "echo <b>x</b>");
  await expect(page.locator("#out > .line").last()).toHaveText("<b>x</b>");
  expect(await page.locator("#out b").count()).toBe(before);
});

test("sudo hire-me reveals the punchline", async ({ page }) => {
  await ready(page);
  await run(page, "sudo hire-me");
  await expect(outputs(page).last().getByText("Access granted.")).toBeVisible();
  await run(page, "sudo rm -rf /");
  await expect(outputs(page).last()).toContainText("not in the sudoers file");
});

test("Enter during a running command is ignored", async ({ page }) => {
  await ready(page);
  const before = await outputs(page).count();
  await run(page, "sudo hire-me");
  await run(page, "help");
  await expect(outputs(page).last().getByText("Access granted.")).toBeVisible();
  await page.waitForTimeout(300);
  await expect(outputs(page)).toHaveCount(before + 1);
  await expect(page.locator("#out")).not.toContainText(
    "クリックでも実行できます",
  );
});

test("tab completion and history", async ({ page }) => {
  await ready(page);
  await input(page).fill("lap");
  await input(page).press("Tab");
  await expect(input(page)).toHaveValue("lapras ");
  await input(page).fill("ls ta");
  await input(page).press("Tab");
  await expect(input(page)).toHaveValue("ls talks ");
  await input(page).fill("la");
  await input(page).press("Tab");
  await expect(input(page)).toHaveValue("la");
  await expect(page.locator("#out > .line").last()).toHaveText("langs  lapras");
  await run(page, "whoami");
  await input(page).press("ArrowUp");
  await expect(input(page)).toHaveValue("whoami");
});

test("help entries are clickable", async ({ page }) => {
  await ready(page);
  await run(page, "help");
  await outputs(page).last().locator('.run[data-run="langs"]').click();
  await expect(outputs(page).last()).toContainText("PHP");
  await expect(page.locator("#out .typed").last()).toHaveText("langs");
});

test("sparse data boots with neofetch only", async ({ page }) => {
  await page.goto(pageUrl("sparse"));
  await expect(page.locator("#inputline")).toBeVisible({ timeout: 10_000 });
  await expect(page.locator("#out .typed")).toHaveText(["neofetch"]);
  await run(page, "help");
  await expect(outputs(page).last()).not.toContainText("langs");
  await run(page, "langs");
  await expect(page.locator("#out > .line").last()).toHaveText(
    "langs: command not found. try help",
  );
});

test.describe("mobile", () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test("width has no horizontal scroll", async ({ page }) => {
    await ready(page, "hostile");
    for (const line of [
      "ls repos",
      "lapras score",
      "open",
      "git log",
      "neofetch",
    ]) {
      await run(page, line);
    }
    const width = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    expect(width).toBeLessThanOrEqual(390);
  });
});
