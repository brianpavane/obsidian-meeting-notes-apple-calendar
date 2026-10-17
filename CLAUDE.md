# Meeting Notes for Apple Calendar — Claude Instructions

## Project Overview

Obsidian plugin that creates structured notes from calendar events. Written in TypeScript, built with esbuild, tested with a Node-based test runner in `scripts/run-tests.mjs`.

**Primary source: local Apple Calendar** (`authMode: "apple"`) — reads Calendar.app on the Mac via EventKit, optionally limited to specific calendars. This is the default and the only actively supported source. The iCal URL and Google OAuth sources are **deprecated**: keep them working, but don't add features to them.

**Key files:**
- `src/` — TypeScript source
- `main.js` — compiled output (gitignored; uploaded as a GitHub release asset, not committed)
- `manifest.json` — plugin metadata including version
- `versions.json` — maps plugin version → minimum Obsidian app version
- `version-bump.mjs` — release-time bump of manifest.json, package.json, versions.json; stamps the `[Unreleased]` CHANGELOG heading
- `CHANGELOG.md` — Keep a Changelog format, newest entry at top
- `tests/` — test files consumed by `scripts/run-tests.mjs`

---

## Commit Checklist — Required on Every Commit

Before creating any git commit, you MUST complete ALL of the following steps in order:

### 1. Run the Full Test Suite

```bash
npm test
```

All tests must pass. If any test fails, fix the failure before proceeding. Do not commit broken code.

### 2. Update CHANGELOG.md under `[Unreleased]`

Do **not** bump the version on routine commits — the version changes only when cutting a release (see `RELEASE_PROCESS.md`).

Add the change to the `## [Unreleased]` section at the top of `CHANGELOG.md` (below the header, above the newest release). If there is no `[Unreleased]` section, create one there. Follow the existing format:

```markdown
## [Unreleased]

### Fixed / Added / Changed / Removed

**Short title for the change**
One or two sentences describing what changed and why it matters to users.

---
```

Rules:
- Merge into existing `###` groups in `[Unreleased]` rather than repeating headings.
- Group changes under the correct heading(s): `Fixed`, `Added`, `Changed`, `Deprecated`, `Removed`.
- Write each item as a **bolded title** followed by a plain-English description.
- Be specific — describe behaviour change, not implementation detail.

### 3. Update README.md (when behaviour changes)

If the commit changes user-facing behaviour, settings, commands, or UI:
- Update the relevant section(s) in `README.md`.
- Keep the existing structure and formatting.
- Do not add placeholder sections or TODOs.

### 4. Stage and Commit

```bash
git add -p   # or add specific files
git commit -m "type: concise present-tense summary"
```

Commit message format: `type: summary` where type is `fix`, `feat`, `refactor`, `test`, `docs`, or `chore`.

---

## Version Bump Level Guide (at release time)

Pick the level from everything in `[Unreleased]`: the highest-impact change wins.

| Change type | Level | Example |
|---|---|---|
| Bug fix, minor improvement | `patch` | 6.5.3 → 6.5.4 |
| New feature, new setting, new UI | `minor` | 6.5.3 → 6.6.0 |
| Breaking change, major rewrite | `major` | 6.5.3 → 7.0.0 |

---

## Code Conventions

- TypeScript strict mode — no implicit `any`.
- No mocking of the filesystem in tests; use in-memory vault helpers already established in the test suite.
- `npm run build` must succeed (TypeScript compile + esbuild) before committing. `main.js` itself is never committed; it is built and attached to GitHub releases (see `RELEASE_PROCESS.md`).
- Do not add comments unless the logic is genuinely non-obvious.
- Do not add error handling for cases that cannot happen.

---

## Test Runner

```bash
npm test          # run all tests
```

Tests live in `tests/` as `*.test.ts` TypeScript files. The runner (`scripts/run-tests.mjs`) compiles them with esbuild then executes them with Node's built-in `--test` runner. No Jest, no Mocha. Add new test files as `tests/<name>.test.ts`.

Support stubs live in `tests/support/`: `obsidianStub.ts` (Obsidian API mock), `electronStub.ts` (electron mock), `testHelpers.ts` (in-memory vault and plugin helpers). Use these rather than mocking the filesystem directly.

---

## Codebase Refresh — Read Before Working

At the start of every session, before making any changes, read the current state of the codebase. Do not rely on memory of previous sessions — files may have changed.

**Always run at session start:**

```bash
git log --oneline -10          # recent commits
git status                     # uncommitted changes
grep '"version"' manifest.json # current version
```

**Read these files when relevant to the task:**
- `src/` — read the specific `.ts` file(s) you are about to change
- `tests/<area>.test.ts` — read the test file covering the area you are modifying
- `CHANGELOG.md` — read the top entry to understand the most recent change
- `README.md` — read before updating docs

**Do not assume file contents from a prior conversation.** Always use the Read or Grep tool to verify current state before editing. If a file has changed since you last read it, re-read it.

The `.claude/settings.json` `SessionStart` hook automatically injects a live snapshot (version, branch, recent commits, file list, working tree status) into your context at the start of each session. Use that snapshot as your starting point, then read individual files as needed.
