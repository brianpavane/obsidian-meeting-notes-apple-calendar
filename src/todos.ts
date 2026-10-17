/**
 * @file todos.ts
 * @description My To-Dos: one checklist note in the Meeting Hub for tasks
 * that didn't come from a meeting. Its items count as the user's own in the
 * Meeting Tracker's Focus, the action items panel and the weekly review.
 * The "Add a to-do" box adds one without opening the note.
 */

import { App, Modal, Setting } from "obsidian";
import { actionLine, type ActionItem } from "./assistant";
import { appendToSection } from "./sections";

export const TODOS_FILENAME = "My To-Dos.md";
export const TODOS_TYPE = "meeting-todos";
export const TODOS_TITLE = "My To-Dos";
const TODOS_SECTION = "To-dos";

export type TodoSource = "email" | "chat";

/** The tag a to-do's source is saved as. */
export const SOURCE_TAG: Record<TodoSource, string> = { email: "#from-email", chat: "#from-chat" };

export interface NewTodo {
  text: string;
  /** YYYY-MM-DD */
  due?: string;
  priority?: ActionItem["priority"];
  from?: TodoSource;
  /** A link back to the message, e.g. a Slack permalink. */
  link?: string;
}

export function newTodosNote(): string {
  return [
    "---",
    `type: ${TODOS_TYPE}`,
    "tags:",
    `  - ${TODOS_TYPE}`,
    "---",
    "",
    `# ${TODOS_TITLE}`,
    "",
    "*Tasks that didn't come from a meeting. Add one here, or from anywhere with **Add a to-do**. They're ranked with your meeting items in the Meeting Tracker's Focus.*",
    "",
    `## ${TODOS_SECTION}`,
    "",
  ].join("\n");
}

/** A to-do as a task line: its text (and link), priority, created date, due date, then its source tag. */
export function todoLine(todo: NewTodo, today: string, people?: string[], role?: string): string {
  const link = todo.link?.trim() ? ` [↗](${todo.link.trim()})` : "";
  const line = actionLine({ task: `${todo.text.trim()}${link}`, due: todo.due, priority: todo.priority, people, role }, today);
  return todo.from ? `${line} ${SOURCE_TAG[todo.from]}` : line;
}

/** The note with the to-do added at the end of its To-dos section, stamped with `today` as its created date. */
export function addTodo(content: string, todo: NewTodo, today: string): string {
  return appendToSection(content, [TODOS_SECTION], [todoLine(todo, today)]);
}

/** The note with the assistant's action items from a message added as to-dos, each tagged with where it came from. */
export function addCapturedTodos(content: string, items: ActionItem[], from: TodoSource, today: string): string {
  const lines = items.map((i) => (i.raw !== undefined
    ? `- [ ] ${i.raw} ➕ ${today} ${SOURCE_TAG[from]}`
    : todoLine({ text: i.task, due: i.due, priority: i.priority, from }, today, i.people, i.role)));
  return appendToSection(content, [TODOS_SECTION], lines);
}

const SOURCES: Array<[string, string]> = [
  ["", "—"],
  ["email", "Email"],
  ["chat", "Slack or Teams"],
];

const PRIORITIES: Array<[string, string]> = [
  ["", "No priority"],
  ["High", "High ⏫"],
  ["Medium", "Medium 🔼"],
  ["Low", "Low 🔽"],
  ["Someday", "Someday ⏬"],
];

export class AddTodoModal extends Modal {
  constructor(app: App, private readonly onSubmit: (todo: NewTodo) => void) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText("Add a to-do");
    const todo: NewTodo = { text: "" };
    const submit = () => {
      if (!todo.text.trim()) return;
      this.close();
      this.onSubmit(todo);
    };
    new Setting(this.contentEl).setName("To-do").addText((text) => {
      text.setPlaceholder("What needs doing").onChange((value) => (todo.text = value));
      text.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submit();
      });
      window.setTimeout(() => text.inputEl.focus());
    });
    new Setting(this.contentEl).setName("Due").setDesc("Optional").addText((text) => {
      text.inputEl.type = "date";
      text.onChange((value) => (todo.due = /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined));
    });
    new Setting(this.contentEl).setName("Priority").addDropdown((dropdown) => {
      for (const [value, label] of PRIORITIES) dropdown.addOption(value, label);
      dropdown.onChange((value) => (todo.priority = (value || undefined) as NewTodo["priority"]));
    });
    new Setting(this.contentEl).setName("From").setDesc("Optional").addDropdown((dropdown) => {
      for (const [value, label] of SOURCES) dropdown.addOption(value, label);
      dropdown.onChange((value) => (todo.from = (value || undefined) as TodoSource | undefined));
    });
    new Setting(this.contentEl).setName("Link").setDesc("Optional: a link back to the message, e.g. a Slack permalink").addText((text) => {
      text.setPlaceholder("https://…").onChange((value) => (todo.link = value.trim() || undefined));
    });
    new Setting(this.contentEl).addButton((button) => button.setButtonText("Add").setCta().onClick(submit));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
