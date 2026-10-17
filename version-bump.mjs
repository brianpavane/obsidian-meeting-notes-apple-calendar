/**
 * version-bump.mjs
 *
 * Bumps the plugin version across manifest.json, package.json, and
 * versions.json, and turns the `## [Unreleased]` heading in CHANGELOG.md into
 * `## [X.Y.Z] – YYYY-MM-DD`. Run it only when cutting a release (see
 * RELEASE_PROCESS.md). The npm `version:*` scripts also stage the JSON files.
 *
 * Usage:
 *   node version-bump.mjs patch   →  1.0.0 → 1.0.1
 *   node version-bump.mjs minor   →  1.0.1 → 1.1.0
 *   node version-bump.mjs major   →  1.1.0 → 2.0.0
 *   node version-bump.mjs 1.2.0   →  literal version
 *
 * With no argument, manifest.json and versions.json are synced to the version
 * already in package.json. `npm version <level>` relies on this: npm bumps
 * package.json first, then its "version" lifecycle script runs this file.
 */

import { readFileSync, writeFileSync } from "fs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeJson(path, data) {
  writeFileSync(path, JSON.stringify(data, null, "\t") + "\n", "utf8");
}

function bumpVersion(current, level) {
  const [major, minor, patch] = current.split(".").map(Number);
  if (level === "major") return `${major + 1}.0.0`;
  if (level === "minor") return `${major}.${minor + 1}.0`;
  if (level === "patch") return `${major}.${minor}.${patch + 1}`;
  // Literal version string
  if (/^\d+\.\d+\.\d+$/.test(level)) return level;
  throw new Error(`Unknown bump level: "${level}". Use major, minor, patch, or a semver string.`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const level = process.argv[2];

const manifest = readJson("manifest.json");
const pkg      = readJson("package.json");
const versions = readJson("versions.json");

const oldVersion = manifest.version;
const newVersion = level ? bumpVersion(oldVersion, level) : pkg.version;

if (newVersion === oldVersion) {
  console.log(`Version is already ${oldVersion}. Nothing to do.`);
  process.exit(0);
}

manifest.version = newVersion;
pkg.version      = newVersion;

// versions.json maps plugin version → minimum Obsidian app version.
// Preserve the existing minAppVersion for this release.
const minAppVersion = manifest.minAppVersion;
versions[newVersion] = minAppVersion;

writeJson("manifest.json", manifest);
writeJson("package.json",  pkg);
writeJson("versions.json", versions);

const changelog = readFileSync("CHANGELOG.md", "utf8");
if (changelog.includes("## [Unreleased]")) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const today = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  writeFileSync(
    "CHANGELOG.md",
    changelog.replace("## [Unreleased]", `## [${newVersion}] – ${today}`),
    "utf8"
  );
} else {
  console.warn("CHANGELOG.md has no ## [Unreleased] section — add the release entry by hand.");
}

console.log(`Bumped ${oldVersion} → ${newVersion}`);
