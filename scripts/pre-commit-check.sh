#!/usr/bin/env bash
# Claude Code PreToolUse hook (Bash). Reads the hook JSON on stdin and, only
# when the command runs `git commit`, enforces the CLAUDE.md commit checklist.
# Exit 0 = allow, exit 2 = block (stderr is shown to Claude).

input=$(cat)
command=$(printf '%s' "$input" | jq -r '.tool_input.command // empty' 2>/dev/null)

case "$command" in
  *"git commit"*) ;;
  *) exit 0 ;;
esac

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}" || exit 2

fail() {
  echo "Pre-commit check failed: $1" >&2
  exit 2
}

if ! out=$(npm test 2>&1); then
  printf '%s\n' "$out" | grep -E '^(✖|not ok|ℹ (pass|fail))' | head -20 >&2
  fail "npm test reported failures."
fi

if ! out=$(npx tsc --noEmit --skipLibCheck 2>&1); then
  printf '%s\n' "$out" | head -20 >&2
  fail "TypeScript compile errors."
fi

staged=$(git diff --cached --name-only)
[ -n "$staged" ] || exit 0

added=$(git diff --cached -U0 -- src | grep -E '^\+[^+]')
if printf '%s\n' "$added" | grep -q 'console\.log('; then
  fail "console.log added in src/. Use console.debug/warn/error with the [CalendarNoteIntegration] prefix."
fi

if git diff --cached -U0 | grep -E '^\+[^+]' | grep -qE -- '-----BEGIN [A-Z ]*PRIVATE KEY|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{36}|sk-ant-[A-Za-z0-9_-]{20,}|AIza[0-9A-Za-z_-]{35}|GOCSPX-[A-Za-z0-9_-]{20,}'; then
  fail "staged changes appear to contain a secret or credential."
fi

if printf '%s\n' "$staged" | grep -qE '^(src/|styles\.css$)'; then
  printf '%s\n' "$staged" | grep -qx 'CHANGELOG.md' \
    || fail "source files are staged but CHANGELOG.md is not. Add an entry under ## [Unreleased] (see CLAUDE.md)."
fi

if git diff --cached -- manifest.json | grep -qE '^\+\s*"version"'; then
  version=$(node -p "require('./manifest.json').version")
  top=$(grep -m1 -oE '^## \[[0-9][^]]*\]' CHANGELOG.md | tr -d '#[] ')
  [ "$version" = "$top" ] \
    || fail "manifest.json version ($version) does not match the newest released CHANGELOG.md entry ($top)."
fi

exit 0
