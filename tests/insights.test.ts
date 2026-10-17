import test from "node:test";
import assert from "node:assert/strict";
import { parseTaskMeta } from "../src/actionItems";
import { buildInsights, sentimentTrend } from "../src/insights";
import { accountBody, ACCOUNT_END, ACCOUNT_START, newAccountNote, refreshAccount } from "../src/accounts";
import { addMissingViews, DASHBOARD_CONTENT } from "../src/dashboard";
import type { TrackerMeeting } from "../src/tracker";

const meeting = (path: string, date: string, extra: Partial<TrackerMeeting> = {}): TrackerMeeting => ({
  path, title: path.split("/").pop() ?? path, date, openItems: [], doneItems: [], decisions: [], ...extra,
});

const MEETINGS = [
  meeting("M/Acme kickoff", "2026-09-20", {
    account: "Acme", category: "Customer", minutes: 60, sentiment: "Positive", outcome: "Progress",
    keyTopics: ["Pilot scope"], people: ["Alice Smith"], summarized: true,
  }),
  meeting("M/Acme pilot", "2026-10-05", {
    account: "acme", category: "Customer", minutes: 30, sentiment: "Negative", outcome: "Blocked",
    keyTopics: ["Pilot scope", "TLS inspection"], people: ["Alice Smith", "Bob Jones"], summarized: true,
    openItems: [parseTaskMeta("Fix certs @[[Bob Jones]] ➕ 2026-10-05 📅 2026-10-06")],
    doneItems: [parseTaskMeta("Send scope @[[Alice Smith]] ✅ 2026-10-06")],
    decisions: ["Pause the rollout"],
  }),
  meeting("M/Globex review", "2026-08-01", { account: "Globex", category: "Customer", minutes: 30, sentiment: "Neutral" }),
  meeting("M/Team sync", "2026-10-06", { category: "Team Sync", minutes: 30, people: ["Bob Jones"] }),
  meeting("M/Cancelled", "2026-10-07", { category: "Team Sync", minutes: 30, skipped: true, status: "cancelled" }),
  meeting("M/Acme next", "2026-10-12", { account: "Acme" }),
  meeting("M/Old topics", "2026-08-25", { keyTopics: ["TLS inspection"], minutes: 30 }),
];

test("buildInsights reports time, accounts, attention, topics, people and follow-through", () => {
  const content = buildInsights(MEETINGS, "2026-10-08", "2026-10-08 9:00 AM", (a) => `[[Hub/Accounts/${a}|${a}]]`);
  assert.match(content, /^# Meeting Insights$/m);
  assert.match(content, /\| 3 \| 2 \| 2 \(67%\) \| 2 \| 1 \(50%\) \| 1 \|/, "held meetings in the last 30 days, hours, summaries, items");
  assert.match(content, /- \[\[Hub\/Accounts\/acme\|acme\]\] — latest sentiment \*\*Negative\*\*, outcome \*\*Blocked\*\* · 2026-10-05/);
  assert.match(content, /- Blocked: \[\[M\/Acme pilot\|Acme pilot\]\] · 2026-10-05 · /);
  assert.match(content, /- Gone quiet: \[\[Hub\/Accounts\/Globex\|Globex\]\] — last met 2026-08-01 \(68 days ago\)/);
  assert.match(content, /\| \[\[Hub\/Accounts\/acme\\\|acme\]\] \| 2 \| 2026-10-05 \| 1 \| 1 \| 🟢 🔴 \| Blocked \|/, "an account's spellings are one account");
  assert.match(content, /\| Customer \| 2 \| 1\.5 \| 75% \|/);
  assert.match(content, /pie showData title Hours by category\n {4}"Customer" : 1\.5\n {4}"Team Sync" : 0\.5/);
  assert.match(content, /\| Pilot scope \| 2 \| 0 \| 🆕 \|/);
  assert.match(content, /\| TLS inspection \| 1 \| 1 \| → \|/);
  assert.match(content, /\| Bob Jones \| 2 \| 2026-10-06 \| 1 \|/);
  assert.match(content, /\| Bob Jones \| 1 \| 1 \| 0 \|\n\| Alice Smith \| 0 \| 0 \| 1 \|/);
  assert.match(content, /## Oldest open items\n\n- Fix certs @\[\[Bob Jones\]\] · Bob Jones · open 3 days · /);
  assert.match(content, /## Meetings without an AI summary \(last 14 days\)\n\n- 2026-10-06 · \[\[M\/Team sync\|Team sync\]\]\n\n/);
  assert.doesNotMatch(content, /Cancelled\|/, "meetings that didn't happen are left out");
});

test("buildInsights copes with no meetings at all", () => {
  const content = buildInsights([], "2026-10-08", "now");
  assert.match(content, /\| 0 \| 0 \| 0 \(—\) \| 0 \| 0 \(—\) \| 0 \|/);
  assert.match(content, /## Needs attention\n\nNothing here\./);
  assert.doesNotMatch(content, /mermaid/);
});

test("sentimentTrend shows the last five sentiments, oldest first", () => {
  const ms = ["Positive", "Neutral", "Mixed", "Negative", "Positive", "Negative"].map((s, i) => meeting(`M${i}`, `2026-10-0${i + 1}`, { sentiment: s }));
  assert.equal(sentimentTrend(ms), "⚪ 🟡 🔴 🟢 🔴");
});

test("account notes list the account's meetings, items, decisions, topics and people, and keep the user's writing", () => {
  const acme = MEETINGS.filter((m) => m.account?.toLowerCase() === "acme");
  const body = accountBody(acme, "2026-10-08", "2026-10-08 9:00 AM");
  assert.match(body, /\| 2 \| 2026-10-05 \| 2026-10-12 \[\[M\/Acme next\\\|Acme next\]\] \| 1 \| 1 \| 🟢 🔴 \|/);
  assert.match(body, /- 2026-10-05 · \[\[M\/Acme pilot\|Acme pilot\]\] · Customer · 🔴 Negative · Blocked/);
  assert.match(body, /## Open items\n\n- \[ \] Fix certs/);
  assert.match(body, /## Recent decisions\n\n### \[\[M\/Acme pilot\|Acme pilot\]\] · 2026-10-05\n\n- Pause the rollout/);
  assert.match(body, /## Key topics\n\n- Pilot scope \(2\)\n- TLS inspection \(1\)/);
  assert.match(body, /## Where we left off\n\nNothing here\./);
  const withContinuity = acme.map((m) => (m.date === "2026-09-20" ? { ...m, continuity: ["Agree pilot scope"] } : m));
  assert.match(accountBody(withContinuity, "2026-10-08", "now"), /## Where we left off\n\nFrom \[\[M\/Acme kickoff\|Acme kickoff\]\] · 2026-09-20:\n\n- Agree pilot scope\n/);
  assert.match(body, /## People\n\n- Alice Smith \(2 meetings\)\n- Bob Jones \(1 meeting\)/);

  const note = newAccountNote("Acme", body).replace("## Overview\n\n- ", "## Overview\n\n- Our biggest pilot");
  assert.match(note, /^type: meeting-account$/m);
  assert.match(note, /^account: "Acme"$/m);
  const refreshed = refreshAccount(note, accountBody([], "2026-10-08", "later"));
  assert.match(refreshed, /- Our biggest pilot/);
  assert.match(refreshed, /No meeting notes yet\./);
  assert.equal(refreshed.split(ACCOUNT_START).length, 2);
  assert.equal(refreshed.split(ACCOUNT_END).length, 2);
});

test("addMissingViews adds new built-in views to an older dashboard and leaves custom layouts alone", () => {
  const older = DASHBOARD_CONTENT.split("  - type: table\n    name: Customer meetings")[0];
  const upgraded = addMissingViews(older);
  for (const name of ["Customer meetings", "By sentiment", "By outcome", "Needs AI summary", "AI-summarized", "All meetings"]) {
    assert.equal(upgraded.split(`    name: ${name}\n`).length, 2, name);
  }
  assert.equal(addMissingViews(upgraded), upgraded);
  assert.equal(addMissingViews(DASHBOARD_CONTENT), DASHBOARD_CONTENT);
  const custom = "views:\n  - type: table\n    name: Mine\nfilters:\n  and: []\n";
  assert.equal(addMissingViews(custom), custom);
});
