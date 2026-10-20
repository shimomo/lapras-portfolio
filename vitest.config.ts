import { configDefaults, defineConfig } from "vitest/config";

// tests/browser/*.spec.ts belong to Playwright (npm run test:browser).
export default defineConfig({
  test: { exclude: [...configDefaults.exclude, "tests/browser/**"] },
});
