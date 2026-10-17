# Release Process

**Repository: `brianpavane/obsidian-meeting-notes-apple-calendar`**

> Routine commits do **not** change the version — they add entries under
> `## [Unreleased]` in `CHANGELOG.md`. Cutting a release is what bumps the version.
>
> Users install and update through **BRAT**, which pulls `main.js`, `manifest.json`,
> and `styles.css` from the latest GitHub release. Changes on `main` reach users
> only once they are released.

---

## Step 1 — Pull latest main and check what is unreleased

```bash
git checkout main
git pull origin main
git status                                   # must be clean
awk '/^## \[Unreleased\]/{f=1; next} f && /^---/{exit} f' CHANGELOG.md
```

The last command prints the `[Unreleased]` changelog section. If it is empty, there is nothing to release.

---

## Step 2 — Bump the version

Choose the level from the unreleased changes (see the guide in `CLAUDE.md`):

```bash
node version-bump.mjs patch    # or minor / major
VERSION=$(node -p "require('./manifest.json').version")
echo $VERSION
```

This updates `manifest.json`, `package.json`, and `versions.json`, and renames
`## [Unreleased]` in `CHANGELOG.md` to `## [$VERSION] – <today>`.

---

## Step 3 — Test and build

```bash
npm test
npm run build
```

Both must succeed. The build date is injected automatically into `main.js`.

---

## Step 4 — Commit and push the release

```bash
git add manifest.json package.json versions.json CHANGELOG.md
git commit -m "chore: release $VERSION"
git push origin main
```

---

## Step 5 — Create and push the annotated tag

```bash
git tag -a $VERSION -m "Release $VERSION"
git push origin $VERSION
git ls-remote --tags origin | grep $VERSION   # verify
```

---

## Step 6 — Create the GitHub release

```bash
gh release create $VERSION \
  main.js manifest.json styles.css \
  --repo brianpavane/obsidian-meeting-notes-apple-calendar \
  --verify-tag \
  --title "$VERSION" \
  --notes "$(awk "/^## \[$VERSION\]/{found=1; next} found && /^---/{exit} found{print}" CHANGELOG.md)" \
  --latest
```

> The notes are the `CHANGELOG.md` section for this version.

---

## Step 7 — Confirm the release

```bash
gh release view $VERSION --repo brianpavane/obsidian-meeting-notes-apple-calendar
```

BRAT users get the update the next time Obsidian starts, or immediately via
**BRAT: Check for updates to all beta plugins and UPDATE**.

---

## Full sequence — set LEVEL, paste

```bash
# ── SET LEVEL ────────────────────────────────────────────────────────────────
LEVEL=patch   # patch | minor | major

# ── PULL ─────────────────────────────────────────────────────────────────────
git checkout main
git pull origin main
git status

# ── BUMP ─────────────────────────────────────────────────────────────────────
node version-bump.mjs $LEVEL
VERSION=$(node -p "require('./manifest.json').version")

# ── TEST & BUILD ─────────────────────────────────────────────────────────────
npm test
npm run build

# ── COMMIT & PUSH ────────────────────────────────────────────────────────────
git add manifest.json package.json versions.json CHANGELOG.md
git commit -m "chore: release $VERSION"
git push origin main

# ── TAG ──────────────────────────────────────────────────────────────────────
git tag -a $VERSION -m "Release $VERSION"
git push origin $VERSION

# ── GITHUB RELEASE ───────────────────────────────────────────────────────────
gh release create $VERSION \
  main.js manifest.json styles.css \
  --repo brianpavane/obsidian-meeting-notes-apple-calendar \
  --verify-tag \
  --title "$VERSION" \
  --notes "$(awk "/^## \[$VERSION\]/{found=1; next} found && /^---/{exit} found{print}" CHANGELOG.md)" \
  --latest

# ── CONFIRM ──────────────────────────────────────────────────────────────────
gh release view $VERSION --repo brianpavane/obsidian-meeting-notes-apple-calendar
```

---

## Pre-release (beta) variant

Add `--prerelease` and use a version like `6.6.0-beta.1`:

```bash
VERSION=6.6.0-beta.1

gh release create $VERSION \
  main.js manifest.json styles.css \
  --repo brianpavane/obsidian-meeting-notes-apple-calendar \
  --title "$VERSION (beta)" \
  --notes "Beta release — not recommended for production use." \
  --prerelease
```

---

## Managing releases

```bash
# List all releases
gh release list --repo brianpavane/obsidian-meeting-notes-apple-calendar

# Delete a release (keeps the tag)
gh release delete $VERSION --repo brianpavane/obsidian-meeting-notes-apple-calendar

# Delete a tag locally and remotely
git tag -d $VERSION
git push origin --delete $VERSION

# Edit release notes after publishing
gh release edit $VERSION \
  --repo brianpavane/obsidian-meeting-notes-apple-calendar \
  --notes "Updated notes here"

# Upload an additional file to an existing release
gh release upload $VERSION styles.css \
  --repo brianpavane/obsidian-meeting-notes-apple-calendar
```

---

## Version bump rules

| Change type | Bump | Example |
|---|---|---|
| Bug fix, minor improvement | **patch** (Z) | 6.5.3 → 6.5.4 |
| New feature, backwards-compatible | **minor** (Y) | 6.5.3 → 6.6.0 |
| Breaking change, major rework | **major** (X) | 6.6.0 → 7.0.0 |

Files updated on every release bump (`node version-bump.mjs <level>` handles all four):

1. `manifest.json` — `"version"`
2. `package.json` — `"version"`
3. `versions.json` — adds `"X.Y.Z": "<minAppVersion>"` entry
4. `CHANGELOG.md` — renames `## [Unreleased]` to `## [X.Y.Z] – YYYY-MM-DD`

---

## Commit message conventions

| Prefix | Use for |
|---|---|
| `feat:` | New user-facing feature |
| `fix:` | Bug fix |
| `perf:` | Performance improvement |
| `chore:` | Version bumps, dependency updates, tooling |
| `docs:` | Documentation only |
| `refactor:` | Internal code change, no behaviour change |

---

## Release artefact checklist

| File | Required | Notes |
|---|---|---|
| `main.js` | Yes | Compiled plugin — produced by `npm run build` |
| `manifest.json` | Yes | Plugin metadata (id, name, version, minAppVersion) |
| `styles.css` | Yes | Event picker styling — attach to every release |
