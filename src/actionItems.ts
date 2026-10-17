/**
 * @file actionItems.ts
 * @description The "Meeting action items" sidebar view: every open task in
 * the plugin's meeting notes, grouped by meeting, person, or due date.
 * Ticking an item checks it off in its meeting note.
 *
 * Tasks may name an owner (`@Bob`, `@[[Bob Jones]]`, or `(owner: IT team)`),
 * a due date and a priority in the Tasks plugin's formats (`📅 2026-10-10` or
 * `[due:: 2026-10-10]`; ⏫ high, 🔼 medium, 🔽 low). Ticking a task adds the
 * Tasks plugin's done date (`✅ 2026-10-07`); "Won't do" marks it cancelled
 * (`- [-] … ❌ 2026-10-07`), so it leaves every list without counting as done.
 * "Park" tags it `#parked`: it stays open for its account or series, but off
 * the user's own lists.
 */

import { App, debounce, ItemView, setIcon, TFile, ViewStateResult, WorkspaceLeaf } from "obsidian";
import { findMeetingNotes, openTasks, OpenTask } from "./noteCreator";
import { TODOS_TITLE, TODOS_TYPE } from "./todos";

export const ACTION_ITEMS_VIEW = "calendar-notes-action-items";

export interface MeetingTasks {
  file: TFile;
  title: string;
  start: string;
  tasks: OpenTask[];
}

export type Priority = "highest" | "high" | "medium" | "low" | "lowest";

export interface TaskMeta {
  /** Task text without the due date, priority and created/done date markers. */
  text: string;
  /** The first owner named. */
  owner?: string;
  /** Every owner named (`@Bob @[[Ann Lee]]`, or a role). */
  owners: string[];
  due?: string;
  priority?: Priority;
  /** The Tasks plugin's done date (`✅ 2026-10-08`), if the task has one. */
  doneOn?: string;
  /** The Tasks plugin's created date (`➕ 2026-10-08`), if the task has one. */
  created?: string;
  /** Tagged `#parked`: still open for its account or series, but off the user's own lists. */
  parked?: boolean;
}

const PARKED_RE = /(?:^|\s)#parked(?![\w/-])/i;
const DUE_RE = /\s*(?:📅\s*(\d{4}-\d{2}-\d{2})|\[due::\s*(\d{4}-\d{2}-\d{2})\s*\])/u;
const OWNER_RE = /(?:^|\s)@(?:\[\[([^\]|]+)(?:\|[^\]]*)?\]\]|([\p{L}\p{N}_.-]+))/gu;
const ROLE_OWNER_RE = /\(owner:\s*([^)]+)\)/i;
const PRIORITY_MARKS: Array<[RegExp, Priority]> = [
  [/🔺/u, "highest"],
  [/⏫|\(priority:\s*high\)/iu, "high"],
  [/🔼|\(priority:\s*medium\)/iu, "medium"],
  [/🔽|\(priority:\s*low\)/iu, "low"],
  [/⏬/u, "lowest"],
];
const OTHER_MARKS_RE = /\s*(?:[🔺⏫🔼🔽⏬]|\(priority:\s*\w+\)|(?:➕|✅|❌|⏳|🛫)\s*\d{4}-\d{2}-\d{2})/giu;

/** Owner, due date and priority written in a task's text. */
export function parseTaskMeta(text: string): TaskMeta {
  const due = text.match(DUE_RE);
  const people = [...text.matchAll(OWNER_RE)].map((m) => (m[1] ?? m[2]).trim());
  const role = text.match(ROLE_OWNER_RE)?.[1].trim();
  const owners = [...people, ...(role ? [role] : [])];
  const doneOn = text.match(/✅\s*(\d{4}-\d{2}-\d{2})/u)?.[1];
  const created = text.match(/➕\s*(\d{4}-\d{2}-\d{2})/u)?.[1];
  return {
    text: text.replace(DUE_RE, "").replace(OTHER_MARKS_RE, "").replace(PARKED_RE, " ").replace(/\s+/g, " ").trim(),
    owner: owners[0],
    owners,
    due: due ? due[1] ?? due[2] : undefined,
    priority: PRIORITY_MARKS.find(([re]) => re.test(text))?.[1],
    ...(doneOn ? { doneOn } : {}),
    ...(created ? { created } : {}),
    ...(PARKED_RE.test(text) ? { parked: true } : {}),
  };
}

const PRIORITY_RANK: Record<Priority, number> = { highest: 0, high: 1, medium: 2, low: 4, lowest: 5 };
/** Sort key: no priority ranks between medium and low, as in the Tasks plugin. */
export const priorityRank = (p: Priority | undefined) => (p ? PRIORITY_RANK[p] : 3);

export type GroupBy = "meeting" | "person" | "due";

export interface ItemRow {
  meeting: MeetingTasks;
  task: OpenTask;
  meta: TaskMeta;
  overdue: boolean;
}

export interface ItemGroup {
  label: string;
  /** Set when the group is a single meeting, so its heading can open the note. */
  meeting?: MeetingTasks;
  rows: ItemRow[];
}

const DUE_BUCKETS = ["Overdue", "Today", "Next 7 days", "Later", "No due date"] as const;

function dueBucket(due: string | undefined, today: string, weekAhead: string): typeof DUE_BUCKETS[number] {
  if (!due) return "No due date";
  if (due < today) return "Overdue";
  if (due === today) return "Today";
  return due <= weekAhead ? "Next 7 days" : "Later";
}

/**
 * Group open items for display. `today` is the local date (YYYY-MM-DD).
 * By meeting: newest meeting first. By person: alphabetical, unassigned last.
 * By due date: overdue first, then soonest; undated last.
 */
export function groupItems(meetings: MeetingTasks[], groupBy: GroupBy, today: string): ItemGroup[] {
  const rows: ItemRow[] = meetings.flatMap((meeting) => meeting.tasks.map((task) => {
    const meta = parseTaskMeta(task.text);
    return { meeting, task, meta, overdue: meta.due !== undefined && meta.due < today };
  }));
  const byDue = (a: ItemRow, b: ItemRow) =>
    priorityRank(a.meta.priority) - priorityRank(b.meta.priority) ||
    (a.meta.due ?? "9999").localeCompare(b.meta.due ?? "9999");

  if (groupBy === "meeting") {
    return meetings.map((meeting) => ({
      label: meeting.title,
      meeting,
      rows: rows.filter((r) => r.meeting === meeting),
    }));
  }

  const groups = new Map<string, ItemRow[]>();
  const week = new Date(`${today}T12:00:00`);
  week.setDate(week.getDate() + 7);
  const weekAhead = localDate(week);
  for (const row of rows) {
    const key = groupBy === "person" ? row.meta.owner ?? "" : dueBucket(row.meta.due, today, weekAhead);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const keys = groupBy === "person"
    ? [...groups.keys()].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)))
    : DUE_BUCKETS.filter((k) => groups.has(k));
  return keys.map((key) => ({
    label: groupBy === "person" ? key || "Unassigned" : key,
    rows: [...(groups.get(key) ?? [])].sort(byDue),
  }));
}

/** My To-Dos first, then meeting notes anywhere in the vault that have open tasks, newest first. */
export async function collectOpenItems(app: App): Promise<MeetingTasks[]> {
  const todos: MeetingTasks[] = [];
  for (const file of app.vault.getMarkdownFiles()) {
    if (app.metadataCache.getFileCache(file)?.frontmatter?.type !== TODOS_TYPE) continue;
    const tasks = openTasks(await app.vault.cachedRead(file));
    if (tasks.length > 0) todos.push({ file, title: TODOS_TITLE, start: "", tasks });
  }
  const meetings: MeetingTasks[] = [];
  for (const { file } of findMeetingNotes(app)) {
    const tasks = openTasks(await app.vault.cachedRead(file));
    if (tasks.length === 0) continue;
    const fm = app.metadataCache.getFileCache(file)?.frontmatter ?? {};
    meetings.push({
      file,
      title: typeof fm.title === "string" && fm.title ? fm.title : file.basename,
      start: String(fm.start ?? fm.date ?? ""),
      tasks,
    });
  }
  return [...todos, ...meetings.sort((a, b) => b.start.localeCompare(a.start))];
}

/**
 * Check off an open task in its note, adding the Tasks plugin's done date
 * (`✅ done`) when given. The task is looked up by text if its line moved
 * since it was listed. Returns false if it is no longer open.
 */
export async function completeTask(app: App, file: TFile, task: OpenTask, done?: string): Promise<boolean> {
  return closeTask(app, file, task, "x", done ? `✅ ${done}` : "");
}

/** Mark an open task "won't do": the Tasks plugin's cancelled status (`- [-]`) and date (`❌ on`). */
export async function cancelTask(app: App, file: TFile, task: OpenTask, on?: string): Promise<boolean> {
  return closeTask(app, file, task, "-", on ? `❌ ${on}` : "");
}

async function closeTask(app: App, file: TFile, task: OpenTask, status: "x" | "-", stamp: string): Promise<boolean> {
  let completed = false;
  await app.vault.process(file, (content) => {
    const lines = content.split("\n");
    const isTask = (i: number) => openTasks(lines[i] ?? "").some((t) => t.text === task.text);
    const index = isTask(task.line) ? task.line : lines.findIndex((_, i) => isTask(i));
    if (index === -1) return content;
    lines[index] = lines[index].replace("[ ]", `[${status}]`).replace(/\s*$/, stamp ? ` ${stamp}` : "");
    completed = true;
    return lines.join("\n");
  });
  return completed;
}

/** Park an open task (tag it `#parked`), or unpark it. Returns false if it is no longer open. */
export async function parkTask(app: App, file: TFile, task: OpenTask, park: boolean): Promise<boolean> {
  let changed = false;
  await app.vault.process(file, (content) => {
    const lines = content.split("\n");
    const isTask = (i: number) => openTasks(lines[i] ?? "").some((t) => t.text === task.text);
    const index = isTask(task.line) ? task.line : lines.findIndex((_, i) => isTask(i));
    if (index === -1) return content;
    const unparked = lines[index].replace(/\s+#parked(?![\w/-])/gi, "").replace(/\s+$/, "");
    lines[index] = park ? `${unparked} #parked` : unparked;
    changed = true;
    return lines.join("\n");
  });
  return changed;
}

/** A date as YYYY-MM-DD in this machine's time zone. */
export function localDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export type OwnerFilter = "mine" | "others" | "parked" | "everyone";

/**
 * Keep only the tasks `filter` asks for; meetings left with none are dropped.
 * Mine and Waiting on others leave out parked items. Without names, Mine is
 * every item that isn't parked.
 */
export function filterByOwner(meetings: MeetingTasks[], filter: OwnerFilter, myNames: string[]): MeetingTasks[] {
  if (filter === "everyone") return meetings;
  const keep = (meta: TaskMeta) =>
    filter === "parked"
      ? !!meta.parked
      : !meta.parked && (myNames.length === 0 ? filter === "mine" : isMine(meta, myNames) === (filter === "mine"));
  return meetings
    .map((m) => ({ ...m, tasks: m.tasks.filter((t) => keep(parseTaskMeta(t.text))) }))
    .filter((m) => m.tasks.length > 0);
}

/** Whether an item belongs on the user's own lists: theirs and not parked. */
export function onMyList(meta: TaskMeta, myNames: string[]): boolean {
  return !meta.parked && isMine(meta, myNames);
}

export class ActionItemsView extends ItemView {
  private readonly refresh = debounce(() => this.render(), 500, true);
  private groupBy: GroupBy = "meeting";
  private owner: OwnerFilter = "mine";

  /**
   * `myNames`: the names the user is written as in action items; none means
   * every item is shown. `addTodo` opens the Add a to-do box.
   */
  constructor(
    leaf: WorkspaceLeaf,
    private readonly myNames: () => string[] = () => [],
    private readonly addTodo?: () => void
  ) {
    super(leaf);
  }

  getViewType(): string {
    return ACTION_ITEMS_VIEW;
  }

  getDisplayText(): string {
    return "Meeting action items";
  }

  getIcon(): string {
    return "list-checks";
  }

  getState(): Record<string, unknown> {
    return { ...super.getState(), groupBy: this.groupBy, owner: this.owner };
  }

  async setState(state: unknown, result: ViewStateResult): Promise<void> {
    const { groupBy, owner } = (state ?? {}) as { groupBy?: unknown; owner?: unknown };
    if (groupBy === "meeting" || groupBy === "person" || groupBy === "due") this.groupBy = groupBy;
    if (owner === "mine" || owner === "others" || owner === "parked" || owner === "everyone") this.owner = owner;
    await this.render();
    await super.setState(state, result);
  }

  async onOpen(): Promise<void> {
    this.registerEvent(this.app.metadataCache.on("changed", () => this.refresh()));
    this.registerEvent(this.app.vault.on("delete", () => this.refresh()));
    this.registerEvent(this.app.vault.on("rename", () => this.refresh()));
    await this.render();
  }

  async render(): Promise<void> {
    const myNames = this.myNames();
    const meetings = filterByOwner(await collectOpenItems(this.app), this.owner, myNames);
    const el = this.contentEl;
    el.empty();
    el.addClass("cal-notes-action-items");

    const header = el.createDiv({ cls: "cal-notes-header" });
    header.createEl("h4", { text: "Open action items" });
    if (this.addTodo) {
      const add = header.createEl("button", { text: "+ To-do", attr: { "aria-label": "Add a to-do that isn't from a meeting" } });
      add.addEventListener("click", () => this.addTodo?.());
    }
    const select = header.createEl("select", { cls: "dropdown" });
    for (const [value, label] of [["meeting", "By meeting"], ["person", "By person"], ["due", "By due date"]] as const) {
      select.createEl("option", { value, text: label });
    }
    select.value = this.groupBy;
    select.addEventListener("change", async () => {
      this.groupBy = select.value as GroupBy;
      this.app.workspace.requestSaveLayout();
      await this.render();
    });
    const whose = header.createEl("select", { cls: "dropdown" });
    const filters: Array<[OwnerFilter, string]> = myNames.length > 0
      ? [["mine", "Mine"], ["others", "Waiting on others"], ["parked", "Parked"], ["everyone", "Everyone"]]
      : [["mine", "Not parked"], ["parked", "Parked"], ["everyone", "Everyone"]];
    for (const [value, label] of filters) whose.createEl("option", { value, text: label });
    if (!filters.some(([value]) => value === this.owner)) this.owner = "mine";
    whose.value = this.owner;
    whose.addEventListener("change", async () => {
      this.owner = whose.value as OwnerFilter;
      this.app.workspace.requestSaveLayout();
      await this.render();
    });
    if (myNames.length === 0) {
      el.createDiv({
        cls: "cal-notes-item-meta",
        text: "Showing everyone's items. Set Your name in the plugin's settings to see only yours.",
      });
    }

    if (meetings.length === 0) {
      const empty = {
        mine: "No open action items in your meeting notes.",
        others: "No one owes you anything right now.",
        parked: "Nothing parked. Park an item with its pause icon to keep it for its account or series but off your lists.",
        everyone: "No open action items in your meeting notes.",
      }[this.owner];
      el.createDiv({ cls: "cal-notes-empty", text: empty });
      return;
    }

    for (const group of groupItems(meetings, this.groupBy, localDate(new Date()))) {
      const block = el.createDiv({ cls: "cal-notes-meeting" });
      if (group.meeting) {
        const meeting = group.meeting;
        const heading = block.createEl("a", { cls: "cal-notes-meeting-title", text: group.label });
        heading.addEventListener("click", () => this.app.workspace.getLeaf(false).openFile(meeting.file));
        if (meeting.start) block.createDiv({ cls: "cal-notes-meeting-date", text: meeting.start.replace("T", " ") });
      } else {
        block.createDiv({ cls: "cal-notes-meeting-title", text: `${group.label} (${group.rows.length})` });
      }

      const list = block.createEl("ul", { cls: "contains-task-list" });
      for (const row of group.rows) {
        const item = list.createEl("li", { cls: "task-list-item" });
        const box = item.createEl("input", { type: "checkbox", cls: "task-list-item-checkbox" });
        const body = item.createDiv({ cls: "cal-notes-item" });
        body.createSpan({ text: row.meta.text });
        const details = body.createDiv({ cls: "cal-notes-item-meta" });
        if (row.meta.priority) {
          const label = row.meta.priority === "lowest" ? "Someday" : row.meta.priority[0].toUpperCase() + row.meta.priority.slice(1);
          details.createSpan({ cls: `cal-notes-priority is-${row.meta.priority}`, text: label });
        }
        if (row.meta.parked) details.createSpan({ cls: "cal-notes-parked", text: "Parked" });
        if (row.meta.due) {
          details.createSpan({ cls: row.overdue ? "cal-notes-due is-overdue" : "cal-notes-due", text: `📅 ${row.meta.due}` });
        }
        if (!group.meeting) {
          const source = details.createEl("a", { text: row.meeting.title });
          source.addEventListener("click", () => this.app.workspace.getLeaf(false).openFile(row.meeting.file));
        }
        box.addEventListener("change", async () => {
          box.disabled = true;
          await completeTask(this.app, row.meeting.file, row.task, localDate(new Date()));
          await this.render();
        });
        const park = item.createEl("a", {
          cls: "cal-notes-wont-do clickable-icon",
          attr: { "aria-label": row.meta.parked ? "Unpark: back on your lists" : "Park: keep it for its account or series, but off your lists" },
        });
        setIcon(park, row.meta.parked ? "play" : "pause");
        park.addEventListener("click", async () => {
          box.disabled = true;
          await parkTask(this.app, row.meeting.file, row.task, !row.meta.parked);
          await this.render();
        });
        const drop = item.createEl("a", { cls: "cal-notes-wont-do clickable-icon", attr: { "aria-label": "Won't do" } });
        setIcon(drop, "x");
        drop.addEventListener("click", async () => {
          box.disabled = true;
          await cancelTask(this.app, row.meeting.file, row.task, localDate(new Date()));
          await this.render();
        });
      }
    }
  }
}

/**
 * Whether a Tasks plugin global query keeps notes in `folder` out of every
 * Tasks query, with a "path (or folder) does not include …" line that
 * matches the folder.
 */
export function tasksQueryExcludes(globalQuery: string, folder: string): boolean {
  const path = `${folder}/`.toLowerCase();
  return globalQuery.split("\n").some((line) => {
    const m = line.trim().match(/^(?:path|folder) does not include\s+(.+)$/i);
    return !!m && path.includes(m[1].trim().toLowerCase());
  });
}

/**
 * Whether a task is the user's: it names one of `myNames` as an owner, or
 * `(owner: me)` as AI replies write "You"/"Me", or names no owner at all (a
 * task in your own notes is yours). Names match whatever their capitalization.
 */
export function isMine(meta: TaskMeta, myNames: string[]): boolean {
  if (meta.owners.length === 0) return true;
  const mine = new Set(["me", ...myNames.map((n) => n.trim().toLowerCase()).filter(Boolean)]);
  return meta.owners.some((o) => mine.has(o.toLowerCase()));
}

/**
 * Entries of the Your name setting that are a single word, like "John":
 * they would also claim items owned by anyone else written by that first name.
 */
export function singleWordNames(value: string): string[] {
  return value.split(",").map((n) => n.trim()).filter((n) => n && !/\s/.test(n));
}

/** A task line with its due date set to `date` (replacing a 📅 or [due:: ] date it had). */
export function withDueDate(line: string, date: string): string {
  if (/📅\s*\d{4}-\d{2}-\d{2}/u.test(line)) return line.replace(/📅\s*\d{4}-\d{2}-\d{2}/u, `📅 ${date}`);
  if (/\[due::\s*\d{4}-\d{2}-\d{2}\s*\]/.test(line)) return line.replace(/\[due::\s*\d{4}-\d{2}-\d{2}\s*\]/, `[due:: ${date}]`);
  const tag = line.match(/\s+#parked(?![\w/-])\s*$/i);
  return tag ? `${line.slice(0, tag.index)} 📅 ${date}${tag[0]}` : `${line.replace(/\s+$/, "")} 📅 ${date}`;
}

/** Set an open task's due date. Returns false if it is no longer open. */
export async function rescheduleTask(app: App, file: TFile, task: OpenTask, date: string): Promise<boolean> {
  let changed = false;
  await app.vault.process(file, (content) => {
    const lines = content.split("\n");
    const isTask = (i: number) => openTasks(lines[i] ?? "").some((t) => t.text === task.text);
    const index = isTask(task.line) ? task.line : lines.findIndex((_, i) => isTask(i));
    if (index === -1) return content;
    lines[index] = withDueDate(lines[index], date);
    changed = true;
    return lines.join("\n");
  });
  return changed;
}
