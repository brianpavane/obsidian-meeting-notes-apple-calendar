import test from "node:test";
import assert from "node:assert/strict";
import { canonicalEventId, parseJxaEvents } from "../src/appleCalendarApi";

function raw(overrides: Record<string, unknown>) {
  return {
    uid: "SERIES-1",
    summary: "Weekly 1:1",
    calendarName: "Work",
    startDate: "2026-01-15T15:00:00.000Z",
    endDate: "2026-01-15T15:30:00.000Z",
    allDayEvent: false,
    description: "",
    location: "",
    ...overrides,
  };
}

test("parseJxaEvents gives each occurrence of a recurring event its own id", () => {
  const events = parseJxaEvents(
    JSON.stringify([
      raw({ recurring: true, occurrenceDate: "2026-01-15T15:00:00.000Z" }),
      raw({
        recurring: true,
        occurrenceDate: "2026-01-22T15:00:00.000Z",
        startDate: "2026-01-22T15:00:00.000Z",
        endDate: "2026-01-22T15:30:00.000Z",
      }),
    ]),
    []
  );

  assert.deepEqual(events.map((e) => e.id), [
    "SERIES-1::2026-01-15T15:00:00.000Z",
    "SERIES-1::2026-01-22T15:00:00.000Z",
  ]);
});

test("parseJxaEvents keeps a moved occurrence's id stable via its original date", () => {
  const [event] = parseJxaEvents(
    JSON.stringify([
      raw({
        recurring: true,
        occurrenceDate: "2026-01-22T15:00:00.000Z",
        startDate: "2026-01-23T17:00:00.000Z",
        endDate: "2026-01-23T17:30:00.000Z",
      }),
    ]),
    []
  );

  assert.equal(event.id, "SERIES-1::2026-01-22T15:00:00.000Z");
  assert.equal(event.start.dateTime, "2026-01-23T17:00:00.000Z");
});

test("parseJxaEvents ignores the /RID suffix Google adds to a moved occurrence's identifier", () => {
  const series = "4B81F012-FD5E-4916-B80F-DCA39E64BFED:49mmnr4iccm5fqud5h5osvlb12@google.com";
  const [event] = parseJxaEvents(
    JSON.stringify([
      raw({
        uid: `${series}/RID=813072600`,
        recurring: true,
        occurrenceDate: "2026-10-07T13:30:00.000Z",
        startDate: "2026-10-09T13:30:00.000Z",
        endDate: "2026-10-09T14:00:00.000Z",
      }),
    ]),
    []
  );

  assert.equal(event.id, `${series}::2026-10-07T13:30:00.000Z`);
});

test("canonicalEventId drops /RID from saved occurrence ids and leaves other ids alone", () => {
  assert.equal(canonicalEventId("A@google.com/RID=813072600::2026-10-07T13:30:00.000Z"), "A@google.com::2026-10-07T13:30:00.000Z");
  assert.equal(canonicalEventId("A@google.com/RID=813072600"), "A@google.com::2026-10-07T13:30:00.000Z", "the RID is the occurrence");
  assert.equal(canonicalEventId("A@google.com::2026-10-07T13:30:00.000Z"), "A@google.com::2026-10-07T13:30:00.000Z");
  assert.equal(canonicalEventId("odd/RID=12/x"), "odd/RID=12/x");
});

test("parseJxaEvents keeps plain ids for one-off events and reads calendar details", () => {
  const [event] = parseJxaEvents(
    JSON.stringify([raw({ uid: "ONE-OFF", status: 3, url: "https://zoom.us/j/987654321" })]),
    []
  );

  assert.equal(event.id, "ONE-OFF");
  assert.equal(event.calendarName, "Work");
  assert.equal(event.cancelled, true);
  assert.equal(event.conferenceData?.entryPoints?.[0].uri, "https://zoom.us/j/987654321");
  assert.equal(event.conferenceData?.conferenceSolution?.name, "Zoom");
});

test("parseJxaEvents finds join links in the location and gives id-less events a stable id", () => {
  const json = JSON.stringify([
    raw({ uid: "", location: "https://teams.microsoft.com/l/meetup-join/19%3ameeting_abc/0" }),
  ]);
  const [first] = parseJxaEvents(json, []);
  const [second] = parseJxaEvents(json, []);

  assert.equal(first.conferenceData?.conferenceSolution?.name, "Microsoft Teams");
  assert.equal(first.id, second.id);
  assert.equal(first.cancelled, undefined);
});

test("moved occurrences that EventKit doesn't report as recurring keep separate ids", () => {
  const series = "S@google.com";
  const events = parseJxaEvents(JSON.stringify([
    raw({ uid: `${series}/RID=813072600`, recurring: false, startDate: "2026-10-09T13:30:00.000Z", endDate: "2026-10-09T14:00:00.000Z" }),
    raw({ uid: `${series}/RID=813677400`, recurring: false, startDate: "2026-10-16T13:30:00.000Z", endDate: "2026-10-16T14:00:00.000Z" }),
  ]), []);
  assert.deepEqual(events.map((e) => e.id), [`${series}::2026-10-07T13:30:00.000Z`, `${series}::2026-10-14T13:30:00.000Z`]);
});

test("occurrences of one series read without recurrence info get their dates added to the shared id", () => {
  const events = parseJxaEvents(JSON.stringify([
    raw({ uid: "WEEKLY", recurring: false, startDate: "2026-10-06T14:00:00.000Z", endDate: "2026-10-06T14:30:00.000Z" }),
    raw({ uid: "WEEKLY", recurring: false, startDate: "2026-10-13T14:00:00.000Z", endDate: "2026-10-13T14:30:00.000Z" }),
    raw({ uid: "ONE-OFF", recurring: false, startDate: "2026-10-07T14:00:00.000Z", endDate: "2026-10-07T14:30:00.000Z" }),
  ]), []);
  assert.deepEqual(events.map((e) => e.id), ["WEEKLY::2026-10-06T14:00:00.000Z", "WEEKLY::2026-10-13T14:00:00.000Z", "ONE-OFF"]);
});
