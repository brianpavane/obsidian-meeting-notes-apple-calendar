/**
 * @file meetingStatus.ts
 * @description Picks the meeting that is in progress or coming up next, and
 * describes it for the status bar.
 */

import type { CalendarEvent } from "./calendarApi";

export interface MeetingTiming {
  event: CalendarEvent;
  start: Date;
  end: Date;
  inProgress: boolean;
}

/** Start and end of a timed event, or undefined for all-day or unparseable events. */
function timing(event: CalendarEvent): { start: Date; end: Date } | undefined {
  if (!event.start.dateTime) return undefined;
  const start = new Date(event.start.dateTime);
  const end = new Date(event.end.dateTime ?? event.start.dateTime);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return undefined;
  return { start, end };
}

/**
 * The meeting in progress (the one that started most recently, if several
 * overlap), otherwise the next one to start. Cancelled meetings are skipped.
 */
export function currentOrNextMeeting(events: CalendarEvent[], now: Date): MeetingTiming | undefined {
  let current: MeetingTiming | undefined;
  let next: MeetingTiming | undefined;
  for (const event of events) {
    if (event.cancelled) continue;
    const t = timing(event);
    if (!t) continue;
    if (t.start <= now && now < t.end) {
      if (!current || t.start > current.start) current = { event, ...t, inProgress: true };
    } else if (t.start > now) {
      if (!next || t.start < next.start) next = { event, ...t, inProgress: false };
    }
  }
  return current ?? next;
}

function minutesLabel(ms: number): string {
  const minutes = Math.max(1, Math.round(ms / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

function clockLabel(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

/** Status bar text, e.g. "Now: Standup · ends in 10 min" or "Next: Review in 25 min". */
export function statusText(meeting: MeetingTiming, now: Date): string {
  const title = meeting.event.summary?.trim() || "Untitled Event";
  if (meeting.inProgress) {
    return `Now: ${title} · ends in ${minutesLabel(meeting.end.getTime() - now.getTime())}`;
  }
  const until = meeting.start.getTime() - now.getTime();
  if (until <= 60 * 60_000) return `Next: ${title} in ${minutesLabel(until)}`;

  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  if (dayKey(meeting.start) === dayKey(now)) return `Next: ${title} at ${clockLabel(meeting.start)}`;
  if (dayKey(meeting.start) === dayKey(tomorrow)) return `Next: ${title} tomorrow at ${clockLabel(meeting.start)}`;
  const weekday = meeting.start.toLocaleDateString("en-US", { weekday: "long" });
  return `Next: ${title} ${weekday} at ${clockLabel(meeting.start)}`;
}

/** The meeting the "Join meeting" command acts on: in progress, or starting within `withinMs`. */
export function meetingToJoin(events: CalendarEvent[], now: Date, withinMs: number): MeetingTiming | undefined {
  const meeting = currentOrNextMeeting(events, now);
  if (!meeting) return undefined;
  if (meeting.inProgress || meeting.start.getTime() - now.getTime() <= withinMs) return meeting;
  return undefined;
}
