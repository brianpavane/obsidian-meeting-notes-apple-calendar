import test from "node:test";
import assert from "node:assert/strict";
import { parseTaskMeta } from "../src/actionItems";
import type { TrackerMeeting } from "../src/tracker";
import { END_MARKER, isoWeek, newReview, refreshReview, reviewBody, START_MARKER } from "../src/weeklyReview";

const meeting = (path: string, date: string, extra: Partial<TrackerMeeting> = {}): TrackerMeeting => ({
  path, title: path.split("/").pop() ?? path, date, openItems: [], doneItems: [], decisions: [], ...extra,
});

test("isoWeek finds the Monday–Sunday week and its ISO number, across year ends", () => {
  assert.deepEqual(isoWeek("2026-10-07"), { label: "2026-W41", start: "2026-10-05", end: "2026-10-11" });
  assert.deepEqual(isoWeek("2026-10-11"), { label: "2026-W41", start: "2026-10-05", end: "2026-10-11" });
  assert.equal(isoWeek("2026-01-01").label, "2026-W01");
  assert.equal(isoWeek("2027-01-01").label, "2026-W53");
  assert.equal(isoWeek("2024-12-30").label, "2025-W01");
});

test("reviewBody summarizes the week's meetings, decisions, done, open and overdue items", () => {
  const week = isoWeek("2026-10-07");
  const body = reviewBody([
    meeting("Clients/Acme/Pilot", "2026-10-06", {
      category: "Customer",
      account: "Acme",
      decisions: ["Go to pilot"],
      openItems: [parseTaskMeta("Send scope @[[Bob Jones]] ⏫ 📅 2026-10-09")],
      doneItems: [parseTaskMeta("Book room ✅ 2026-10-06"), parseTaskMeta("Old thing ✅ 2026-09-01")],
    }),
    meeting("Team/Sync", "2026-10-08", { openItems: [parseTaskMeta("Write notes")] }),
    meeting("Old/Kickoff", "2026-09-20", { openItems: [parseTaskMeta("Late report 📅 2026-10-01")], decisions: ["Not this week"] }),
  ], week, "2026-10-07", "2026-10-07 9:00 AM");

  assert.ok(body.startsWith(START_MARKER) && body.endsWith(END_MARKER));
  assert.match(body, /\| 2 \| 1 \| 1 \| 2 \| 1 \|/);
  assert.match(body, /### Tuesday, October 6\n\n- \[\[Clients\/Acme\/Pilot\|Pilot\]\] · Customer · Acme\n\n### Thursday, October 8\n\n- \[\[Team\/Sync\|Sync\]\]\n/);
  assert.match(body, /## Decisions\n\n### \[\[Clients\/Acme\/Pilot\|Pilot\]\]\n\n- Go to pilot\n/);
  assert.doesNotMatch(body, /Not this week|Old thing/);
  assert.match(body, /## Done this week\n\n- Book room · \[\[Clients\/Acme\/Pilot\|Pilot\]\]\n/);
  assert.match(body, /## Still open from this week's meetings\n\n- \[ \] Send scope @\[\[Bob Jones\]\] · ⏫ 📅 2026-10-09 · [^\n]+\n- \[ \] Write notes · /);
  assert.match(body, /## Overdue\n\n- \[ \] Late report · 📅 2026-10-01 · \[\[Old\/Kickoff\|Kickoff\]\]\n/);
});

test("refreshReview replaces only the plugin's part and keeps the user's writing", () => {
  const week = isoWeek("2026-10-07");
  const first = newReview(`${START_MARKER}\nold numbers\n${END_MARKER}`, week);
  assert.match(first, /^---\ntype: weekly-review\nweek: 2026-W41\nweek_start: 2026-10-05\nweek_end: 2026-10-11\n/);
  assert.match(first, /# Weekly review · 2026-W41\n\n\*\*Monday, October 5 – Sunday, October 11, 2026\*\*/);
  const written = first.replace("### Wins\n\n- ", "### Wins\n\n- Closed the Acme pilot");
  const refreshed = refreshReview(written, `${START_MARKER}\nnew numbers\n${END_MARKER}`);
  assert.match(refreshed, /new numbers/);
  assert.doesNotMatch(refreshed, /old numbers/);
  assert.match(refreshed, /- Closed the Acme pilot/);
  assert.equal(refreshReview("markers deleted", "anything"), "markers deleted");
});

test("reviewBody doesn't count a meeting that didn't happen, but keeps its open items", () => {
  const body = reviewBody([
    meeting("Team/Sync", "2026-10-06"),
    meeting("Team/Skipped", "2026-10-08", { skipped: true, openItems: [parseTaskMeta("Reschedule demo")] }),
  ], isoWeek("2026-10-07"), "2026-10-07", "now");

  assert.match(body, /\| 1 \| 0 \| 0 \| 1 \| 0 \|/);
  assert.doesNotMatch(body, /### Thursday, October 8/);
  assert.match(body, /## Still open from this week's meetings\n\n- \[ \] Reschedule demo · \[\[Team\/Skipped\|Skipped\]\]/);
});
