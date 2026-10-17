/**
 * @file brief.ts
 * @description The Meeting Brief: a short section at the top of an upcoming
 * meeting's note — where things were left, what the attendees owe you and
 * what you owe (from this series or account, if it has one), and how the
 * account stands. The
 * plugin rebuilds it between two markers until the AI reply is added, then
 * removes it. Items are plain bullets linking to their meetings, so they are
 * never counted as this meeting's own tasks.
 */

import { isMine, priorityRank } from "./actionItems";
import { sentimentMark } from "./insights";
import { seriesId } from "./noteCreator";
import { atRiskAccounts, itemStatus, leftOff, link, list, type Item, type TrackerMeeting } from "./tracker";

export const BRIEF_START = "<!-- meeting-brief:start — the plugin rebuilds this brief until the AI reply is added. -->";
export const BRIEF_END = "<!-- meeting-brief:end -->";
const MAX_ITEMS = 8;

export interface BriefInput {
  /** Every other meeting note. */
  meetings: TrackerMeeting[];
  /** The meeting's calendar event id. */
  id: string;
  /** YYYY-MM-DD */
  date: string;
  /** Attendee names. */
  attendees: string[];
  /** The note's account; if empty, the series' latest one is used. */
  account?: string;
  myNames: string[];
  today: string;
  updated: string;
  /** Leave out Where we left off, because the note's Agenda already has it. */
  skipLeftOff?: boolean;
}

/** Soonest due first (so overdue ones lead), undated last; then by priority. */
const urgentFirst = (a: Item, b: Item) =>
  (a.meta.due ?? "9999").localeCompare(b.meta.due ?? "9999") || priorityRank(a.meta.priority) - priorityRank(b.meta.priority);

export type MeetingContext = Pick<BriefInput, "meetings" | "id" | "date" | "attendees" | "account" | "myNames">;

/**
 * A meeting's context: its account (or its series' latest one), the earlier
 * meetings of its series or account, what the attendees owe the user and
 * what the user owes there. What attendees owe is scoped to the series or
 * account, so another customer's items never show up in this meeting; a
 * meeting with neither (an ad-hoc 1:1, say) gets all the attendees owe.
 */
export function meetingContext(input: MeetingContext): { account?: string; related: TrackerMeeting[]; theyOwe: Item[]; youOwe: Item[] } {
  const { meetings, date, myNames } = input;
  const series = seriesId(input.id);
  const inSeries = (m: TrackerMeeting) => !!series && !!m.id && seriesId(m.id) === series;
  const before = meetings.filter((m) => !m.date || m.date <= date);
  const account = input.account?.trim()
    || before.filter(inSeries).filter((m) => m.account?.trim()).sort((a, b) => b.date.localeCompare(a.date))[0]?.account?.trim();
  const sameAccount = (m: TrackerMeeting) => !!account && m.account?.trim().toLowerCase() === account.toLowerCase();
  const related = before.filter((m) => inSeries(m) || sameAccount(m));
  const me = new Set(myNames.map((n) => n.toLowerCase()));
  const attendees = new Set(input.attendees.map((a) => a.trim().toLowerCase()).filter((a) => a && !me.has(a)));
  const items = (ms: TrackerMeeting[]): Item[] => ms.flatMap((meeting) => meeting.openItems.map((meta) => ({ meta, meeting })));
  return {
    account,
    related,
    theyOwe: items(series || account ? related : meetings).filter((i) => i.meta.owners.some((o) => attendees.has(o.toLowerCase()))),
    youOwe: items(related).filter((i) => isMine(i.meta, myNames)),
  };
}

/** The brief, markers included, ready to go into the note. */
export function briefBlock(input: BriefInput): string {
  const { meetings, today } = input;
  const { account, related, theyOwe, youOwe } = meetingContext(input);
  const series = seriesId(input.id);
  const sameAccount = (m: TrackerMeeting) => !!account && m.account?.trim().toLowerCase() === account.toLowerCase();
  const shortList = (all: Item[]) => {
    const sorted = [...all].sort(urgentFirst);
    const shown = list(sorted.slice(0, MAX_ITEMS), () => 0, true, itemStatus(today));
    return sorted.length > MAX_ITEMS ? [...shown, `- …and ${sorted.length - MAX_ITEMS} more in the Meeting Tracker`] : shown;
  };

  const lastHeld = related
    .filter((m) => sameAccount(m) && !m.skipped && m.date && m.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const atRisk = !!account && atRiskAccounts(meetings, today).has(account.toLowerCase());
  const status = account
    ? [
      `**${account}**`,
      lastHeld ? `last met ${lastHeld.date} (${link(lastHeld)})` : "no meetings yet",
      lastHeld?.sentiment && `${sentimentMark(lastHeld.sentiment)} ${lastHeld.sentiment}`,
      lastHeld?.outcome,
      atRisk && "⚠ at risk",
    ].filter(Boolean).join(" · ")
    : undefined;

  return [
    BRIEF_START,
    "## Meeting Brief",
    "",
    `*Updated ${input.updated}. Refreshes when you open this note in the hour before the meeting, or click the brief icon at the top right; removed once you add the AI reply.*`,
    "",
    ...(status ? ["**Account:** " + status, ""] : []),
    ...(input.skipLeftOff ? [] : ["### Where we left off", "", ...leftOff(related, today), ""]),
    "### They owe you",
    "",
    ...(theyOwe.length > 0 ? shortList(theyOwe) : [`Nothing open from this meeting's attendees${series || account ? " in this series or account" : ""}.`]),
    "",
    "### You owe",
    "",
    ...(youOwe.length > 0 ? shortList(youOwe) : ["Nothing open from this series or account."]),
    "",
    BRIEF_END,
  ].join("\n");
}

/** Where the note's brief is: its start marker and the end marker after it, or undefined. */
function briefSpan(content: string): [number, number] | undefined {
  const end = content.indexOf(BRIEF_END);
  const start = end === -1 ? -1 : content.lastIndexOf(BRIEF_START, end);
  return start === -1 ? undefined : [start, end + BRIEF_END.length];
}

/**
 * The note with its brief replaced, or added above the Agenda (or the first
 * section). A lone marker left by an edit is dropped, so it can't later pair
 * up with the new brief's and take the writing between them.
 */
export function upsertBrief(content: string, block: string): string {
  const span = briefSpan(content);
  if (span) return content.slice(0, span[0]) + block + content.slice(span[1]);
  content = content.split("\n").filter((l) => l !== BRIEF_START && l !== BRIEF_END).join("\n");
  const lines = content.split("\n");
  const body = lines[0] === "---" ? lines.indexOf("---", 1) + 1 : 0;
  const agenda = lines.findIndex((l, i) => i >= body && /^## Agenda\s*$/.test(l));
  const firstSection = lines.findIndex((l, i) => i >= body && /^## /.test(l));
  const at = agenda !== -1 ? agenda : firstSection;
  if (at === -1) return `${content.replace(/\s*$/, "")}\n\n${block}\n`;
  const gap = at > 0 && lines[at - 1].trim() ? [""] : [];
  return [...lines.slice(0, at), ...gap, block, "", ...lines.slice(at)].join("\n");
}

/** The note without its brief. */
export function removeBrief(content: string): string {
  const span = briefSpan(content);
  if (!span) return content;
  return content.slice(0, span[0]) + content.slice(span[1]).replace(/^\n+/, "");
}

export const hasBrief = (content: string) => content.includes(BRIEF_START);
