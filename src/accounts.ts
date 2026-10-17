/**
 * @file accounts.ts
 * @description Account overview notes: one per account (the `account`
 * property of meeting notes), in the Meeting Hub's Accounts folder. The
 * user's own sections (Overview, Key contacts) are left alone; the plugin's
 * part — meetings, sentiment, open items, decisions, topics and people — is
 * rebuilt between two markers whenever insights or the overview are opened.
 */

import { groupBy, sentimentMark, sentimentTrend } from "./insights";
import { itemStatus, leftOff, link, list, byPriorityThenDue, type Item, type TrackerMeeting } from "./tracker";
import { replaceBetweenMarkers } from "./weeklyReview";

export const ACCOUNTS_FOLDER = "Accounts";
export const ACCOUNT_START =
  "<!-- meeting-account:start — the plugin rebuilds everything down to the end marker. Write above it. -->";
export const ACCOUNT_END = "<!-- meeting-account:end -->";

const RECENT_DECISIONS = 5;

const tally = (values: string[]) =>
  [...groupBy(values, (v) => v)].map(([k, v]): [string, number] => [k, v.length]).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));

/** The plugin's part of an account note, from the account's meeting notes. */
export function accountBody(meetings: TrackerMeeting[], today: string, updated: string): string {
  const newestFirst = [...meetings].sort((a, b) => b.date.localeCompare(a.date));
  const held = newestFirst.filter((m) => !m.skipped && m.date && m.date <= today);
  const next = newestFirst.filter((m) => !m.skipped && m.date > today).pop();
  const open: Item[] = newestFirst.flatMap((meeting) => meeting.openItems.map((meta) => ({ meta, meeting })));
  const overdue = open.filter((i) => i.meta.due && i.meta.due < today);
  const decided = held.filter((m) => m.decisions.length > 0).slice(0, RECENT_DECISIONS);
  const topics = tally(held.flatMap((m) => m.keyTopics ?? [])).slice(0, 12);
  const people = tally(held.flatMap((m) => [...new Set(m.people ?? [])])).slice(0, 15);
  const organizations = tally(held.flatMap((m) => m.organizations ?? []));

  const meetingLine = (m: TrackerMeeting) => {
    const details = [m.category, m.sentiment && `${sentimentMark(m.sentiment)} ${m.sentiment}`, m.outcome].filter(Boolean).join(" · ");
    return m.skipped
      ? `- ~~${m.date || "No date"} · ${link(m)}~~ · ${m.status ?? "didn't happen"}`
      : `- ${m.date || "No date"} · ${link(m)}${details ? ` · ${details}` : ""}`;
  };

  return [
    ACCOUNT_START,
    `*Updated ${updated}. Everything below comes from the account's meeting notes — change it there. Refreshes each time you open it, or click ↻ at the top right.*`,
    "",
    "| Meetings held | Last met | Next meeting | Open items | Overdue | Sentiment (oldest → newest) |",
    "| ---: | --- | --- | ---: | ---: | --- |",
    `| ${held.length} | ${held[0]?.date ?? "—"} | ${next ? `${next.date} ${link(next, true)}` : "—"} | ${open.length} | ${overdue.length} | ${sentimentTrend(held) || "—"} |`,
    "",
    "## Where we left off",
    "",
    ...leftOff(meetings, today),
    "",
    "## Meetings",
    "",
    ...(newestFirst.length > 0 ? newestFirst.map(meetingLine) : ["No meeting notes yet."]),
    "",
    "## Open items",
    "",
    ...list(open, byPriorityThenDue, false, itemStatus(today)),
    "",
    "## Recent decisions",
    "",
    ...(decided.length > 0
      ? decided.flatMap((m) => [`### ${link(m)} · ${m.date}`, "", ...m.decisions.map((d) => `- ${d}`), ""]).slice(0, -1)
      : ["Nothing here."]),
    "",
    "## Key topics",
    "",
    ...(topics.length > 0 ? topics.map(([t, n]) => `- ${t} (${n})`) : ["Nothing here."]),
    "",
    "## People",
    "",
    ...(people.length > 0 ? people.map(([p, n]) => `- ${p} (${n} meeting${n !== 1 ? "s" : ""})`) : ["Nothing here."]),
    ...(organizations.length > 0 ? ["", `**Organizations:** ${organizations.map(([o]) => o).join(", ")}`] : []),
    "",
    ACCOUNT_END,
  ].join("\n");
}

/** A new account note: properties, title, the user's sections, then the plugin's part. */
export function newAccountNote(account: string, body: string): string {
  const quoted = (value: string) => `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  return [
    "---",
    "type: meeting-account",
    `account: ${quoted(account)}`,
    "tags:",
    "  - meeting-account",
    "---",
    "",
    `# ${account}`,
    "",
    "## Overview",
    "",
    "- ",
    "",
    "## Key contacts",
    "",
    "- ",
    "",
    body,
    "",
  ].join("\n");
}

/** Replace the plugin's part of an existing account note, keeping everything else. */
export function refreshAccount(content: string, body: string): string {
  return replaceBetweenMarkers(content, body, ACCOUNT_START, ACCOUNT_END);
}
