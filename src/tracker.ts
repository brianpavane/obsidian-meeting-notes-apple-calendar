/**
 * @file tracker.ts
 * @description The Meeting Tracker note: a snapshot of open action items,
 * recent decisions and this week's meetings across every meeting note,
 * rebuilt each time it's opened. The user's own items come first — a short
 * Focus list, then overdue, due soon and high priority — then what others
 * owe them, and items gone stale. Open items are checkboxes; ticking one
 * checks it off in its meeting note (in Gone stale?, marks it won't do).
 */

import { isMine, priorityRank, type TaskMeta } from "./actionItems";

export const TRACKER_FILENAME = "Meeting Tracker.md";
/** Ticking an item under this heading marks it won't do rather than done. */
export const STALE_HEADING = "## Gone stale?";
const FOCUS_SIZE = 7;
/** Items shown per account or person before "…and N more", so the tracker stays readable. */
const GROUP_SIZE = 10;
const STALE_SIZE = 25;
/** An undated item from a meeting this many days ago, or more, has gone stale. */
const STALE_DAYS = 30;

export interface TrackerMeeting {
  /** Vault path without `.md`, for links. */
  path: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  account?: string;
  category?: string;
  openItems: TaskMeta[];
  /** Ticked items (with their done date, if they have one). */
  doneItems: TaskMeta[];
  decisions: string[];
  /** The meeting was cancelled, removed from the calendar or declined. */
  skipped?: boolean;
  /** The note's `status` property (e.g. "cancelled"), if any. */
  status?: string;
  /** The meeting's calendar event id. */
  id?: string;
  /** Length in minutes, from the note's start and end. */
  minutes?: number;
  /** Properties from the AI reply's Meeting Metadata. */
  sentiment?: string;
  outcome?: string;
  keyTopics?: string[];
  organizations?: string[];
  /** Attendees and identified speakers, by name. */
  people?: string[];
  /** An AI reply has been filed into the note (`ai_summarized`). */
  summarized?: boolean;
  /** The note's "Core Elements for Next Meeting Continuity" bullets. */
  continuity?: string[];
}

/** "Where we left off": the continuity points of the latest meeting held that has some. */
export function leftOff(meetings: TrackerMeeting[], today: string): string[] {
  const latest = meetings
    .filter((m) => !m.skipped && m.date && m.date <= today && (m.continuity?.length ?? 0) > 0)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return latest ? [`From ${link(latest)} · ${latest.date}:`, "", ...latest.continuity!.map((c) => `- ${c}`)] : ["Nothing here."];
}

export interface Item {
  meta: TaskMeta;
  meeting: TrackerMeeting;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function link(meeting: TrackerMeeting, inTable = false): string {
  const alias = meeting.title.replace(/[[\]|#^]/g, " ").replace(/\s+/g, " ").trim() || meeting.path;
  return `[[${meeting.path}${inTable ? "\\|" : "|"}${alias}]]`;
}

const PRIORITY_MARK: Record<string, string> = { highest: "🔺", high: "⏫", medium: "🔼", low: "🔽", lowest: "⏬" };

/** An item's wording with its priority and due date, as listed in the Meeting Hub notes. */
export function itemText(meta: TaskMeta): string {
  const extras = [
    meta.priority ? PRIORITY_MARK[meta.priority] : "",
    meta.due ? `📅 ${meta.due}` : "",
  ].filter(Boolean).join(" ");
  return `${meta.text}${extras ? ` · ${extras}` : ""}`;
}

/**
 * An open item is a checkbox, so it can be ticked in a Meeting Hub note (the
 * plugin then checks it off in its meeting note); a done item is a plain bullet.
 */
function itemLine({ meta, meeting }: Item, done: boolean, reason?: string): string {
  return `- ${done ? "" : "[ ] "}${itemText(meta)} · ${link(meeting)}${reason ? ` · *${reason}*` : ""}`;
}

/**
 * A ticked (`[x]`) or cancelled (`[-]`) item line in a Meeting Hub note: its
 * wording (as {@link itemText}), its meeting's path and whether it was cancelled.
 */
export function tickedItem(line: string): { text: string; path: string; cancelled: boolean } | undefined {
  const m = line
    .replace(/\s*[✅❌]\s*\d{4}-\d{2}-\d{2}\s*$/u, "")
    .match(/^\s*[-*+] \[([xX-])\] (.+?) · \[\[([^\]|]+)(?:\|[^\]]*)?\]\](?: · \*[^*]*\*)?\s*$/);
  return m ? { text: m[2].trim(), path: m[3], cancelled: m[1] === "-" } : undefined;
}

export const byPriorityThenDue = (a: Item, b: Item) =>
  priorityRank(a.meta.priority) - priorityRank(b.meta.priority) ||
  (a.meta.due ?? "9999").localeCompare(b.meta.due ?? "9999");

export function list(items: Item[], sort: (a: Item, b: Item) => number = byPriorityThenDue, done = false, reason?: (item: Item) => string | undefined): string[] {
  return items.length > 0 ? [...items].sort(sort).map((item) => itemLine(item, done, reason?.(item))) : ["Nothing here."];
}

/** Why an item stands out: parked, overdue, or both. */
export const itemStatus = (today: string) => (i: Item): string | undefined =>
  [i.meta.parked && "parked", i.meta.due && i.meta.due < today && "overdue"].filter(Boolean).join(", ") || undefined;

/** The first `size` lines of a list, then a line saying how many more there are and where to see them. */
function capped(lines: string[], size: number, more: (hidden: number) => string): string[] {
  return lines.length > size ? [...lines.slice(0, size), more(lines.length - size)] : lines;
}

/**
 * Items grouped under `### heading (count)`, at most {@link GROUP_SIZE} per
 * group (most pressing first), then "…and N more" with `more(key)` saying where.
 */
function grouped(
  items: Item[],
  key: (item: Item) => string | undefined,
  none: string,
  reason?: (item: Item) => string | undefined,
  more: (key: string) => string = () => ""
): string[] {
  if (items.length === 0) return ["Nothing here."];
  const groups = new Map<string, Item[]>();
  for (const item of items) {
    const k = key(item)?.trim() || "";
    groups.set(k, [...(groups.get(k) ?? []), item]);
  }
  const keys = [...groups.keys()].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
  return keys.flatMap((k) => [
    `### ${k || none} (${groups.get(k)!.length})`,
    "",
    ...capped(list(groups.get(k)!, byPriorityThenDue, false, reason), GROUP_SIZE, (n) => `- …and ${n} more${more(k)}`),
    "",
  ]).slice(0, -1);
}

const isHigh = (i: Item) => i.meta.priority === "high" || i.meta.priority === "highest";
/** Someday (⏬): an item nobody committed to, which will probably never get done. */
const isSomeday = (i: Item) => i.meta.priority === "lowest";

/** Accounts whose latest meeting held went badly: sentiment Negative or outcome Blocked. */
export function atRiskAccounts(meetings: TrackerMeeting[], today: string): Set<string> {
  const latest = new Map<string, TrackerMeeting>();
  for (const m of meetings) {
    const key = m.account?.trim().toLowerCase();
    if (!key || m.skipped || !m.date || m.date > today) continue;
    if (!latest.has(key) || latest.get(key)!.date < m.date) latest.set(key, m);
  }
  return new Set([...latest].filter(([, m]) => /^negative$/i.test(m.sentiment ?? "") || /^blocked$/i.test(m.outcome ?? "")).map(([k]) => k));
}

/**
 * The few items to work on first, each with why: overdue (longest overdue
 * first), due in the next 7 days, high priority, for an at-risk account,
 * then from this week's meetings.
 */
export function focusItems(items: Item[], today: string, atRisk: Set<string>, size = FOCUS_SIZE): Array<Item & { reason: string }> {
  const weekAhead = addDays(today, 7);
  const weekAgo = addDays(today, -7);
  const tiers: Array<[string, (i: Item) => boolean, (a: Item, b: Item) => number]> = [
    ["overdue", (i) => !!i.meta.due && i.meta.due < today, (a, b) => a.meta.due!.localeCompare(b.meta.due!)],
    ["due soon", (i) => !!i.meta.due && i.meta.due <= weekAhead, (a, b) => a.meta.due!.localeCompare(b.meta.due!) || byPriorityThenDue(a, b)],
    ["high priority", isHigh, (a, b) => byPriorityThenDue(a, b) || b.meeting.date.localeCompare(a.meeting.date)],
    ["at-risk account", (i) => atRisk.has(i.meeting.account?.trim().toLowerCase() ?? ""), (a, b) => byPriorityThenDue(a, b) || b.meeting.date.localeCompare(a.meeting.date)],
    ["from this week", (i) => (i.meta.created ?? i.meeting.date) >= weekAgo, (a, b) => (b.meta.created ?? b.meeting.date).localeCompare(a.meta.created ?? a.meeting.date)],
  ];
  const picked: Array<Item & { reason: string }> = [];
  const left = new Set(items.filter((i) => !isSomeday(i)));
  for (const [reason, test, sort] of tiers) {
    for (const item of [...left].filter(test).sort(sort)) {
      if (picked.length >= size) return picked;
      picked.push({ ...item, reason });
      left.delete(item);
    }
  }
  return picked;
}

/** Someday items, and undated, not high-priority items from meetings at least {@link STALE_DAYS} days ago, oldest first. */
export function staleItems(items: Item[], today: string): Item[] {
  const cutoff = addDays(today, -STALE_DAYS);
  const old = (i: Item) => !i.meta.due && !isHigh(i) && !!(i.meta.created ?? i.meeting.date) && (i.meta.created ?? i.meeting.date) <= cutoff;
  return items
    .filter((i) => isSomeday(i) || old(i))
    .sort((a, b) => (a.meta.created ?? a.meeting.date).localeCompare(b.meta.created ?? b.meeting.date));
}

/**
 * The tracker note's content. `today` is YYYY-MM-DD; `updated` is shown as
 * the time it was built. `myNames` are the names the user is written as in
 * action items: items owned by someone else go under Waiting on others.
 * Without names, every item counts as the user's. Parked items are left
 * off the user's lists and only shown by account. `todos` (My To-Dos) add
 * their items to the lists but aren't counted as meetings. `accountLink`
 * links an account's name to its overview note, if it has one.
 */
export function buildTracker(
  meetings: TrackerMeeting[],
  today: string,
  updated: string,
  myNames: string[] = [],
  todos: TrackerMeeting[] = [],
  accountLink: (account: string) => string | undefined = () => undefined
): string {
  const items: Item[] = [...todos, ...meetings].flatMap((meeting) => meeting.openItems.map((meta) => ({ meta, meeting })));
  const active = items.filter((i) => !i.meta.parked);
  const parked = items.length - active.length;
  const mine = myNames.length > 0 ? active.filter((i) => isMine(i.meta, myNames)) : active;
  const others = myNames.length > 0 ? active.filter((i) => !isMine(i.meta, myNames)) : [];
  const weekAhead = addDays(today, 7);
  const overdue = mine.filter((i) => i.meta.due && i.meta.due < today);
  const dueSoon = mine.filter((i) => i.meta.due && i.meta.due >= today && i.meta.due <= weekAhead);
  const high = mine.filter(isHigh);
  const focus = focusItems(mine, today, atRiskAccounts(meetings, today));
  const stale = staleItems(active, today);
  const late = (i: Item) => (i.meta.due && i.meta.due < today ? "overdue" : undefined);
  const inOverview = (account: string) => {
    const overview = account && accountLink(account);
    return overview ? ` in ${overview}` : "";
  };

  const day = new Date(`${today}T12:00:00`).getDay();
  const monday = addDays(today, -((day + 6) % 7));
  const sunday = addDays(monday, 6);
  const thisWeek = meetings
    .filter((m) => !m.skipped && m.date >= monday && m.date <= sunday)
    .sort((a, b) => a.date.localeCompare(b.date));
  const categories = new Map<string, TrackerMeeting[]>();
  for (const m of thisWeek) {
    const k = m.category?.trim() || "Uncategorized";
    categories.set(k, [...(categories.get(k) ?? []), m]);
  }

  const monthAgo = addDays(today, -30);
  const decided = meetings
    .filter((m) => m.decisions.length > 0 && m.date >= monthAgo && m.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date));

  return [
    "# Meeting Tracker",
    "",
    `*Updated ${updated}. Refreshes each time you open it, or click ↻ at the top right. Edits here are overwritten.*`,
    "",
    "## At a glance",
    "",
    "| My open items | Overdue | Due in 7 days | High priority | Waiting on others | Gone stale | Parked | Meetings this week |",
    "| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
    `| ${mine.length} | ${overdue.length} | ${dueSoon.length} | ${high.length} | ${others.length} | ${stale.length} | ${parked} | ${thisWeek.length} |`,
    "",
    "## Focus",
    "",
    ...(focus.length > 0
      ? [`*Your ${focus.length === 1 ? "most pressing item" : `${focus.length} most pressing items`}: overdue, then due soon, high priority, at-risk accounts and this week's meetings.*`, "", ...focus.map((i) => itemLine(i, false, i.reason))]
      : ["Nothing pressing."]),
    "",
    "## Overdue",
    "",
    ...list(overdue, (a, b) => (a.meta.due ?? "").localeCompare(b.meta.due ?? "")),
    "",
    "## Due in the next 7 days",
    "",
    ...list(dueSoon, (a, b) => (a.meta.due ?? "").localeCompare(b.meta.due ?? "") || byPriorityThenDue(a, b)),
    "",
    "## High priority",
    "",
    ...list(high),
    "",
    "## Waiting on others",
    "",
    ...(myNames.length > 0
      ? grouped(others, (i) => i.meta.owner, "Unassigned", late, () => " in the action items panel (Waiting on others, By person)")
      : ["Set **Your name** in the plugin's settings to list here what others owe you."]),
    "",
    STALE_HEADING,
    "",
    ...(stale.length > 0
      ? [`*Marked Someday (⏬), or with no due date and from a meeting over ${STALE_DAYS} days ago. Tick one here to drop it (marked won't do); tick it anywhere else to mark it done.*`, "", ...capped(list(stale, () => 0), STALE_SIZE, (n) => `- …and ${n} more; they'll show here as you clear these`)]
      : ["Nothing here."]),
    "",
    "## Open items by account",
    "",
    ...grouped(items, (i) => i.meeting.account, "No account", itemStatus(today), inOverview),
    "",
    "## Decisions in the last 30 days",
    "",
    ...(decided.length > 0
      ? decided.flatMap((m) => [`### ${link(m)} · ${m.date}`, "", ...m.decisions.map((d) => `- ${d}`), ""]).slice(0, -1)
      : ["Nothing here."]),
    "",
    `## Meetings this week (${monday} to ${sunday})`,
    "",
    ...(thisWeek.length > 0
      ? [
        "| Category | Meetings |",
        "| --- | --- |",
        ...[...categories.keys()].sort().map((k) => `| ${k} (${categories.get(k)!.length}) | ${categories.get(k)!.map((m) => link(m, true)).join(", ")} |`),
      ]
      : ["Nothing here."]),
    "",
  ].join("\n");
}
