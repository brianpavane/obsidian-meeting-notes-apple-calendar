import test from "node:test";
import assert from "node:assert/strict";
import GoogleCalendarPlugin from "../src/main";
import { DEFAULT_SETTINGS } from "../src/settings";
import {
  App,
  getNotices,
  MarkdownView,
  resetObsidianTestState,
  TFile,
  WorkspaceLeaf,
} from "./support/obsidianStub";
import { createMemoryApp, buildEvent } from "./support/testHelpers";
import { mkdtemp, mkdir, writeFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

function createPlugin(app?: App): GoogleCalendarPlugin {
  const plugin = new GoogleCalendarPlugin(
    (app ?? createMemoryApp()) as never,
    {
      id: "calendar-note-integration",
      name: "Calendar Note Integration",
      author: "Test",
      minAppVersion: "1.0.0",
      description: "Test manifest",
      version: "test",
    } as never
  ) as GoogleCalendarPlugin;
  plugin.now = () => new Date("2026-04-03T06:00:00-04:00");
  return plugin;
}

test.afterEach(() => {
  resetObsidianTestState();
});

test("loadSettings clamps numeric values and sanitizes invalid fields", async () => {
  const plugin = createPlugin();
  plugin.loadData = async () => ({
    daysAhead: 99,
    maxEvents: 0,
    hoursInAdvance: "500",
    pollIntervalMinutes: 1,
    daysBack: -5,
    includePastEvents: "yes",
    includeEventNotes: "no",
    linkAttendees: null,
    datePosition: "sideways",
    processedEventIds: "not-an-array",
  });

  await plugin.loadSettings();

  assert.equal(plugin.settings.daysAhead, 30);
  assert.equal(plugin.settings.maxEvents, 20);
  assert.equal(plugin.settings.hoursInAdvance, 48);
  assert.equal(plugin.settings.pollIntervalMinutes, 5);
  assert.equal(plugin.settings.daysBack, 1);
  assert.equal(plugin.settings.includePastEvents, false);
  assert.equal(plugin.settings.includeEventNotes, true);
  assert.equal(plugin.settings.linkAttendees, false);
  assert.equal(plugin.settings.datePosition, "before");
  assert.deepEqual(plugin.settings.processedEventIds, []);
});

test("refreshNotes bootstraps existing files and only creates genuinely new notes", async () => {
  const app = createMemoryApp([
    { path: "Meeting Notes/2026-04-03 - Existing.md", content: "existing" },
    { path: "Meeting Notes", content: "" },
  ]);
  const plugin = createPlugin(app);
  plugin.settings = {
    ...DEFAULT_SETTINGS,
    authMode: "apple",
    noteFolder: "Meeting Notes",
    processedEventIds: [],
  };

  const existingEvent = buildEvent({
    id: "existing-id",
    summary: "Existing",
    start: { dateTime: "2026-04-03T10:00:00-04:00" },
    end: { dateTime: "2026-04-03T11:00:00-04:00" },
  });
  const newEvent = buildEvent({
    id: "new-id",
    summary: "New Event",
    start: { dateTime: "2026-04-03T12:00:00-04:00" },
    end: { dateTime: "2026-04-03T13:00:00-04:00" },
  });

  plugin.getCalendarService = async () =>
    ({
      queriedCalendars: () => undefined,
      fetchedEvents: () => undefined,
      listEventsInTimeWindow: async () => [existingEvent, newEvent],
    } as never);

  await plugin.refreshNotes(true);

  assert.deepEqual(plugin.settings.processedEventIds.sort(), ["existing-id", "new-id"]);
  assert.deepEqual(app.createdPaths, ["Meeting Notes/2026-04-03 - New Event.md"]);
  assert.match(getNotices().at(-1)?.message ?? "", /Created 1 note/);
});

test("refreshNotes filters all-day and declined self events", async () => {
  const app = createMemoryApp([{ path: "Meeting Notes", content: "" }]);
  const plugin = createPlugin(app);
  plugin.settings = {
    ...DEFAULT_SETTINGS,
    authMode: "apple",
    selfEmail: "me@example.com",
    noteFolder: "Meeting Notes",
    processedEventIds: [],
  };

  plugin.getCalendarService = async () =>
    ({
      queriedCalendars: () => undefined,
      fetchedEvents: () => undefined,
      listEventsInTimeWindow: async () => [
        buildEvent({ id: "all-day", start: { date: "2026-04-03" }, end: { date: "2026-04-04" } }),
        buildEvent({
          id: "declined",
          attendees: [{ email: "me@example.com", responseStatus: "declined" }],
        }),
        buildEvent({
          id: "accepted",
          summary: "Accepted Meeting",
          attendees: [{ email: "me@example.com", responseStatus: "accepted" }],
        }),
      ],
    } as never);

  await plugin.refreshNotes(false);

  assert.deepEqual(app.createdPaths, ["Meeting Notes/2026-04-03 - Accepted Meeting.md"]);
  assert.deepEqual(plugin.settings.processedEventIds, ["accepted"]);
});

test("refreshNotes filters events declined by the calendar's self attendee without selfEmail", async () => {
  const app = createMemoryApp([{ path: "Meeting Notes", content: "" }]);
  const plugin = createPlugin(app);
  plugin.settings = {
    ...DEFAULT_SETTINGS,
    authMode: "apple",
    selfEmail: "",
    noteFolder: "Meeting Notes",
    processedEventIds: [],
  };

  plugin.getCalendarService = async () =>
    ({
      queriedCalendars: () => undefined,
      fetchedEvents: () => undefined,
      listEventsInTimeWindow: async () => [
        buildEvent({
          id: "declined",
          attendees: [{ email: "me@example.com", self: true, responseStatus: "declined" }],
        }),
        buildEvent({
          id: "other-declined",
          summary: "Someone Else Declined",
          attendees: [{ email: "them@example.com", responseStatus: "declined" }],
        }),
      ],
    } as never);

  await plugin.refreshNotes(false);

  assert.deepEqual(app.createdPaths, ["Meeting Notes/2026-04-03 - Someone Else Declined.md"]);
  assert.deepEqual(plugin.settings.processedEventIds, ["other-declined"]);
});

test("rebuildNotes recreates deleted files even if the event was already processed", async () => {
  const app = createMemoryApp([{ path: "Meeting Notes", content: "" }]);
  const plugin = createPlugin(app);
  plugin.settings = {
    ...DEFAULT_SETTINGS,
    authMode: "apple",
    noteFolder: "Meeting Notes",
    processedEventIds: ["event-1"],
  };

  plugin.getCalendarService = async () =>
    ({
      queriedCalendars: () => undefined,
      fetchedEvents: () => undefined,
      listEventsInTimeWindow: async () => [buildEvent()],
    } as never);

  await plugin.rebuildNotes(true);

  assert.deepEqual(app.createdPaths, ["Meeting Notes/2026-04-03 - Team Sync.md"]);
  assert.deepEqual(plugin.settings.processedEventIds, ["event-1"]);
  assert.match(getNotices().at(-1)?.message ?? "", /Created 1 note/);
});

test("createNoteForNextEvent opens the next filtered event file", async () => {
  const app = createMemoryApp([{ path: "Meeting Notes", content: "" }]);
  const plugin = createPlugin(app);
  plugin.settings = {
    ...DEFAULT_SETTINGS,
    authMode: "apple",
    noteFolder: "Meeting Notes",
    selfEmail: "me@example.com",
  };

  plugin.getCalendarService = async () =>
    ({
      listUpcomingEvents: async () => [
        buildEvent({
          id: "declined",
          attendees: [{ email: "me@example.com", responseStatus: "declined" }],
        }),
        buildEvent({
          id: "next",
          summary: "Next Event",
          attendees: [{ email: "me@example.com", responseStatus: "accepted" }],
        }),
      ],
    } as never);

  await plugin.createNoteForNextEvent();

  assert.deepEqual(app.openedFiles, ["Meeting Notes/2026-04-03 - Next Event.md"]);
  assert.match(getNotices().at(-1)?.message ?? "", /Note ready:/);
});

function appleSettings(overrides: Partial<typeof DEFAULT_SETTINGS> = {}) {
  return {
    ...DEFAULT_SETTINGS,
    authMode: "apple" as const,
    noteFolder: "Meeting Notes",
    processedEventIds: [],
    ...overrides,
  };
}

test("refreshNotes updates an existing note and renames it when the meeting moves day", async () => {
  const app = createMemoryApp([{ path: "Meeting Notes", content: "" }]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings();

  const original = buildEvent({ id: "moving", summary: "Planning", location: "Room B" });
  plugin.getCalendarService = async () =>
    ({ queriedCalendars: () => undefined, fetchedEvents: () => undefined, listEventsInTimeWindow: async () => [original] } as never);
  await plugin.refreshNotes(false);

  const file = app.files.get("Meeting Notes/2026-04-03 - Planning.md") as TFile;
  file.content = (file.content ?? "").replace("## Notes\n\n- ", "## Notes\n\n- Prep slides");

  const moved = buildEvent({
    id: "moving",
    summary: "Planning",
    start: { dateTime: "2026-04-06T09:00:00-04:00" },
    end: { dateTime: "2026-04-06T09:30:00-04:00" },
  });
  plugin.getCalendarService = async () =>
    ({ queriedCalendars: () => undefined, fetchedEvents: () => undefined, listEventsInTimeWindow: async () => [moved] } as never);
  await plugin.refreshNotes(true);

  assert.deepEqual(app.renamed, [
    ["Meeting Notes/2026-04-03 - Planning.md", "Meeting Notes/2026-04-06 - Planning.md"],
  ]);
  const content = (app.files.get("Meeting Notes/2026-04-06 - Planning.md") as TFile).content ?? "";
  assert.match(content, /^start: 2026-04-06T09:00$/m);
  assert.doesNotMatch(content, /^location:/m);
  assert.match(content, /- Prep slides/);
  assert.equal(app.createdPaths.length, 1);
  assert.match(getNotices().at(-1)?.message ?? "", /Updated 1 note/);
});

test("refreshNotes marks an existing note cancelled but never creates notes for cancelled events", async () => {
  const app = createMemoryApp([{ path: "Meeting Notes", content: "" }]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings();

  plugin.getCalendarService = async () =>
    ({ queriedCalendars: () => undefined, fetchedEvents: () => undefined, listEventsInTimeWindow: async () => [buildEvent({ id: "a", summary: "Kept" })] } as never);
  await plugin.refreshNotes(false);

  plugin.getCalendarService = async () =>
    ({
      queriedCalendars: () => undefined,
      fetchedEvents: () => undefined,
      listEventsInTimeWindow: async () => [
        buildEvent({ id: "a", summary: "Kept", cancelled: true }),
        buildEvent({ id: "b", summary: "Never", cancelled: true }),
      ],
    } as never);
  await plugin.refreshNotes(false);

  assert.deepEqual(app.createdPaths, ["Meeting Notes/2026-04-03 - Kept.md"]);
  const content = (app.files.get("Meeting Notes/2026-04-03 - Kept.md") as TFile).content ?? "";
  assert.match(content, /^status: cancelled$/m);
  assert.match(content, /^> \[!danger\] Meeting cancelled$/m);
});

test("runStartupSweep rebuilds once after an upgrade, then refreshes", async () => {
  const app = createMemoryApp([{ path: "Meeting Notes", content: "" }]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings({ processedEventIds: ["deleted"], lastRunVersion: "6.6.1" });
  plugin.getCalendarService = async () =>
    ({ queriedCalendars: () => undefined, fetchedEvents: () => undefined, listEventsInTimeWindow: async () => [buildEvent({ id: "deleted", summary: "Back" })] } as never);

  await plugin.runStartupSweep();
  assert.deepEqual(app.createdPaths, ["Meeting Notes/2026-04-03 - Back.md"]);
  assert.equal(plugin.settings.lastRunVersion, "test");

  app.files.delete("Meeting Notes/2026-04-03 - Back.md");
  await plugin.runStartupSweep();
  assert.deepEqual(app.createdPaths, ["Meeting Notes/2026-04-03 - Back.md"]);
});

test("runStartupSweep retries the upgrade rebuild if the calendar can't be read", async () => {
  const plugin = createPlugin();
  plugin.settings = appleSettings({ lastRunVersion: "6.6.1" });
  plugin.getCalendarService = async () => {
    throw new Error("Calendar unavailable");
  };

  await plugin.runStartupSweep();

  assert.equal(plugin.settings.lastRunVersion, "6.6.1");
});

test("refreshNotes leaves unchanged notes untouched", async () => {
  const app = createMemoryApp([{ path: "Meeting Notes", content: "" }]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings();
  plugin.getCalendarService = async () =>
    ({ queriedCalendars: () => undefined, fetchedEvents: () => undefined, listEventsInTimeWindow: async () => [buildEvent({ id: "same", summary: "Same" })] } as never);
  await plugin.refreshNotes(false);

  let writes = 0;
  const process = app.vault.process;
  app.vault.process = async (file, fn) => {
    writes++;
    return process(file, fn);
  };
  await plugin.refreshNotes(true);

  assert.equal(writes, 0);
  assert.match(getNotices().at(-1)?.message ?? "", /All notes are up to date/);
});

test("refreshNotes uses the template note and the Daily Notes format", async () => {
  const app = createMemoryApp([
    { path: "Meeting Notes", content: "" },
    { path: "Templates/Meeting.md", content: "# {{title}}\n\nDay: {{daily_note}}\n" },
  ]);
  (app as unknown as { internalPlugins: unknown }).internalPlugins = {
    getPluginById: (id: string) =>
      id === "daily-notes" ? { instance: { options: { format: "YYYY/MM/DD", folder: "Journal" } } } : null,
  };
  const plugin = createPlugin(app);
  plugin.settings = appleSettings({ templatePath: "Templates/Meeting" });
  plugin.getCalendarService = async () =>
    ({ queriedCalendars: () => undefined, fetchedEvents: () => undefined, listEventsInTimeWindow: async () => [buildEvent({ id: "t", summary: "Templated" })] } as never);

  await plugin.refreshNotes(false);

  const content = (app.files.get("Meeting Notes/2026-04-03 - Templated.md") as TFile).content ?? "";
  assert.match(content, /^# Templated$/m);
  assert.match(content, /^Day: \[\[Journal\/2026\/04\/03\|03\]\]$/m);
  assert.match(content, /^calendar_event_id: "t"$/m);
});

test("refreshNotes falls back to the built-in format when the template is missing", async () => {
  const app = createMemoryApp([{ path: "Meeting Notes", content: "" }]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings({ templatePath: "Templates/Missing.md", dailyNoteLink: false });
  plugin.getCalendarService = async () =>
    ({ queriedCalendars: () => undefined, fetchedEvents: () => undefined, listEventsInTimeWindow: async () => [buildEvent({ id: "m", summary: "Fallback" })] } as never);

  await plugin.refreshNotes(true);

  const content = (app.files.get("Meeting Notes/2026-04-03 - Fallback.md") as TFile).content ?? "";
  assert.match(content, /^> \[!info\] Meeting details$/m);
  assert.doesNotMatch(content, /daily_note/);
  assert.ok(getNotices().some((n) => /template "Templates\/Missing\.md" not found/.test(n.message)));
});

function appleService(events: ReturnType<typeof buildEvent>[], calendars: string[], all?: ReturnType<typeof buildEvent>[]) {
  return async () =>
    ({
      queriedCalendars: () => calendars,
      fetchedEvents: () => all ?? events,
      listEventsInTimeWindow: async () => events,
    } as never);
}

test("refreshNotes marks notes of meetings deleted from the calendar, and restores them", async () => {
  const app = createMemoryApp([{ path: "Meeting Notes", content: "" }]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings({ dailyNoteLink: false });

  const work = buildEvent({ id: "w", summary: "Work Sync", calendarName: "Work" });
  const home = buildEvent({ id: "h", summary: "Dentist", calendarName: "Home" });
  plugin.getCalendarService = appleService([work, home], ["Work", "Home"]);
  await plugin.refreshNotes(false);

  // "w" is deleted; "Home" is no longer selected, so its note must be left alone.
  plugin.getCalendarService = appleService([], ["Work"]);
  await plugin.refreshNotes(true);

  const workNote = () => (app.files.get("Meeting Notes/2026-04-03 - Work Sync.md") as TFile).content ?? "";
  const homeNote = (app.files.get("Meeting Notes/2026-04-03 - Dentist.md") as TFile).content ?? "";
  assert.match(workNote(), /^status: removed$/m);
  assert.match(workNote(), /^> \[!danger\] Meeting removed from calendar$/m);
  assert.doesNotMatch(homeNote, /status:/);
  assert.match(getNotices().at(-1)?.message ?? "", /Marked 1 note removed from calendar/);

  plugin.getCalendarService = appleService([work], ["Work"]);
  await plugin.refreshNotes(false);
  assert.doesNotMatch(workNote(), /^status:/m);
  assert.match(workNote(), /^> \[!info\] Meeting details$/m);
});

test("refreshNotes renames the note of a meeting moved outside the window, without marking it removed", async () => {
  const app = createMemoryApp([{ path: "Meeting Notes", content: "" }]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings();
  const meeting = buildEvent({ id: "moved", summary: "Moved", calendarName: "Work" });
  plugin.getCalendarService = appleService([meeting], ["Work"]);
  await plugin.refreshNotes(false);

  const later = buildEvent({
    id: "moved",
    summary: "Moved",
    calendarName: "Work",
    start: { dateTime: "2026-04-09T10:00:00-04:00" },
    end: { dateTime: "2026-04-09T11:00:00-04:00" },
  });
  plugin.getCalendarService = appleService([], ["Work"], [later]);
  await plugin.refreshNotes(false);

  assert.deepEqual(app.renamed, [
    ["Meeting Notes/2026-04-03 - Moved.md", "Meeting Notes/2026-04-09 - Moved.md"],
  ]);
  const content = (app.files.get("Meeting Notes/2026-04-09 - Moved.md") as TFile).content ?? "";
  assert.match(content, /^start: 2026-04-09T10:00$/m);
  assert.doesNotMatch(content, /status:/);
  assert.equal(app.createdPaths.length, 1);
});

test("refreshNotes keeps the note of a meeting moved to another day after it started, and creates a new one", async () => {
  const app = createMemoryApp([{ path: "Meeting Notes", content: "" }]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings();
  plugin.getCalendarService = appleService([buildEvent({ id: "m", summary: "Planning", calendarName: "Work" })], ["Work"]);
  await plugin.refreshNotes(false);

  const friday = app.files.get("Meeting Notes/2026-04-03 - Planning.md") as TFile;
  friday.content = (friday.content ?? "").replace("## Notes\n\n- ", "## Notes\n\n- Agreed the budget\n- [ ] Send the deck");
  const before = friday.content;

  plugin.now = () => new Date("2026-04-06T08:00:00-04:00");
  const monday = buildEvent({
    id: "m", summary: "Planning", calendarName: "Work",
    start: { dateTime: "2026-04-06T09:00:00-04:00" }, end: { dateTime: "2026-04-06T09:30:00-04:00" },
  });
  plugin.getCalendarService = appleService([monday], ["Work"]);
  await plugin.refreshNotes(false);

  assert.deepEqual(app.renamed, []);
  assert.equal(friday.path, "Meeting Notes/2026-04-03 - Planning.md");
  assert.equal(friday.content, before.replace(/^(tags:)/m, "moved_to: 2026-04-06\n$1"));
  const newNote = (app.files.get("Meeting Notes/2026-04-06 - Planning.md") as TFile).content ?? "";
  assert.match(newNote, /^start: 2026-04-06T09:00$/m);
  assert.match(newNote, /^previous_meeting: ".*2026-04-03 - Planning.*"$/m);
  assert.match(newNote, /Send the deck/);
  assert.doesNotMatch(newNote, /Agreed the budget/);
  assert.match(getNotices().at(-1)?.message ?? "", /Created 1 note, kept "2026-04-03 - Planning" as it was/);

  await plugin.refreshNotes(false);
  assert.equal(app.createdPaths.length, 2);
  assert.deepEqual(app.renamed, []);
  assert.equal(friday.content, before.replace(/^(tags:)/m, "moved_to: 2026-04-06\n$1"));
});

test("a meeting moved after it started to a day outside the window gets its new note once that day is in the window", async () => {
  const app = createMemoryApp([{ path: "Meeting Notes", content: "" }]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings();
  plugin.getCalendarService = appleService([buildEvent({ id: "m", summary: "Planning", calendarName: "Work" })], ["Work"]);
  await plugin.refreshNotes(false);

  plugin.now = () => new Date("2026-04-03T12:00:00-04:00");
  const later = buildEvent({
    id: "m", summary: "Planning", calendarName: "Work",
    start: { dateTime: "2026-04-09T10:00:00-04:00" }, end: { dateTime: "2026-04-09T11:00:00-04:00" },
  });
  plugin.getCalendarService = appleService([], ["Work"], [later]);
  await plugin.refreshNotes(false);

  const friday = (app.files.get("Meeting Notes/2026-04-03 - Planning.md") as TFile).content ?? "";
  assert.match(friday, /^moved_to: 2026-04-09$/m);
  assert.match(friday, /^start: 2026-04-03T10:00$/m);
  assert.doesNotMatch(friday, /^status:/m);
  assert.equal(app.createdPaths.length, 1);

  plugin.now = () => new Date("2026-04-09T06:00:00-04:00");
  plugin.getCalendarService = appleService([later], ["Work"]);
  await plugin.refreshNotes(false);
  const thursday = (app.files.get("Meeting Notes/2026-04-09 - Planning.md") as TFile).content ?? "";
  assert.match(thursday, /^previous_meeting: ".*2026-04-03 - Planning.*"$/m);
  assert.deepEqual(app.renamed, []);
});

test("refreshNotes does not create notes for meetings outside the window", async () => {
  const app = createMemoryApp([{ path: "Meeting Notes", content: "" }]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings();
  const later = buildEvent({
    id: "later",
    summary: "Later",
    calendarName: "Work",
    start: { dateTime: "2026-04-09T10:00:00-04:00" },
    end: { dateTime: "2026-04-09T11:00:00-04:00" },
  });
  plugin.getCalendarService = appleService([], ["Work"], [later]);
  await plugin.refreshNotes(false);

  assert.deepEqual(app.createdPaths, []);
});

test("a failed background sync shows one notice until a sync succeeds", async () => {
  const plugin = createPlugin();
  plugin.settings = appleSettings();
  plugin.getCalendarService = async () => {
    throw new Error("Calendar unavailable");
  };

  await plugin.refreshNotes(false);
  await plugin.refreshNotes(false);
  assert.equal(getNotices().filter((n) => /couldn't read your calendar/.test(n.message)).length, 1);

  plugin.getCalendarService = appleService([], []);
  await plugin.refreshNotes(false);
  plugin.getCalendarService = async () => {
    throw new Error("Calendar unavailable");
  };
  await plugin.refreshNotes(false);
  assert.equal(getNotices().filter((n) => /couldn't read your calendar/.test(n.message)).length, 2);
});

test("joinMeeting opens the meeting's note and its join link", async () => {
  const app = createMemoryApp([{ path: "Meeting Notes", content: "" }]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings();
  plugin.now = () => new Date("2026-04-03T09:50:00-04:00");
  const opened: string[] = [];
  (globalThis as unknown as { window: unknown }).window = { open: (url: string) => opened.push(url) };

  plugin.getCalendarService = appleService(
    [
      buildEvent({
        id: "j",
        summary: "Standup",
        conferenceData: {
          conferenceSolution: { name: "Zoom" },
          entryPoints: [{ entryPointType: "video", uri: "https://zoom.us/j/555" }],
        },
      }),
    ],
    []
  );
  await plugin.joinMeeting();

  assert.deepEqual(opened, ["https://zoom.us/j/555"]);
  assert.deepEqual(app.openedFiles, ["Meeting Notes/2026-04-03 - Standup.md"]);
});

test("joinMeeting does nothing when no meeting is near", async () => {
  const plugin = createPlugin();
  plugin.settings = appleSettings();
  plugin.now = () => new Date("2026-04-03T06:00:00-04:00");
  plugin.getCalendarService = appleService([buildEvent({ id: "late" })], []);

  await plugin.joinMeeting();

  assert.match(getNotices().at(-1)?.message ?? "", /No meeting in progress or starting in the next 30 minutes/);
});

test("openDashboard creates the Bases file once and opens it", async () => {
  const app = createMemoryApp();
  const plugin = createPlugin(app);
  plugin.settings = appleSettings();

  await plugin.openDashboard();
  await plugin.openDashboard();

  assert.deepEqual(app.createdPaths, ["Meeting Notes/Meetings.base"]);
  assert.deepEqual(app.openedFiles, ["Meeting Notes/Meetings.base", "Meeting Notes/Meetings.base"]);
  const content = (app.files.get("Meeting Notes/Meetings.base") as TFile).content ?? "";
  assert.match(content, /file\.hasProperty\("calendar_event_id"\)/);
});

test("refreshNotes links each recurring meeting to the previous one and carries open items", async () => {
  const app = createMemoryApp([{ path: "Meeting Notes", content: "" }]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings({ hoursInAdvance: 48 });

  const occurrence = (day: string) => buildEvent({
    id: `weekly::2026-04-0${day}T14:00:00.000Z`,
    summary: "Weekly Sync",
    start: { dateTime: `2026-04-0${day}T10:00:00-04:00` },
    end: { dateTime: `2026-04-0${day}T10:30:00-04:00` },
  });
  plugin.getCalendarService = async () =>
    ({ queriedCalendars: () => undefined, fetchedEvents: () => undefined, listEventsInTimeWindow: async () => [occurrence("3")] } as never);
  await plugin.refreshNotes(false);

  const first = app.files.get("Meeting Notes/2026-04-03 - Weekly Sync.md") as TFile;
  first.content = (first.content ?? "").replace("## Next Steps\n\n- [ ] ", "## Next Steps\n\n- [ ] Send deck\n- [x] Book room\n- [ ] ");

  plugin.getCalendarService = async () =>
    ({ queriedCalendars: () => undefined, fetchedEvents: () => undefined, listEventsInTimeWindow: async () => [occurrence("3"), occurrence("4")] } as never);
  await plugin.refreshNotes(false);

  const second = (app.files.get("Meeting Notes/2026-04-04 - Weekly Sync.md") as TFile).content ?? "";
  assert.match(second, /^> \*\*Previous:\*\* \[\[Meeting Notes\/2026-04-03 - Weekly Sync\|2026-04-03 - Weekly Sync\]\]$/m);
  assert.match(second, /- Open items from \[\[Meeting Notes\/2026-04-03 - Weekly Sync\|last meeting\]\]:\n  - Send deck\n- \n/);
  assert.doesNotMatch(second, /Book room/);
  assert.doesNotMatch(first.content ?? "", /Previous:/);
});

test("loadDayEvents reads the given day midnight to midnight and drops all-day and declined meetings", async () => {
  const plugin = createPlugin();
  plugin.settings = appleSettings({ selfEmail: "me@example.com" });
  let window: [Date, Date] | undefined;
  plugin.getCalendarService = async () =>
    ({
      queriedCalendars: () => undefined,
      fetchedEvents: () => undefined,
      listEventsInTimeWindow: async (min: Date, max: Date) => {
        window = [min, max];
        return [
          buildEvent({ id: "kept" }),
          buildEvent({ id: "all-day", start: { date: "2026-04-03" }, end: { date: "2026-04-04" } }),
          buildEvent({ id: "declined", attendees: [{ email: "me@example.com", responseStatus: "declined" }] }),
        ];
      },
    } as never);

  const events = await plugin.loadDayEvents(new Date(2026, 3, 4));
  assert.deepEqual(events?.map((e) => e.id), ["kept"]);
  assert.deepEqual(window?.map((d) => d.getTime()), [
    new Date(2026, 3, 4).getTime(),
    new Date(2026, 3, 5).getTime(),
  ]);
});

const serviceFor = (events: ReturnType<typeof buildEvent>[]) => async () =>
  ({
    queriedCalendars: () => undefined,
    fetchedEvents: () => undefined,
    listEventsInTimeWindow: async () => events,
  } as never);

test("refreshNotes skips listed titles and solo events for new notes but still updates existing ones", async () => {
  const app = createMemoryApp([
    { path: "Meeting Notes/2026-04-03 - Lunch.md", content: "---\ntitle: \"Lunch\"\ncalendar_event_id: \"lunch\"\n---\n" },
  ]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings({ skipTitles: "lunch\nfocus", skipSolo: true });
  const other = [{ email: "bob@example.com" }];
  plugin.getCalendarService = serviceFor([
    buildEvent({ id: "lunch", summary: "Lunch", location: "Cafe", attendees: other }),
    buildEvent({ id: "focus", summary: "Focus block", attendees: other }),
    buildEvent({ id: "solo", summary: "Prep", attendees: [] }),
    buildEvent({ id: "sync", summary: "Sync", attendees: other }),
  ]);

  await plugin.refreshNotes(false);

  assert.deepEqual(app.createdPaths, ["Meeting Notes/2026-04-03 - Sync.md"]);
  assert.match((app.files.get("Meeting Notes/2026-04-03 - Lunch.md") as TFile).content ?? "", /^location: "Cafe"$/m);
  assert.ok(!plugin.settings.processedEventIds.includes("focus"));
});

test("notes filed outside the note folder are still found, updated and opened", async () => {
  const app = createMemoryApp([
    { path: "Clients/Acme/2026/Q2/Projects/Launch/2026-04-03 - Sync.md", content: "---\ntitle: \"Sync\"\ncalendar_event_id: \"sync\"\n---\n\n## Notes\n\n- Mine\n" },
  ]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings();
  const event = buildEvent({ id: "sync", summary: "Sync", location: "Room 4" });
  plugin.getCalendarService = serviceFor([event]);

  await plugin.refreshNotes(false);
  await plugin.openNoteForEvent(event);

  assert.deepEqual(app.createdPaths, []);
  assert.deepEqual(app.openedFiles, ["Clients/Acme/2026/Q2/Projects/Launch/2026-04-03 - Sync.md"]);
  assert.match((app.files.get("Clients/Acme/2026/Q2/Projects/Launch/2026-04-03 - Sync.md") as TFile).content ?? "", /^location: "Room 4"$/m);

  plugin.getCalendarService = serviceFor([{ ...event, start: { dateTime: "2026-04-04T10:00:00-04:00" }, end: { dateTime: "2026-04-04T11:00:00-04:00" } }]);
  await plugin.refreshNotes(false);
  assert.deepEqual(app.renamed, [[
    "Clients/Acme/2026/Q2/Projects/Launch/2026-04-03 - Sync.md",
    "Clients/Acme/2026/Q2/Projects/Launch/2026-04-04 - Sync.md",
  ]]);
});

test("Krisp transcripts are only proposed, never written, until an import is confirmed", async () => {
  const root = await mkdtemp(join(tmpdir(), "krisp-main-"));
  try {
    const folder = "Weekly Sync - April 2, 2026 10-01-30 AM";
    await mkdir(join(root, folder));
    await writeFile(join(root, folder, "transcript.txt"), "Weekly Sync - April 2, 2026 10-01-30 AM\nApril 2, 2026 10:01:30 AM\n30m 2s\n\n\nYou\n0:01 - hello");
    const noteText = (title: string, start: string, end: string) =>
      `---\ntitle: "${title}"\nstart: ${start}\nend: ${end}\ncalendar_event_id: "${title}"\n---\n\n## Notes\n\n- \n\n## Transcript\n\n`;
    const app = createMemoryApp([
      { path: "Projects/Weekly Sync.md", content: noteText("Weekly Sync", "2026-04-02T10:00", "2026-04-02T10:30") },
      { path: "Meeting Notes/Later.md", content: noteText("Later", "2026-04-03T10:00", "2026-04-03T11:00") },
    ]);
    const plugin = createPlugin(app);
    plugin.settings = appleSettings({ krispFolder: root, krispAutoImport: true });
    plugin.getCalendarService = serviceFor([]);
    const note = app.files.get("Projects/Weekly Sync.md") as TFile;
    const before = note.content;

    await plugin.refreshNotes(false);
    assert.equal(note.content, before, "a sync only asks");

    const proposals = await plugin.transcriptProposals();
    assert.deepEqual(proposals.map((p) => [p.file.path, p.candidates.map((r) => r.name)]), [["Projects/Weekly Sync.md", [folder]]]);

    assert.equal(await plugin.importTranscripts([{ file: note as never, recording: proposals[0].candidates[0] }]), 1);
    assert.match(note.content ?? "", /## Transcript\n\nYou\n0:01 - hello\n$/);
    assert.match(note.content ?? "", new RegExp(`^krisp_recording: "${folder}"$`, "m"));
    assert.match(note.content ?? "", /## Notes\n\n- \n/);

    assert.deepEqual(await plugin.transcriptProposals(), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("loadSettings keeps every note section on unless switched off", async () => {
  const plugin = createPlugin();
  plugin.loadData = async () => ({ noteSections: { transcript: false, agenda: "no" }, skipSolo: "yes", krispFolder: 5 });
  await plugin.loadSettings();
  assert.deepEqual(plugin.settings.noteSections, {
    agenda: true, notes: true, summary: true, actionItems: true, topics: true, decisions: true, additional: true, speakers: true, transcript: false,
  });
  assert.equal(plugin.settings.skipSolo, false);
  assert.equal(plugin.settings.krispFolder, "~/Documents/Transcripts/Krisp Meetings");
  assert.equal(plugin.settings.krispAutoImport, false);
  assert.equal(plugin.settings.aiIncludeInstructions, true);
  assert.equal(plugin.settings.aiInstructions, "");
  assert.equal(plugin.settings.aiSaveProperties, true);
});

test("Copy meeting for AI assistant leaves out the instructions when switched off, and uses custom ones", async () => {
  const app = createMemoryApp([
    { path: "Clients/Acme/Sync.md", content: "---\ntitle: \"Sync\"\ndate: 2026-04-02\nstart: 2026-04-02T10:00\nend: 2026-04-02T10:30\ncalendar_event_id: \"sync\"\n---\n\n## Notes\n\n- Mine\n\n## Transcript\n\n" },
  ]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings();
  const file = app.files.get("Clients/Acme/Sync.md") as never;

  assert.match(await plugin.assistantCopyText(file) ?? "", /^Write up the meeting below[\s\S]*\n\nMEETING DETAILS\nTitle: Sync\nDate: 2026-04-02\nTime: /);
  plugin.settings.aiInstructions = "Be brief.";
  assert.match(await plugin.assistantCopyText(file) ?? "", /^Be brief\.\n\nMEETING DETAILS\n/);
  plugin.settings.aiIncludeInstructions = false;
  assert.match(await plugin.assistantCopyText(file) ?? "", /^MEETING DETAILS\n/);
});

test("Add AI reply files an agent report into a filed note and rejects unrelated text", async () => {
  const app = createMemoryApp([
    { path: "Clients/Acme/2026/Sync.md", content: "---\ntitle: \"Sync\"\ncalendar_event_id: \"sync\"\n---\n\n## Decisions\n\n- \n\n## Action items\n\n- [ ] \n\n## Meeting Summary\n\n\n\n## Transcript\n\n" },
  ]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings();
  const file = app.files.get("Clients/Acme/2026/Sync.md") as TFile;
  const report = "**Category:** Team Sync\n**Primary Account / Project:** General\n**Key Decisions Made:**\n- Ship it\n### Action Items & Commitments\n| Action Item | Owner | Due |\n|---|---|---|\n| Write notes | Alice Smith | 2026-04-10 |";

  assert.equal(await plugin.applyAssistantReply(file as never, report), true);
  assert.match(file.content ?? "", /## Action items\n\n- \[ \] Write notes @\[\[Alice Smith\]\] ➕ 2026-04-03 📅 2026-04-10\n/);
  assert.match(file.content ?? "", /^meeting_category: "Team Sync"$/m);
  assert.doesNotMatch(file.content ?? "", /^account:/m, "General is not an account");
  assert.match(getNotices().at(-1)?.message ?? "", /Updated the summary; added 1 new decision and 1 new next step/);

  const before = file.content;
  assert.equal(await plugin.applyAssistantReply(file as never, "Hello there"), false);
  assert.equal(file.content, before);
});

test("Open meeting tracker builds the tracker from notes anywhere and rebuilds it in place", async () => {
  const app = createMemoryApp([
    { path: "Clients/Acme/2026/Q4/Pilot.md", content: "---\ntitle: \"Pilot\"\nstart: 2026-04-02T10:00\naccount: \"Acme\"\ncalendar_event_id: \"p\"\n---\n\n## Decisions\n\n- Go live\n\n## Action items\n\n- [ ] Send scope @[[Bob Jones]] ⏫ 📅 2026-04-01\n- [ ] \n" },
  ]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings();

  await plugin.openTracker();
  const tracker = app.files.get("Meeting Notes/Meeting Tracker.md") as TFile;
  assert.match(tracker.content ?? "", /## Overdue\n\n- \[ \] Send scope @\[\[Bob Jones\]\] · ⏫ 📅 2026-04-01 · \[\[Clients\/Acme\/2026\/Q4\/Pilot\|Pilot\]\]/);
  assert.match(tracker.content ?? "", /### Acme \(1\)/);
  assert.match(tracker.content ?? "", /- Go live/);
  assert.deepEqual(app.openedFiles, ["Meeting Notes/Meeting Tracker.md"]);

  (app.files.get("Clients/Acme/2026/Q4/Pilot.md") as TFile).content =
    (app.files.get("Clients/Acme/2026/Q4/Pilot.md") as TFile).content?.replace("- [ ] Send", "- [x] Send");
  await plugin.openTracker();
  assert.equal(app.createdPaths.filter((p) => p.endsWith("Meeting Tracker.md")).length, 1);
  assert.match(tracker.content ?? "", /\| 0 \| 0 \| 0 \| 0 \|/);
});

test("meeting notes get Krisp, copy and add-reply icons in their header; other notes don't", () => {
  const app = createMemoryApp([
    { path: "Clients/Sync.md", content: "---\ntitle: \"Sync\"\ncalendar_event_id: \"sync\"\n---\n" },
    { path: "Ideas.md", content: "Just a note" },
  ]);
  const meetingView = new MarkdownView(new WorkspaceLeaf());
  meetingView.file = app.files.get("Clients/Sync.md") as TFile;
  const otherView = new MarkdownView(new WorkspaceLeaf());
  otherView.file = app.files.get("Ideas.md") as TFile;
  let leaves = [{ view: meetingView }, { view: otherView }];
  (app.workspace as unknown as { getLeavesOfType: () => unknown[] }).getLeavesOfType = () => leaves;
  const plugin = createPlugin(app);
  plugin.settings = appleSettings();

  plugin.updateNoteActions();
  plugin.updateNoteActions();
  assert.deepEqual(meetingView.actions.map((a) => a.title), [
    "Add AI reply to this meeting",
    "Copy meeting for AI assistant",
    "Import Krisp transcript into this note",
  ], "added once, in reverse so they read left to right");
  assert.equal(otherView.actions.length, 0);

  meetingView.file = otherView.file;
  plugin.updateNoteActions();
  assert.ok(meetingView.actions.every((a) => a.removed), "removed when the tab shows another note");

  meetingView.file = app.files.get("Clients/Sync.md") as TFile;
  plugin.updateNoteActions();
  leaves = [];
  plugin.updateNoteActions();
  assert.ok(meetingView.actions.every((a) => a.removed), "removed when the tab closes");
});

test("the Today panel's follow-up buttons copy and add replies for the meeting's own note", async () => {
  const app = createMemoryApp([
    { path: "Clients/2026/Sync.md", content: "---\ntitle: \"Sync\"\ncalendar_event_id: \"sync\"\n---\n\n## Notes\n\n- Mine\n\n## Action items\n\n- [ ] \n\n## Transcript\n\n" },
  ]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings({ aiIncludeInstructions: false });
  let clipboard = "";
  Object.defineProperty(globalThis, "navigator", {
    value: { clipboard: { writeText: async (t: string) => { clipboard = t; }, readText: async () => clipboard } },
    configurable: true,
  });

  await plugin.meetingNoteAction(buildEvent({ id: "sync" }), "copy");
  assert.match(clipboard, /^MEETING DETAILS\nTitle: Sync\n[\s\S]*MY NOTES\n- Mine/);

  clipboard = "## Summary\nDone.\n## Action items\n- [ ] Ship it @[[Bob Jones]]";
  await plugin.meetingNoteAction(buildEvent({ id: "sync" }), "reply");
  assert.match((app.files.get("Clients/2026/Sync.md") as TFile).content ?? "", /## Action items\n\n- \[ \] Ship it @\[\[Bob Jones\]\] ➕ 2026-04-03\n/);

  await plugin.meetingNoteAction(buildEvent({ id: "missing" }), "copy");
  assert.match(getNotices().at(-1)?.message ?? "", /no note yet/);
});

test("Open this week's review creates the Weekly Reviews folder and keeps the user's writing on reopen", async () => {
  const app = createMemoryApp([
    { path: "Clients/Acme/Pilot.md", content: "---\ntitle: \"Pilot\"\nstart: 2026-04-02T10:00\ncalendar_event_id: \"p\"\n---\n\n## Decisions\n\n- Go live\n\n## Action items\n\n- [ ] Send scope 📅 2026-04-10\n" },
  ]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings({ noteFolder: "Work/Meeting Notes" });

  await plugin.openWeeklyReview(0);
  const path = "Work/Meeting Notes/Weekly Reviews/2026-W14 Weekly Review.md";
  assert.ok(app.files.has("Work"), "missing parent folders are created");
  assert.ok(app.files.has("Work/Meeting Notes/Weekly Reviews"));
  const review = app.files.get(path) as TFile;
  assert.match(review.content ?? "", /- Go live/);
  assert.match(review.content ?? "", /## Still open from this week's meetings\n\n- \[ \] Send scope · 📅 2026-04-10/);
  assert.deepEqual(app.openedFiles, [path]);

  review.content = (review.content ?? "").replace("### Wins\n\n- ", "### Wins\n\n- Shipped it");
  (app.files.get("Clients/Acme/Pilot.md") as TFile).content =
    (app.files.get("Clients/Acme/Pilot.md") as TFile).content?.replace("- [ ] Send scope 📅 2026-04-10", "- [x] Send scope 📅 2026-04-10 ✅ 2026-04-03");
  await plugin.openWeeklyReview(0);
  assert.match(review.content ?? "", /- Shipped it/);
  assert.match(review.content ?? "", /## Done this week\n\n- Send scope · 📅 2026-04-10 · /);
  assert.equal(app.createdPaths.filter((p) => p === path).length, 1);

  await plugin.openWeeklyReview(-1);
  assert.ok(app.files.has("Work/Meeting Notes/Weekly Reviews/2026-W13 Weekly Review.md"));
});

test("the tracker, dashboard and weekly reviews go in the Meeting Hub folder when one is set", async () => {
  const app = createMemoryApp();
  const plugin = createPlugin(app);
  plugin.settings = appleSettings({ hubFolder: "Meeting Hub" });

  await plugin.openTracker();
  await plugin.openDashboard();
  await plugin.openWeeklyReview(0);

  assert.deepEqual(app.createdPaths, [
    "Meeting Hub/Meeting Tracker.md",
    "Meeting Hub/Meetings.base",
    "Meeting Hub/Weekly Reviews/2026-W14 Weekly Review.md",
  ]);
});

test("Move existing files moves the tracker, dashboard and weekly reviews into the Meeting Hub folder", async () => {
  const app = createMemoryApp([
    { path: "Meeting Notes", content: "" },
    { path: "Meeting Notes/Meeting Tracker.md", content: "old tracker" },
    { path: "Meeting Notes/Meetings.base", content: "base" },
    { path: "Meeting Notes/Weekly Reviews/2026-W13 Weekly Review.md", content: "### Wins\n\n- Kept" },
    { path: "Meeting Notes/Weekly Reviews/2026-W14 Weekly Review.md", content: "older copy" },
    { path: "Meeting Notes/2026-04-03 - Planning.md", content: "meeting" },
    { path: "Meeting Hub/Weekly Reviews/2026-W14 Weekly Review.md", content: "newer copy" },
  ]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings({ hubFolder: "Meeting Hub" });

  await plugin.moveHubFiles();

  assert.deepEqual(app.renamed, [
    ["Meeting Notes/Meeting Tracker.md", "Meeting Hub/Meeting Tracker.md"],
    ["Meeting Notes/Meetings.base", "Meeting Hub/Meetings.base"],
    ["Meeting Notes/Weekly Reviews/2026-W13 Weekly Review.md", "Meeting Hub/Weekly Reviews/2026-W13 Weekly Review.md"],
  ]);
  assert.equal((app.files.get("Meeting Hub/Weekly Reviews/2026-W14 Weekly Review.md") as TFile).content, "newer copy");
  assert.ok(app.files.has("Meeting Notes/2026-04-03 - Planning.md"));
  assert.match(getNotices().at(-1)?.message ?? "", /Moved 3 files to Meeting Hub\. Left 2026-W14 Weekly Review\.md in place/);
});

test("Move existing files does nothing when the Meeting Hub folder is the note folder", async () => {
  const app = createMemoryApp([{ path: "Meeting Notes/Meeting Tracker.md", content: "tracker" }]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings();

  await plugin.moveHubFiles();

  assert.deepEqual(app.renamed, []);
  assert.match(getNotices().at(-1)?.message ?? "", /set a different folder first/);
});

test("refreshNotes adopts a note saved with a moved occurrence's /RID id and renames it", async () => {
  const series = "CAL:49mmnr4iccm5fqud5h5osvlb12@google.com";
  const app = createMemoryApp([
    { path: "Meeting Notes", content: "" },
    {
      path: "Meeting Notes/2026-04-03 - Standup.md",
      content: `---\ntitle: "Standup"\ndate: 2026-04-03\nstart: 2026-04-03T10:00\ncalendar: "Work"\ncalendar_event_id: "${series}/RID=797000000::2026-04-03T14:00:00.000Z"\n---\n\n## Notes\n\n- Mine\n`,
    },
  ]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings();
  const moved = buildEvent({
    id: `${series}::2026-04-03T14:00:00.000Z`,
    summary: "Standup",
    calendarName: "Work",
    start: { dateTime: "2026-04-03T15:00:00-04:00" },
    end: { dateTime: "2026-04-03T15:30:00-04:00" },
  });
  const friday = { ...moved, start: { dateTime: "2026-04-10T10:00:00-04:00" }, end: { dateTime: "2026-04-10T10:30:00-04:00" } };
  plugin.getCalendarService = appleService([], ["Work"], [friday]);

  await plugin.refreshNotes(false);

  assert.deepEqual(app.createdPaths, []);
  assert.deepEqual(app.renamed, [["Meeting Notes/2026-04-03 - Standup.md", "Meeting Notes/2026-04-10 - Standup.md"]]);
  const content = (app.files.get("Meeting Notes/2026-04-10 - Standup.md") as TFile).content ?? "";
  assert.match(content, new RegExp(`^calendar_event_id: "${series}::2026-04-03T14:00:00\\.000Z"$`, "m"));
  assert.match(content, /- Mine/);
});

test("a recurring meeting's Previous link skips an occurrence that was removed from the calendar", async () => {
  const app = createMemoryApp([{ path: "Meeting Notes", content: "" }]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings({ hoursInAdvance: 48 });
  const occurrence = (day: string) => buildEvent({
    id: `weekly::2026-04-0${day}T14:00:00.000Z`,
    summary: "Weekly Sync",
    calendarName: "Work",
    start: { dateTime: `2026-04-0${day}T10:00:00-04:00` },
    end: { dateTime: `2026-04-0${day}T10:30:00-04:00` },
  });
  plugin.getCalendarService = appleService([occurrence("3")], ["Work"]);
  await plugin.refreshNotes(false);
  plugin.getCalendarService = appleService([occurrence("3"), occurrence("4")], ["Work"]);
  await plugin.refreshNotes(false);

  plugin.getCalendarService = appleService([occurrence("3")], ["Work"]);
  await plugin.refreshNotes(false);
  assert.match((app.files.get("Meeting Notes/2026-04-04 - Weekly Sync.md") as TFile).content ?? "", /^status: removed$/m);

  plugin.getCalendarService = appleService([occurrence("3"), occurrence("5")], ["Work"]);
  plugin.now = () => new Date("2026-04-04T06:00:00-04:00");
  await plugin.refreshNotes(false);

  const third = (app.files.get("Meeting Notes/2026-04-05 - Weekly Sync.md") as TFile).content ?? "";
  assert.match(third, /^> \*\*Previous:\*\* \[\[Meeting Notes\/2026-04-03 - Weekly Sync\|2026-04-03 - Weekly Sync\]\]$/m);
});

test("refreshNotes marks the note of a meeting you declined, and restores it if you accept again", async () => {
  const app = createMemoryApp([{ path: "Meeting Notes", content: "" }]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings();
  const meeting = (responseStatus: "accepted" | "declined") => buildEvent({
    id: "one-off",
    summary: "Review",
    calendarName: "Work",
    attendees: [
      { email: "me@example.com", self: true, responseStatus },
      { email: "them@example.com", responseStatus: "accepted" },
    ],
  });
  plugin.getCalendarService = appleService([meeting("accepted")], ["Work"]);
  await plugin.refreshNotes(false);

  plugin.getCalendarService = appleService([meeting("declined")], ["Work"]);
  await plugin.refreshNotes(false);
  const note = () => (app.files.get("Meeting Notes/2026-04-03 - Review.md") as TFile).content ?? "";
  assert.match(note(), /^status: declined$/m);
  assert.match(note(), /^> \[!warning\] Meeting declined$/m);

  plugin.getCalendarService = appleService([meeting("accepted")], ["Work"]);
  await plugin.refreshNotes(false);
  assert.doesNotMatch(note(), /^status:/m);
  assert.match(note(), /^> \[!info\] Meeting details$/m);
  assert.equal(app.createdPaths.length, 1);
});

test("the calendar is read far enough ahead to keep notes in sync for the configured number of days", async () => {
  const plugin = createPlugin();
  plugin.settings = appleSettings({ daysAhead: 7, syncDaysAhead: 45 });
  const service = await plugin.getCalendarService();
  assert.equal((service as unknown as { appleApi: { daysAhead: number } }).appleApi.daysAhead, 45);
});

test("refreshNotes warns once per session about two notes for the same meeting, and again on a manual refresh", async () => {
  const id = "S@google.com::2026-04-03T14:00:00.000Z";
  const note = (path: string, stored: string) => ({ path, content: `---\ntitle: "Sync"\ndate: 2026-04-03\ncalendar: "Work"\ncalendar_event_id: "${stored}"\n---\n` });
  const app = createMemoryApp([
    { path: "Meeting Notes", content: "" },
    note("Meeting Notes/2026-04-03 - Sync.md", id),
    note("Meeting Notes/2026-04-05 - Sync.md", "S@google.com/RID=1::2026-04-03T14:00:00.000Z"),
  ]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings();
  plugin.getCalendarService = appleService([], ["Work"]);

  await plugin.refreshNotes(false);
  await plugin.refreshNotes(false);
  const warnings = () => getNotices().filter((n) => /notes are for the same meeting/.test(n.message));
  assert.equal(warnings().length, 1);
  assert.match(warnings()[0].message, /2 notes are for the same meeting: 2026-04-03 - Sync, 2026-04-05 - Sync\. Copy what you need into one and delete the other\./);

  await plugin.refreshNotes(true);
  assert.equal(warnings().length, 2);
});

test("refreshNotes points out a note that couldn't be renamed because another note has the new name", async () => {
  const app = createMemoryApp([{ path: "Meeting Notes", content: "" }, { path: "Meeting Notes/2026-04-06 - Planning.md", content: "mine" }]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings();
  plugin.getCalendarService = appleService([buildEvent({ id: "p", summary: "Planning", calendarName: "Work" })], ["Work"]);
  await plugin.refreshNotes(false);

  const moved = buildEvent({
    id: "p", summary: "Planning", calendarName: "Work",
    start: { dateTime: "2026-04-06T09:00:00-04:00" }, end: { dateTime: "2026-04-06T09:30:00-04:00" },
  });
  plugin.getCalendarService = appleService([], ["Work"], [moved]);
  await plugin.refreshNotes(false);

  assert.ok(app.files.has("Meeting Notes/2026-04-03 - Planning.md"));
  assert.match(getNotices().at(-1)?.message ?? "", /2026-04-03 - Planning should be renamed to match its meeting, but 2026-04-06 - Planning already has that name/);
});

test("Open series note creates it in the Meeting Hub, links the occurrences both ways and keeps the user's writing", async () => {
  const app = createMemoryApp([{ path: "Meeting Notes", content: "" }]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings({ hubFolder: "Meeting Hub", hoursInAdvance: 48 });
  const occurrence = (day: string, extra = {}) => buildEvent({
    id: `weekly@google.com::2026-04-0${day}T14:00:00.000Z`,
    summary: "Weekly Sync",
    calendarName: "Work",
    start: { dateTime: `2026-04-0${day}T10:00:00-04:00` },
    end: { dateTime: `2026-04-0${day}T10:30:00-04:00` },
    ...extra,
  });
  plugin.getCalendarService = appleService([occurrence("3"), occurrence("4")], ["Work"]);
  await plugin.refreshNotes(false);
  const first = app.files.get("Meeting Notes/2026-04-03 - Weekly Sync.md") as TFile;
  first.content = (first.content ?? "").replace("## Next Steps\n\n- [ ] ", "## Next Steps\n\n- [ ] Send deck\n- [ ] ")
    .replace("## Key Decisions\n\n- ", "## Key Decisions\n\n- Ship it");

  await plugin.openSeriesNote(occurrence("3").id, "Weekly Sync");

  const path = "Meeting Hub/Series/Weekly Sync.md";
  const series = app.files.get(path) as TFile;
  assert.deepEqual(app.openedFiles, [path]);
  assert.match(series.content ?? "", /^series_id: "weekly@google\.com"$/m);
  assert.match(series.content ?? "", /## Purpose\n\n- \n\n## Standing agenda/);
  assert.match(series.content ?? "", /## Meetings\n\n- 2026-04-04 · \[\[Meeting Notes\/2026-04-04 - Weekly Sync\|Weekly Sync\]\]\n- 2026-04-03 · \[\[Meeting Notes\/2026-04-03 - Weekly Sync\|Weekly Sync\]\] · 1 open/);
  assert.match(series.content ?? "", /## Open items\n\n- \[ \] Send deck · /);
  assert.match(series.content ?? "", /## Recent decisions\n\n### [^\n]+ · 2026-04-03\n\n- Ship it/);
  assert.match(first.content ?? "", /^series: "\[\[Meeting Hub\/Series\/Weekly Sync\|Weekly Sync\]\]"$/m);
  assert.match(first.content ?? "", /^> \*\*Series:\*\* \[\[Meeting Hub\/Series\/Weekly Sync\|Weekly Sync\]\]$/m);

  series.content = (series.content ?? "").replace("## Purpose\n\n- ", "## Purpose\n\n- Unblock the team");
  plugin.getCalendarService = appleService([occurrence("3"), occurrence("4", { cancelled: true }), occurrence("5")], ["Work"]);
  await plugin.refreshNotes(false);
  const fifth = (app.files.get("Meeting Notes/2026-04-05 - Weekly Sync.md") as TFile).content ?? "";
  assert.match(fifth, /^> \*\*Series:\*\* \[\[Meeting Hub\/Series\/Weekly Sync\|Weekly Sync\]\]$/m, "new occurrences are linked when created");
  assert.match(first.content ?? "", /^series: /m, "the link survives a sync");

  await plugin.openSeriesNote(occurrence("3").id, "Weekly Sync");
  assert.match(series.content ?? "", /- Unblock the team/);
  assert.match(series.content ?? "", /- ~~2026-04-04 · [^\n]+~~ · cancelled/);
  assert.equal(app.createdPaths.filter((p) => p === path).length, 1);
});

test("Open series note says so for a meeting that doesn't repeat", async () => {
  const plugin = createPlugin();
  plugin.settings = appleSettings();
  await plugin.openSeriesNote("one-off", "Review");
  assert.match(getNotices().at(-1)?.message ?? "", /isn't a recurring meeting/);
});

test("Move existing files also moves series notes", async () => {
  const app = createMemoryApp([{ path: "Meeting Notes/Series/Weekly Sync.md", content: "series" }]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings({ hubFolder: "Meeting Hub" });
  await plugin.moveHubFiles();
  assert.deepEqual(app.renamed, [["Meeting Notes/Series/Weekly Sync.md", "Meeting Hub/Series/Weekly Sync.md"]]);
});

test("Open meeting insights builds the insights note and an overview note per account in the Meeting Hub", async () => {
  const app = createMemoryApp([
    { path: "Meeting Notes/Pilot.md", content: "---\ntitle: \"Pilot\"\nstart: 2026-04-02T10:00\nend: 2026-04-02T11:00\naccount: \"Acme\"\nmeeting_category: \"Customer\"\nsentiment: \"Negative\"\noutcome: \"Blocked\"\nkey_topics:\n  - \"TLS\"\nattendees:\n  - \"Me <me@example.com>\"\n  - \"Alice Smith <alice@example.com>\"\nspeakers:\n  - \"Bob Jones\"\nai_summarized: \"2026-04-02\"\ncalendar_event_id: \"p\"\n---\n\n## Next Steps\n\n- [ ] Fix certs @[[Bob Jones]]\n" },
    { path: "Meeting Hub/Accounts/Acme.md", content: "---\ntype: meeting-account\naccount: \"ACME\"\n---\n\n## Overview\n\n- Mine\n\n<!-- meeting-account:start — the plugin rebuilds everything down to the end marker. Write above it. -->\nold\n<!-- meeting-account:end -->\n" },
  ]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings({ hubFolder: "Meeting Hub", selfEmail: "me@example.com" });

  await plugin.openInsights();
  const insights = (app.files.get("Meeting Hub/Meeting Insights.md") as TFile).content ?? "";
  assert.match(insights, /\| \[\[Meeting Hub\/Accounts\/Acme\\\|Acme\]\] \| 1 \| 2026-04-02 \| 1 \| 0 \| 🔴 \| Blocked \|/);
  assert.match(insights, /\| Alice Smith \| 1 \|[\s\S]*\| Bob Jones \| 1 \| 2026-04-02 \| 1 \|/);
  assert.doesNotMatch(insights, /\| Me \|/, "the user isn't listed among the people they meet");
  assert.match(insights, /\| Customer \| 1 \| 1 \| 100% \|/);
  const account = (app.files.get("Meeting Hub/Accounts/Acme.md") as TFile).content ?? "";
  assert.match(account, /- Mine\n/);
  assert.match(account, /- 2026-04-02 · \[\[Meeting Notes\/Pilot\|Pilot\]\] · Customer · 🔴 Negative · Blocked/);
  assert.doesNotMatch(account, /\nold\n/);
  assert.deepEqual(app.createdPaths, ["Meeting Hub/Meeting Insights.md"], "the existing account note is reused");
  assert.deepEqual(app.openedFiles, ["Meeting Hub/Meeting Insights.md"]);

  await plugin.openAccountOverview("acme");
  assert.deepEqual(app.openedFiles.at(-1), "Meeting Hub/Accounts/Acme.md");
});

test("openDashboard adds new built-in views to an existing dashboard", async () => {
  const app = createMemoryApp([{ path: "Meeting Notes/Meetings.base", content: "views:\n  - type: table\n    name: All meetings\n" }]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings();
  await plugin.openDashboard();
  const content = (app.files.get("Meeting Notes/Meetings.base") as TFile).content ?? "";
  assert.match(content, /name: Needs AI summary/);
  assert.equal(content.split("name: All meetings").length, 2);

  const file = app.files.get("Meeting Notes/Meetings.base") as TFile;
  file.content = content.replace(/ {2}- type: table\n {4}name: Needs AI summary\n(?: {4,}.*\n)*/, "");
  assert.doesNotMatch(file.content ?? "", /Needs AI summary/);
  await plugin.openDashboard();
  assert.doesNotMatch(file.content ?? "", /Needs AI summary/, "a built-in view the user deleted isn't added back");
});

test("showTodayInBackground opens Today's meetings without focus, only when it isn't open", async () => {
  const app = createMemoryApp();
  const plugin = createPlugin(app);
  const states: unknown[] = [];
  let open = 0;
  Object.assign(app.workspace, {
    getLeavesOfType: () => Array.from({ length: open }),
    getRightLeaf: () => ({ setViewState: async (state: unknown) => { states.push(state); open++; } }),
  });
  await plugin.showTodayInBackground();
  await plugin.showTodayInBackground();
  assert.deepEqual(states, [{ type: "calendar-notes-today", active: false }]);
});

test("Meeting Hub notes get a refresh icon that rebuilds them; meeting notes keep their own icons", async () => {
  const app = createMemoryApp([
    { path: "Meeting Notes/Pilot.md", content: "---\ntitle: \"Pilot\"\nstart: 2026-04-02T10:00\naccount: \"Acme\"\ncalendar_event_id: \"p\"\n---\n" },
    { path: "Meeting Hub/Accounts/Acme.md", content: "---\ntype: meeting-account\naccount: \"Acme\"\n---\n\n<!-- meeting-account:start — the plugin rebuilds everything down to the end marker. Write above it. -->\nold\n<!-- meeting-account:end -->\n" },
    { path: "Ideas.md", content: "Just a note" },
  ]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings({ hubFolder: "Meeting Hub" });
  await plugin.openInsights();

  const views = ["Meeting Hub/Accounts/Acme.md", "Meeting Hub/Meeting Insights.md", "Meeting Notes/Pilot.md", "Ideas.md"].map((path) => {
    const view = new MarkdownView(new WorkspaceLeaf());
    view.file = app.files.get(path) as TFile;
    return view;
  });
  (app.workspace as unknown as { getLeavesOfType: () => unknown[] }).getLeavesOfType = () => views.map((view) => ({ view }));
  plugin.updateNoteActions();
  assert.deepEqual(views.map((v) => v.actions.map((a) => a.icon)), [
    ["refresh-cw"],
    ["refresh-cw"],
    ["clipboard-paste", "clipboard-copy", "file-audio"],
    [],
  ]);

  const account = app.files.get("Meeting Hub/Accounts/Acme.md") as TFile;
  account.content = (account.content ?? "").replace(/(meeting-account:start[^\n]*\n)[\s\S]*?(<!-- meeting-account:end)/, "$1stale\n$2");
  views[0].actions[0].callback();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.match(account.content ?? "", /\[\[Meeting Notes\/Pilot\|Pilot\]\]/);
  assert.match(getNotices().at(-1)?.message ?? "", /Refreshed/);
});

test("a Meeting Hub note is rebuilt when opened, but not again right after the plugin rebuilt it", async () => {
  const app = createMemoryApp([
    { path: "Meeting Notes/Pilot.md", content: "---\ntitle: \"Pilot\"\nstart: 2026-04-02T10:00\ncalendar_event_id: \"p\"\n---\n\n## Next Steps\n\n- [ ] Fix certs\n" },
    { path: "Meeting Notes/Meeting Tracker.md", content: "stale" },
    { path: "Weekly Reviews/2026-W14.md", content: "---\ntype: weekly-review\nweek_start: 2026-03-30\n---\n\n<!-- weekly-review:start — the plugin rebuilds everything down to the end marker each time you open this review. Write below it. -->\nold\n<!-- weekly-review:end -->\n\nMine\n" },
  ]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings();
  await (plugin as unknown as { refreshHubNoteOnOpen: (f: TFile) => Promise<void> }).refreshHubNoteOnOpen(app.files.get("Meeting Notes/Meeting Tracker.md") as TFile);
  assert.equal((app.files.get("Meeting Notes/Meeting Tracker.md") as TFile).content, "stale", "not rebuilt before Obsidian has read the vault");
  plugin.metadataReady = true;
  const onOpen = (path: string) =>
    (plugin as unknown as { refreshHubNoteOnOpen: (f: TFile) => Promise<void> }).refreshHubNoteOnOpen(app.files.get(path) as TFile);

  await onOpen("Meeting Notes/Meeting Tracker.md");
  const tracker = app.files.get("Meeting Notes/Meeting Tracker.md") as TFile;
  assert.match(tracker.content ?? "", /Fix certs/);

  tracker.content = "edited";
  await onOpen("Meeting Notes/Meeting Tracker.md");
  assert.equal(tracker.content, "edited", "not rebuilt twice in a row when a command just rebuilt and opened it");

  await onOpen("Weekly Reviews/2026-W14.md");
  const review = (app.files.get("Weekly Reviews/2026-W14.md") as TFile).content ?? "";
  assert.match(review, /Mine/);
  assert.match(review, /Refreshes each time you open it/);

  await onOpen("Meeting Notes/Pilot.md");
  assert.doesNotMatch((app.files.get("Meeting Notes/Pilot.md") as TFile).content ?? "", /Refreshes/, "meeting notes aren't touched");
});

test("Add AI reply with an account brings that account's overview note up to date", async () => {
  const app = createMemoryApp([
    { path: "Meeting Notes/Pilot.md", content: "---\ntitle: \"Pilot\"\nstart: 2026-04-02T10:00\ncalendar_event_id: \"p\"\n---\n\n## Notes\n\n- Mine\n" },
  ]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings({ hubFolder: "Meeting Hub", aiSaveProperties: true });
  await plugin.applyAssistantReply(
    app.files.get("Meeting Notes/Pilot.md") as never,
    "## Meeting Metadata\n- **Account / Project:** Acme\n\n## Executive Summary\nShort.\n\n## Next Steps\n- [ ] **[[Ann Lee]]**: Send the deck\n"
  );
  const overview = (app.files.get("Meeting Hub/Accounts/Acme.md") as TFile | undefined)?.content ?? "";
  assert.match(overview, /\[\[Meeting Notes\/Pilot\|Pilot\]\]/);
  assert.match(overview, /Send the deck/);
  assert.deepEqual(app.openedFiles, [], "the overview isn't opened");
});

test("ticking an item in a Meeting Hub note checks it off in its meeting note and drops it from the hub note", async () => {
  const app = createMemoryApp([
    { path: "Meeting Notes/Pilot.md", content: "---\ntitle: \"Pilot\"\nstart: 2026-04-02T10:00\naccount: \"Acme\"\ncalendar_event_id: \"p\"\n---\n\n## Next Steps\n\n- [ ] Fix certs @[[Bob Jones]] ⏫ 📅 2026-04-01\n- [ ] Book room\n" },
  ]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings({ hubFolder: "Meeting Hub" });
  await plugin.openTracker();
  const tracker = app.files.get("Meeting Hub/Meeting Tracker.md") as TFile;
  assert.match(tracker.content ?? "", /- \[ \] Fix certs @\[\[Bob Jones\]\] · ⏫ 📅 2026-04-01 · \[\[Meeting Notes\/Pilot\|Pilot\]\]/);

  // The Tasks plugin adds a done date after the link when a box is ticked.
  tracker.content = (tracker.content ?? "").replace(/- \[ \] (Fix certs[^\n]*)/, "- [x] $1 ✅ 2026-04-03");
  await plugin.completeTickedHubItems(tracker as never);

  const meeting = (app.files.get("Meeting Notes/Pilot.md") as TFile).content ?? "";
  assert.match(meeting, /- \[x\] Fix certs @\[\[Bob Jones\]\] ⏫ 📅 2026-04-01 ✅ 2026-04-03/);
  assert.match(meeting, /- \[ \] Book room/, "other items stay open");
  assert.doesNotMatch(tracker.content ?? "", /Fix certs/, "the hub note is rebuilt without it");
  assert.match(tracker.content ?? "", /- \[ \] Book room/);
  assert.match(getNotices().at(-1)?.message ?? "", /Checked off 1 item in its meeting note/);

  const before = meeting;
  await plugin.completeTickedHubItems(app.files.get("Meeting Notes/Pilot.md") as never);
  assert.equal((app.files.get("Meeting Notes/Pilot.md") as TFile).content, before, "ticks in meeting notes themselves are left to Obsidian");
});

test("the settings warn when the Tasks plugin's global query doesn't leave out the Meeting Hub folder", async () => {
  const app = createMemoryApp();
  const disk = new Map<string, string>([[".obsidian/plugins/obsidian-tasks-plugin/manifest.json", "{}"]]);
  Object.assign(app.vault, {
    configDir: ".obsidian",
    adapter: { exists: async (p: string) => disk.has(p), read: async (p: string) => disk.get(p) ?? "" },
  });
  const plugin = createPlugin(app);
  plugin.settings = appleSettings({ hubFolder: "" });
  assert.match((await plugin.tasksQueryWarning()) ?? "", /Set a Meeting Hub folder of its own/);

  plugin.settings = appleSettings({ hubFolder: "Meeting Hub" });
  assert.match((await plugin.tasksQueryWarning()) ?? "", /add this line: path does not include Meeting Hub$/, "no data.json yet");

  disk.set(".obsidian/plugins/obsidian-tasks-plugin/data.json", JSON.stringify({ globalQuery: "not done\npath does not include meeting hub" }));
  assert.equal(await plugin.tasksQueryWarning(), undefined);

  disk.clear();
  assert.equal(await plugin.tasksQueryWarning(), undefined, "no warning without the Tasks plugin");
});

test("ticking an item under Gone stale? marks it won't do; [-] anywhere does too", async () => {
  const app = createMemoryApp([
    { path: "Meeting Notes/Kickoff.md", content: "---\ntitle: \"Kickoff\"\nstart: 2026-01-05T10:00\ncalendar_event_id: \"k\"\n---\n\n## Next Steps\n\n- [ ] Old idea\n- [ ] Other old idea\n- [ ] Done one\n" },
  ]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings({ hubFolder: "Meeting Hub" });
  await plugin.openTracker();
  const tracker = app.files.get("Meeting Hub/Meeting Tracker.md") as TFile;
  const [stale, byAccount] = (tracker.content ?? "").split("## Open items by account");
  tracker.content = stale.replace("- [ ] Old idea", "- [x] Old idea") + "## Open items by account" +
    byAccount.replace("- [ ] Done one", "- [x] Done one").replace("- [ ] Other old idea", "- [-] Other old idea");
  await plugin.completeTickedHubItems(tracker as never);

  const meeting = (app.files.get("Meeting Notes/Kickoff.md") as TFile).content ?? "";
  assert.match(meeting, /- \[-\] Old idea ❌ 2026-04-03/);
  assert.match(meeting, /- \[-\] Other old idea ❌ 2026-04-03/);
  assert.match(meeting, /- \[x\] Done one ✅ 2026-04-03/);
  assert.match(getNotices().at(-1)?.message ?? "", /Checked off 1 item; Marked 2 items won't do in their meeting notes/);
});

test("myNames combines the Your name setting with the user's own name in calendar invites", () => {
  const app = createMemoryApp([
    { path: "Meeting Notes/Sync.md", content: "---\ncalendar_event_id: \"s\"\nattendees:\n  - \"John Smith <me@example.com>\"\n  - \"Ann Lee <ann@example.com>\"\n---\n" },
  ]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings({ selfEmail: "me@example.com", myNames: "John, john smith" });
  assert.deepEqual(plugin.myNames(), ["John", "John Smith"]);
});

test("notes that share a calendar id, such as older recurring-meeting notes, all count in the hub and the action items panel", async () => {
  const app = createMemoryApp([
    { path: "Meeting Notes/Sync 1.md", content: "---\ntitle: \"Sync\"\nstart: 2026-03-23T10:00\naccount: \"Acme\"\ncalendar_event_id: \"weekly\"\n---\n\n## Next Steps\n\n- [ ] First week item\n" },
    { path: "Meeting Notes/Sync 2.md", content: "---\ntitle: \"Sync\"\nstart: 2026-03-30T10:00\naccount: \"Acme\"\ncalendar_event_id: \"weekly\"\n---\n\n## Next Steps\n\n- [ ] Second week item\n" },
  ]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings({ hubFolder: "Meeting Hub" });

  assert.equal((await plugin.trackerMeetings()).length, 2);
  await plugin.openTracker();
  const tracker = (app.files.get("Meeting Hub/Meeting Tracker.md") as TFile).content ?? "";
  assert.match(tracker, /First week item/);
  assert.match(tracker, /Second week item/);
  await plugin.openAccountOverview("Acme");
  assert.match((app.files.get("Meeting Hub/Accounts/Acme.md") as TFile).content ?? "", /Sync 1[\s\S]*Sync 2|Sync 2[\s\S]*Sync 1/);
  const { collectOpenItems } = await import("../src/actionItems");
  assert.equal((await collectOpenItems(app as never)).length, 2);
});

test("an upcoming meeting's note gets a Meeting Brief with an icon to refresh it, and the AI reply removes it", async () => {
  const app = createMemoryApp([
    { path: "Meeting Notes/Pilot 1.md", content: "---\ntitle: \"Pilot\"\nstart: 2026-03-27T10:00\naccount: \"Acme\"\ncalendar_event_id: \"pilot::2026-03-27\"\n---\n\n## Next Steps\n\n- [ ] Send runbook @[[Ann Lee]]\n" },
    { path: "Meeting Notes/Pilot 2.md", content: "---\ntitle: \"Pilot\"\nstart: 2026-04-03T10:30\nend: 2026-04-03T11:00\ncalendar_event_id: \"pilot::2026-04-03\"\nattendees:\n  - \"Ann Lee <ann@example.com>\"\n---\n\n# Pilot\n\n## Agenda\n\n- \n\n## Notes\n\n- \n" },
  ]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings();
  const note = app.files.get("Meeting Notes/Pilot 2.md") as TFile;

  const view = new MarkdownView(new WorkspaceLeaf());
  view.file = note;
  (app.workspace as unknown as { getLeavesOfType: () => unknown[] }).getLeavesOfType = () => [{ view }];
  plugin.updateNoteActions();
  const refresh = view.actions.find((a) => a.title === "Refresh meeting brief");
  assert.ok(refresh, "the meeting hasn't happened yet, so it has a brief icon");

  refresh!.callback();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.match(note.content ?? "", /## Meeting Brief[\s\S]*\*\*Account:\*\* \*\*Acme\*\*[\s\S]*### They owe you\n\n- Send runbook @\[\[Ann Lee\]\][\s\S]*meeting-brief:end -->\n\n## Agenda/);

  await plugin.applyAssistantReply(note as never, "## Executive Summary\nShort.\n\n## Next Steps\n- [ ] **[[Ann Lee]]**: Send the deck\n");
  assert.doesNotMatch(note.content ?? "", /Meeting Brief|meeting-brief/);
  assert.match(note.content ?? "", /Send the deck/);
});

test("Add a to-do files it in My To-Dos in the Meeting Hub, and to-dos rank in the Tracker and lead the action items panel", async () => {
  const app = createMemoryApp([
    { path: "Meeting Notes/Sync.md", content: "---\ntitle: \"Sync\"\nstart: 2026-04-01T10:00\ncalendar_event_id: \"s\"\n---\n\n## Next Steps\n\n- [ ] Meeting item\n" },
  ]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings({ hubFolder: "Meeting Hub" });
  await plugin.addTodo({ text: "Renew passport", due: "2026-04-02", priority: "High" });
  await plugin.addTodo({ text: "Clean desk" });
  const todos = app.files.get("Meeting Hub/My To-Dos.md") as TFile;
  assert.match(todos.content ?? "", /type: meeting-todos[\s\S]*## To-dos\n\n- \[ \] Renew passport ⏫ ➕ 2026-04-03 📅 2026-04-02\n- \[ \] Clean desk ➕ 2026-04-03\n/);
  assert.match(getNotices().at(-1)?.message ?? "", /Added to My To-Dos/);

  await plugin.openTracker();
  const tracker = (app.files.get("Meeting Hub/Meeting Tracker.md") as TFile).content ?? "";
  assert.match(tracker.split("## Focus")[1], /^[\s\S]*?- \[ \] Renew passport · ⏫ 📅 2026-04-02 · \[\[Meeting Hub\/My To-Dos\|My To-Dos\]\] · \*overdue\*/);
  assert.doesNotMatch(tracker.split("## Meetings this week")[1], /My To-Dos/, "not counted as a meeting");

  const { collectOpenItems } = await import("../src/actionItems");
  const lists = await collectOpenItems(app as never);
  assert.deepEqual(lists.map((l) => l.title), ["My To-Dos", "Sync"]);

  const trackerFile = app.files.get("Meeting Hub/Meeting Tracker.md") as TFile;
  trackerFile.content = (trackerFile.content ?? "").replace("- [ ] Clean desk", "- [x] Clean desk");
  await plugin.completeTickedHubItems(trackerFile as never);
  assert.match(todos.content ?? "", /- \[x\] Clean desk ➕ 2026-04-03 ✅ 2026-04-03/);
});

test("a ticked hub item that changed since the rebuild is reported, and the user's own ticked lines are left alone", async () => {
  const app = createMemoryApp([
    { path: "Meeting Notes/Sync.md", content: "---\ntitle: \"Sync\"\nstart: 2026-04-01T10:00\naccount: \"Acme\"\ncalendar_event_id: \"s\"\n---\n\n## Next Steps\n\n- [ ] Send deck\n" },
  ]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings({ hubFolder: "Meeting Hub" });
  await plugin.openAccountOverview("Acme");
  const account = app.files.get("Meeting Hub/Accounts/Acme.md") as TFile;

  account.content = (account.content ?? "").replace("## Overview\n\n- ", "## Overview\n\n- [x] My own note · [[Meeting Notes/Sync|Sync]]");
  const before = account.content;
  const notices = getNotices().length;
  await plugin.completeTickedHubItems(account as never);
  assert.equal(account.content, before, "a line above the markers isn't the plugin's");
  assert.equal(getNotices().length, notices);

  (app.files.get("Meeting Notes/Sync.md") as TFile).content = "---\ntitle: \"Sync\"\nstart: 2026-04-01T10:00\naccount: \"Acme\"\ncalendar_event_id: \"s\"\n---\n\n## Next Steps\n\n- [ ] Send the deck to Bob\n";
  account.content = (account.content ?? "").replace("- [ ] Send deck", "- [x] Send deck");
  await plugin.completeTickedHubItems(account as never);
  assert.match(getNotices().at(-1)?.message ?? "", /Couldn't find "Send deck" in its meeting note/);
  assert.match(account.content ?? "", /- \[ \] Send the deck to Bob/, "the list is rebuilt from the note as it is now");
  assert.match(account.content ?? "", /- \[x\] My own note/);
});

test("an old weekly review isn't rewritten when opened; this week's and last week's are", async () => {
  const review = (week: string, start: string, end: string) => ({
    path: `Weekly Reviews/${week} Weekly Review.md`,
    content: `---\ntype: weekly-review\nweek_start: ${start}\nweek_end: ${end}\n---\n\n<!-- weekly-review:start — the plugin rebuilds everything down to the end marker each time you open this review. Write below it. -->\nold\n<!-- weekly-review:end -->\n`,
  });
  const app = createMemoryApp([review("2026-W10", "2026-03-02", "2026-03-08"), review("2026-W13", "2026-03-23", "2026-03-29")]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings();
  plugin.metadataReady = true;
  const onOpen = (path: string) =>
    (plugin as unknown as { refreshHubNoteOnOpen: (f: TFile) => Promise<void> }).refreshHubNoteOnOpen(app.files.get(path) as TFile);
  await onOpen("Weekly Reviews/2026-W10 Weekly Review.md");
  await onOpen("Weekly Reviews/2026-W13 Weekly Review.md");
  assert.match((app.files.get("Weekly Reviews/2026-W10 Weekly Review.md") as TFile).content ?? "", /\nold\n/);
  assert.doesNotMatch((app.files.get("Weekly Reviews/2026-W13 Weekly Review.md") as TFile).content ?? "", /\nold\n/);
});

test("two quick ticks handled at the same time check each item off once", async () => {
  const app = createMemoryApp([
    { path: "Meeting Notes/Sync.md", content: "---\ntitle: \"Sync\"\nstart: 2026-04-01T10:00\ncalendar_event_id: \"s\"\n---\n\n## Next Steps\n\n- [ ] Send deck 📅 2026-04-02\n- [ ] Book room 📅 2026-04-02\n" },
  ]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings({ hubFolder: "Meeting Hub" });
  await plugin.openTracker();
  const tracker = app.files.get("Meeting Hub/Meeting Tracker.md") as TFile;
  tracker.content = (tracker.content ?? "").replace("- [ ] Send deck", "- [x] Send deck").replace("- [ ] Book room", "- [x] Book room");
  await Promise.all([plugin.completeTickedHubItems(tracker as never), plugin.completeTickedHubItems(tracker as never)]);
  const meeting = (app.files.get("Meeting Notes/Sync.md") as TFile).content ?? "";
  assert.equal(meeting.match(/✅/g)?.length, 2, meeting);
  assert.match(meeting, /- \[x\] Send deck 📅 2026-04-02 ✅ 2026-04-03\n- \[x\] Book room 📅 2026-04-02 ✅ 2026-04-03/);
  assert.doesNotMatch(getNotices().map((n) => n.message).join("\n"), /Couldn't find/, "the second handler finding them already done isn't an error");
});

test("the brief refreshes itself on open in the hour before the meeting, but not further ahead or once it has started", async () => {
  const note = (start: string, end: string) =>
    `---\ntitle: "Sync"\nstart: ${start}\nend: ${end}\ncalendar_event_id: "s"\n---\n\n## Agenda\n\n- \n`;
  const app = createMemoryApp([
    { path: "Soon.md", content: note("2026-04-03T06:45", "2026-04-03T07:15") },
    { path: "Later.md", content: note("2026-04-03T09:00", "2026-04-03T09:30") },
    { path: "Now.md", content: note("2026-04-03T05:45", "2026-04-03T06:30") },
  ]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings();
  plugin.metadataReady = true;
  for (const path of ["Soon.md", "Later.md", "Now.md"]) await plugin.refreshBriefOnOpen(app.files.get(path) as never);
  const hasBrief = (path: string) => /Meeting Brief/.test((app.files.get(path) as TFile).content ?? "");
  assert.deepEqual([hasBrief("Soon.md"), hasBrief("Later.md"), hasBrief("Now.md")], [true, false, false]);
});

test("a note created for an upcoming event gets its brief from the event; a past event's note gets none", async () => {
  const app = createMemoryApp([
    { path: "Meeting Notes/Pilot 1.md", content: "---\ntitle: \"Pilot\"\nstart: 2026-03-27T10:00\naccount: \"Acme\"\ncalendar_event_id: \"pilot::2026-03-27\"\n---\n\n## Next Steps\n\n- [ ] Send runbook @[[Ann Lee]]\n" },
    { path: "Meeting Notes/Pilot 2.md", content: "# Pilot\n\n## Agenda\n\n- \n" },
    { path: "Meeting Notes/Old.md", content: "# Old\n\n## Agenda\n\n- \n" },
  ]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings();
  const write = (path: string, event: unknown) =>
    (plugin as unknown as { writeNewNoteBrief: (f: TFile, e: unknown) => Promise<void> }).writeNewNoteBrief(app.files.get(path) as TFile, event);
  await write("Meeting Notes/Pilot 2.md", {
    id: "pilot::2026-04-03", summary: "Pilot",
    start: { dateTime: "2026-04-03T10:00:00-04:00" }, end: { dateTime: "2026-04-03T10:30:00-04:00" },
    attendees: [{ email: "ann@example.com", displayName: "Ann Lee" }],
  });
  const content = (app.files.get("Meeting Notes/Pilot 2.md") as TFile).content ?? "";
  assert.match(content, /\*\*Account:\*\* \*\*Acme\*\*[\s\S]*### They owe you\n\n- Send runbook @\[\[Ann Lee\]\]/);

  await write("Meeting Notes/Old.md", {
    id: "old", summary: "Old", start: { dateTime: "2026-04-01T10:00:00-04:00" }, end: { dateTime: "2026-04-01T11:00:00-04:00" },
  });
  assert.doesNotMatch((app.files.get("Meeting Notes/Old.md") as TFile).content ?? "", /Meeting Brief/);
});

test("Prepare my day creates the day's notes with briefs, rebuilds the Tracker and My Day, and copies the Daily Briefing", async () => {
  const dir = await mkdtemp(join(tmpdir(), "briefing-"));
  try {
    const app = createMemoryApp([
      { path: "Meeting Notes/Pilot 1.md", content: "---\ntitle: \"Pilot\"\nstart: 2026-03-27T10:00\naccount: \"Acme\"\ncalendar_event_id: \"pilot::2026-03-27\"\n---\n\n## Next Steps\n\n- [ ] Send runbook @[[Ann Lee]]\n" },
    ]);
    const plugin = createPlugin(app);
    plugin.settings = appleSettings({ hubFolder: "Meeting Hub", briefingFolder: join(dir, "Drive", "Briefing") });
    plugin.loadDayEvents = async () => [
      buildEvent({ id: "pilot::2026-04-03", summary: "Pilot", attendees: [{ email: "ann@example.com", displayName: "Ann Lee" }] }),
      buildEvent({ id: "gone", summary: "Cancelled thing", cancelled: true }),
    ];
    await plugin.prepareDay(true);

    const created = [...app.files.keys()].find((p) => p.startsWith("Meeting Notes/") && p.includes("Pilot") && !p.endsWith("Pilot 1.md"));
    assert.ok(created, [...app.files.keys()].join(", "));
    assert.match((app.files.get(created!) as TFile).content ?? "", /## Meeting Brief[\s\S]*Send runbook @\[\[Ann Lee\]\]/);
    assert.ok(!([...app.files.keys()].some((p) => p.includes("Cancelled thing"))));
    assert.ok(app.files.get("Meeting Hub/Meeting Tracker.md"));
    const day = (app.files.get("Meeting Hub/My Day.md") as TFile).content ?? "";
    assert.match(day, /# Friday, April 3, 2026[\s\S]*## Meetings\n\n- 10:00 AM–11:00 AM · \[\[[^\]]*Pilot[^\]]*\]\] · with Ann Lee · brief ready/);
    const { readFile } = await import("fs/promises");
    const briefing = await readFile(join(dir, "Drive", "Briefing", "Daily Briefing.md"), "utf8");
    assert.match(briefing, /^# Friday, April 3, 2026/);
    assert.doesNotMatch(briefing, /\[\[/);
    assert.match(getNotices().at(-1)?.message ?? "", /Prepared Friday, April 3, 2026 — 1 meeting, 1 new note; Daily Briefing copied/);
    assert.ok(plugin.settings.lastPreparedAt);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});

test("the nightly prep runs once after its time, catches up after a missed night, and plans tomorrow from 6 PM", async () => {
  const plugin = createPlugin(createMemoryApp());
  plugin.settings = appleSettings({ prepTime: "00:30" });
  plugin.metadataReady = true;
  let runs = 0;
  plugin.prepareDay = async () => {
    runs++;
    plugin.settings.lastPreparedAt = plugin.now().toISOString();
  };
  plugin.now = () => new Date(2026, 3, 3, 0, 20);
  await plugin.prepareIfDue();
  assert.equal(runs, 0, "not before its time");
  plugin.now = () => new Date(2026, 3, 3, 0, 31);
  await plugin.prepareIfDue();
  await plugin.prepareIfDue();
  assert.equal(runs, 1, "once a night");
  plugin.now = () => new Date(2026, 3, 5, 8, 0);
  await plugin.prepareIfDue();
  assert.equal(runs, 2, "catches up when Obsidian is next open");

  plugin.now = () => new Date(2026, 3, 5, 17, 59);
  assert.equal(plugin.planDate(), "2026-04-05");
  plugin.now = () => new Date(2026, 3, 5, 18, 0);
  assert.equal(plugin.planDate(), "2026-04-06");
});

test("notifications: before a meeting, after one that has no AI reply yet, and the morning summary, each once", async () => {
  const app = createMemoryApp([
    { path: "Meeting Notes/Pilot.md", content: "---\ntitle: \"Pilot\"\nstart: 2026-04-03T10:00\ncalendar_event_id: \"pilot\"\n---\n\n## Next Steps\n\n- [ ] Due today 📅 2026-04-03\n- [ ] Late 📅 2026-04-01\n" },
  ]);
  const plugin = createPlugin(app);
  plugin.settings = appleSettings({ morningReminderTime: "08:30" });
  const shown: string[] = [];
  plugin.notify = (title, body) => { shown.push(`${title} | ${body}`); };
  (plugin as unknown as { liveEvents: unknown[] }).liveEvents = [
    buildEvent({ id: "pilot", summary: "Pilot", start: { dateTime: "2026-04-03T10:00:00-04:00" }, end: { dateTime: "2026-04-03T10:30:00-04:00" } }),
  ];
  const at = (h: number, m: number) => { plugin.now = () => new Date("2026-04-03T00:00:00-04:00".replace("00:00", `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`)); };

  at(8, 20);
  await plugin.checkNotifications();
  assert.deepEqual(shown, []);
  at(8, 31);
  await plugin.checkNotifications();
  await plugin.checkNotifications();
  assert.deepEqual(shown, ["Your day | 1 meeting · 1 due today · 1 overdue. Click to open My Day."]);
  at(9, 56);
  await plugin.checkNotifications();
  await plugin.checkNotifications();
  assert.match(shown[1], /^Pilot at 10:00 AM \| Click to open the note\.$/);
  at(10, 41);
  await plugin.checkNotifications();
  assert.match(shown[2], /^Pilot has ended \| Import the Krisp transcript and add the AI reply/);
  assert.equal(shown.length, 3);
  at(17, 35);
  await plugin.checkNotifications();
  await plugin.checkNotifications();
  assert.deepEqual(shown.slice(3), ["Wrap up your day | 2 items slipped today. Click to wrap up and prepare tomorrow."]);
});
