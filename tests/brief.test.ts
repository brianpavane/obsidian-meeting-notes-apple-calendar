import test from "node:test";
import assert from "node:assert/strict";
import { parseTaskMeta } from "../src/actionItems";
import { BRIEF_END, BRIEF_START, briefBlock, removeBrief, upsertBrief } from "../src/brief";
import type { TrackerMeeting } from "../src/tracker";

const meeting = (path: string, date: string, extra: Partial<TrackerMeeting> = {}): TrackerMeeting => ({
  path, title: path.split("/").pop() ?? path, date, openItems: [], doneItems: [], decisions: [], ...extra,
});

const meetings = [
  meeting("M/Pilot 1", "2026-10-01", {
    id: "pilot::2026-10-01", account: "Acme", sentiment: "Negative", outcome: "Blocked",
    continuity: ["Agree the TLS scope"],
    openItems: [
      parseTaskMeta("Send runbook @[[Ann Lee]] 📅 2026-10-05"),
      parseTaskMeta("Fix certs @[[John Smith]]"),
      parseTaskMeta("Share pricing @[[Bob Jones]]"),
    ],
  }),
  meeting("M/Other", "2026-09-20", { openItems: [parseTaskMeta("Review plan @[[Ann Lee]]"), parseTaskMeta("Unrelated mine")] }),
];

test("the brief shows the account's state, where things were left, and what each side owes", () => {
  const block = briefBlock({
    meetings, id: "pilot::2026-10-08", date: "2026-10-08", attendees: ["Ann Lee", "John Smith"],
    myNames: ["John Smith"], today: "2026-10-08", updated: "now",
  });
  assert.ok(block.startsWith(`${BRIEF_START}\n## Meeting Brief\n`));
  assert.ok(block.endsWith(BRIEF_END));
  assert.match(block, /\*\*Account:\*\* \*\*Acme\*\* · last met 2026-10-01 \(\[\[M\/Pilot 1\|Pilot 1\]\]\) · 🔴 Negative · Blocked · ⚠ at risk/, "the account comes from the series");
  assert.match(block, /### Where we left off\n\nFrom \[\[M\/Pilot 1\|Pilot 1\]\] · 2026-10-01:\n\n- Agree the TLS scope/);
  const theyOwe = block.split("### They owe you")[1].split("###")[0];
  assert.match(theyOwe, /^\n\n- Send runbook @\[\[Ann Lee\]\] · 📅 2026-10-05 · \[\[M\/Pilot 1\|Pilot 1\]\] · \*overdue\*\n\n/);
  assert.doesNotMatch(theyOwe, /Bob Jones|Fix certs/, "only attendees other than the user");
  assert.doesNotMatch(theyOwe, /Review plan/, "not from another account's meetings");

  const adHoc = briefBlock({ meetings, id: "chat", date: "2026-10-08", attendees: ["Ann Lee"], myNames: ["John Smith"], today: "2026-10-08", updated: "now" });
  assert.match(adHoc.split("### They owe you")[1], /Send runbook[\s\S]*Review plan/, "a meeting with no series or account shows all they owe");
  const youOwe = block.split("### You owe")[1];
  assert.match(youOwe, /- Fix certs @\[\[John Smith\]\]/);
  assert.doesNotMatch(youOwe, /Unrelated mine/, "only from this series or account");
  assert.doesNotMatch(block, /- \[ \]/, "plain bullets, never counted as this meeting's tasks");
});

test("the brief leaves out Where we left off when the Agenda has it, and says when nothing is open", () => {
  const block = briefBlock({ meetings: [], id: "solo", date: "2026-10-08", attendees: [], myNames: [], today: "2026-10-08", updated: "now", skipLeftOff: true });
  assert.doesNotMatch(block, /Where we left off|Account:/);
  assert.match(block, /Nothing open from this meeting's attendees\./);
  assert.match(block, /Nothing open from this series or account\./);
});

test("upsertBrief adds the brief above the Agenda, replaces it in place, and removeBrief takes it out", () => {
  const note = "---\ntitle: x\n---\n\n# Sync\n\n> [!info] Meeting details\n\n## Agenda\n\n- Mine\n\n## Notes\n\n- \n";
  const once = upsertBrief(note, `${BRIEF_START}\nfirst\n${BRIEF_END}`);
  assert.match(once, /> \[!info\] Meeting details\n\n<!-- meeting-brief:start[^\n]*\nfirst\n<!-- meeting-brief:end -->\n\n## Agenda/);
  const twice = upsertBrief(once, `${BRIEF_START}\nsecond\n${BRIEF_END}`);
  assert.doesNotMatch(twice, /first/);
  assert.equal(twice.split(BRIEF_START).length, 2);
  assert.equal(removeBrief(twice), note);
  assert.equal(removeBrief(note), note);
});

test("upsertBrief keeps a blank line between a details box and the brief", () => {
  const out = upsertBrief("# Sync\n> [!info] Meeting details\n> When: now\n## Agenda\n", `${BRIEF_START}\nx\n${BRIEF_END}`);
  assert.match(out, /> When: now\n\n<!-- meeting-brief:start/);
});

test("a brief with a deleted marker is replaced cleanly, without touching the user's writing", () => {
  const note = "# Sync\n\n## Agenda\n\n- Mine\n\n## Notes\n\n- My notes\n";
  const block = (x: string) => `${BRIEF_START}\n## Meeting Brief\n${x}\n${BRIEF_END}`;
  for (const lost of [BRIEF_START, BRIEF_END]) {
    let c = upsertBrief(note, block("v1")).replace(`${lost}\n`, "").replace(lost, "");
    c = upsertBrief(upsertBrief(c, block("v2")), block("v3"));
    assert.equal(c.split(BRIEF_START).length, 2, lost);
    assert.equal(c.split(BRIEF_END).length, 2, lost);
    assert.match(c, /v3/);
    assert.doesNotMatch(c, /v2/);
    assert.match(removeBrief(c), /- Mine\n\n## Notes\n\n- My notes/);
  }
});

test("the brief still lists parked items for the series, marked parked", () => {
  const block = briefBlock({
    meetings: [meeting("M/Pilot 1", "2026-10-01", { id: "pilot::2026-10-01", openItems: [parseTaskMeta("Draft SOW @[[John Smith]] #parked")] })],
    id: "pilot::2026-10-08", date: "2026-10-08", attendees: [], myNames: ["John Smith"], today: "2026-10-08", updated: "now",
  });
  assert.match(block.split("### You owe")[1], /- Draft SOW @\[\[John Smith\]\] · \[\[M\/Pilot 1\|Pilot 1\]\] · \*parked\*/);
});
