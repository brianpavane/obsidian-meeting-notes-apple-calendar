/**
 * @file icalParser.ts
 * @description RFC 5545 iCalendar parser for Google Calendar events.
 *
 * Handles the iCal features present in Google Calendar exports:
 *   - Line unfolding (CRLF + WSP continuation per RFC 5545 §3.1)
 *   - DATE and DATE-TIME properties (UTC "Z", floating, TZID-qualified)
 *   - VEVENT fields: UID, SUMMARY, DESCRIPTION, LOCATION, DTSTART, DTEND,
 *     ORGANIZER, ATTENDEE (with CN and PARTSTAT), STATUS
 *   - Conference links: Google Meet (X-GOOGLE-CONFERENCE / X-GOOGLE-HANGOUT),
 *     Zoom, and Microsoft Teams URLs extracted from properties and description
 *   - Cancelled event suppression (STATUS:CANCELLED)
 */

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type ResponseStatus = "accepted" | "declined" | "tentative" | "needsAction";

export interface CalendarEvent {
  id: string;
  summary?: string;
  description?: string;
  location?: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus?: ResponseStatus;
    self?: boolean;
    organizer?: boolean;
  }>;
  organizer?: { email: string; displayName?: string };
  conferenceData?: {
    entryPoints?: Array<{ entryPointType: string; uri: string }>;
    conferenceSolution?: { name?: string };
  };
  calendarName?: string;
  cancelled?: boolean;
}

// ---------------------------------------------------------------------------
// Conference URL patterns
// ---------------------------------------------------------------------------

/**
 * Ordered list of known video-conferencing URL patterns.
 * The first match wins when scanning event descriptions.
 */
const CONFERENCE_PATTERNS: Array<{ regex: RegExp; name: string }> = [
  {
    regex: /https:\/\/meet\.google\.com\/[a-z0-9-]+/i,
    name: "Google Meet",
  },
  {
    regex: /https:\/\/[\w.-]+\.zoom\.us\/[^\s<>"]{5,100}/i,
    name: "Zoom",
  },
  {
    regex: /https:\/\/teams\.microsoft\.com\/l\/meetup-join\/[^\s<>"]{5,200}/i,
    name: "Microsoft Teams",
  },
  {
    regex: /https:\/\/teams\.live\.com\/meet\/[^\s<>"]{5,100}/i,
    name: "Microsoft Teams",
  },
];

// ---------------------------------------------------------------------------
// Line handling
// ---------------------------------------------------------------------------

function unfoldLines(raw: string): string[] {
  return raw
    .replace(/\r\n[ \t]/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/\n[ \t]/g, "")
    .split("\n")
    .filter((l) => l.length > 0);
}

// ---------------------------------------------------------------------------
// Property line parsing
// ---------------------------------------------------------------------------

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

function parsePropLine(line: string): Prop {
  let colonIdx = -1;
  let inDQuote = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inDQuote = !inDQuote; continue; }
    if (line[i] === ":" && !inDQuote) { colonIdx = i; break; }
  }

  if (colonIdx === -1) {
    return { name: line.toUpperCase(), params: {}, value: "" };
  }

  const nameAndParams = line.slice(0, colonIdx);
  const value = line.slice(colonIdx + 1);

  const segments: string[] = [];
  let seg = "";
  inDQuote = false;
  for (const ch of nameAndParams) {
    if (ch === '"') { inDQuote = !inDQuote; seg += ch; }
    else if (ch === ";" && !inDQuote) { segments.push(seg); seg = ""; }
    else { seg += ch; }
  }
  segments.push(seg);

  const name = segments[0].toUpperCase().trim();
  const params: Record<string, string> = {};

  for (let i = 1; i < segments.length; i++) {
    const eqIdx = segments[i].indexOf("=");
    if (eqIdx === -1) continue;
    const key = segments[i].slice(0, eqIdx).toUpperCase().trim();
    let val = segments[i].slice(eqIdx + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    params[key] = val;
  }

  return { name, params, value };
}

// ---------------------------------------------------------------------------
// Value helpers
// ---------------------------------------------------------------------------

function unescapeText(value: string): string {
  return value
    .replace(/\\[nN]/g, "\n")
    .replace(/\\;/g, ";")
    .replace(/\\,/g, ",")
    .replace(/\\\\/g, "\\");
}

function getTimeZoneOffsetMs(timeZone: string, instant: Date): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(instant);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );

  return Date.UTC(
    Number(values.year),
    Number(values.month) - 1,
    Number(values.day),
    Number(values.hour),
    Number(values.minute),
    Number(values.second)
  ) - instant.getTime();
}

function convertTzidDateTimeToUtcIso(
  value: string,
  timeZone: string
): string | undefined {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
  if (!m) return undefined;

  const [, yr, mo, dy, hr, mn, sc] = m;
  const year = Number(yr);
  const month = Number(mo);
  const day = Number(dy);
  const hour = Number(hr);
  const minute = Number(mn);
  const second = Number(sc);

  let utcMs = Date.UTC(year, month - 1, day, hour, minute, second);

  for (let i = 0; i < 3; i++) {
    const offsetMs = getTimeZoneOffsetMs(timeZone, new Date(utcMs));
    const nextUtcMs = Date.UTC(year, month - 1, day, hour, minute, second) - offsetMs;
    if (nextUtcMs === utcMs) break;
    utcMs = nextUtcMs;
  }

  return new Date(utcMs).toISOString().replace(".000Z", "Z");
}

function parseIcalDate(
  value: string,
  params: Record<string, string> = {}
): { dateTime?: string; date?: string } {
  if (/^\d{8}$/.test(value)) {
    return {
      date: `${value.slice(0, 4)}-${value.slice(4, 6)}-${value.slice(6, 8)}`,
    };
  }
  const m = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})(Z?)$/);
  if (!m) return {};
  const [, yr, mo, dy, hr, mn, sc, utc] = m;
  const tzid = params["TZID"]?.trim();
  if (tzid && utc !== "Z") {
    try {
      const utcIso = convertTzidDateTimeToUtcIso(value, tzid);
      if (utcIso) {
        return { dateTime: utcIso };
      }
    } catch {
      // Fall back to the original floating timestamp if the TZID is unknown.
    }
  }
  return {
    dateTime: `${yr}-${mo}-${dy}T${hr}:${mn}:${sc}${utc === "Z" ? "Z" : ""}`,
  };
}

function buildInstanceKey(
  start: { dateTime?: string; date?: string },
  recurrenceId?: { dateTime?: string; date?: string }
): string | undefined {
  return (
    recurrenceId?.dateTime ??
    recurrenceId?.date ??
    start.dateTime ??
    start.date
  );
}

function mapPartstat(partstat: string | undefined): ResponseStatus {
  switch ((partstat ?? "").toUpperCase()) {
    case "ACCEPTED":     return "accepted";
    case "DECLINED":     return "declined";
    case "TENTATIVE":    return "tentative";
    case "NEEDS-ACTION":
    default:             return "needsAction";
  }
}

/**
 * Attempt to extract a video-conference URL from event properties.
 *
 * Checks explicit iCal conference properties first (X-GOOGLE-CONFERENCE,
 * X-GOOGLE-HANGOUT), then scans the description for known patterns:
 * Google Meet, Zoom, and Microsoft Teams.
 */
function extractConference(
  xConf: string | undefined,
  xHangout: string | undefined,
  description: string
): CalendarEvent["conferenceData"] | undefined {
  const explicit = xConf ?? xHangout;

  if (explicit) {
    // Identify platform from URL
    for (const { regex, name } of CONFERENCE_PATTERNS) {
      if (regex.test(explicit)) {
        return {
          entryPoints: [{ entryPointType: "video", uri: explicit }],
          conferenceSolution: { name },
        };
      }
    }
    // Unknown platform but we have an explicit URL
    return {
      entryPoints: [{ entryPointType: "video", uri: explicit }],
      conferenceSolution: { name: "Video call" },
    };
  }

  // Scan description for known conference URLs
  for (const { regex, name } of CONFERENCE_PATTERNS) {
    const match = description.match(regex);
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
// Main parse function
// ---------------------------------------------------------------------------

/**
 * Parse a raw iCalendar string and return all VEVENT entries as
 * {@link CalendarEvent} objects.
 *
 * Cancelled events (STATUS:CANCELLED) and events with no UID are dropped.
 */
export function parseIcal(raw: string): CalendarEvent[] {
  const lines = unfoldLines(raw);
  const events: Array<CalendarEvent & { rawUid: string; instanceKey?: string }> = [];

  let inVEvent = false;
  let uid = "";
  let summary = "";
  let description = "";
  let location = "";
  let startResult: ReturnType<typeof parseIcalDate> = {};
  let endResult: ReturnType<typeof parseIcalDate> = {};
  let organizer: CalendarEvent["organizer"] = undefined;
  let attendees: NonNullable<CalendarEvent["attendees"]> = [];
  let xConf: string | undefined;
  let xHangout: string | undefined;
  let recurrenceId: ReturnType<typeof parseIcalDate> | undefined;
  let cancelled = false;

  const resetState = (): void => {
    uid = ""; summary = ""; description = ""; location = "";
    startResult = {}; endResult = {};
    organizer = undefined; attendees = [];
    xConf = undefined; xHangout = undefined;
    recurrenceId = undefined;
    cancelled = false;
  };

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      inVEvent = true;
      resetState();
      continue;
    }

    if (line === "END:VEVENT") {
      inVEvent = false;
      if (uid && !cancelled) {
        if (organizer) {
          attendees = attendees.map((a) => ({
            ...a,
            organizer: a.organizer ?? (a.email === organizer!.email),
          }));
        }

        events.push({
          id: uid,
          summary: summary || undefined,
          description: description || undefined,
          location: location || undefined,
          start: startResult,
          end: endResult,
          organizer,
          attendees: attendees.length > 0 ? attendees : undefined,
          conferenceData: extractConference(xConf, xHangout, description),
          rawUid: uid,
          instanceKey: buildInstanceKey(startResult, recurrenceId),
        });
      }
      continue;
    }

    if (!inVEvent) continue;

    const prop = parsePropLine(line);

    switch (prop.name) {
      case "UID":
        uid = prop.value;
        break;
      case "SUMMARY":
        summary = unescapeText(prop.value);
        break;
      case "DESCRIPTION":
        description = unescapeText(prop.value);
        break;
      case "LOCATION":
        location = unescapeText(prop.value);
        break;
      case "STATUS":
        if (prop.value.toUpperCase() === "CANCELLED") cancelled = true;
        break;
      case "DTSTART":
        startResult = parseIcalDate(prop.value, prop.params);
        break;
      case "DTEND":
        endResult = parseIcalDate(prop.value, prop.params);
        break;
      case "RECURRENCE-ID":
        recurrenceId = parseIcalDate(prop.value, prop.params);
        break;
      case "ORGANIZER": {
        const email = prop.value.replace(/^mailto:/i, "").trim();
        const displayName = prop.params["CN"] || undefined;
        if (email) organizer = { email, displayName };
        break;
      }
      case "ATTENDEE": {
        const email = prop.value.replace(/^mailto:/i, "").trim();
        if (!email) break;
        const displayName = prop.params["CN"] || undefined;
        const responseStatus = mapPartstat(prop.params["PARTSTAT"]);
        attendees.push({ email, displayName, responseStatus });
        break;
      }
      case "X-GOOGLE-CONFERENCE":
        xConf = prop.value;
        break;
      case "X-GOOGLE-HANGOUT":
        xHangout = prop.value;
        break;
    }
  }

  const duplicateUidCounts = new Map<string, number>();
  for (const event of events) {
    duplicateUidCounts.set(event.rawUid, (duplicateUidCounts.get(event.rawUid) ?? 0) + 1);
  }

  return events.map(({ rawUid, instanceKey, ...event }) => ({
    ...event,
    id:
      (duplicateUidCounts.get(rawUid) ?? 0) > 1 && instanceKey
        ? `${rawUid}::${instanceKey}`
        : rawUid,
  }));
}
