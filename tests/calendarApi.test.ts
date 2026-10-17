import test from "node:test";
import assert from "node:assert/strict";
import { GoogleCalendarApi, IcalCalendarApi } from "../src/calendarApi";
import { resetObsidianTestState, setRequestUrlMock } from "./support/obsidianStub";

test.afterEach(() => {
  resetObsidianTestState();
});

test("IcalCalendarApi appends singleevents=true for Google Calendar feeds", async () => {
  let requestedUrl = "";
  setRequestUrlMock(async ({ url }) => {
    requestedUrl = url;
    return {
      status: 200,
      text: `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:test
SUMMARY:One-off
DTSTART:20260403T140000Z
DTEND:20260403T150000Z
END:VEVENT
END:VCALENDAR`,
      json: {},
    };
  });

  const api = new IcalCalendarApi(
    "https://calendar.google.com/calendar/ical/foo/basic.ics"
  );
  const events = await api.fetchAllEvents();

  assert.equal(events.length, 1);
  assert.match(requestedUrl, /singleevents=true/);
});

test("IcalCalendarApi rejects non-calendar responses with a helpful error", async () => {
  setRequestUrlMock(async () => ({
    status: 200,
    text: "<html>please sign in</html>",
    json: {},
  }));

  const api = new IcalCalendarApi("https://example.com/feed.ics");
  await assert.rejects(
    () => api.fetchAllEvents(),
    /did not return a valid calendar feed/i
  );
});

test("IcalCalendarApi filters events in a time window", async () => {
  setRequestUrlMock(async () => ({
    status: 200,
    text: `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:inside
SUMMARY:Inside
DTSTART:20260403T140000Z
DTEND:20260403T150000Z
END:VEVENT
BEGIN:VEVENT
UID:outside
SUMMARY:Outside
DTSTART:20260410T140000Z
DTEND:20260410T150000Z
END:VEVENT
END:VCALENDAR`,
    json: {},
  }));

  const api = new IcalCalendarApi("https://example.com/feed.ics");
  const events = await api.listEventsInTimeWindow(
    new Date("2026-04-03T00:00:00Z"),
    new Date("2026-04-04T00:00:00Z")
  );

  assert.deepEqual(events.map((event) => event.summary), ["Inside"]);
});

test("GoogleCalendarApi surfaces REST error messages", async () => {
  setRequestUrlMock(async () => ({
    status: 403,
    text: "",
    json: { error: { message: "Forbidden calendar" } },
  }));

  const api = new GoogleCalendarApi("token");
  await assert.rejects(
    () =>
      api.listEventsInTimeWindow(
        "primary",
        new Date("2026-04-03T00:00:00Z"),
        new Date("2026-04-04T00:00:00Z")
      ),
    /Forbidden calendar/
  );
});

test("GoogleCalendarApi includes expected query parameters", async () => {
  let requestedUrl = "";
  setRequestUrlMock(async ({ url }) => {
    requestedUrl = url;
    return {
      status: 200,
      text: "",
      json: { items: [] },
    };
  });

  const api = new GoogleCalendarApi("token");
  await api.listUpcomingEvents("primary", 7, 3);

  assert.match(requestedUrl, /singleEvents=true/);
  assert.match(requestedUrl, /orderBy=startTime/);
  assert.match(requestedUrl, /maxResults=7/);
});
