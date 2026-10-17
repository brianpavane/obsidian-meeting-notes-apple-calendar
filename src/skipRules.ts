/**
 * @file skipRules.ts
 * @description Meetings that shouldn't get a note automatically: titles the
 * user listed (focus time, lunch, holds) and events with nobody else invited.
 */

import type { CalendarEvent } from "./calendarApi";

export interface SkipRules {
  /** Case-insensitive title fragments, one per line. */
  titles: string;
  /** Skip events with no attendees other than you. */
  solo: boolean;
}

export function titlePatterns(titles: string): string[] {
  return titles.split("\n").map((t) => t.trim().toLowerCase()).filter(Boolean);
}

export function isSkipped(event: CalendarEvent, rules: SkipRules): boolean {
  const title = (event.summary ?? "").toLowerCase();
  if (titlePatterns(rules.titles).some((p) => title.includes(p))) return true;
  return rules.solo && !(event.attendees ?? []).some((a) => !a.self);
}
