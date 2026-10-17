/**
 * @file weeklyReview.ts
 * @description Weekly review notes: one per week (Monday–Sunday), with a part
 * the plugin fills in from the week's meeting notes and a part for the
 * user's own reflections. Reopening a review refreshes only the plugin's
 * part, between two markers; everything else in the note is left alone.
 */

import { addDays, byPriorityThenDue, itemStatus, link, list, type Item, type TrackerMeeting } from "./tracker";

export const REVIEW_FOLDER = "Weekly Reviews";
export const START_MARKER =
  "<!-- weekly-review:start — the plugin rebuilds everything down to the end marker each time you open this review. Write below it. -->";
export const END_MARKER = "<!-- weekly-review:end -->";

export interface Week {
  /** e.g. "2026-W41" */
  label: string;
  /** Monday, YYYY-MM-DD */
  start: string;
  /** Sunday, YYYY-MM-DD */
  end: string;
}

/** The ISO week (Monday–Sunday) containing `date` (YYYY-MM-DD). */
export function isoWeek(date: string): Week {
  const day = new Date(`${date}T12:00:00`).getDay();
  const start = addDays(date, -((day + 6) % 7));
  const thursday = new Date(`${addDays(start, 3)}T12:00:00`);
  const yearStart = new Date(thursday.getFullYear(), 0, 1, 12);
  // Round the day count: a daylight-saving change makes it an hour short or long.
  const days = Math.round((thursday.getTime() - yearStart.getTime()) / 86_400_000);
  const week = Math.floor(days / 7) + 1;
  return { label: `${thursday.getFullYear()}-W${String(week).padStart(2, "0")}`, start, end: addDays(start, 6) };
}

export const reviewFilename = (week: Week) => `${week.label} Weekly Review.md`;

const longDate = (date: string, withYear = false) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", ...(withYear ? { year: "numeric" } : {}),
  });

/**
 * The plugin's part of the review: from the start marker to the end marker.
 * `todos` (My To-Dos) count in Done this week and Overdue, not as meetings.
 */
export function reviewBody(meetings: TrackerMeeting[], week: Week, today: string, updated: string, todos: TrackerMeeting[] = []): string {
  const inWeek = (date: string | undefined) => !!date && date >= week.start && date <= week.end;
  const thisWeek = meetings.filter((m) => inWeek(m.date)).sort((a, b) => a.date.localeCompare(b.date));
  const held = thisWeek.filter((m) => !m.skipped);
  const decided = held.filter((m) => m.decisions.length > 0);
  const done: Item[] = [...todos, ...meetings].flatMap((meeting) =>
    meeting.doneItems.filter((meta) => inWeek(meta.doneOn)).map((meta) => ({ meta, meeting })));
  const open: Item[] = thisWeek.flatMap((meeting) => meeting.openItems.map((meta) => ({ meta, meeting })));
  const overdue: Item[] = [...todos, ...meetings].flatMap((meeting) =>
    meeting.openItems.filter((meta) => meta.due && meta.due < today).map((meta) => ({ meta, meeting })));

  const days = [...new Set(held.map((m) => m.date))];
  return [
    START_MARKER,
    "",
    `*Updated ${updated}. Refreshes each time you open it, or click ↻ at the top right.*`,
    "",
    "## At a glance",
    "",
    "| Meetings | Decisions | Done | Still open | Overdue |",
    "| ---: | ---: | ---: | ---: | ---: |",
    `| ${held.length} | ${decided.reduce((n, m) => n + m.decisions.length, 0)} | ${done.length} | ${open.length} | ${overdue.length} |`,
    "",
    "## Meetings",
    "",
    ...(days.length > 0
      ? days.flatMap((day) => [
        `### ${longDate(day)}`,
        "",
        ...held.filter((m) => m.date === day).map((m) =>
          `- ${link(m)}${[m.category, m.account].filter(Boolean).map((v) => ` · ${v}`).join("")}`),
        "",
      ]).slice(0, -1)
      : ["No meetings this week."]),
    "",
    "## Decisions",
    "",
    ...(decided.length > 0
      ? decided.flatMap((m) => [`### ${link(m)}`, "", ...m.decisions.map((d) => `- ${d}`), ""]).slice(0, -1)
      : ["Nothing here."]),
    "",
    "## Done this week",
    "",
    ...list(done, (a, b) => (a.meta.doneOn ?? "").localeCompare(b.meta.doneOn ?? ""), true),
    "",
    "## Still open from this week's meetings",
    "",
    ...list(open, byPriorityThenDue, false, itemStatus(today)),
    "",
    "## Overdue",
    "",
    ...list(overdue, (a, b) => (a.meta.due ?? "").localeCompare(b.meta.due ?? "")),
    "",
    END_MARKER,
  ].join("\n");
}

/** A new review note: properties, title, the plugin's part, and the user's sections. */
export function newReview(body: string, week: Week): string {
  return [
    "---",
    "type: weekly-review",
    `week: ${week.label}`,
    `week_start: ${week.start}`,
    `week_end: ${week.end}`,
    "tags:",
    "  - weekly-review",
    "---",
    "",
    `# Weekly review · ${week.label}`,
    "",
    `**${longDate(week.start)} – ${longDate(week.end, true)}**`,
    "",
    body,
    "",
    "## My review",
    "",
    "### Wins",
    "",
    "- ",
    "",
    "### Concerns",
    "",
    "- ",
    "",
    "### Next week's focus",
    "",
    "- ",
    "",
  ].join("\n");
}

/**
 * Replace the plugin's part of an existing review, keeping everything else.
 * Returns the content unchanged if the markers were removed.
 */
export function refreshReview(content: string, body: string): string {
  return replaceBetweenMarkers(content, body, START_MARKER, END_MARKER);
}

/** Replace the text from `startMarker` to `endMarker` (inclusive) with `body`; unchanged if either marker is missing. */
export function replaceBetweenMarkers(content: string, body: string, startMarker: string, endMarker: string): string {
  const start = content.indexOf(startMarker);
  const end = content.indexOf(endMarker);
  if (start === -1 || end === -1 || end < start) return content;
  return content.slice(0, start) + body + content.slice(end + endMarker.length);
}

