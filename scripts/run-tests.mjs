import esbuild from "esbuild";
import { existsSync, mkdirSync, readdirSync, rmSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const testsDir = path.join(repoRoot, "tests");
const outDir = path.join(repoRoot, ".test-dist");

function findTestFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findTestFiles(fullPath));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      files.push(fullPath);
    }
  }
  return files;
}

if (!existsSync(testsDir)) {
  console.error("No tests directory found.");
  process.exit(1);
}

const entryPoints = findTestFiles(testsDir);
if (entryPoints.length === 0) {
  console.error("No test files found.");
  process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

await esbuild.build({
  entryPoints,
  outdir: outDir,
  bundle: true,
  format: "cjs",
  platform: "node",
  target: "node18",
  sourcemap: "inline",
  logLevel: "silent",
  alias: {
    obsidian: path.join(repoRoot, "tests/support/obsidianStub.ts"),
    electron: path.join(repoRoot, "tests/support/electronStub.ts"),
  },
  define: {
    __BUILD_DATE__: JSON.stringify("2026-04-03"),
  },
});

const bundledTests = entryPoints.map((entryPoint) =>
  path.join(outDir, path.relative(testsDir, entryPoint)).replace(/\.ts$/, ".js")
);

const result = spawnSync(process.execPath, ["--test", ...bundledTests], {
  cwd: repoRoot,
  env: { ...process.env, TZ: "America/New_York" },
  stdio: "inherit",
});

rmSync(outDir, { recursive: true, force: true });

if (result.error) {
  throw result.error;
}

process.exit(result.status ?? 1);
