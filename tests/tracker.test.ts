import test from "node:test";
import assert from "node:assert/strict";
import { parseTaskMeta } from "../src/actionItems";
import { buildTracker, type TrackerMeeting } from "../src/tracker";

const meeting = (path: string, date: string, extra: Partial<TrackerMeeting> = {}): TrackerMeeting => ({
  path, title: path.split("/").pop() ?? path, date, openItems: [], doneItems: [], decisions: [], ...extra,
});

test("buildTracker summarizes open items, decisions and this week's meetings", () => {
  const content = buildTracker([
    meeting("Clients/Acme/Pilot review", "2026-10-06", {
      account: "Acme Corp",
      category: "External Customer",
      openItems: [
        parseTaskMeta("Send scope @[[Bob Jones]] ⏫ 📅 2026-10-09"),
        parseTaskMeta("Confirm window (owner: Customer IT team) 📅 2026-10-01"),
      ],
      decisions: ["Move to a production pilot"],
    }),
    meeting("Team/Sync", "2026-10-07", { category: "Team Sync", openItems: [parseTaskMeta("Book room")] }),
    meeting("Old/Kickoff", "2026-08-01", { decisions: ["Too old to list"] }),
  ], "2026-10-07", "2026-10-07 9:00 AM");

  assert.match(content, /\| 3 \| 1 \| 1 \| 1 \| 0 \| 0 \| 0 \| 2 \|/);
  assert.match(content, /## Overdue\n\n- \[ \] Confirm window \(owner: Customer IT team\) · 📅 2026-10-01 · \[\[Clients\/Acme\/Pilot review\|Pilot review\]\]\n/);
  assert.match(content, /## Due in the next 7 days\n\n- \[ \] Send scope @\[\[Bob Jones\]\] · ⏫ 📅 2026-10-09 ·/);
  assert.match(content, /### Acme Corp \(2\)[\s\S]*### No account \(1\)\n\n- \[ \] Book room · \[\[Team\/Sync\|Sync\]\]/);
  assert.match(content, /## Waiting on others\n\nSet \*\*Your name\*\*/, "without names every item is the user's");
  assert.match(content, /## Decisions in the last 30 days\n\n### \[\[Clients\/Acme\/Pilot review\|Pilot review\]\] · 2026-10-06\n\n- Move to a production pilot\n/);
  assert.doesNotMatch(content, /Too old to list/);
  assert.match(content, /## Meetings this week \(2026-10-05 to 2026-10-11\)\n\n\| Category \| Meetings \|\n\| --- \| --- \|\n\| External Customer \(1\) \| \[\[Clients\/Acme\/Pilot review\\\|Pilot review\]\] \|\n\| Team Sync \(1\) \| \[\[Team\/Sync\\\|Sync\]\] \|/);
});

test("buildTracker says so when there is nothing to show", () => {
  const content = buildTracker([], "2026-10-07", "now");
  assert.match(content, /\| 0 \| 0 \| 0 \| 0 \| 0 \| 0 \| 0 \| 0 \|/);
  assert.equal(content.match(/Nothing here\./g)?.length, 7);
});

test("buildTracker leaves cancelled, removed and declined meetings out of this week's meetings but keeps their items", () => {
  const content = buildTracker([
    meeting("Team/Sync", "2026-10-06", { category: "Team Sync" }),
    meeting("Team/Skipped sync", "2026-10-07", { category: "Team Sync", skipped: true, openItems: [parseTaskMeta("Reschedule demo")] }),
  ], "2026-10-07", "now");

  assert.match(content, /\| Team Sync \(1\) \| \[\[Team\/Sync\\\|Sync\]\] \|/);
  assert.doesNotMatch(content, /\| [^\n]*Skipped sync\\\|/);
  assert.match(content, /- \[ \] Reschedule demo · \[\[Team\/Skipped sync\|Skipped sync\]\]/);
});

test("buildTracker puts the user's items first: Focus, then their own lists, Waiting on others and Gone stale?", () => {
  const content = buildTracker([
    meeting("Clients/Acme/Pilot", "2026-10-06", {
      account: "Acme", sentiment: "Negative",
      openItems: [
        parseTaskMeta("Fix certs @[[John Smith]]"),
        parseTaskMeta("Send runbook @[[Jane Doe]] 📅 2026-10-01"),
      ],
    }),
    meeting("Team/Sync", "2026-10-05", {
      openItems: [
        parseTaskMeta("Late report 📅 2026-10-02"),
        parseTaskMeta("Plan offsite 📅 2026-10-12"),
        parseTaskMeta("Hire contractor ⏫"),
        parseTaskMeta("Tidy wiki"),
      ],
    }),
    meeting("Old/Kickoff", "2026-08-01", { openItems: [parseTaskMeta("Old idea"), parseTaskMeta("Ask Bob @Bob")] }),
  ], "2026-10-08", "now", ["John Smith"]);

  const section = (name: string) => content.split(`## ${name}`)[1]?.split("\n## ")[0] ?? "";
  const focus = section("Focus");
  const order = ["Late report", "Plan offsite", "Hire contractor", "Fix certs", "Tidy wiki"];
  assert.deepEqual(order.map((t) => focus.indexOf(t)).every((i, n, all) => i > 0 && (n === 0 || all[n - 1] < i)), true, focus);
  assert.match(focus, /- \[ \] Late report · 📅 2026-10-02 · \[\[Team\/Sync\|Sync\]\] · \*overdue\*/);
  assert.match(focus, /Fix certs @\[\[John Smith\]\] · \[\[Clients\/Acme\/Pilot\|Pilot\]\] · \*at-risk account\*/);
  assert.doesNotMatch(focus, /Jane|Old idea/, "others' items and stale ones aren't in Focus");
  assert.doesNotMatch(section("Overdue"), /Send runbook/, "Overdue lists only the user's items");
  assert.match(section("Waiting on others"), /### Bob \(1\)[\s\S]*### Jane Doe \(1\)\n\n- \[ \] Send runbook [^\n]+ · \*overdue\*/);
  assert.match(section("Gone stale?"), /Tick one here to drop it[\s\S]*- \[ \] Old idea ·[\s\S]*- \[ \] Ask Bob/);
  assert.doesNotMatch(section("Gone stale?"), /Tidy wiki/);
  assert.match(content, /\| 6 \| 1 \| 1 \| 1 \| 2 \| 2 \| 0 \| 2 \|/);
});

test("Someday items never reach Focus and go straight to Gone stale?", () => {
  const content = buildTracker([
    meeting("Team/Sync", "2026-10-07", { openItems: [parseTaskMeta("Explore partner idea ⏬"), parseTaskMeta("Book room")] }),
  ], "2026-10-08", "now");
  const focus = content.split("## Focus")[1].split("\n## ")[0];
  assert.doesNotMatch(focus, /Explore partner idea/);
  assert.match(focus, /Book room/);
  assert.match(content.split("## Gone stale?")[1].split("\n## ")[0], /Marked Someday[\s\S]*- \[ \] Explore partner idea · ⏬ ·/);
});

test("parked items are off the user's lists but stay under their account, marked parked", () => {
  const content = buildTracker([
    meeting("Clients/Acme/Pilot", "2026-10-06", {
      account: "Acme",
      openItems: [parseTaskMeta("Draft SOW ⏫ 📅 2026-10-01 #parked"), parseTaskMeta("Chase legal @Bob #parked"), parseTaskMeta("Send deck")],
    }),
  ], "2026-10-08", "now", ["Me"]);
  const section = (name: string) => content.split(`## ${name}`)[1]?.split("\n## ")[0] ?? "";
  for (const name of ["Focus", "Overdue", "High priority", "Waiting on others", "Gone stale?"]) assert.doesNotMatch(section(name), /Draft SOW|Chase legal/, name);
  assert.match(section("Open items by account"), /- \[ \] Draft SOW · ⏫ 📅 2026-10-01 · \[\[Clients\/Acme\/Pilot\|Pilot\]\] · \*parked, overdue\*/);
  assert.match(section("Open items by account"), /- \[ \] Chase legal @Bob · \[\[Clients\/Acme\/Pilot\|Pilot\]\] · \*parked\*/);
  assert.match(content, /\| 1 \| 0 \| 0 \| 0 \| 0 \| 0 \| 2 \| 1 \|/);
});

test("long account and person groups are capped, pointing to where the rest are", () => {
  const many = (who: string) => Array.from({ length: 13 }, (_, i) => parseTaskMeta(`Item ${who} ${i} @${who}`));
  const content = buildTracker([
    meeting("Clients/Acme/Pilot", "2026-10-06", { account: "Acme", openItems: many("Bob") }),
    meeting("Clients/Beta/Kickoff", "2026-10-06", { account: "Beta", openItems: many("Ann") }),
  ], "2026-10-08", "now", ["Me"], [], (account) => (account === "Acme" ? "[[Hub/Accounts/Acme|Acme overview]]" : undefined));
  const byAccount = content.split("## Open items by account")[1];
  assert.match(byAccount, /### Acme \(13\)\n\n(- \[ \] [^\n]+\n){10}- …and 3 more in \[\[Hub\/Accounts\/Acme\|Acme overview\]\]\n/);
  assert.match(byAccount, /### Beta \(13\)\n\n(- \[ \] [^\n]+\n){10}- …and 3 more\n/);
  assert.match(content.split("## Waiting on others")[1], /### Ann \(13\)\n\n(- \[ \] [^\n]+\n){10}- …and 3 more in the action items panel/);
});
