import test from "node:test";
import assert from "node:assert/strict";
import {
  ALL_SECTIONS,
  builtInTemplate,
  createNoteContent,
  createNoteFile,
  findDuplicateNotes,
  findNotesByEventId,
  movedAfterItStarted,
  setSeriesLink,
  syncNoteFile,
  generateNoteFilename,
  openTasks,
  previousNoteInSeries,
  resolveNoteFilePath,
  setFrontmatterValue,
  addFrontmatterTags,
  updateNoteContent,
} from "../src/noteCreator";
import type { CalendarEvent } from "../src/calendarApi";
import { createMemoryApp } from "./support/testHelpers";
import { TFile } from "./support/obsidianStub";

function buildEvent(overrides = {}) {
  const base = {
    id: "event-1",
    summary: "Late Night Sync",
    start: { dateTime: "2026-04-03T23:30:00-04:00" },
    end: { dateTime: "2026-04-04T00:30:00-04:00" },
  };
  return { ...base, ...overrides } as CalendarEvent;
}

test("generateNoteFilename preserves the event's local calendar date", () => {
  const filename = generateNoteFilename(buildEvent(), "before");
  assert.equal(filename, "2026-04-03 - Late Night Sync");
});

test("resolveNoteFilePath preserves the event's local date in the final path", () => {
  const filePath = resolveNoteFilePath(buildEvent(), {
    noteFolder: "Meeting Notes",
    datePosition: "after",
  });

  assert.equal(filePath, "Meeting Notes/Late Night Sync - 2026-04-03.md");
});

test("createNoteContent writes the original event date into frontmatter", () => {
  const content = createNoteContent(buildEvent(), {
    includeEventNotes: false,
    linkAttendees: false,
  });

  assert.match(content, /^date: 2026-04-03$/m);
  assert.doesNotMatch(content, /^date: 2026-04-04$/m);
});

test("createNoteContent sanitizes attendees, strips boilerplate, and omits self attendee", () => {
  const content = createNoteContent(
    {
      ...buildEvent(),
      summary: 'Planning: "Q2"',
      description: `<p>Agenda line</p>
-::~:~::-
Join Zoom Meeting
https://zoom.us/j/123456789
-::~:~::-`,
      attendees: [
        { email: "me@example.com", displayName: "Me", self: true, responseStatus: "accepted" },
        { email: "alex@example.com", displayName: "Alex | Smith", responseStatus: "accepted" },
      ],
      organizer: { email: "alex@example.com", displayName: "Alex | Smith" },
      conferenceData: {
        conferenceSolution: { name: "Zoom" },
        entryPoints: [{ entryPointType: "video", uri: "https://zoom.us/j/123456789" }],
      },
    },
    {
      includeEventNotes: true,
      linkAttendees: false,
    }
  );

  assert.match(content, /title: "Planning: \\"Q2\\""/);
  assert.match(content, /^> \*\*Attendees:\*\* 🟢 Alex \\\| Smith \*\(organizer\)\*$/m);
  assert.doesNotMatch(content, /Me <me@example\.com>/);
  assert.doesNotMatch(content, /Join Zoom Meeting/);
  assert.match(content, /^> \*\*Join:\*\* \[Join Zoom\]\(https:\/\/zoom\.us\/j\/123456789\)$/m);
  assert.match(content, /^meeting_url: "https:\/\/zoom\.us\/j\/123456789"$/m);
});

test("createNoteContent excludes unsafe conference links", () => {
  const content = createNoteContent(
    {
      ...buildEvent(),
      conferenceData: {
        conferenceSolution: { name: "Video call" },
        entryPoints: [{ entryPointType: "video", uri: "javascript:alert(1)" }],
      },
    },
    {
      includeEventNotes: false,
      linkAttendees: false,
    }
  );

  assert.doesNotMatch(content, /\*\*Join:\*\*/);
  assert.doesNotMatch(content, /^meeting_url:/m);
});

test("createNoteContent excludes plain http conference links", () => {
  const content = createNoteContent(
    {
      ...buildEvent(),
      conferenceData: {
        conferenceSolution: { name: "Zoom" },
        entryPoints: [{ entryPointType: "video", uri: "http://zoom.us/j/123456789" }],
      },
    },
    {
      includeEventNotes: false,
      linkAttendees: false,
    }
  );

  assert.doesNotMatch(content, /\*\*Join:\*\*/);
  assert.doesNotMatch(content, /^meeting_url:/m);
});

test("createNoteFile creates folders and reuses existing files idempotently", async () => {
  const app = createMemoryApp();
  const event = buildEvent();

  const first = await createNoteFile(app as never, event, {
    noteFolder: "Meeting Notes",
    includeEventNotes: true,
    linkAttendees: false,
    datePosition: "before",
  });
  const second = await createNoteFile(app as never, event, {
    noteFolder: "Meeting Notes",
    includeEventNotes: true,
    linkAttendees: false,
    datePosition: "before",
  });

  assert.equal(first.wasCreated, true);
  assert.equal(second.wasCreated, false);
  assert.equal(first.file.path, "Meeting Notes/2026-04-03 - Late Night Sync.md");
});

test("generateNoteFilename uses this machine's date for UTC timestamps", () => {
  const start = "2026-04-04T02:30:00.000Z";
  const d = new Date(start);
  const pad = (n: number) => String(n).padStart(2, "0");
  const localDate = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const filename = generateNoteFilename(
    buildEvent({ start: { dateTime: start }, end: { dateTime: "2026-04-04T03:30:00.000Z" } }),
    "before"
  );

  assert.equal(filename, `${localDate} - Late Night Sync`);
});

test("createNoteContent uses the meeting format with properties, details callout and sections", () => {
  const content = createNoteContent(
    buildEvent({
      summary: "Weekly Sync",
      start: { dateTime: "2026-01-15T10:00:00-05:00" },
      end: { dateTime: "2026-01-15T11:00:00-05:00" },
      location: "Room B",
      calendarName: "Work",
      organizer: { email: "alice@example.com", displayName: "Alice Smith" },
      attendees: [
        { email: "alice@example.com", displayName: "Alice Smith", responseStatus: "accepted" },
        { email: "bob@example.com", displayName: "Bob Jones", responseStatus: "tentative" },
      ],
      conferenceData: {
        conferenceSolution: { name: "Google Meet" },
        entryPoints: [{ entryPointType: "video", uri: "https://meet.google.com/abc-defg-hij" }],
      },
    }),
    { includeEventNotes: false, linkAttendees: true }
  );

  assert.match(content, /^type: meeting$/m);
  assert.match(content, /^start: 2026-01-15T10:00$/m);
  assert.match(content, /^end: 2026-01-15T11:00$/m);
  assert.match(content, /^calendar: "Work"$/m);
  assert.match(content, /^organizer: "\[\[Alice Smith\]\]"$/m);
  assert.match(content, /^ {2}- "\[\[Bob Jones\]\]"$/m);
  assert.match(content, /^> \*\*When:\*\* Thursday, January 15, 2026 · 10:00 AM – 11:00 AM EST \(1h\)$/m);
  assert.match(content, /^> \*\*Where:\*\* Room B$/m);
  assert.match(content, /^> \*\*Join:\*\* \[Join Google Meet\]\(https:\/\/meet\.google\.com\/abc-defg-hij\)$/m);
  assert.match(content, /^> \*\*Attendees:\*\* 🟢 \[\[Alice Smith\]\] \*\(organizer\)\* · 🟡 \[\[Bob Jones\]\]$/m);
  assert.match(content, /## Agenda\n\n- \n\n## Notes\n\n- \n\n## Executive Summary\n\n\n\n## Next Steps\n\n- \[ \] \n\n## Summary by Topic\n\n\n\n## Key Decisions\n\n- \n\n## Additional Items\n\n- \n\n## Speakers\n\n\n\n## Transcript\n\n$/);
  assert.doesNotMatch(content, /Event description/);
});

test("updateNoteContent refreshes calendar details and keeps the user's writing", () => {
  const original = createNoteContent(
    buildEvent({
      summary: "Planning",
      start: { dateTime: "2026-01-15T10:00:00-05:00" },
      end: { dateTime: "2026-01-15T11:00:00-05:00" },
      location: "Room B",
      attendees: [{ email: "bob@example.com", displayName: "Bob", responseStatus: "needsAction" }],
    }),
    { includeEventNotes: false, linkAttendees: false }
  )
    .replace("tags:\n  - meeting", "tags:\n  - meeting\n  - project-x\nproject: Apollo")
    .replace("## Notes\n\n- ", "## Notes\n\n- My own note");

  const updated = updateNoteContent(
    original,
    buildEvent({
      summary: "Planning",
      start: { dateTime: "2026-01-16T14:00:00-05:00" },
      end: { dateTime: "2026-01-16T14:30:00-05:00" },
      attendees: [{ email: "bob@example.com", displayName: "Bob", responseStatus: "accepted" }],
      cancelled: true,
    }),
    { linkAttendees: false }
  );

  assert.match(updated, /^date: 2026-01-16$/m);
  assert.match(updated, /^start: 2026-01-16T14:00$/m);
  assert.match(updated, /^status: cancelled$/m);
  assert.doesNotMatch(updated, /^location:/m);
  assert.match(updated, /^> \[!danger\] Meeting cancelled$/m);
  assert.match(updated, /^> \*\*When:\*\* Friday, January 16, 2026 · 02:00 PM – 02:30 PM EST \(30m\)$/m);
  assert.match(updated, /^> \*\*Attendees:\*\* 🟢 Bob$/m);
  assert.doesNotMatch(updated, /Where:/);
  assert.match(updated, /^ {2}- project-x$/m);
  assert.match(updated, /^project: Apollo$/m);
  assert.match(updated, /- My own note/);
  assert.equal(updateNoteContent(updated, buildEvent({
    summary: "Planning",
    start: { dateTime: "2026-01-16T14:00:00-05:00" },
    end: { dateTime: "2026-01-16T14:30:00-05:00" },
    attendees: [{ email: "bob@example.com", displayName: "Bob", responseStatus: "accepted" }],
    cancelled: true,
  }), { linkAttendees: false }), updated);
});

test("createNoteContent puts the event description in the Agenda section", () => {
  const content = createNoteContent(
    buildEvent({ description: "Review Q1 goals\n\nStaffing update" }),
    { includeEventNotes: true, linkAttendees: false }
  );

  assert.match(content, /## Agenda\n\n- Review Q1 goals\n- Staffing update\n- \n\n## Notes/);
  assert.doesNotMatch(content, /Event description/);
});

test("createNoteContent fills a user template and still adds the calendar properties", () => {
  const template = [
    "---",
    "project: \"{{calendar}}\"",
    "tags:",
    "  - work",
    "---",
    "# {{title}} ({{start_time}})",
    "",
    "Join: {{join_link}}",
    "With: {{attendees}}",
    "Day: {{daily_note}}",
    "",
    "{{description_callout}}",
    "",
    "<% tp.date.now() %> {{unknown}}",
    "",
  ].join("\n");

  const content = createNoteContent(
    buildEvent({
      summary: "Design Review",
      calendarName: "Work",
      start: { dateTime: "2026-01-15T10:00:00-05:00" },
      end: { dateTime: "2026-01-15T11:00:00-05:00" },
      attendees: [{ email: "bob@example.com", displayName: "Bob Jones", responseStatus: "accepted" }],
      conferenceData: {
        conferenceSolution: { name: "Zoom" },
        entryPoints: [{ entryPointType: "video", uri: "https://zoom.us/j/1234567" }],
      },
    }),
    {
      includeEventNotes: false,
      linkAttendees: true,
      dailyNote: { format: "YYYY-MM-DD", folder: "Daily" },
      template,
    }
  );

  assert.match(content, /^project: "Work"$/m);
  assert.match(content, /^calendar_event_id: "event-1"\ntags:\n {2}- work\n---$/m);
  assert.match(content, /^daily_note: "\[\[Daily\/2026-01-15\|2026-01-15\]\]"$/m);
  assert.match(content, /^# Design Review \(10:00 AM EST\)$/m);
  assert.match(content, /^Join: \[Join Zoom\]\(https:\/\/zoom\.us\/j\/1234567\)$/m);
  assert.match(content, /^With: \[\[Bob Jones\]\]$/m);
  assert.match(content, /^Day: \[\[Daily\/2026-01-15\|2026-01-15\]\]$/m);
  assert.match(content, /^<% tp\.date\.now\(\) %> \{\{unknown\}\}$/m);
  assert.doesNotMatch(content, /Event description/);
  assert.doesNotMatch(content, /\n\n\n/);
});

test("createNoteContent adds frontmatter to a template that has none", () => {
  const content = createNoteContent(buildEvent(), {
    includeEventNotes: false,
    linkAttendees: false,
    template: "# {{title}}\n",
  });

  assert.match(content, /^---\ntitle: "Late Night Sync"\ndate: 2026-04-03\n/);
  assert.match(content, /^calendar_event_id: "event-1"\n---\n\n# Late Night Sync\n$/m);
});

test("daily-note links follow the date when a meeting moves", () => {
  const options = { includeEventNotes: false, linkAttendees: false, dailyNote: { format: "YYYY-MM-DD", folder: "" } };
  const original = createNoteContent(
    buildEvent({ start: { dateTime: "2026-01-15T10:00:00-05:00" }, end: { dateTime: "2026-01-15T11:00:00-05:00" } }),
    options
  );
  assert.match(original, /^> \*\*When:\*\* \[\[2026-01-15\|Thursday, January 15, 2026\]\] · /m);

  const updated = updateNoteContent(
    original,
    buildEvent({ start: { dateTime: "2026-01-16T10:00:00-05:00" }, end: { dateTime: "2026-01-16T11:00:00-05:00" } }),
    options
  );
  assert.match(updated, /^daily_note: "\[\[2026-01-16\]\]"$/m);
  assert.match(updated, /^> \*\*When:\*\* \[\[2026-01-16\|Friday, January 16, 2026\]\] · /m);
});

test("createNoteContent labels times with the machine's time zone or the event's own offset", () => {
  const utc = createNoteContent(
    buildEvent({ start: { dateTime: "2026-07-01T14:00:00.000Z" }, end: { dateTime: "2026-07-01T15:30:00.000Z" } }),
    { includeEventNotes: false, linkAttendees: false }
  );
  assert.match(utc, /^> \*\*When:\*\* Wednesday, July 1, 2026 · 10:00 AM – 11:30 AM EDT \(1h 30m\)$/m);

  const india = createNoteContent(
    buildEvent({ start: { dateTime: "2026-07-01T09:00:00+05:30" }, end: { dateTime: "2026-07-01T10:00:00+05:30" } }),
    { includeEventNotes: false, linkAttendees: false, template: "{{start_time}} | {{end_time}} | {{time}}" }
  );
  assert.match(india, /^09:00 AM GMT\+5:30 \| 10:00 AM GMT\+5:30 \| 09:00 AM – 10:00 AM GMT\+5:30$/m);

  const acrossDst = createNoteContent(
    buildEvent({ start: { dateTime: "2026-11-01T05:30:00.000Z" }, end: { dateTime: "2026-11-01T06:30:00.000Z" } }),
    { includeEventNotes: false, linkAttendees: false, template: "{{time}}" }
  );
  assert.match(acrossDst, /^01:30 AM EDT – 01:30 AM EST$/m);
});

test("previousNoteInSeries finds the latest earlier occurrence of the same series", () => {
  const note = (path: string) => new TFile(path);
  const notes = new Map<string, TFile>([
    ["sync::2026-01-01T15:00:00.000Z", note("a.md")],
    ["sync::2026-01-08T15:00:00.000Z", note("b.md")],
    ["sync::2026-01-22T15:00:00.000Z", note("d.md")],
    ["other::2026-01-14T15:00:00.000Z", note("x.md")],
    ["sync", note("y.md")],
  ]);
  assert.equal(previousNoteInSeries(notes as never, "sync::2026-01-15T15:00:00.000Z")?.path, "b.md");
  assert.equal(previousNoteInSeries(notes as never, "sync::2026-01-01T15:00:00.000Z"), undefined);
  assert.equal(previousNoteInSeries(notes as never, "one-off"), undefined);
});

test("openTasks lists unchecked, non-empty tasks with their lines", () => {
  const content = "## Action items\n\n- [ ] Send deck\n- [x] Book room\n  * [ ] Nested item \n- [ ] \n";
  assert.deepEqual(openTasks(content), [
    { line: 2, text: "Send deck" },
    { line: 4, text: "Nested item" },
  ]);
});

test("createNoteContent links the previous meeting and carries its open action items", () => {
  const event = buildEvent({
    start: { dateTime: "2026-01-15T10:00:00-05:00" },
    end: { dateTime: "2026-01-15T11:00:00-05:00" },
  });
  const content = createNoteContent(event, {
    includeEventNotes: false,
    linkAttendees: false,
    previousNote: "Meetings/2026-01-08 - Weekly Sync",
    carriedItems: ["Send deck", "Follow up with [[Bob Jones]]"],
  });

  assert.match(content, /^previous_meeting: "\[\[Meetings\/2026-01-08 - Weekly Sync\|2026-01-08 - Weekly Sync\]\]"$/m);
  assert.match(content, /^> \*\*Previous:\*\* \[\[Meetings\/2026-01-08 - Weekly Sync\|2026-01-08 - Weekly Sync\]\]$/m);
  assert.match(
    content,
    /## Agenda\n\n- Open items from \[\[Meetings\/2026-01-08 - Weekly Sync\|last meeting\]\]:\n  - Send deck\n  - Follow up with \[\[Bob Jones\]\]\n- \n\n## Notes/
  );

  const updated = updateNoteContent(content, event, { linkAttendees: false });
  assert.doesNotMatch(updated, /previous_meeting|\*\*Previous:\*\*/);
  assert.match(updated, /Open items from/);
});

test("the built-in format keeps every section by default and drops only the ones switched off", () => {
  const event = buildEvent({ summary: "Sync" });
  const all = createNoteContent(event, { includeEventNotes: false, linkAttendees: false, template: builtInTemplate() });
  assert.equal(all, createNoteContent(event, { includeEventNotes: false, linkAttendees: false }));
  for (const heading of ["Agenda", "Notes", "Executive Summary", "Next Steps", "Summary by Topic", "Key Decisions", "Additional Items", "Speakers", "Transcript"]) {
    assert.match(all, new RegExp(`^## ${heading}$`, "m"));
  }

  const trimmed = createNoteContent(event, {
    includeEventNotes: false,
    linkAttendees: false,
    template: builtInTemplate({ ...ALL_SECTIONS, agenda: false, transcript: false }),
  });
  assert.doesNotMatch(trimmed, /## Agenda|## Transcript/);
  assert.match(trimmed, /## Notes\n\n- \n\n## Executive Summary\n\n\n\n## Next Steps\n\n- \[ \] \n\n## Summary by Topic\n\n\n\n## Key Decisions\n\n- \n\n## Additional Items\n\n- \n\n## Speakers\n\n\n$/);
});

test("setFrontmatterValue adds or replaces one property", () => {
  const out = setFrontmatterValue("---\ntitle: \"Sync\"\n---\nBody", "krisp_recording", "Sync 2026");
  assert.equal(out, "---\ntitle: \"Sync\"\nkrisp_recording: \"Sync 2026\"\n---\nBody");
  assert.equal(setFrontmatterValue("No frontmatter", "a", "b"), "No frontmatter");
});

test("addFrontmatterTags merges into list, inline and missing tags, ignoring case and #", () => {
  assert.equal(addFrontmatterTags("---\ntags:\n  - meeting\n---\nBody", ["#Acme", "MEETING"]), "---\ntags:\n  - meeting\n  - Acme\n---\nBody");
  assert.equal(addFrontmatterTags("---\ntags: [a, b]\n---\n", ["c"]), "---\ntags:\n  - a\n  - b\n  - c\n---\n");
  assert.equal(addFrontmatterTags("---\ntitle: \"x\"\n---\n", ["new"]), "---\ntitle: \"x\"\ntags:\n  - new\n---\n");
  assert.equal(addFrontmatterTags("---\ntags:\n  - a\n---\n", ["A"]), "---\ntags:\n  - a\n---\n");
});

test("findNotesByEventId indexes /RID ids without the suffix and prefers a note whose saved id already matches", () => {
  const note = (path: string, id: string) => ({ path, content: `---\ncalendar_event_id: "${id}"\n---\n` });
  const app = createMemoryApp([
    note("Moved copy.md", "S@google.com/RID=1::2026-10-07T13:30:00.000Z"),
    note("Original.md", "S@google.com::2026-10-07T13:30:00.000Z"),
    note("Moved only.md", "T@google.com/RID=1::2026-10-07T13:30:00.000Z"),
  ]);

  const byId = findNotesByEventId(app as never);

  assert.equal(byId.get("S@google.com::2026-10-07T13:30:00.000Z")?.path, "Original.md");
  assert.equal(byId.get("T@google.com::2026-10-07T13:30:00.000Z")?.path, "Moved only.md");
  assert.equal(byId.size, 2);
});

const syncedNote = (title: string, date: string, extra = "") =>
  `---\ntitle: ${title}\ndate: ${date}\nstart: ${date}T09:30\ncalendar_event_id: "s::x"\n---\n\n# Standup\n\n> [!info] Meeting details\n> **When:** ${date}\n${extra}`;
const standup = (summary: string, day: string) => buildEventFor(summary, day);
function buildEventFor(summary: string, day: string): CalendarEvent {
  return {
    id: "s::x",
    summary,
    start: { dateTime: `${day}T09:30:00-04:00` },
    end: { dateTime: `${day}T10:00:00-04:00` },
  } as CalendarEvent;
}

test("syncNoteFile renames by the date in the filename, so a rename blocked once is retried", async () => {
  const app = createMemoryApp([
    { path: "M/2026-10-07 - Standup.md", content: syncedNote('"Standup"', "2026-10-07") },
    { path: "M/2026-10-09 - Standup.md", content: "duplicate" },
  ]);
  const file = app.files.get("M/2026-10-07 - Standup.md") as TFile;

  const first = await syncNoteFile(app as never, file as never, standup("Standup", "2026-10-09"), { linkAttendees: false });
  assert.deepEqual(first, { changed: true, blockedBy: "M/2026-10-09 - Standup.md" });

  app.files.delete("M/2026-10-09 - Standup.md");
  const second = await syncNoteFile(app as never, file as never, standup("Standup", "2026-10-09"), { linkAttendees: false });
  assert.equal(second.changed, true);
  assert.equal(file.path, "M/2026-10-09 - Standup.md");
});

test("syncNoteFile renames a retitled meeting's note and heading, but keeps a name the user edited", async () => {
  const app = createMemoryApp([
    { path: "M/2026-10-07 - Standup.md", content: syncedNote("Standup", "2026-10-07") },
    { path: "M/Standup with Acme 2026-10-07.md", content: syncedNote('"Standup"', "2026-10-07").replace('"s::x"', '"s::y"') },
  ]);
  const plain = app.files.get("M/2026-10-07 - Standup.md") as TFile;
  const edited = app.files.get("M/Standup with Acme 2026-10-07.md") as TFile;
  const options = { linkAttendees: false, renameOnTitleChange: true, datePosition: "before" as const };

  await syncNoteFile(app as never, plain as never, standup("Team Sync", "2026-10-07"), options);
  await syncNoteFile(app as never, edited as never, { ...standup("Team Sync", "2026-10-08"), id: "s::y" }, options);

  assert.equal(plain.path, "M/2026-10-07 - Team Sync.md");
  assert.match(plain.content ?? "", /^# Team Sync$/m);
  assert.match(plain.content ?? "", /^title: "Team Sync"$/m);
  assert.equal(edited.path, "M/Standup with Acme 2026-10-08.md");
});

test("syncNoteFile leaves the name and heading alone on a title change when the setting is off", async () => {
  const app = createMemoryApp([{ path: "M/2026-10-07 - Standup.md", content: syncedNote('"Standup"', "2026-10-07") }]);
  const file = app.files.get("M/2026-10-07 - Standup.md") as TFile;

  await syncNoteFile(app as never, file as never, standup("Team Sync", "2026-10-07"), { linkAttendees: false, renameOnTitleChange: false });

  assert.equal(file.path, "M/2026-10-07 - Standup.md");
  assert.match(file.content ?? "", /^# Standup$/m);
  assert.deepEqual(app.renamed, []);
});

test("findDuplicateNotes groups notes for the same meeting, including /RID ids", () => {
  const note = (path: string, id: string) => ({ path, content: `---\ncalendar_event_id: "${id}"\n---\n` });
  const app = createMemoryApp([
    note("A.md", "S::2026-10-07T13:30:00.000Z"),
    note("B.md", "S/RID=1::2026-10-07T13:30:00.000Z"),
    note("C.md", "T::2026-10-07T13:30:00.000Z"),
  ]);

  assert.deepEqual(findDuplicateNotes(app as never).map((files) => files.map((f) => f.path)), [["A.md", "B.md"]]);
});

test("setSeriesLink adds the series property and a Series line after Previous, and replaces it later", () => {
  const content = "---\ntitle: \"Sync\"\ntags:\n  - meeting\n---\n\n> [!info] Meeting details\n> **When:** Friday\n> **Previous:** [[M/Old|Old]]\n> **Where:** Room\n\n## Notes\n";

  const linked = setSeriesLink(content, "Meeting Hub/Series/Sync");

  assert.match(linked, /^series: "\[\[Meeting Hub\/Series\/Sync\|Sync\]\]"\ntags:/m);
  assert.match(linked, /> \*\*Previous:\*\* \[\[M\/Old\|Old\]\]\n> \*\*Series:\*\* \[\[Meeting Hub\/Series\/Sync\|Sync\]\]\n> \*\*Where:\*\* Room/);
  assert.equal(setSeriesLink(linked, "Meeting Hub/Series/Sync"), linked);
  assert.match(setSeriesLink(linked, "Hub/Sync (2)"), /> \*\*Series:\*\* \[\[Hub\/Sync \(2\)\|Sync \(2\)\]\]\n> \*\*Where/);
});

test("createNoteContent puts the last meeting's continuity points first in the Agenda", () => {
  const content = createNoteContent(buildEvent({}), {
    includeEventNotes: false,
    linkAttendees: false,
    previousNote: "Meetings/Weekly Sync",
    carriedContinuity: ["Confirm the [[XYZ]] POV scope", "TLS decryption pilot status"],
    carriedItems: ["Send deck"],
  });
  assert.match(content, /## Agenda\n\n- Where we left off in \[\[Meetings\/Weekly Sync\|last meeting\]\]:\n  - Confirm the \[\[XYZ\]\] POV scope\n  - TLS decryption pilot status\n- Open items from \[\[Meetings\/Weekly Sync\|last meeting\]\]:\n  - Send deck\n- \n/);
});

test("findDuplicateNotes never groups different occurrences, even with one saved id", () => {
  const note = (path: string, id: string, date: string) => ({ path, content: `---\ndate: ${date}\ncalendar_event_id: "${id}"\n---\n` });
  const app = createMemoryApp([
    note("2026-10-07 - Sync.md", "S@google.com/RID=813072600", "2026-10-09"),
    note("2026-10-14 - Sync.md", "S@google.com/RID=813677400", "2026-10-16"),
    note("2026-10-06 - Weekly.md", "WEEKLY", "2026-10-06"),
    note("2026-10-13 - Weekly.md", "WEEKLY", "2026-10-13"),
    note("Copy of 2026-10-13 - Weekly.md", "WEEKLY", "2026-10-13"),
  ]);
  assert.deepEqual(findDuplicateNotes(app as never).map((files) => files.map((f) => f.path)), [["2026-10-13 - Weekly.md", "Copy of 2026-10-13 - Weekly.md"]]);
});

test("movedAfterItStarted is true only when a meeting that had started is now on another day", () => {
  const now = new Date("2026-04-06T08:00:00-04:00");
  const monday = buildEvent({ start: { dateTime: "2026-04-06T09:00:00-04:00" }, end: { dateTime: "2026-04-06T09:30:00-04:00" } });
  assert.equal(movedAfterItStarted({ date: "2026-04-03", start: "2026-04-03T10:00" }, monday, now), true);
  assert.equal(movedAfterItStarted({ date: "2026-04-07", start: "2026-04-07T10:00" }, monday, now), false, "not started yet");
  assert.equal(movedAfterItStarted({ date: "2026-04-06", start: "2026-04-06T07:00" }, monday, now), false, "same day");
  assert.equal(movedAfterItStarted({ date: "2026-04-03" }, monday, now), true, "all-day note");
  assert.equal(movedAfterItStarted({}, monday, now), false);
});
