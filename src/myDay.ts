/**
 * @file myDay.ts
 * @description My Day: one note in the Meeting Hub for the day ahead
 * — its meetings, the user's Focus, what the people they meet owe them, what
 * others owe that's overdue, loose ends and what got done. Its headings stay
 * the same every day so an assistant (Gemini's daily briefing) can read it;
 * {@link briefingText} turns it into the plain Daily Briefing file.
 */

import { isMine } from "./actionItems";
import { meetingContext } from "./brief";
import { atRiskAccounts, focusItems, itemStatus, link, list, type Item, type TrackerMeeting } from "./tracker";

export const DAY_FILENAME = "My Day.md";
export const DAY_TYPE = "meeting-day";
export const BRIEFING_FILENAME = "Daily Briefing.md";
const FOCUS_SIZE = 5;
const PER_MEETING = 5;
const WAITING_SIZE = 8;

export interface DayMeeting {
  /** The calendar event id. */
  id: string;
  title: string;
  start: Date;
  end: Date;
  /** The meeting note's path without `.md`, if it has one. */
  path?: string;
  account?: string;
  attendees: string[];
  joinUrl?: string;
  /** The note has its Meeting Brief. */
  briefed: boolean;
  /** The AI reply has been added. */
  summarized: boolean;
}

export interface DayInput {
  /** The day planned, YYYY-MM-DD. */
  date: string;
  /** The day's meetings in order, or null if the calendar couldn't be read. */
  meetings: DayMeeting[] | null;
  /** Every meeting note. */
  notes: TrackerMeeting[];
  /** My To-Dos. */
  todos: TrackerMeeting[];
  myNames: string[];
  /** Meetings held recently that are still waiting for their AI reply. */
  unsummarized: TrackerMeeting[];
  /** Ended meetings with a Krisp recording not yet imported. */
  recordings: number;
  updated: string;
}

const clock = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
export const longDay = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });

/** My Day's content, properties included. */
export function dayNote(input: DayInput): string {
  const { date, notes, myNames } = input;
  const all: Item[] = [...input.todos, ...notes].flatMap((meeting) => meeting.openItems.map((meta) => ({ meta, meeting })));
  const active = all.filter((i) => !i.meta.parked);
  const mine = myNames.length > 0 ? active.filter((i) => isMine(i.meta, myNames)) : active;
  const others = myNames.length > 0 ? active.filter((i) => !isMine(i.meta, myNames)) : [];
  const focus = focusItems(mine, date, atRiskAccounts(notes, date), FOCUS_SIZE);
  const dueToday = mine.filter((i) => i.meta.due === date && !focus.some((f) => f.meta === i.meta));
  const focusLines = [...focus.map((i) => listLine(i, i.reason)), ...dueToday.map((i) => listLine(i, "due today"))];
  const overdueOthers = others.filter((i) => i.meta.due && i.meta.due < date).sort((a, b) => a.meta.due!.localeCompare(b.meta.due!));
  const done: Item[] = [...input.todos, ...notes].flatMap((meeting) =>
    meeting.doneItems.filter((meta) => meta.doneOn === date).map((meta) => ({ meta, meeting })));
  const meetings = input.meetings ?? [];

  const meetingLine = (m: DayMeeting) => {
    const title = m.path ? `[[${m.path}|${m.title.replace(/[[\]|#^]/g, " ").trim()}]]` : m.title;
    const status = m.summarized ? "AI reply added" : m.briefed ? "brief ready" : m.path ? "note ready" : "no note yet";
    return [
      `- ${clock(m.start)}–${clock(m.end)} · ${title}`,
      m.account,
      m.attendees.length > 0 && `with ${m.attendees.slice(0, 4).join(", ")}${m.attendees.length > 4 ? ` +${m.attendees.length - 4}` : ""}`,
      status,
      m.joinUrl && `[Join](${m.joinUrl})`,
    ].filter(Boolean).join(" · ");
  };

  const before = meetings.flatMap((m) => {
    const { theyOwe } = meetingContext({ meetings: notes, id: m.id, date, attendees: m.attendees, account: m.account, myNames });
    const open = theyOwe.filter((i) => !i.meta.parked).sort((a, b) => (a.meta.due ?? "9999").localeCompare(b.meta.due ?? "9999"));
    if (open.length === 0) return [];
    return [
      `### ${clock(m.start)} · ${m.title}`,
      "",
      ...list(open.slice(0, PER_MEETING), () => 0, false, itemStatus(date)),
      ...(open.length > PER_MEETING ? [`- …and ${open.length - PER_MEETING} more`] : []),
      "",
    ];
  });

  const loose = [
    ...input.unsummarized.map((m) => `- Add the AI reply: ${link(m)} · ${m.date}`),
    ...(input.recordings > 0
      ? [`- ${input.recordings} Krisp recording${input.recordings !== 1 ? "s" : ""} to import (Today's meetings panel, or **Import Krisp transcript** in the meeting's note)`]
      : []),
  ];

  return [
    "---",
    `type: ${DAY_TYPE}`,
    `date: ${date}`,
    "tags:",
    `  - ${DAY_TYPE}`,
    "---",
    "",
    `# ${longDay(date)}`,
    "",
    `*Updated ${input.updated}. Prepared each night at 12:30 AM, and refreshed when you open it or click ↻. Edits here are overwritten.*`,
    "",
    "[Wrap up my day](obsidian://meeting-notes?do=wrap-up) · [Add a to-do](obsidian://meeting-notes?do=add-todo) · [Tasks from a message](obsidian://meeting-notes?do=capture) · [Prepare tomorrow](obsidian://meeting-notes?do=prepare)",
    "",
    "## At a glance",
    "",
    `| Meetings | First meeting | Focus | Due today | Overdue (mine) | Others overdue | Loose ends |`,
    "| ---: | --- | ---: | ---: | ---: | ---: | ---: |",
    `| ${meetings.length} | ${meetings[0] ? clock(meetings[0].start) : "—"} | ${focusLines.length} | ${mine.filter((i) => i.meta.due === date).length} | ${mine.filter((i) => i.meta.due && i.meta.due < date).length} | ${overdueOthers.length} | ${loose.length} |`,
    "",
    "## Meetings",
    "",
    ...(input.meetings === null
      ? ["Couldn't read the calendar. Check the plugin's settings, then click ↻."]
      : meetings.length > 0 ? meetings.map(meetingLine) : ["No meetings."]),
    "",
    "## Focus",
    "",
    ...(focusLines.length > 0 ? focusLines : ["Nothing pressing."]),
    "",
    "## Before your meetings",
    "",
    "*What the people you're meeting owe you, so you can follow up in the meeting.*",
    "",
    ...(before.length > 0 ? before.slice(0, -1) : ["Nothing open from the people you're meeting."]),
    "",
    "## Waiting on others: overdue",
    "",
    ...(myNames.length === 0
      ? ["Set **Your name** in the plugin's settings to see what others owe you."]
      : overdueOthers.length > 0
        ? [...list(overdueOthers.slice(0, WAITING_SIZE), () => 0, false, itemStatus(date)), ...(overdueOthers.length > WAITING_SIZE ? [`- …and ${overdueOthers.length - WAITING_SIZE} more in the Meeting Tracker`] : [])]
        : ["Nothing overdue."]),
    "",
    "## Loose ends",
    "",
    ...(loose.length > 0 ? loose : ["Nothing to tidy up."]),
    "",
    "## Done today",
    "",
    ...(done.length > 0 ? list(done, () => 0, true) : ["Nothing checked off yet."]),
    "",
  ].join("\n");
}

const listLine = (item: Item, reason: string) => list([item], () => 0, false, () => reason)[0];

/**
 * The Daily Briefing: My Day as plain Markdown for an assistant —
 * no properties or Obsidian action links, links reduced to their names,
 * checkboxes to bullets.
 */
export function briefingText(dayContent: string): string {
  return dayContent
    .replace(/^---\n[\s\S]*?\n---\n+/, "")
    .replace(/^.*obsidian:\/\/.*\n\n?/gm, "")
    .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
    .replace(/\[\[([^\]]+)\]\]/g, (_, target: string) => target.split("/").pop() ?? target)
    .replace(/^(\s*)- \[[ xX-]\] /gm, "$1- ")
    .replace(/\*Updated ([^.]+)\.[^\n]*\*/, "*Prepared $1 by Obsidian (Meeting Notes for Apple Calendar).*");
}
