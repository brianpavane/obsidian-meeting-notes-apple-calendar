/**
 * @file calendarApi.ts
 * @description Calendar clients for iCal, Google OAuth REST API, and Apple Calendar.
 *
 * Exports:
 *   - {@link IcalCalendarApi}    — fetches from a secret iCal URL (no auth)
 *   - {@link GoogleCalendarApi} — fetches via REST API with an OAuth access token
 *   - {@link AppleCalendarApi}  — reads from Calendar.app via JXA (macOS only)
 *   - {@link CalendarService}   — unified adapter; wraps any backend
 */

export { CalendarEvent, ResponseStatus } from "./icalParser";
import { CalendarEvent } from "./icalParser";
import { parseIcal } from "./icalParser";
import { requestUrl } from "obsidian";
import { AppleCalendarApi } from "./appleCalendarApi";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FETCH_TIMEOUT_MS = 10_000;
const MAX_ICAL_BYTES = 10 * 1024 * 1024; // 10 MB
const CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";
const REST_TIMEOUT_MS = 10_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function fetchIcalText(url: string, timeoutMs = FETCH_TIMEOUT_MS): Promise<string> {
  if (!url) {
    throw new Error(
      "iCal URL is empty. Please re-enter the URL in Settings — " +
      "it may have failed to decrypt on this machine."
    );
  }

  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(
      () => reject(new Error(`iCal request timed out after ${timeoutMs / 1000} seconds.`)),
      timeoutMs
    )
  );

  const fetchPromise = requestUrl({ url, method: "GET", throw: false }).then((response) => {
    if (response.status < 200 || response.status >= 300) {
      throw new Error(
        `Failed to fetch iCal feed: HTTP ${response.status}. ` +
          "Check that the iCal URL is correct and has not been regenerated in Google Calendar."
      );
    }
    const text = response.text;
    if (text.length > MAX_ICAL_BYTES) {
      throw new Error(
        `iCal feed is too large (${(text.length / 1024 / 1024).toFixed(1)} MB). ` +
        `Maximum allowed size is ${MAX_ICAL_BYTES / 1024 / 1024} MB.`
      );
    }
    const trimmed = text.trimStart();
    if (!trimmed.startsWith("BEGIN:VCALENDAR")) {
      const preview = trimmed.slice(0, 50).replace(/[\r\n]+/g, " ");
      console.error(
        "[CalendarNoteIntegration] Unexpected iCal response. " +
        `HTTP ${response.status}. First 50 chars: ${preview}`
      );
      throw new Error(
        "iCal URL did not return a valid calendar feed. " +
        "This usually means the calendar requires authentication — " +
        "check that you are using the 'Secret address in iCal format' " +
        "(not the public URL), and that your organization has not " +
        "disabled external iCal access. " +
        `Response preview: "${preview}"`
      );
    }
    return text;
  });

  return Promise.race([fetchPromise, timeoutPromise]);
}

function withSingleEvents(url: string): string {
  if (!url.includes("calendar.google.com")) return url;
  try {
    const u = new URL(url);
    if (!u.searchParams.has("singleevents")) {
      u.searchParams.set("singleevents", "true");
    }
    return u.toString();
  } catch {
    return url;
  }
}

// ---------------------------------------------------------------------------
// IcalCalendarApi
// ---------------------------------------------------------------------------

export class IcalCalendarApi {
  private readonly icalUrl: string;

  constructor(icalUrl: string) {
    this.icalUrl = icalUrl;
  }

  async fetchAllEvents(): Promise<CalendarEvent[]> {
    const url = withSingleEvents(this.icalUrl);
    const text = await fetchIcalText(url);
    const events = parseIcal(text);
    console.debug(
      `[CalendarNoteIntegration] Fetched iCal feed: ${text.length} bytes, ` +
      `${text.split("BEGIN:VEVENT").length - 1} VEVENT blocks, ` +
      `${events.length} parsed events.`
    );
    if (events.length > 0) {
      console.debug("[CalendarNoteIntegration] First event:", events[0].summary, events[0].start);
    }
    return events;
  }

  async listEventsInTimeWindow(timeMin: Date, timeMax: Date): Promise<CalendarEvent[]> {
    const events = await this.fetchAllEvents();
    return events.filter((event) => {
      if (event.start.dateTime) {
        const start = new Date(event.start.dateTime);
        return start >= timeMin && start <= timeMax;
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
    const events = await this.listEventsInTimeWindow(now, windowEnd);
    events.sort((a, b) => {
      const ta = new Date(a.start.dateTime ?? (a.start.date ?? "") + "T00:00:00").getTime();
      const tb = new Date(b.start.dateTime ?? (b.start.date ?? "") + "T00:00:00").getTime();
      return ta - tb;
    });
    return events.slice(0, maxResults);
  }
}

// ---------------------------------------------------------------------------
// Google Calendar REST API client
// ---------------------------------------------------------------------------

export interface Calendar {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
  selected?: boolean;
}

export class GoogleCalendarApi {
  private readonly accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async listCalendars(): Promise<Calendar[]> {
    const data = await this.request<{ items: Calendar[] }>("/users/me/calendarList");
    return data.items ?? [];
  }

  async listUpcomingEvents(
    calendarId: string,
    maxResults = 20,
    daysAhead = 7
  ): Promise<CalendarEvent[]> {
    const now = new Date();
    const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1_000);
    return this.listEventsInTimeWindow(calendarId, now, future, maxResults);
  }

  async listEventsInTimeWindow(
    calendarId: string,
    timeMin: Date,
    timeMax: Date,
    maxResults = 50
  ): Promise<CalendarEvent[]> {
    const data = await this.request<{ items: CalendarEvent[] }>(
      `/calendars/${encodeURIComponent(calendarId)}/events`,
      {
        timeMin: timeMin.toISOString(),
        timeMax: timeMax.toISOString(),
        maxResults: String(maxResults),
        singleEvents: "true",
        orderBy: "startTime",
      }
    );
    return data.items ?? [];
  }

  private async request<T>(path: string, params?: Record<string, string>): Promise<T> {
    const url = new URL(`${CALENDAR_API_BASE}${path}`);
    if (params) {
      Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Google Calendar API request timed out.")), REST_TIMEOUT_MS)
    );

    const fetchPromise = requestUrl({
      url: url.toString(),
      method: "GET",
      headers: { Authorization: `Bearer ${this.accessToken}` },
      throw: false,
    }).then((response) => {
      if (response.status < 200 || response.status >= 300) {
        const message =
          (response.json as { error?: { message?: string } })?.error?.message ??
          `HTTP ${response.status}`;
        throw new Error(`Google Calendar API error: ${message}`);
      }
      return response.json as T;
    });

    return Promise.race([fetchPromise, timeoutPromise]);
  }
}

// ---------------------------------------------------------------------------
// Unified CalendarService adapter
// ---------------------------------------------------------------------------

export class CalendarService {
  private readonly icalApi?: IcalCalendarApi;
  private readonly restApi?: GoogleCalendarApi;
  private readonly appleApi?: AppleCalendarApi;
  private readonly calendarId: string;

  private constructor(
    icalApi: IcalCalendarApi | undefined,
    restApi: GoogleCalendarApi | undefined,
    appleApi: AppleCalendarApi | undefined,
    calendarId: string
  ) {
    this.icalApi = icalApi;
    this.restApi = restApi;
    this.appleApi = appleApi;
    this.calendarId = calendarId;
  }

  static fromIcal(url: string): CalendarService {
    return new CalendarService(new IcalCalendarApi(url), undefined, undefined, "");
  }

  static fromOAuth(accessToken: string, calendarId: string): CalendarService {
    return new CalendarService(
      undefined,
      new GoogleCalendarApi(accessToken),
      undefined,
      calendarId || "primary"
    );
  }

  static fromApple(calendarFilter: string[] = [], daysBack = 0, daysAhead = 30): CalendarService {
    return new CalendarService(
      undefined,
      undefined,
      new AppleCalendarApi(calendarFilter, daysBack, daysAhead),
      ""
    );
  }

  /**
   * Calendars covered by the last fetch, when the source can tell (Apple
   * Calendar only). Undefined means the source cannot say which calendars it read.
   */
  queriedCalendars(): string[] | undefined {
    return this.appleApi?.queriedCalendars;
  }

  /** Every event the last fetch returned across its whole date range (Apple Calendar only). */
  fetchedEvents(): CalendarEvent[] | undefined {
    return this.appleApi?.fetched;
  }

  async fetchAllEvents(): Promise<CalendarEvent[]> {
    if (this.appleApi) return this.appleApi.fetchAllEvents();
    if (this.icalApi)  return this.icalApi.fetchAllEvents();
    return this.restApi!.listUpcomingEvents(this.calendarId, 2500, 365);
  }

  async listEventsInTimeWindow(timeMin: Date, timeMax: Date): Promise<CalendarEvent[]> {
    if (this.appleApi) return this.appleApi.listEventsInTimeWindow(timeMin, timeMax);
    if (this.icalApi)  return this.icalApi.listEventsInTimeWindow(timeMin, timeMax);
    return this.restApi!.listEventsInTimeWindow(this.calendarId, timeMin, timeMax);
  }

  async listUpcomingEvents(maxResults: number, daysAhead: number): Promise<CalendarEvent[]> {
    if (this.appleApi) return this.appleApi.listUpcomingEvents(maxResults, daysAhead);
    if (this.icalApi)  return this.icalApi.listUpcomingEvents(maxResults, daysAhead);
    return this.restApi!.listUpcomingEvents(this.calendarId, maxResults, daysAhead);
  }
}
