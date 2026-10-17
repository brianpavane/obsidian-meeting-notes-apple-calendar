import test from "node:test";
import assert from "node:assert/strict";
import { parseTaskMeta } from "../src/actionItems";
import { oneOnOnePerson, seriesBody } from "../src/series";
import type { TrackerMeeting } from "../src/tracker";

const meeting = (path: string, date: string, extra: Partial<TrackerMeeting> = {}): TrackerMeeting => ({
  path, title: path.split("/").pop() ?? path, date, openItems: [], doneItems: [], decisions: [], ...extra,
});

test("a series is a 1:1 when every meeting held had the same one other person", () => {
  assert.equal(oneOnOnePerson([meeting("a", "2026-10-01", { people: ["Ann Lee"] }), meeting("b", "2026-10-08", { people: ["ann lee"] })]), "Ann Lee");
  assert.equal(oneOnOnePerson([meeting("a", "2026-10-01", { people: ["Ann Lee"] }), meeting("b", "2026-10-08", { people: ["Ann Lee", "Bob Jones"] })]), undefined);
  assert.equal(oneOnOnePerson([meeting("a", "2026-10-01", { people: ["Ann Lee"] }), meeting("b", "2026-10-08", { people: ["Cy Ong"] })]), undefined);
  assert.equal(oneOnOnePerson([meeting("a", "2026-10-01", { people: ["Ann Lee"] }), meeting("b", "2026-10-08", { people: [], skipped: true })]), "Ann Lee", "a meeting that didn't happen doesn't count");
  assert.equal(oneOnOnePerson([]), undefined);
});

test("a 1:1's series note also lists what they owe you from any meeting and what you owe them", () => {
  const ones = [meeting("M/1-1 1", "2026-10-01", { people: ["Ann Lee"], openItems: [parseTaskMeta("Review deck @[[John Smith]]")] })];
  const others = [
    meeting("M/Pilot", "2026-10-05", { people: ["Ann Lee", "Bob Jones"], openItems: [parseTaskMeta("Send budget @[[Ann Lee]] 📅 2026-10-01"), parseTaskMeta("Fix certs @[[John Smith]]")] }),
    meeting("M/Other", "2026-10-06", { people: ["Bob Jones"], openItems: [parseTaskMeta("Mine, no Ann @[[John Smith]]")] }),
  ];
  const body = seriesBody(ones, "now", "2026-10-08", { person: "Ann Lee", meetings: [...ones, ...others], myNames: ["John Smith"] });
  assert.match(body.split("## Ann Lee owes you")[1].split("\n## ")[0], /Send budget[^\n]*\*overdue\*/);
  const youOwe = body.split("## You owe Ann Lee")[1].split("\n## ")[0];
  assert.match(youOwe, /Review deck[\s\S]*Fix certs|Fix certs[\s\S]*Review deck/);
  assert.doesNotMatch(youOwe, /Mine, no Ann/);
  assert.doesNotMatch(seriesBody(ones, "now", "2026-10-08"), /owes you/, "only for a 1:1");
});
