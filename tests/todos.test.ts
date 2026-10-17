import test from "node:test";
import assert from "node:assert/strict";
import { captureInstructions, nextStepsIn } from "../src/assistant";
import { addCapturedTodos, addTodo, newTodosNote } from "../src/todos";

test("a to-do keeps where it came from and a link back to the message", () => {
  const note = addTodo(newTodosNote(), { text: "Reply to Ann", due: "2026-10-14", priority: "High", from: "chat", link: "https://acme.slack.com/archives/C1/p2" }, "2026-10-12");
  assert.match(note, /- \[ \] Reply to Ann \[↗\]\(https:\/\/acme\.slack\.com\/archives\/C1\/p2\) ⏫ ➕ 2026-10-12 📅 2026-10-14 #from-chat\n/);
});

test("tasks from a message: the assistant's list becomes to-dos with owners, dates, priorities and their source", () => {
  const reply = [
    "Here are the action items:",
    "- [ ] **[[John Smith]]**: Send the revised SOW (2026-10-15, High)",
    "- [ ] **[[Ann Lee]]**: Confirm legal review (Medium)",
    "* [ ] Unowned follow-up",
    "Not a task",
  ].join("\n");
  const items = nextStepsIn(reply);
  assert.equal(items.length, 3);
  const note = addCapturedTodos(newTodosNote(), items, "email", "2026-10-12");
  assert.match(note, /- \[ \] Send the revised SOW @\[\[John Smith\]\] ⏫ ➕ 2026-10-12 📅 2026-10-15 #from-email\n- \[ \] Confirm legal review @\[\[Ann Lee\]\] 🔼 ➕ 2026-10-12 #from-email\n- \[ \] Unowned follow-up ➕ 2026-10-12 #from-email\n/);
});

test("the capture instructions name the user and ask for the Next Steps format", () => {
  const text = captureInstructions("John Smith", "2026-10-12");
  assert.match(text, /for me \(John Smith\)/);
  assert.match(text, /- \[ \] \*\*\[\[Full Name\]\]\*\*: What needs doing \(YYYY-MM-DD, Priority\)/);
  assert.match(text, /write me as \[\[John Smith\]\]/);
});
