import { appendFile } from "node:fs/promises";
import { join } from "node:path";
import { runBuild } from "./build.js";
import { ConfigError } from "./config.js";
import { FetchError } from "./lapras.js";

const rootDir = process.cwd();

async function appendEnvFile(name: string, text: string) {
  const path = process.env[name];
  if (path) await appendFile(path, text);
}

try {
  const result = await runBuild({
    rootDir,
    themesDir: join(rootDir, "themes"),
    outDir: join(rootDir, "dist"),
    repository: process.env.GITHUB_REPOSITORY,
    http: (url, init) => fetch(url, init),
    sleep: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: () => new Date(),
  });
  if (result.status === "skipped") {
    console.log(result.message);
    await appendEnvFile("GITHUB_OUTPUT", "skipped=true\n");
    await appendEnvFile(
      "GITHUB_STEP_SUMMARY",
      `## まだ設定されていません\n\n${result.message}\n`,
    );
  } else {
    const line = `${result.data.name} のページを生成しました（テーマ: ${result.theme}）`;
    console.log(line);
    await appendEnvFile("GITHUB_OUTPUT", "skipped=false\n");
    await appendEnvFile("GITHUB_STEP_SUMMARY", `## ${line}\n`);
  }
} catch (error) {
  if (error instanceof ConfigError || error instanceof FetchError) {
    console.error(error.message);
    await appendEnvFile(
      "GITHUB_STEP_SUMMARY",
      `## ビルドに失敗しました\n\n${error.message}\n`,
    );
  } else {
    console.error(error);
  }
  process.exitCode = 1;
}
