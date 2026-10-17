/**
 * @file appleCalendarApi.ts
 * @description Read events from Apple Calendar on macOS through EventKit.
 *
 * Each fetch is one osascript (JXA) call that uses EKEventStore through the
 * ObjC bridge. EventKit reads the same local store Calendar.app syncs to, so
 * it covers every account in Calendar.app (iCloud, Google, Exchange, local)
 * without any network request, and returns in well under a second.
 *
 * Security notes:
 *   - Scripts only interpolate validated integers and JSON-serialised
 *     calendar names, never raw user strings.
 *   - Output is capped at MAX_OUTPUT_BYTES before JSON.parse to prevent OOM.
 *   - Every field read from the JXA response is type-checked and length-capped.
 *   - Date strings are validated through Date.parse before use.
 *   - execFile (not exec) is used so no shell expansion takes place.
 */

import { execFile } from "child_process";
import type { CalendarEvent, ResponseStatus } from "./icalParser";

const MAX_OUTPUT_BYTES = 5 * 1024 * 1024; // 5 MB
const TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Conference URL patterns (mirrors icalParser.ts)
// ---------------------------------------------------------------------------

const CONFERENCE_PATTERNS: Array<{ regex: RegExp; name: string }> = [
  { regex: /https:\/\/meet\.google\.com\/[a-z0-9-]+/i, name: "Google Meet" },
  { regex: /https:\/\/(?:[\w-]+\.)*zoom\.us\/[^\s<>"]{5,100}/i, name: "Zoom" },
  { regex: /https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s<>"]{5,200}/i, name: "Microsoft Teams" },
  { regex: /https:\/\/teams\.microsoft\.com\/meet\/[^\s<>"]{5,200}/i, name: "Microsoft Teams" },
  { regex: /https:\/\/teams\.live\.com\/meet\/[^\s<>"]{5,100}/i, name: "Microsoft Teams" },
  { regex: /https:\/\/(?:[\w-]+\.)*webex\.com\/[^\s<>"]{5,200}/i, name: "Webex" },
];

function extractConferenceFromText(text: string): CalendarEvent["conferenceData"] | undefined {
  for (const { regex, name } of CONFERENCE_PATTERNS) {
    const match = text.match(regex);
    if (match) {
      return {
        entryPoints: [{ entryPointType: "video", uri: match[0] }],
        conferenceSolution: { name },
      };
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// JXA scripts
// ---------------------------------------------------------------------------

/**
 * Checks EventKit access and asks for it when macOS has not decided yet.
 * Leaves `store` set to an authorised EKEventStore, or returns early with
 * `{ error: "access", status }`. EKAuthorizationStatus: 0 not determined,
 * 1 restricted, 2 denied, 3 full access, 4 write-only ("Add Only").
 */
const JXA_EVENTKIT_ACCESS = `
  var store = $.EKEventStore.alloc.init;
  var status = Number($.EKEventStore.authorizationStatusForEntityType(0));
  if (status === 0) {
    var answered = false;
    var onAnswer = function (granted, err) { answered = true; };
    if (store.respondsToSelector("requestFullAccessToEventsWithCompletion:")) {
      store.requestFullAccessToEventsWithCompletion(onAnswer);
    } else {
      store.requestAccessToEntityTypeCompletion(0, onAnswer);
    }
    var giveUp = Date.now() + 25000;
    while (!answered && Date.now() < giveUp) {
      $.NSRunLoop.currentRunLoop.runUntilDate($.NSDate.dateWithTimeIntervalSinceNow(0.2));
    }
    status = Number($.EKEventStore.authorizationStatusForEntityType(0));
    store = $.EKEventStore.alloc.init;
  }
  if (status !== 3) {
    return JSON.stringify({ error: "access", status: status });
  }`;

// Serialises one EKEvent (variable `ev`) into `item` (pre-initialised with
// calendarName / calendarId). All variable names are prefixed with `ek` to
// avoid collisions when embedded in a loop body alongside other JXA code.
//
// EKParticipantStatus integers: 0=unknown 1=pending 2=accepted 3=declined
//                               4=tentative 5=delegated 6=completed 7=inProcess
// EKParticipant.URL is a mailto: URI — scheme stripped to get the email address.
// Number() coercion is required because participantStatus is an ObjC NSInteger
// that does not satisfy strict === against a JS number literal in JXA.
const JXA_SERIALIZE_EK_EVENT = `
      try { item.uid     = ev.eventIdentifier ? ev.eventIdentifier.js : ""; } catch (e) {}
      try { item.summary = ev.title            ? ev.title.js            : ""; } catch (e) {}
      try {
        if (ev.startDate) {
          var ekSs = parseFloat(String(ev.startDate.timeIntervalSince1970));
          item.startDate = new Date(ekSs * 1000).toISOString();
        }
      } catch (e) {}
      try {
        if (ev.endDate) {
          var ekEs = parseFloat(String(ev.endDate.timeIntervalSince1970));
          item.endDate = new Date(ekEs * 1000).toISOString();
        }
      } catch (e) {}
      try { item.allDayEvent = ev.isAllDay ? true : false; } catch (e) {}
      try { item.description = ev.notes    ? ev.notes.js    : ""; } catch (e) {}
      try { item.location    = ev.location ? ev.location.js : ""; } catch (e) {}
      try {
        var ekUrl = ev.URL;
        if (ekUrl && ekUrl.absoluteString) item.url = ekUrl.absoluteString.js;
      } catch (e) {}
      try { item.status    = Number(ev.status); } catch (e) {}
      try { item.recurring = (ev.hasRecurrenceRules ? true : false) || (ev.isDetached ? true : false); } catch (e) {}
      try {
        if (ev.occurrenceDate) {
          var ekOs = parseFloat(String(ev.occurrenceDate.timeIntervalSince1970));
          item.occurrenceDate = new Date(ekOs * 1000).toISOString();
        }
      } catch (e) {}
      try {
        var ekAtts = ev.attendees;
        if (ekAtts && ekAtts.count > 0) {
          var ekAttList = [];
          var ekMaxA    = Math.min(ekAtts.count, 20);
          for (var ekAi = 0; ekAi < ekMaxA; ekAi++) {
            try {
              var ekAtt   = ekAtts.objectAtIndex(ekAi);
              var ekAName = "";
              var ekAAddr = "";
              var ekAStat = "unknown";
              try { ekAName = ekAtt.name ? ekAtt.name.js : ""; } catch (e) {}
              try {
                if (ekAtt.URL) {
                  ekAAddr = ekAtt.URL.absoluteString.js.replace(/^mailto:/i, "");
                }
              } catch (e) {}
              try {
                var ekPs = Number(ekAtt.participantStatus);
                if      (ekPs === 2) ekAStat = "accepted";
                else if (ekPs === 3) ekAStat = "declined";
                else if (ekPs === 4) ekAStat = "tentative";
                else if (ekPs === 1) ekAStat = "needsAction";
                else                 ekAStat = "unknown";
              } catch (e) {}
              var ekASelf = false;
              try { ekASelf = ekAtt.isCurrentUser === true || Number(ekAtt.isCurrentUser) === 1; } catch (e) {}
              if (ekAAddr || ekAName) {
                ekAttList.push({ displayName: ekAName, address: ekAAddr, status: ekAStat, self: ekASelf });
              }
            } catch (e) {}
          }
          item.attendees = ekAttList;
        }
      } catch (e) {}`.trimStart();

/** 2001-01-01T00:00:00Z, the reference date of Apple timestamps, in Unix seconds. */
const APPLE_EPOCH_SECONDS = 978_307_200;

/**
 * An event id in its occurrence form. Calendar.app appends "/RID=<original
 * start>" (seconds since 2001) to the identifier of a moved occurrence of a
 * Google recurring event. When the id already ends in "::<occurrence>", the
 * suffix is dropped; otherwise it becomes "::<original start>", since it is
 * the only thing telling that occurrence apart from the series' others.
 * Either way the occurrence keeps the id (and note) it had before it moved.
 */
export function canonicalEventId(id: string): string {
  const m = id.match(/^(.*)\/RID=(\d+)(::.*)?$/);
  if (!m) return id;
  return m[3] ? `${m[1]}${m[3]}` : `${m[1]}::${new Date((Number(m[2]) + APPLE_EPOCH_SECONDS) * 1000).toISOString()}`;
}


/**
 * Reads events from the local EventKit store in one call.
 *
 * If calendarFilter is non-empty only those calendars are queried; otherwise
 * all event calendars are. Returns JSON:
 *   { calendars: string[], events: object[] }   on success
 *   { error: "access", status: number }          when access is missing
 * `calendars` lists the calendars that were actually queried.
 */
function buildEventKitScript(calendarFilter: string[], daysBack: number, daysAhead: number): string {
  const safeDaysBack  = Math.max(0, Math.min(30,  Math.floor(daysBack)));
  const safeDaysAhead = Math.max(1, Math.min(365, Math.floor(daysAhead)));
  const filterJson    = JSON.stringify(calendarFilter);
  return `
ObjC.import('Foundation');
ObjC.import('EventKit');
(function () {
${JXA_EVENTKIT_ACCESS}
  var now = new Date();
  var windowStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ${safeDaysBack});
  var windowEnd   = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ${safeDaysAhead});
  var startNS = $.NSDate.dateWithTimeIntervalSince1970(windowStart.getTime() / 1000);
  var endNS   = $.NSDate.dateWithTimeIntervalSince1970(windowEnd.getTime()   / 1000);

  var filterNames = ${filterJson};
  var allCals = store.calendarsForEntityType(0);
  var targetCals = $.NSMutableArray.alloc.init;
  var queried = [];
  for (var c = 0; c < allCals.count; c++) {
    try {
      var cal = allCals.objectAtIndex(c);
      var title = cal.title ? cal.title.js : "";
      if (filterNames.length === 0 || filterNames.indexOf(title) !== -1) {
        targetCals.addObject(cal);
        queried.push(title);
      }
    } catch (e) {}
  }
  if (targetCals.count === 0) {
    return JSON.stringify({ calendars: [], events: [] });
  }

  var pred   = store.predicateForEventsWithStartDateEndDateCalendars(startNS, endNS, targetCals);
  var ekEvts = store.eventsMatchingPredicate(pred);

  var results = [];
  for (var ek = 0; ek < ekEvts.count; ek++) {
    try {
      var ev = ekEvts.objectAtIndex(ek);
      var ekCalName = "";
      try { if (ev.calendar && ev.calendar.title) ekCalName = ev.calendar.title.js; } catch (e) {}
      var item = {
        uid: "", summary: "",
        startDate: windowStart.toISOString(), endDate: windowStart.toISOString(),
        allDayEvent: false, description: "", location: "",
        calendarName: ekCalName, attendees: []
      };
      ${JXA_SERIALIZE_EK_EVENT}
      results.push(item);
    } catch (e) {}
  }

  return JSON.stringify({ calendars: queried, events: results });
})();
`.trim();
}

/** Lists every event calendar as JSON `{ calendars: [{ name, id, account }] }`. */
const JXA_LIST_CALENDARS = `
ObjC.import('Foundation');
ObjC.import('EventKit');
(function () {
${JXA_EVENTKIT_ACCESS}
  var cals = store.calendarsForEntityType(0);
  var out = [];
  for (var i = 0; i < cals.count; i++) {
    try {
      var cal = cals.objectAtIndex(i);
      var account = "";
      try { if (cal.source && cal.source.title) account = cal.source.title.js; } catch (e) {}
      out.push({
        name: cal.title ? cal.title.js : "",
        id: cal.calendarIdentifier ? cal.calendarIdentifier.js : "",
        account: account
      });
    } catch (e) {}
  }
  return JSON.stringify({ calendars: out });
})();
`.trim();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function runOsascript(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      "osascript",
      ["-l", "JavaScript", "-e", script],
      { maxBuffer: MAX_OUTPUT_BYTES, timeout: TIMEOUT_MS },
      (err, stdout, stderr) => {
        if (err) {
          if ((err as Error & { killed?: boolean }).killed) {
            reject(new Error(`Apple Calendar request timed out after ${TIMEOUT_MS / 1000}s.`));
            return;
          }
          // stderr holds only the script error; err.message repeats the whole script.
          const raw = (stderr ?? "").trim() || err.message;
          const clean = raw.split("\n").filter((l) => l.trim()).pop() ?? raw;
          reject(new Error(`Apple Calendar error: ${clean}`));
          return;
        }
        resolve(stdout.trim());
      }
    );
  });
}

const ACCESS_HELP =
  "In System Settings → Privacy & Security → Calendars, set Obsidian to Full Calendar Access, then restart Obsidian.";

function accessError(status: unknown): Error {
  if (status === 4) {
    return new Error(`Apple Calendar: Obsidian only has "Add Only" calendar access. ${ACCESS_HELP}`);
  }
  return new Error(`Apple Calendar: Obsidian does not have access to your calendars. ${ACCESS_HELP}`);
}

/** Run an EventKit script and return its parsed result, turning access failures into errors. */
async function runEventKit(script: string): Promise<Record<string, unknown>> {
  const json = await runOsascript(script);
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error("Apple Calendar: could not read the calendar data.");
  }
  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Apple Calendar: unexpected response format.");
  }
  const result = parsed as Record<string, unknown>;
  if (result.error === "access") throw accessError(result.status);
  return result;
}

function safeStr(v: unknown, maxLen = 5_000): string {
  return typeof v === "string" ? v.slice(0, maxLen) : "";
}

function mapAppleStatus(status: string): ResponseStatus {
  switch (status.toLowerCase()) {
    case "accepted":  return "accepted";
    case "declined":  return "declined";
    case "tentative": return "tentative";
    // "invited" and "notresponded" are Calendar.app variants for "awaiting reply"
    case "invited":
    case "notresponded":
    default:          return "needsAction";
  }
}

export function parseJxaEvents(json: string, calendarFilter: string[]): CalendarEvent[] {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    throw new Error(
      "Apple Calendar: could not parse calendar data. " +
      "Check the developer console (Ctrl+Shift+I) for details."
    );
  }

  if (!Array.isArray(raw)) {
    throw new Error("Apple Calendar: unexpected response format.");
  }

  const events: CalendarEvent[] = [];
  const occurrences: string[] = [];

  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;

    const calName = safeStr(r.calendarName);
    if (calendarFilter.length > 0 && !calendarFilter.includes(calName)) {
      continue;
    }

    const startStr = safeStr(r.startDate);
    const endStr   = safeStr(r.endDate);
    const startMs  = Date.parse(startStr);
    if (isNaN(startMs)) continue;

    const allDay = r.allDayEvent === true;
    let start: CalendarEvent["start"];
    let end: CalendarEvent["end"];

    if (allDay) {
      const s = new Date(startMs);
      const pad = (n: number) => String(n).padStart(2, "0");
      const toDateStr = (d: Date) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      start = { date: toDateStr(s) };
      const endMs = Date.parse(endStr);
      end = { date: toDateStr(isNaN(endMs) ? s : new Date(endMs)) };
    } else {
      start = { dateTime: new Date(startMs).toISOString() };
      const endMs = Date.parse(endStr);
      end = { dateTime: isNaN(endMs) ? new Date(startMs).toISOString() : new Date(endMs).toISOString() };
    }

    const attendees: NonNullable<CalendarEvent["attendees"]> = [];
    if (Array.isArray(r.attendees)) {
      for (const a of r.attendees) {
        if (typeof a !== "object" || a === null) continue;
        const ar = a as Record<string, unknown>;
        const email       = safeStr(ar.address,     200).trim();
        const displayName = safeStr(ar.displayName, 200).trim();
        // Exchange attendees often have a display name but no email address in
        // Calendar.app's scripting bridge. Include them using the display name
        // as a fallback identifier so the attendee table is never silently empty.
        if (!email && !displayName) continue;
        attendees.push({
          email: email || displayName,
          displayName: displayName || undefined,
          responseStatus: mapAppleStatus(safeStr(ar.status)),
          ...(ar.self === true ? { self: true } : {}),
        });
      }
    }

    const summary     = safeStr(r.summary,  500)   || undefined;
    const description = safeStr(r.description, 50_000) || undefined;
    const location    = safeStr(r.location, 1_000) || undefined;
    const url         = safeStr(r.url, 2_000);

    // Every occurrence of a recurring event shares one identifier, so the
    // occurrence's original start date distinguishes them. occurrenceDate stays
    // fixed when a single occurrence is moved, keeping its note matched.
    const rawUid = safeStr(r.uid, 500);
    const series = rawUid.replace(/\/RID=\d+$/, "") || `apple-${startMs}-${summary ?? ""}`;
    const occurrence = safeStr(r.occurrenceDate) || new Date(startMs).toISOString();
    const id = r.recurring === true ? `${series}::${occurrence}` : (rawUid ? canonicalEventId(rawUid) : series);
    occurrences.push(occurrence);

    const status = r.status;
    const cancelled = status === 3 || (typeof status === "string" && status.toLowerCase() === "cancelled");

    events.push({
      id,
      summary,
      description,
      location,
      start,
      end,
      attendees: attendees.length > 0 ? attendees : undefined,
      conferenceData: extractConferenceFromText([url, location ?? "", description ?? ""].join("\n")),
      calendarName: calName || undefined,
      ...(cancelled ? { cancelled: true } : {}),
    });
  }

  // Occurrences of one series that EventKit didn't report as recurring would
  // share an id; their occurrence dates tell them apart.
  const count = new Map<string, Set<string>>();
  events.forEach((e, i) => count.set(e.id, (count.get(e.id) ?? new Set()).add(occurrences[i])));
  events.forEach((e, i) => {
    if (!e.id.includes("::") && (count.get(e.id)?.size ?? 0) > 1) e.id = `${e.id}::${occurrences[i]}`;
  });
  return events;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface AppleCalendar {
  name: string;
  id: string;
  account: string;
}

export async function listAppleCalendars(): Promise<AppleCalendar[]> {
  const result = await runEventKit(JXA_LIST_CALENDARS);
  if (!Array.isArray(result.calendars)) return [];
  return result.calendars
    .filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null)
    .map((item) => ({
      name: safeStr(item.name, 200),
      id: safeStr(item.id, 500),
      account: safeStr(item.account, 200),
    }))
    .filter((c) => c.name);
}

/**
 * Check Apple Calendar access step by step and describe the result.
 * Results are also logged to the developer console.
 */
export async function runAppleCalendarDiagnostic(calendarFilter: string[] = []): Promise<string> {
  const lines: string[] = ["Apple Calendar Diagnostic", "─".repeat(40)];
  const log = (line: string) => {
    lines.push(line);
    console.debug("[CalendarNoteIntegration] DIAG", line);
  };
  const message = (err: unknown) => (err instanceof Error ? err.message : String(err));

  log("Step 1: Running a script…");
  try {
    await runOsascript(`(function(){ return "ok"; })()`);
    log("  ✓ osascript works");
  } catch (err) {
    log(`  ✗ ${message(err)}`);
    return lines.join("\n");
  }

  log("Step 2: Checking calendar access and listing calendars…");
  try {
    const t0 = Date.now();
    const cals = await listAppleCalendars();
    log(`  ✓ Access granted — ${cals.length} calendar(s) in ${Date.now() - t0}ms:`);
    cals.forEach((c) => log(`     "${c.name}"${c.account ? ` (${c.account})` : ""}`));
  } catch (err) {
    log(`  ✗ ${message(err)}`);
    return lines.join("\n");
  }

  log("Step 3: Reading events for the next 7 days…");
  try {
    const t0 = Date.now();
    const api = new AppleCalendarApi(calendarFilter, 0, 7);
    const events = await api.fetchAllEvents();
    log(`  ✓ ${events.length} event(s) from ${api.queriedCalendars.length} calendar(s) in ${Date.now() - t0}ms`);
    if (calendarFilter.length > 0 && api.queriedCalendars.length < calendarFilter.length) {
      const missing = calendarFilter.filter((n) => !api.queriedCalendars.includes(n));
      log(`  ⚠ Selected calendar(s) not found: ${missing.map((n) => `"${n}"`).join(", ")}`);
    }
  } catch (err) {
    log(`  ✗ ${message(err)}`);
  }

  return lines.join("\n");
}

/**
 * Read-only client that sources events from Apple Calendar through EventKit.
 *
 * @param calendarFilter Calendar names to include; empty = all calendars.
 * @param daysBack       Whole days before today to include (0 = from today).
 * @param daysAhead      Whole days after today to include.
 */
export class AppleCalendarApi {
  /** Calendars covered by the most recent successful fetch. */
  queriedCalendars: string[] = [];
  /** Every event in the most recent successful fetch (whole date range). */
  fetched: CalendarEvent[] = [];

  constructor(
    private readonly calendarFilter: string[] = [],
    private readonly daysBack = 0,
    private readonly daysAhead = 30
  ) {}

  async fetchAllEvents(): Promise<CalendarEvent[]> {
    const t0 = Date.now();
    const result = await runEventKit(
      buildEventKitScript(this.calendarFilter, this.daysBack, this.daysAhead)
    );
    if (!Array.isArray(result.events)) {
      throw new Error("Apple Calendar: unexpected response format.");
    }
    this.queriedCalendars = Array.isArray(result.calendars)
      ? result.calendars.map((n) => safeStr(n, 200)).filter(Boolean)
      : [];
    const events = parseJxaEvents(JSON.stringify(result.events), this.calendarFilter);
    this.fetched = events;
    console.debug(
      `[CalendarNoteIntegration] Apple Calendar: ${events.length} event(s) from ` +
      `${this.queriedCalendars.length} calendar(s) in ${Date.now() - t0}ms`
    );
    return events;
  }

  async listEventsInTimeWindow(timeMin: Date, timeMax: Date): Promise<CalendarEvent[]> {
    const all = await this.fetchAllEvents();
    return all.filter((event) => {
      if (event.start.dateTime) {
        const s = new Date(event.start.dateTime);
        return s >= timeMin && s <= timeMax;
      }
      if (event.start.date) {
        const dayStart = new Date(event.start.date + "T00:00:00");
        const dayEnd   = new Date(event.start.date + "T23:59:59");
        return dayEnd >= timeMin && dayStart <= timeMax;
      }
      return false;
    });
  }

  async listUpcomingEvents(maxResults: number, daysAhead: number): Promise<CalendarEvent[]> {
    const now       = new Date();
    const windowEnd = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1_000);
    const events    = await this.listEventsInTimeWindow(now, windowEnd);

    events.sort((a, b) => {
      const ta = new Date(a.start.dateTime ?? (a.start.date ?? "") + "T00:00:00").getTime();
      const tb = new Date(b.start.dateTime ?? (b.start.date ?? "") + "T00:00:00").getTime();
      return ta - tb;
    });

    return events.slice(0, maxResults);
  }
}
