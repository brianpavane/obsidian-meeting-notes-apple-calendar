/**
 * @file series.ts
 * @description Series notes: one per recurring meeting, in the Meeting Hub's
 * Series folder. The user's own sections (Purpose, Standing agenda) are left
 * alone; the plugin's part — every occurrence, open items across the series
 * and recent decisions — is rebuilt between two markers each time it opens.
 * A 1:1's note also lists what the other person owes you from any meeting,
 * and what you owe them from any meeting with them.
 */

import { isMine } from "./actionItems";
import { byPriorityThenDue, itemStatus, leftOff, link, list, type Item, type TrackerMeeting } from "./tracker";
import { replaceBetweenMarkers } from "./weeklyReview";

export const SERIES_FOLDER = "Series";
export const SERIES_START =
  "<!-- meeting-series:start — the plugin rebuilds everything down to the end marker each time you open this note. Write above it. -->";
export const SERIES_END = "<!-- meeting-series:end -->";

const RECENT_DECISIONS = 5;

/**
 * The other person of a 1:1: the one person besides the user in every
 * meeting held in the series (the user is already left out of `people`).
 */
export function oneOnOnePerson(occurrences: TrackerMeeting[]): string | undefined {
  const held = occurrences.filter((m) => !m.skipped);
  const names = held.map((m) => [...new Set((m.people ?? []).map((p) => p.trim().toLowerCase()))]);
  if (held.length === 0 || names.some((n) => n.length !== 1 || n[0] !== names[0][0])) return undefined;
  return held.map((m) => m.people![0].trim()).find((p) => p.toLowerCase() === names[0][0]);
}

export interface OneOnOne {
  person: string;
  /** Every meeting note. */
  meetings: TrackerMeeting[];
  myNames: string[];
}

/** The plugin's part of a series note, from the occurrences' notes (and, for a 1:1, every meeting note). */
export function seriesBody(occurrences: TrackerMeeting[], updated: string, today: string, oneOnOne?: OneOnOne): string {
  const newestFirst = [...occurrences].sort((a, b) => b.date.localeCompare(a.date));
  const held = newestFirst.filter((m) => !m.skipped);
  const open: Item[] = newestFirst.flatMap((meeting) => meeting.openItems.map((meta) => ({ meta, meeting })));
  const decided = held.filter((m) => m.decisions.length > 0).slice(0, RECENT_DECISIONS);

  const occurrence = (m: TrackerMeeting) => {
    const openCount = m.openItems.length > 0 ? ` · ${m.openItems.length} open` : "";
    return m.skipped
      ? `- ~~${m.date || "No date"} · ${link(m)}~~ · ${m.status ?? "didn't happen"}`
      : `- ${m.date || "No date"} · ${link(m)}${openCount}`;
  };

  return [
    SERIES_START,
    `*Updated ${updated}. Items and decisions come from each meeting's own note — change them there. Refreshes each time you open it, or click ↻ at the top right.*`,
    "",
    "| Meetings held | Open items | Decisions |",
    "| --- | --- | --- |",
    `| ${held.length} | ${open.length} | ${held.reduce((n, m) => n + m.decisions.length, 0)} |`,
    "",
    "## Where we left off",
    "",
    ...leftOff(occurrences, today),
    "",
    "## Meetings",
    "",
    ...(newestFirst.length > 0 ? newestFirst.map(occurrence) : ["No meeting notes yet."]),
    "",
    "## Open items",
    "",
    ...list(open, byPriorityThenDue, false, itemStatus(today)),
    "",
    ...(oneOnOne ? oneOnOneSections(oneOnOne, today) : []),
    "## Recent decisions",
    "",
    ...(decided.length > 0
      ? decided.flatMap((m) => [`### ${link(m)} · ${m.date}`, "", ...m.decisions.map((d) => `- ${d}`), ""]).slice(0, -1)
      : ["Nothing here."]),
    "",
    SERIES_END,
  ].join("\n");
}

/** A new series note: properties, title, the user's sections, then the plugin's part. */
export function newSeriesNote(title: string, seriesId: string, body: string): string {
  const quoted = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  return [
    "---",
    "type: meeting-series",
    `title: ${quoted(title)}`,
    `series_id: ${quoted(seriesId)}`,
    "tags:",
    "  - meeting-series",
    "---",
    "",
    `# ${title}`,
    "",
    "## Purpose",
    "",
    "- ",
    "",
    "## Standing agenda",
    "",
    "- ",
    "",
    body,
    "",
  ].join("\n");
}

/** Replace the plugin's part of an existing series note, keeping everything else. */
export function refreshSeries(content: string, body: string): string {
  return replaceBetweenMarkers(content, body, SERIES_START, SERIES_END);
}

/** What the other person of a 1:1 owes you from any meeting, and what you owe them from any meeting with them. */
function oneOnOneSections({ person, meetings, myNames }: OneOnOne, today: string): string[] {
  const same = (a: string) => a.trim().toLowerCase() === person.toLowerCase();
  const items = (ms: TrackerMeeting[]): Item[] => ms.flatMap((meeting) => meeting.openItems.map((meta) => ({ meta, meeting })));
  const theyOwe = items(meetings).filter((i) => i.meta.owners.some(same));
  const youOwe = items(meetings.filter((m) => (m.people ?? []).some(same)))
    .filter((i) => isMine(i.meta, myNames) && !i.meta.owners.some(same));
  return [
    `## ${person} owes you`,
    "",
    "*From any meeting, not only this 1:1.*",
    "",
    ...list(theyOwe, byPriorityThenDue, false, itemStatus(today)),
    "",
    `## You owe ${person}`,
    "",
    "*Your items from any meeting with them.*",
    "",
    ...list(youOwe, byPriorityThenDue, false, itemStatus(today)),
    "",
  ];
}
