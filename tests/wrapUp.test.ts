import test from "node:test";
import assert from "node:assert/strict";
import { withDueDate, rescheduleTask, type MeetingTasks } from "../src/actionItems";
import { nextMonday, wrapUpRows } from "../src/wrapUp";
import { TFile } from "./support/obsidianStub";
import { createMemoryApp } from "./support/testHelpers";

test("the wrap-up lists your slipped items, oldest first, and today's undated ones; not others', not parked", () => {
  const meeting: MeetingTasks = {
    file: new TFile("M/Sync.md") as never, title: "Sync", start: "",
    tasks: [
      { line: 0, text: "Late @Me 📅 2026-10-08" },
      { line: 1, text: "Today @Me 📅 2026-10-10" },
      { line: 2, text: "Tomorrow @Me 📅 2026-10-11" },
      { line: 3, text: "Theirs @Bob 📅 2026-10-01" },
      { line: 4, text: "Parked @Me 📅 2026-10-01 #parked" },
      { line: 5, text: "New, no date ➕ 2026-10-10" },
      { line: 6, text: "Old, no date ➕ 2026-10-01" },
    ],
  };
  const { slipped, undated } = wrapUpRows([meeting], ["Me"], "2026-10-10");
  assert.deepEqual(slipped.map((r) => r.meta.text), ["Late @Me", "Today @Me"]);
  assert.deepEqual(undated.map((r) => r.meta.text), ["New, no date"]);
});

test("rescheduling sets or replaces the due date in either Tasks format, keeping #parked last", async () => {
  assert.equal(withDueDate("- [ ] Send 📅 2026-10-01", "2026-10-12"), "- [ ] Send 📅 2026-10-12");
  assert.equal(withDueDate("- [ ] Send [due:: 2026-10-01]", "2026-10-12"), "- [ ] Send [due:: 2026-10-12]");
  assert.equal(withDueDate("- [ ] Send ⏫ ➕ 2026-10-10", "2026-10-12"), "- [ ] Send ⏫ ➕ 2026-10-10 📅 2026-10-12");
  assert.equal(withDueDate("- [ ] Send #parked", "2026-10-12"), "- [ ] Send 📅 2026-10-12 #parked");
  assert.equal(nextMonday("2026-10-10"), "2026-10-12");
  assert.equal(nextMonday("2026-10-12"), "2026-10-19", "from a Monday, the next one");

  const app = createMemoryApp([{ path: "M/Sync.md", content: "- [ ] Send 📅 2026-10-01\n" }]);
  const file = app.files.get("M/Sync.md") as TFile;
  assert.equal(await rescheduleTask(app as never, file as never, { line: 0, text: "Send 📅 2026-10-01" }, "2026-10-12"), true);
  assert.equal(file.content, "- [ ] Send 📅 2026-10-12\n");
});
