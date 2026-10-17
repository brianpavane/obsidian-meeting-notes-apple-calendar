import test from "node:test";
import assert from "node:assert/strict";
import { currentOrNextMeeting, meetingToJoin, statusText } from "../src/meetingStatus";
import { buildEvent } from "./support/testHelpers";

const at = (hhmm: string, day = "2026-04-03") => new Date(`${day}T${hhmm}:00-04:00`);
const event = (id: string, start: string, end: string, extra = {}) =>
  buildEvent({
    id,
    summary: id,
    start: { dateTime: `2026-04-03T${start}:00-04:00` },
    end: { dateTime: `2026-04-03T${end}:00-04:00` },
    ...extra,
  });

test("currentOrNextMeeting prefers the meeting in progress", () => {
  const events = [event("Later", "11:00", "12:00"), event("Now", "09:30", "10:30")];
  const meeting = currentOrNextMeeting(events, at("10:00"));

  assert.equal(meeting?.event.id, "Now");
  assert.equal(meeting?.inProgress, true);
  assert.equal(statusText(meeting!, at("10:00")), "Now: Now · ends in 30 min");
});

test("currentOrNextMeeting picks the soonest upcoming meeting and skips cancelled ones", () => {
  const events = [
    event("Cancelled", "10:10", "10:40", { cancelled: true }),
    event("Second", "11:00", "12:00"),
    event("First", "10:25", "10:55"),
    buildEvent({ id: "AllDay", start: { date: "2026-04-03" }, end: { date: "2026-04-04" } }),
  ];
  const meeting = currentOrNextMeeting(events, at("10:00"));

  assert.equal(meeting?.event.id, "First");
  assert.equal(statusText(meeting!, at("10:00")), "Next: First in 25 min");
});

test("statusText shows a clock time for later meetings", () => {
  const later = currentOrNextMeeting([event("Review", "15:00", "16:00")], at("10:00"))!;
  assert.match(statusText(later, at("10:00")), /^Next: Review at \d{1,2}:00 (AM|PM)$/);

  const tomorrow = currentOrNextMeeting(
    [buildEvent({ id: "T", summary: "Sync", start: { dateTime: "2026-04-04T09:00:00-04:00" }, end: { dateTime: "2026-04-04T09:30:00-04:00" } })],
    at("20:00")
  )!;
  assert.match(statusText(tomorrow, at("20:00")), /^Next: Sync (tomorrow|\w+day) at /);
});

test("meetingToJoin only returns a meeting in progress or starting soon", () => {
  const events = [event("Soon", "10:20", "11:00"), event("Far", "13:00", "14:00")];

  assert.equal(meetingToJoin(events, at("10:00"), 30 * 60_000)?.event.id, "Soon");
  assert.equal(meetingToJoin([event("Far", "13:00", "14:00")], at("10:00"), 30 * 60_000), undefined);
});
