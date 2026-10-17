import test from "node:test";
import assert from "node:assert/strict";
import { cancelTask, collectOpenItems, completeTask, filterByOwner, groupItems, isMine, parkTask, parseTaskMeta, singleWordNames, tasksQueryExcludes, type MeetingTasks } from "../src/actionItems";
import { TFile } from "./support/obsidianStub";
import { createMemoryApp } from "./support/testHelpers";

const note = (title: string, start: string, body: string) =>
  `---\ntitle: "${title}"\nstart: ${start}\ncalendar_event_id: "${title}"\n---\n\n## Action items\n\n${body}`;

test("collectOpenItems lists open tasks from meeting notes, newest meeting first", async () => {
  const app = createMemoryApp([
    { path: "Meetings/2026-01-08 - Sync.md", content: note("Sync", "2026-01-08T10:00", "- [ ] Send deck\n- [x] Book room\n- [ ] ") },
    { path: "Meetings/2026-01-15 - Review.md", content: note("Review", "2026-01-15T10:00", "- [ ] Draft plan") },
    { path: "Meetings/2026-01-20 - Done.md", content: note("Done", "2026-01-20T10:00", "- [x] All done\n- [ ] ") },
    { path: "Other/Todo.md", content: "- [ ] Not a meeting" },
    { path: "Projects/Acme/2026-01-10 - Kickoff.md", content: note("Kickoff", "2026-01-10T10:00", "- [ ] Filed away") },
  ]);

  const meetings = await collectOpenItems(app as never);
  assert.deepEqual(
    meetings.map((m) => [m.title, m.start, m.tasks.map((t) => t.text)]),
    [
      ["Review", "2026-01-15T10:00", ["Draft plan"]],
      ["Kickoff", "2026-01-10T10:00", ["Filed away"]],
      ["Sync", "2026-01-08T10:00", ["Send deck"]],
    ]
  );
});

test("completeTask adds the Tasks plugin's done date when given", async () => {
  const app = createMemoryApp([{ path: "Meetings/Sync.md", content: "## Action items\n\n- [ ] Send deck 📅 2026-10-09" }]);
  const file = app.files.get("Meetings/Sync.md") as TFile;
  assert.equal(await completeTask(app as never, file as never, { line: 2, text: "Send deck 📅 2026-10-09" }, "2026-10-07"), true);
  assert.equal(file.content, "## Action items\n\n- [x] Send deck 📅 2026-10-09 ✅ 2026-10-07");
});

test("completeTask checks off the task, finding it by text if its line moved", async () => {
  const app = createMemoryApp([
    { path: "Meetings/Sync.md", content: "## Action items\n\n- [ ] Send deck\n- [ ] Draft plan" },
  ]);
  const file = app.files.get("Meetings/Sync.md") as TFile;

  assert.equal(await completeTask(app as never, file as never, { line: 3, text: "Draft plan" }), true);
  assert.equal(file.content, "## Action items\n\n- [ ] Send deck\n- [x] Draft plan");

  file.content = "## Notes\n\n## Action items\n\n- [ ] Send deck\n- [x] Draft plan";
  assert.equal(await completeTask(app as never, file as never, { line: 2, text: "Send deck" }), true);
  assert.equal(file.content, "## Notes\n\n## Action items\n\n- [x] Send deck\n- [x] Draft plan");

  assert.equal(await completeTask(app as never, file as never, { line: 4, text: "Send deck" }), false);
});

test("parseTaskMeta reads @owners and due dates in both Tasks formats", () => {
  assert.deepEqual(parseTaskMeta("Send deck @Bob 📅 2026-10-10"), { text: "Send deck @Bob", owner: "Bob", owners: ["Bob"], due: "2026-10-10", priority: undefined });
  assert.deepEqual(parseTaskMeta("Draft plan @[[Alice Smith]] [due:: 2026-10-08]"), { text: "Draft plan @[[Alice Smith]]", owner: "Alice Smith", owners: ["Alice Smith"], due: "2026-10-08", priority: undefined });
  assert.deepEqual(parseTaskMeta("Email bob@example.com"), { text: "Email bob@example.com", owner: undefined, owners: [], due: undefined, priority: undefined });
});

test("parseTaskMeta reads Tasks priorities, role owners, and hides created and done dates", () => {
  assert.deepEqual(parseTaskMeta("Send scope @[[Bob Jones]] ⏫ ➕ 2026-10-07 📅 2026-10-09"), {
    text: "Send scope @[[Bob Jones]]", owner: "Bob Jones", owners: ["Bob Jones"], due: "2026-10-09", priority: "high", created: "2026-10-07",
  });
  assert.deepEqual(parseTaskMeta("Confirm window (owner: Customer IT team) 🔽"), {
    text: "Confirm window (owner: Customer IT team)", owner: "Customer IT team", owners: ["Customer IT team"], due: undefined, priority: "low",
  });
  assert.equal(parseTaskMeta("Old style (priority: Medium)").priority, "medium");
  assert.equal(parseTaskMeta("Old style (priority: Medium)").text, "Old style");
});

test("groupItems puts higher priority first within a person or due-date group", () => {
  const meeting: MeetingTasks = {
    file: new TFile("Meetings/Sync.md") as never,
    title: "Sync",
    start: "2026-10-01T10:00",
    tasks: [
      { line: 0, text: "Low thing @Bob 🔽 📅 2026-10-02" },
      { line: 1, text: "Plain thing @Bob 📅 2026-10-01" },
      { line: 2, text: "Urgent thing @Bob ⏫ 📅 2026-10-20" },
    ],
  };
  const [bob] = groupItems([meeting], "person", "2026-10-05");
  assert.deepEqual(bob.rows.map((r) => r.meta.text), ["Urgent thing @Bob", "Plain thing @Bob", "Low thing @Bob"]);
});

test("groupItems groups by person and by due date", () => {
  const meeting = (title: string, start: string, texts: string[]): MeetingTasks => ({
    file: new TFile(`Meetings/${title}.md`) as never,
    title,
    start,
    tasks: texts.map((text, line) => ({ line, text })),
  });
  const meetings = [
    meeting("Review", "2026-10-05T10:00", ["Draft plan @Alice 📅 2026-10-08", "Book room"]),
    meeting("Sync", "2026-10-01T10:00", ["Send deck @Bob 📅 2026-10-02", "Call vendor @Alice 📅 2026-10-30"]),
  ];
  const today = "2026-10-06";

  const byPerson = groupItems(meetings, "person", today);
  assert.deepEqual(byPerson.map((g) => [g.label, g.rows.map((r) => r.meta.text)]), [
    ["Alice", ["Draft plan @Alice", "Call vendor @Alice"]],
    ["Bob", ["Send deck @Bob"]],
    ["Unassigned", ["Book room"]],
  ]);
  assert.equal(byPerson[1].rows[0].overdue, true);

  const byDue = groupItems(meetings, "due", today);
  assert.deepEqual(byDue.map((g) => [g.label, g.rows.map((r) => r.meeting.title)]), [
    ["Overdue", ["Sync"]],
    ["Next 7 days", ["Review"]],
    ["Later", ["Sync"]],
    ["No due date", ["Review"]],
  ]);

  assert.deepEqual(groupItems(meetings, "meeting", today).map((g) => [g.label, g.rows.length]), [["Review", 2], ["Sync", 2]]);
});

test("tasksQueryExcludes spots a global query line that leaves out a folder", () => {
  assert.equal(tasksQueryExcludes("", "Meeting Hub"), false);
  assert.equal(tasksQueryExcludes("path does not include Meeting Hub", "Meeting Hub"), true);
  assert.equal(tasksQueryExcludes("not done\n  folder does not include Work/Meeting Hub  ", "Work/Meeting Hub"), true);
  assert.equal(tasksQueryExcludes("path does not include Archive", "Meeting Hub"), false);
  assert.equal(tasksQueryExcludes("path includes Meeting Hub", "Meeting Hub"), false);
});

test("isMine: items naming the user, or no one, are theirs; several owners count if any is the user", () => {
  const me = ["John Smith", "John"];
  assert.equal(isMine(parseTaskMeta("Book room"), me), true);
  assert.equal(isMine(parseTaskMeta("Send deck @[[john smith]]"), me), true);
  assert.equal(isMine(parseTaskMeta("Review @[[Tom Clark]] @[[John Smith]]"), me), true);
  assert.equal(isMine(parseTaskMeta("Send runbook @[[Jane Doe]]"), me), false);
  assert.equal(isMine(parseTaskMeta("Open the firewall (owner: XYZ Network Team)"), me), false);
  assert.deepEqual(parseTaskMeta("Review @[[Tom Clark]] @Ann (owner: IT)").owners, ["Tom Clark", "Ann", "IT"]);
});

test("filterByOwner splits the panel into mine and waiting on others, and shows everything without names", () => {
  const meeting: MeetingTasks = {
    file: new TFile("Meetings/Sync.md") as never, title: "Sync", start: "2026-10-01T10:00",
    tasks: [{ line: 0, text: "Mine @Me" }, { line: 1, text: "Theirs @Bob" }, { line: 2, text: "Unowned" }],
  };
  const texts = (ms: MeetingTasks[]) => ms.flatMap((m) => m.tasks.map((t) => t.text));
  assert.deepEqual(texts(filterByOwner([meeting], "mine", ["Me"])), ["Mine @Me", "Unowned"]);
  assert.deepEqual(texts(filterByOwner([meeting], "others", ["Me"])), ["Theirs @Bob"]);
  assert.deepEqual(texts(filterByOwner([meeting], "mine", [])), ["Mine @Me", "Theirs @Bob", "Unowned"]);
  assert.deepEqual(filterByOwner([{ ...meeting, tasks: [{ line: 0, text: "Mine @Me" }] }], "others", ["Me"]), [], "meetings left with nothing are dropped");
});

test("cancelTask marks an item won't do with the Tasks plugin's cancelled status and date", async () => {
  const app = createMemoryApp([{ path: "Meetings/Sync.md", content: "## Next Steps\n\n- [ ] Old idea\n- [ ] Keep\n" }]);
  const file = app.files.get("Meetings/Sync.md") as TFile;
  assert.equal(await cancelTask(app as never, file as never, { line: 2, text: "Old idea" }, "2026-10-10"), true);
  assert.equal(file.content, "## Next Steps\n\n- [-] Old idea ❌ 2026-10-10\n- [ ] Keep\n");
});

test("isMine counts (owner: me), as AI replies write You or Me, as the user's", () => {
  assert.equal(isMine(parseTaskMeta("Send notes (owner: me)"), ["John Smith"]), true);
  assert.equal(isMine(parseTaskMeta("Send notes (owner: me)"), []), true);
});

test("parkTask tags an item #parked and unparks it; a parked item stays open but leaves Mine and Waiting on others", async () => {
  const app = createMemoryApp([{ path: "Meetings/Sync.md", content: "## Next Steps\n\n- [ ] Draft SOW @[[Ann Lee]] 📅 2026-10-20\n- [ ] Keep\n" }]);
  const file = app.files.get("Meetings/Sync.md") as TFile;
  assert.equal(await parkTask(app as never, file as never, { line: 2, text: "Draft SOW @[[Ann Lee]] 📅 2026-10-20" }, true), true);
  assert.equal(file.content, "## Next Steps\n\n- [ ] Draft SOW @[[Ann Lee]] 📅 2026-10-20 #parked\n- [ ] Keep\n");
  const meta = parseTaskMeta("Draft SOW @[[Ann Lee]] 📅 2026-10-20 #parked");
  assert.equal(meta.parked, true);
  assert.equal(meta.text, "Draft SOW @[[Ann Lee]]");
  assert.equal(meta.due, "2026-10-20");
  assert.equal(parseTaskMeta("Read #parkedcars").parked, undefined);

  const meeting: MeetingTasks = { file: file as never, title: "Sync", start: "", tasks: [{ line: 2, text: "Draft SOW @[[Ann Lee]] 📅 2026-10-20 #parked" }, { line: 3, text: "Keep" }] };
  const texts = (f: "mine" | "others" | "parked" | "everyone", names: string[]) => filterByOwner([meeting], f, names).flatMap((m) => m.tasks.map((t) => t.text.split(" ")[0]));
  assert.deepEqual(texts("mine", ["Me"]), ["Keep"]);
  assert.deepEqual(texts("others", ["Me"]), []);
  assert.deepEqual(texts("parked", ["Me"]), ["Draft"]);
  assert.deepEqual(texts("everyone", ["Me"]), ["Draft", "Keep"]);
  assert.deepEqual(texts("mine", []), ["Keep"], "without names, Mine is everything not parked");

  assert.equal(await parkTask(app as never, file as never, { line: 2, text: "Draft SOW @[[Ann Lee]] 📅 2026-10-20 #parked" }, false), true);
  assert.match(file.content ?? "", /- \[ \] Draft SOW @\[\[Ann Lee\]\] 📅 2026-10-20\n/);
});

test("singleWordNames flags first names alone in the Your name setting", () => {
  assert.deepEqual(singleWordNames("John Smith, John,  , John Q. Smith"), ["John"]);
  assert.deepEqual(singleWordNames(""), []);
});
