import test from "node:test";
import assert from "node:assert/strict";
import { parseIcal } from "../src/icalParser";

test("parseIcal assigns unique ids to recurring instances", () => {
  const events = parseIcal(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:series-123
SUMMARY:Weekly Sync
DTSTART:20260403T140000Z
DTEND:20260403T150000Z
END:VEVENT
BEGIN:VEVENT
UID:series-123
RECURRENCE-ID:20260410T140000Z
SUMMARY:Weekly Sync
DTSTART:20260410T140000Z
DTEND:20260410T150000Z
END:VEVENT
END:VCALENDAR`);

  assert.equal(events.length, 2);
  assert.equal(events[0].id, "series-123::2026-04-03T14:00:00Z");
  assert.equal(events[1].id, "series-123::2026-04-10T14:00:00Z");
});

test("parseIcal converts TZID datetimes to UTC", () => {
  const [event] = parseIcal(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:tzid-1
SUMMARY:Timezone Test
DTSTART;TZID=America/New_York:20260115T100000
DTEND;TZID=America/New_York:20260115T110000
END:VEVENT
END:VCALENDAR`);

  assert.ok(event);
  assert.equal(event.start.dateTime, "2026-01-15T15:00:00Z");
  assert.equal(event.end.dateTime, "2026-01-15T16:00:00Z");
});

test("parseIcal keeps unknown TZID values as floating local timestamps", () => {
  const [event] = parseIcal(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:tzid-unknown
SUMMARY:Fallback Test
DTSTART;TZID=Custom/Zone:20260115T100000
DTEND;TZID=Custom/Zone:20260115T110000
END:VEVENT
END:VCALENDAR`);

  assert.ok(event);
  assert.equal(event.start.dateTime, "2026-01-15T10:00:00");
  assert.equal(event.end.dateTime, "2026-01-15T11:00:00");
});

test("parseIcal unfolds folded lines and unescapes text fields", () => {
  const [event] = parseIcal(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:folded-1
SUMMARY:Quarterly\\, Review
DESCRIPTION:Line one\\nLine two
 continued
LOCATION:HQ\\; Boardroom
DTSTART:20260403T140000Z
DTEND:20260403T150000Z
END:VEVENT
END:VCALENDAR`);

  assert.ok(event);
  assert.equal(event.summary, "Quarterly, Review");
  assert.equal(event.description, "Line one\nLine twocontinued");
  assert.equal(event.location, "HQ; Boardroom");
});

test("parseIcal drops cancelled events and extracts conference links", () => {
  const events = parseIcal(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:cancelled-1
SUMMARY:Cancelled
STATUS:CANCELLED
DTSTART:20260403T140000Z
DTEND:20260403T150000Z
END:VEVENT
BEGIN:VEVENT
UID:meeting-1
SUMMARY:Planning
DESCRIPTION:Join here https://meet.google.com/abc-defg-hij
DTSTART:20260404T140000Z
DTEND:20260404T150000Z
END:VEVENT
END:VCALENDAR`);

  assert.equal(events.length, 1);
  assert.equal(events[0].conferenceData?.conferenceSolution?.name, "Google Meet");
  assert.equal(
    events[0].conferenceData?.entryPoints?.[0]?.uri,
    "https://meet.google.com/abc-defg-hij"
  );
});

test("parseIcal marks organizer attendees when organizer matches attendee email", () => {
  const [event] = parseIcal(`BEGIN:VCALENDAR
BEGIN:VEVENT
UID:organizer-1
SUMMARY:Planning
ORGANIZER;CN=Alex:mailto:alex@example.com
ATTENDEE;CN=Alex;PARTSTAT=ACCEPTED:mailto:alex@example.com
DTSTART:20260403T140000Z
DTEND:20260403T150000Z
END:VEVENT
END:VCALENDAR`);

  assert.equal(event.organizer?.email, "alex@example.com");
  assert.equal(event.attendees?.[0]?.organizer, true);
});
