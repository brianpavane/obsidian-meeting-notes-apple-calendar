import test from "node:test";
import assert from "node:assert/strict";
import { parseTaskMeta } from "../src/actionItems";
import { briefingText, dayNote, type DayInput } from "../src/myDay";
import type { TrackerMeeting } from "../src/tracker";

const meeting = (path: string, date: string, extra: Partial<TrackerMeeting> = {}): TrackerMeeting => ({
  path, title: path.split("/").pop() ?? path, date, openItems: [], doneItems: [], decisions: [], ...extra,
});

const input = (extra: Partial<DayInput> = {}): DayInput => ({
  date: "2026-10-12",
  meetings: [
    {
      id: "pilot::2026-10-12", title: "Acme pilot", start: new Date("2026-10-12T09:00:00"), end: new Date("2026-10-12T09:30:00"),
      path: "M/Acme pilot 3", account: "Acme", attendees: ["Ann Lee", "Bob Jones"], joinUrl: "https://zoom.us/j/1", briefed: true, summarized: false,
    },
    { id: "solo", title: "Focus time", start: new Date("2026-10-12T13:00:00"), end: new Date("2026-10-12T14:00:00"), attendees: [], briefed: false, summarized: false },
  ],
  notes: [
    meeting("M/Acme pilot 2", "2026-10-05", {
      id: "pilot::2026-10-05", account: "Acme",
      openItems: [parseTaskMeta("Send runbook @[[Ann Lee]] 📅 2026-10-08"), parseTaskMeta("Fix certs @[[John Smith]] 📅 2026-10-12"), parseTaskMeta("Chase legal @[[Cy Ong]] 📅 2026-10-01")],
      doneItems: [parseTaskMeta("Book room ✅ 2026-10-12")],
    }),
    meeting("M/Other", "2026-10-09", { account: "Beta", openItems: [parseTaskMeta("Beta thing @[[Ann Lee]]")] }),
    meeting("M/Friday sync", "2026-10-11", { summarized: false }),
  ],
  todos: [meeting("Hub/My To-Dos", "", { openItems: [parseTaskMeta("Renew passport ⏫ ➕ 2026-10-11")] })],
  myNames: ["John Smith"],
  unsummarized: [meeting("M/Friday sync", "2026-10-11")],
  recordings: 2,
  updated: "2026-10-12 12:30 AM",
  ...extra,
});

test("My Day lists the day's meetings, your focus, what attendees owe you, others' overdue items, loose ends and what's done", () => {
  const note = dayNote(input());
  const section = (name: string) => note.split(`## ${name}`)[1]?.split("\n## ")[0] ?? "";
  assert.match(note, /^---\ntype: meeting-day\ndate: 2026-10-12\n/);
  assert.match(note, /# Monday, October 12, 2026/);
  assert.match(section("Meetings"), /- 9:00 AM–9:30 AM · \[\[M\/Acme pilot 3\|Acme pilot\]\] · Acme · with Ann Lee, Bob Jones · brief ready · \[Join\]\(https:\/\/zoom\.us\/j\/1\)\n- 1:00 PM–2:00 PM · Focus time · no note yet/);
  assert.match(section("Focus"), /Fix certs[^\n]*\*due soon\*|Fix certs/);
  assert.match(section("Focus"), /Renew passport/);
  assert.match(section("Before your meetings"), /### 9:00 AM · Acme pilot\n\n- \[ \] Send runbook @\[\[Ann Lee\]\] · 📅 2026-10-08 · [^\n]+\*overdue\*/);
  assert.doesNotMatch(section("Before your meetings"), /Beta thing/, "another account's items stay out");
  assert.match(section("Waiting on others: overdue"), /Chase legal[\s\S]*Send runbook|Send runbook[\s\S]*Chase legal/);
  assert.match(section("Loose ends"), /- Add the AI reply: \[\[M\/Friday sync\|Friday sync\]\] · 2026-10-11\n- 2 Krisp recordings to import/);
  assert.match(section("Done today"), /- Book room/);
});

test("My Day says so when the calendar can't be read or the day is empty", () => {
  assert.match(dayNote(input({ meetings: null })), /## Meetings\n\nCouldn't read the calendar/);
  const empty = dayNote(input({ meetings: [], notes: [], todos: [], unsummarized: [], recordings: 0 }));
  assert.match(empty, /## Meetings\n\nNo meetings\./);
  assert.match(empty, /## Focus\n\nNothing pressing\./);
  assert.match(empty, /## Loose ends\n\nNothing to tidy up\./);
});

test("the Daily Briefing is My Day as plain text: no properties, link names only, bullets instead of checkboxes", () => {
  const text = briefingText(dayNote(input()));
  assert.ok(text.startsWith("# Monday, October 12, 2026"));
  assert.doesNotMatch(text, /\[\[|---\ntype|- \[ \]|obsidian:\/\//);
  assert.match(text, /- 9:00 AM–9:30 AM · Acme pilot · Acme/);
  assert.match(text, /- Send runbook @Ann Lee · 📅 2026-10-08 · Acme pilot 2 · \*overdue\*/);
  assert.match(text, /\*Prepared 2026-10-12 12:30 AM by Obsidian/);
});
