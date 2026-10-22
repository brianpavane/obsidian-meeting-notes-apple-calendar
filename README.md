# Meeting Notes for Apple Calendar

An Obsidian plugin that turns your Apple Calendar into meeting notes: a note before every meeting, a Today panel with one-click join, Krisp transcripts, AI summaries by copy and paste, and action items tracked across all your meetings.

Reads events from **Apple Calendar on your Mac** — any account synced to Calendar.app, limited to the specific calendars you choose.

> **Deprecated sources:** the Google Calendar (OAuth 2.0) and iCal URL sources still work but are deprecated and may be removed in a future release. Use Apple Calendar instead — add your Google or Exchange account to Calendar.app and select its calendars in the plugin settings.

---

## Features

- **Automatic note creation** — notes appear before your meetings without any manual action
- **Local Apple Calendar** — reads Calendar.app on your Mac; choose exactly which calendars to include
- **Structured meeting notes** — searchable properties, a Meeting details box, and Agenda, Notes, Executive Summary, Next Steps, Summary by Topic, Key Decisions, Additional Items, Speakers, and Transcript sections
- **One-click join** — Zoom, Google Meet, Microsoft Teams, and Webex links are found in the event's URL, location, or description and shown as a **Join** link
- **Attendees with RSVP status** — 🟢 accepted, 🔴 declined, 🟡 tentative, ⚪ awaiting; optionally as `[[Name]]` links to your people notes
- **Notes stay in sync** — time, attendee, and location changes are applied to existing notes; moved meetings are renamed to their new date (or, if they had already started, get a new note and the old one is kept); cancelled, deleted and declined meetings are marked as such
- **Recurring meetings** — every occurrence gets its own note, linked to the previous one, with where you left off (the AI write-up's continuity points) and last meeting's open action items in the Agenda
- **Your own template** — point the plugin at a template note with placeholders, or use the built-in format
- **Daily-note links** — each meeting links to that day's daily note, so the day's meetings appear in its backlinks
- **Next meeting in the status bar** — click it, or run **Join current or next meeting**, to open the note and join
- **Meetings dashboard** — a ready-made Bases file of upcoming and recent meetings, by account, category, sentiment and outcome, customer meetings, and meetings still needing an AI summary ([guide](docs/DASHBOARDS.md))
- **Today's meetings** — a sidebar of today's meetings (arrows step to other days) with one-click **Open note**, **Join** and **New note** buttons ([guide](docs/DASHBOARDS.md))
- **Krisp transcripts** — fill a meeting's Transcript section from its Krisp recording, by command or automatically
- **AI summaries by copy and paste** — copy a meeting for Gemini, Claude, ChatGPT or Copilot (or your own agent), paste the reply back into Executive Summary, Next Steps, Summary by Topic, Key Decisions, Additional Items and Speakers, with its category, account, organizations, key topics, sentiment, outcome and speakers saved as properties; the plugin itself never goes online
- **File notes anywhere** — move finished notes into your own folders; the plugin still finds them
- **Skip rules** — no automatic notes for meetings titled Focus time, Lunch, etc., or with no one else invited
- **Action items view** — every open action item across your meetings in one sidebar, grouped by meeting, owner (`@Bob`), or due date (`📅 2026-10-10`), with priorities, ticked off in place ([guide](docs/DASHBOARDS.md))
- **Meeting tracker** — one page with overdue and upcoming items, high priorities, open items by account and person, recent decisions and this week's meetings ([guide](docs/DASHBOARDS.md))
- **Meeting insights** — analytics across your meetings: hours per week and by category, accounts needing attention (negative sentiment, blocked, gone quiet), sentiment trends, trending topics, the people you meet most, follow-through by owner and the oldest open items ([guide](docs/DASHBOARDS.md#6-meeting-insights))
- **Account overviews** — a note per customer or project with every meeting, its sentiment trend, open items, decisions, topics and people, plus space for your own notes ([guide](docs/DASHBOARDS.md#7-account-overviews))
- **Weekly review** — a note per week with its meetings, decisions, what got done and what's still open, plus space for your own wins, concerns and next week's focus ([guide](docs/DASHBOARDS.md))
- **Works with the Tasks plugin** — action items use its format (priority, created, due and done dates), for live lists in any note ([guide](docs/TASKS.md))
- **Declined event filtering** — events you have declined are skipped, when the calendar identifies you as an attendee or your email address is set
- **All-day event filtering** — all-day events (holidays, OOO blocks) are skipped
- **Configurable time window** — look ahead 1–48 hours; optionally include past events
- **Background polling** — re-checks on a configurable interval (5–120 minutes)
- **Rebuild on demand** — recreate notes for deleted events with a single button click
- Requires macOS and Obsidian 1.4.10 or later

---

## Installation

The plugin is not listed in the Obsidian Community Plugins directory. Install it with **BRAT**, which installs plugins straight from their GitHub releases and keeps them updated.

### With BRAT (recommended)

1. In Obsidian, open **Settings → Community plugins → Browse**, search for **BRAT** (by TfTHacker), then click **Install** and **Enable**
2. Open the command palette (Cmd+P) and run **BRAT: Add a beta plugin for testing**
3. Enter the repository URL: `https://github.com/brianpavane/obsidian-meeting-notes-apple-calendar`
4. Choose the latest version and click **Add Plugin**
5. Enable **Meeting Notes for Apple Calendar** under **Settings → Community plugins**

BRAT checks for new releases when Obsidian starts. To update immediately, run **BRAT: Check for updates to all beta plugins and UPDATE** from the command palette.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/brianpavane/obsidian-meeting-notes-apple-calendar/releases/latest)
2. Copy all three files to `<vault>/.obsidian/plugins/calendar-note-integration/`
3. Reload Obsidian and enable the plugin under **Settings → Community plugins**

Manual installs do not update automatically.

---

## Setup

Open **Settings → Meeting Notes for Apple Calendar**. **Calendar source** defaults to Apple Calendar.

### Apple Calendar (macOS) — recommended

Reads events from the calendars on your Mac using Apple's **EventKit** framework — no API keys, no OAuth, no Google Cloud project required. Every account synced to Calendar.app is available: iCloud, Google, Exchange/Office 365, and local calendars. EventKit reads the Mac's local calendar store, so each check takes well under a second and makes no network requests.

**Required permission:**
1. The first time the plugin reads your calendars, macOS asks:
   *"Obsidian would like to access your Calendar data"*
2. Click **OK**. If you missed it, go to **System Settings → Privacy & Security → Calendars** and set Obsidian to **Full Calendar Access** (not **Add Only**), then restart Obsidian.

**Apple Calendar settings:**

| Setting | Default | Description |
|---------|---------|-------------|
| Calendars to include | *(all)* | Toggle the specific calendars to create notes from; turning all on (or all off) includes every calendar |
| Run diagnostics | — | Checks calendar access, lists your calendars, and reads the next 7 days of events |

### Google Calendar — iCal URL (deprecated)

No Google Cloud project needed. Uses the private iCal feed URL from your Google Calendar account.

1. Open [Google Calendar](https://calendar.google.com) → **Settings (gear icon)**
2. Click your calendar name in the left sidebar
3. Scroll to **Integrate calendar**
4. Copy the **Secret address in iCal format** URL
5. Paste it into **Settings → iCal URL** in Obsidian

### Google Calendar — OAuth 2.0 (deprecated)

Full API access. Required for shared/workspace calendars or precise filtering.

**One-time Google Cloud setup:**

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a project and enable the **Google Calendar API**
3. Go to **APIs & Services → OAuth consent screen** → External → add your account as a test user
4. Go to **Credentials → Create Credentials → OAuth client ID** → Desktop app
5. Copy the **Client ID** and **Client Secret** into Obsidian Settings, then click **Sign in with Google**
6. Enter the **Calendar ID** (found in Google Calendar → Settings → Integrate calendar)

---

## Settings Reference

### Personal

| Setting | Description |
|---------|-------------|
| Your email address | Identifies your own attendee entry when the calendar doesn't. Used to omit you from the attendee table and skip events you have declined. |
| Your name | How you're written as an owner in action items (your full name; comma-separate other spellings, e.g. `John Smith, John Q. Smith` — a first name alone would also claim other people's items, and the settings warn if you enter one). Your items, and items with no owner, are listed as yours in the Tracker's Focus and the action items panel; the rest go under **Waiting on others**. Your name from calendar invites is used too |

### Note Settings

| Setting | Default | Description |
|---------|---------|-------------|
| Note folder | Meeting Notes | Vault-relative folder for created notes. You can move notes anywhere in the vault afterwards — the plugin finds them by their `calendar_event_id` property |
| Meeting Hub folder | *(empty — same as note folder)* | Folder for the Meeting Tracker, Meeting Insights, the `Meetings.base` dashboard, and the `Weekly Reviews`, `Series` and `Accounts` notes, e.g. `Meeting Hub`. After changing it, click **Move existing files** to move the ones you already have (links to them keep working; a file already in the new folder is left in place) |
| Prepare my day each night | On, 12:30 AM | Builds My Day, creates the day's meeting notes with their brief and rebuilds the Tracker each night (Obsidian open, Mac on power); a missed night is caught up when Obsidian is next open. **Prepare now** runs it straight away |
| Copy the Daily Briefing to | *(empty)* | A folder outside the vault — e.g. a Google Drive for desktop folder — where My Day is written as plain-text `Daily Briefing.md` each time it's rebuilt, for Gemini or another assistant to read |
| Notify before a meeting | 5 minutes | A Mac notification before each meeting that opens its note and brief; 0 = off |
| Notify after a meeting | On | 10 minutes after a meeting with no AI reply yet: import the Krisp transcript and add the reply |
| Morning summary | 8:30 AM | A notification with the day's meetings and what's due or overdue, opening My Day; clear to turn off |
| Wrap-up reminder | 5:30 PM | A notification with how many of your items slipped, opening Wrap up my day; clear to turn off |
| Hours in advance | 12 | Create notes for events starting within this many hours (1–48) |
| Poll interval | 30 min | How often to check for new upcoming events (5–120) |
| Include past events | Off | Also create notes for events that have already started |
| Days back | 1 | How many days back to look when past events are enabled (1–30) |
| Keep notes in sync for meetings up to this many days ahead | 30 | Notes that already exist are updated, and renamed when their meeting moves to another day, as long as the meeting is within this many days (1–90). New notes are still only created **Hours in advance** |
| Rename notes when the meeting title changes | On | When a meeting is retitled, rename its note and update its `# heading`. A note you renamed yourself keeps your name |
| Skip meetings titled | *(empty)* | Meetings whose title contains any of these words (one per line, any case) never get a note automatically — e.g. `Focus time`, `Lunch`, `Hold`. You can still create one by hand |
| Skip meetings with no one else invited | Off | Don't auto-create notes for events with no attendees besides you. Set **Your email address** so the plugin knows which attendee is you |
| Include event description | On | Add the event's description to the Agenda section of new notes |
| Link attendees | Off | Write the organizer and attendees as `[[Name]]` links instead of plain names and emails |
| Template file | *(built-in)* | A note to use as the template for new meeting notes — see [Custom templates](#custom-templates) |
| Sections in new notes | All on | Which sections the built-in format includes: Agenda, Notes, Executive Summary, Next Steps, Summary by Topic, Key Decisions, Additional Items, Speakers, Transcript. Ignored when a template file is set. Existing notes are not changed |
| Link to daily note | On | Link each meeting note to that day's daily note, using your Daily Notes format and folder |
| Show next meeting in status bar | On | Show the meeting in progress or coming up next at the bottom of the window; click it to join |
| Open Today's meetings at startup | On | Open the **Today's meetings** panel, with its **Join** buttons, in the right sidebar when Obsidian starts (if it isn't already open) |
| Date position in filename | Before | `2026-01-15 - Meeting Name.md` or `Meeting Name - 2026-01-15.md` |

### Calendar View (event picker)

| Setting | Default | Description |
|---------|---------|-------------|
| Days ahead to fetch | 7 | Look-ahead window for the event picker modal (1–30) |
| Max events to show | 20 | Maximum events listed in the picker modal (1–50) |

### Krisp Transcripts

| Setting | Default | Description |
|---------|---------|-------------|
| Krisp folder | `~/Documents/Transcripts/Krisp Meetings` | Where Krisp saves recordings on this Mac: one folder per meeting, each with a `transcript.txt` (or `transcript.md`) |
| Import transcripts automatically | Off | After each sync, offer recordings for meetings that ended in the last 2 days with an empty **Transcript** section. You confirm every import. Off: only with the command |

### AI Assistant (copy and paste)

| Setting | Default | Description |
|---------|---------|-------------|
| Include instructions when copying | On | Put the instructions in front of the copied meeting. Turn off if your assistant already has its own instructions (a Gem, custom GPT, Claude Project or Copilot agent) |
| Instructions | *(built-in)* | What the assistant is asked to do. **Copy** puts them on the clipboard; **Reset to default** restores the built-in text |
| Save the reply's details as properties | On | Save the reply's Meeting Metadata as `meeting_category`, `account`, `organizations`, `key_topics`, `sentiment`, `outcome` and `tags`, its speakers as `speakers`, and the day it was first filed as `ai_summarized` — see [AI agent instructions](docs/AGENT_INSTRUCTIONS.md) |

### Manual Actions

| Button | Description |
|--------|-------------|
| **Refresh** | Immediately fetch events, create notes for new events, and update existing notes. Notes you deleted are not recreated. |
| **Rebuild** | Same as Refresh, but also recreates notes you deleted. Runs automatically once after each install or upgrade. |

---

## Generated Note Format

```markdown
---
type: meeting
title: "Weekly Sync"
date: 2026-01-15
daily_note: "[[2026-01-15]]"
start: 2026-01-15T10:00
end: 2026-01-15T11:00
calendar: "Work"
organizer: "Alice Smith <alice@example.com>"
attendees:
  - "Alice Smith <alice@example.com>"
  - "Bob Jones <bob@example.com>"
  - "Carol White <carol@example.com>"
location: "Conference Room B"
meeting_url: "https://meet.google.com/abc-defg-hij"
conference_platform: "Google Meet"
calendar_event_id: "7F3A…::2026-01-15T15:00:00.000Z"
tags:
  - meeting
---

# Weekly Sync

> [!info] Meeting details
> **When:** [[2026-01-15|Thursday, January 15, 2026]] · 10:00 AM – 11:00 AM EST (1h)
> **Where:** Conference Room B
> **Join:** [Join Google Meet](https://meet.google.com/abc-defg-hij)
> **Organizer:** Alice Smith
> **Attendees:** 🟢 Alice Smith *(organizer)* · 🟢 Bob Jones · ⚪ Carol White

## Agenda

- Review Q1 goals
- Staffing update
- 

## Notes

- 

## Executive Summary



## Next Steps

- [ ] 

## Summary by Topic



## Key Decisions

- 

## Additional Items

- 

## Speakers



## Transcript

```

- **Properties** hold the meeting's details so you can search, sort, and query meetings (for example with Bases or Dataview). `meeting_url` is clickable in the Properties panel.
- **Meeting details** has the **Join** link, and the date links to the daily note. A cancelled meeting shows a red **Meeting cancelled** box instead.
- **Agenda** starts with the lines of the event description (when **Include event description** is on).
- **Agenda** and **Notes** are yours to fill in.
- **Executive Summary**, **Next Steps**, **Summary by Topic**, **Key Decisions**, **Additional Items** and **Speakers** follow the sections of an [AI agent's write-up](docs/AGENT_INSTRUCTIONS.md), so **Add AI reply** can fill each one — or write in them by hand. Next Steps are checkboxes, so Obsidian's task search and the Tasks plugin can collect them across meetings.
- **Transcript** is the empty section at the end of the note, for the Krisp transcript or one from your AI note-taker.

### Custom templates

Set **Template file** to a note in your vault, and new meeting notes are created from it. Use any of these placeholders:

| Placeholder | Value |
|---|---|
| `{{title}}` | Meeting title |
| `{{date}}` / `{{date_long}}` | `2026-01-15` / `Thursday, January 15, 2026` |
| `{{start_time}}` / `{{end_time}}` / `{{time}}` | `10:00 AM EST` / `11:00 AM EST` / `10:00 AM – 11:00 AM EST` |
| `{{start}}` / `{{end}}` | `2026-01-15T10:00` / `2026-01-15T11:00` |
| `{{duration}}` | `1h` |
| `{{location}}` | Location |
| `{{calendar}}` | Calendar name |
| `{{organizer}}` | Organizer |
| `{{attendees}}` | Attendees, comma-separated |
| `{{attendee_list}}` | Attendees as a bulleted list with RSVP status |
| `{{join_link}}` | `[Join Zoom](https://…)` |
| `{{meeting_url}}` / `{{platform}}` | The join URL / `Zoom` |
| `{{agenda}}` | Event description as bullets, then the previous meeting's open action items (ends with an empty bullet) |
| `{{description}}` | Event description as plain text |
| `{{description_callout}}` | Event description in a collapsed callout |
| `{{details}}` | The **Meeting details** box (kept up to date) |
| `{{daily_note}}` | Link to the day's daily note |
| `{{previous_meeting}}` | Link to the previous meeting in a recurring series |
| `{{event_id}}` | Calendar event ID |

- A line containing only placeholders that come out empty (for example `{{join_link}}` for an in-person meeting) is left out.
- The plugin always adds its calendar properties to the note's frontmatter, so updates keep working with any template. Your template's own frontmatter is kept; placeholders inside it should be quoted, for example `project: "{{calendar}}"`.
- Only the properties and the `{{details}}` box are updated later. Everything else is filled in once, when the note is created.
- Anything that isn't a placeholder — including Templater `<% %>` commands — is copied as-is. To run Templater commands, turn on Templater's **Trigger Templater on new file creation** for your meeting-notes folder.

The built-in template is:

```markdown
---
type: meeting
tags:
  - meeting
---

# {{title}}

{{details}}

## Agenda

{{agenda}}

## Notes

- 

## Executive Summary



## Next Steps

- [ ] 

## Summary by Topic



## Key Decisions

- 

## Additional Items

- 

## Speakers



## Transcript

```

### Recurring meetings

Each occurrence of a recurring meeting gets its own note, linked to the one before it:

- **Meeting details** shows a **Previous** link, and the note gets a `previous_meeting` property.
- A new note's **Agenda** starts with *Where we left off in last meeting*: the **Core Elements for Next Meeting Continuity** from the previous meeting's Executive Summary, when an [AI write-up](docs/AGENT_INSTRUCTIONS.md) was filed there.
- It then lists the previous meeting's open action items under *Open items from last meeting*. They are plain bullets rather than checkboxes, so each item stays a single task in the earlier note — tick it off there or in the **Meeting action items** view.

Only meetings that repeat in Apple Calendar are linked; separate events that happen to share a title are not.

**Series notes.** Click the **repeat** icon at the top of a recurring meeting's note (or on its row in **Today's meetings**), or run **Open series note**, to open one note for the whole series in the `Series` folder of your Meeting Hub folder. It has **Purpose** and **Standing agenda** sections for you, and a part the plugin rebuilds each time you open it: **Where we left off** (the latest meeting's continuity points), every occurrence (newest first, with ones that didn't happen struck through), open items across the series, and recent decisions. Each occurrence's note gets a **Series:** link back to it and a `series` property. For a **1:1** — a series where every meeting is just you and one other person — the series note also lists what they owe you from *any* meeting and what you owe them from any meeting with them, so it doubles as that person's page. If you edit "this and all following events" of a Google meeting, Calendar.app may start a new series, so the occurrences from then on can get their own series note.

The **Previous** link skips occurrences that didn't happen (cancelled, deleted from the calendar, or declined), so it always points to the last meeting that took place. Moving a single occurrence to another day renames its note (or, if it had already started, keeps the note and creates a new one); it stays in the series.

### Daily notes

With **Link to daily note** on, each meeting note gets a `daily_note` property linking to that day's daily note, named and placed according to Obsidian's **Daily notes** settings. Open a daily note and its **Backlinks** pane lists that day's meetings. To show them inside the daily note, add this to your daily-note template (requires the Dataview plugin):

````markdown
```dataview
TABLE start, location FROM [[]] AND #meeting SORT start
```
````

The plugin never edits daily notes, and the link moves with the meeting if it is rescheduled.

### Keeping notes up to date

Every poll, Refresh, and Rebuild updates the notes of meetings in the time window. The plugin only rewrites the calendar properties listed above (title, date, daily note, previous meeting, series, start, end, calendar, organizer, attendees, location, meeting link, status, and event ID) and the **Meeting details** box. Everything else in the note — your writing, extra properties, and tags you add — is never changed.

If a meeting moves to another day, its note is renamed to the new date on the next sync (a title you edited in the filename is kept). This works for any new date within **Keep notes in sync for meetings up to this many days ahead** (30 days by default), even though new notes are only created **Hours in advance**. The plugin compares the date in the filename with the meeting's, so a note whose rename was blocked once is renamed as soon as it can be.

If the meeting had already started when it was moved — an organizer reusing the invite for a follow-up call, say — its note is not renamed. It stays the record of the day it took place, with its transcript, summary and notes untouched, and gets a `moved_to` property with the new date. The plugin stops syncing it and creates a new note for the new day (when that day comes within **Hours in advance**), linked back to the earlier note as its **Previous** meeting, with its open action items carried over. If you deleted the new note, it isn't recreated.

If a meeting is retitled, its note is renamed to the new title and its `# heading` updated (turn off **Rename notes when the meeting title changes** to keep the old name). A note you renamed yourself keeps your name; only its date changes.

A rename never overwrites another note. If two notes are for the same meeting — the same calendar event *and* the same date — or a note can't be renamed because another note already has the new name, the plugin shows one notice naming the notes — click a name to open it, copy what you need into one, and delete the other. Notes for different occurrences of a recurring meeting are never reported. In the background each case is shown once per Obsidian session and the notice closes after 20 seconds; **Refresh** shows it again and keeps it open.

If a meeting disappears from Apple Calendar (deleted rather than cancelled), its note is marked `status: removed` with a red **Meeting removed from calendar** box. This only happens for meetings in the time window and from calendars the plugin read, so turning a calendar off never marks its notes. If the meeting comes back — for example it was moved further out than the sync range and is now back in it — the next sync restores the note.

If you decline a meeting that already has a note, the note is marked `status: declined` with a yellow **Meeting declined** box. Accept it again and the next sync restores the note. No new notes are created for declined meetings.

Cancelled, removed and declined meetings are left out of the meeting lists in the Meeting Tracker and weekly reviews, but any action items you wrote in their notes are still listed. Notes created by versions before 6.7 get their properties updated but keep their original layout.

### Filing notes into your own folders

New notes are created in the **Note folder**, but you can move them anywhere in the vault once the meeting is done, as many folder levels deep as you like. The plugin finds meeting notes anywhere by their `calendar_event_id` property, so a filed note keeps its **Open note** button, its action items, its **Previous** link from the next meeting in the series, and its calendar updates. If a filed meeting moves to another day, the note is renamed in the folder you filed it in.

### Krisp transcripts

If you record meetings with Krisp, the plugin can copy a recording's transcript into the note's **Transcript** section. Set **Krisp folder** in settings (default `~/Documents/Transcripts/Krisp Meetings`), open the meeting note, and run **Import Krisp transcript into this note**.

- **Nothing is imported without your OK.** A window shows the meeting and the recording it found, with a dropdown of other likely recordings and **Don't import**. Click **Import** to go ahead, or **Choose another recording…** to pick from every recording.
- Recordings are matched by the start time in the transcript header (or folder name). Any recording started from 10 minutes before the meeting until it ends is offered, best first: a matching title, then a start within the usual join window (2 minutes early to 7 minutes late), then the closest start. Generic titles like "Zoom meeting" are fine — back-to-back meetings each get the recording that started nearest their own start, and a recording that started after a meeting ended is never offered for it.
- Only the transcript is copied; Krisp's header (title, time, length) is left out.
- The transcript only goes into an empty Transcript section; clear the section to import again.
- The note records which recording it came from (`krisp_recording`), so the same recording isn't offered for another meeting.
- Turn on **Import transcripts automatically** to be offered transcripts after every sync, for all meetings that ended in the last 2 days, in one window. Double-booked meetings never start with the same recording selected. Meetings you skip (or close the window on) aren't offered again until Obsidian restarts. It's off until you turn it on.

### AI summaries (copy and paste)

Use any AI assistant your organization approves — Gemini, Claude, ChatGPT, Copilot, or a custom agent of your own. The plugin never contacts any of them; it copies text for you to paste and files the reply you copy back:

1. In the meeting note, click the **Copy meeting for AI assistant** icon (clipboard with an arrow) in the note's top-right corner — or the same button on the meeting in **Today's meetings**. It copies a **MEETING DETAILS** block from your calendar (title, date, time, attendees), your **Notes** and the **Transcript** — with the plugin's instructions in front, unless you turned **Include instructions when copying** off.
2. Paste it into your assistant, then copy its whole reply.
3. Click the **Add AI reply** icon (clipboard with a page) next to it.

Every meeting note's header also has an **Import Krisp transcript** icon (a file with a sound wave). All three are commands too (**Cmd + P**), for hotkeys.

The reply has six sections — **Executive Summary**, **Next Steps**, **Summary (by topic)**, **Key Decisions/Agreements**, **Additional Items** and **Speakers** — both from the built-in instructions and from your own agent (see **[AI agent instructions](docs/AGENT_INSTRUCTIONS.md)**). Each goes into the note section of the same name:

- **Next Steps** like `- [ ] **Bob Jones**: Send the scope (2026-10-09)` become checkboxes in the [Tasks plugin's format](docs/TASKS.md): owners as `@[[Full Name]]` (or `(owner: Customer IT team)` for a team), the date added as `➕ YYYY-MM-DD` and a `YYYY-MM-DD` deadline as the due date `📅 YYYY-MM-DD`.
- **Key Decisions/Agreements** go into **Key Decisions**, the topic write-up into **Summary by Topic**, and the speaker table into **Speakers**.

Running it again with the same reply is safe: Executive Summary, Summary by Topic, Additional Items and Speakers are **replaced**, and next steps and decisions already in the note (ticked or not) aren't added twice. Your own writing in Notes, Next Steps and Key Decisions is kept.

Older notes keep their **Meeting Summary**, **Decisions** and **Action items** sections; a reply fills those, and adds the new sections before the Transcript. Replies in the older formats (a short **Summary** / **Decisions** / **Action items** reply, or a full report with an action items table and **Category**, **Account / Project** and **Search Tags** fields) are still understood.

Both steps are optional. The note's sections are there for you to write in by hand either way.

---

## Commands

| Command | Description |
|---------|-------------|
| **Create note from calendar event** | Opens a fuzzy-search modal to pick any upcoming event |
| **Create note for next upcoming event** | Immediately creates and opens a note for the next upcoming event |
| **Auto-create notes for events in the next N hours** | Runs the same sweep as the background poll right away (N = **Hours in advance**) |
| **Join current or next meeting** | Opens the note for the meeting in progress (or starting within 30 minutes), creating it if needed, and opens its join link |
| **Open meetings dashboard** | Opens `Meetings.base` in your Meeting Hub folder (created on first use) |
| **Open today's meetings** | Shows today's meetings in the right sidebar, with Open note and Join buttons, arrows to other days, and a New note button |
| **Open meeting action items** | Shows every open action item from your meeting notes in the right sidebar |
| **Open this week's review** / **Open last week's review** | Creates (or refreshes) the week's review note in `Weekly Reviews` inside your Meeting Hub folder — see [Weekly review](docs/DASHBOARDS.md#5-weekly-review) |
| **Open series note** | For a recurring meeting's note: creates (or refreshes) the series note in `Series` inside your Meeting Hub folder — see [Recurring meetings](#recurring-meetings) |
| **Open meeting insights** | Rebuilds and opens `Meeting Insights.md` in your Meeting Hub folder, and refreshes every account overview — see [Meeting insights](docs/DASHBOARDS.md#6-meeting-insights) |
| **Open account overview** | In a meeting note with an `account`, rebuilds and opens that account's note in `Accounts` inside your Meeting Hub folder — see [Account overviews](docs/DASHBOARDS.md#7-account-overviews) |
| **Open meeting tracker** | Rebuilds and opens `Meeting Tracker.md` in your Meeting Hub folder: your Focus list, overdue, due soon, high priority, waiting on others, gone stale, by account, recent decisions, this week's meetings |
| **Open My Day** | Rebuilds and opens `My Day.md` in your Meeting Hub folder: the day's meetings, your focus, what attendees owe you, loose ends — tomorrow's from 6 PM. See [My Day](docs/DASHBOARDS.md#my-day-and-the-daily-briefing) |
| **Prepare my day** | Gets the day ready now (it also runs each night at 12:30 AM): the day's meeting notes with their briefs, the Meeting Tracker, My Day and the Daily Briefing |
| **Add tasks from an email or chat message** | Paste an email or Slack/Teams thread, copy it for your AI assistant, then paste its reply to add the action items to My To-Dos, tagged with where they came from |
| **Wrap up my day** | Goes through your items that slipped today and new ones without a date — Done, Tomorrow, Next week, Park or Won't do — then prepares tomorrow |
| **Add a to-do** | Opens a quick box to add a task that isn't from a meeting to `My To-Dos.md` in your Meeting Hub folder (also a ribbon icon and a **+ To-do** button in the action items panel) |
| **Open my to-dos** | Opens `My To-Dos.md`, creating it if needed |
| **Refresh meeting brief** | In an upcoming meeting's note, rebuilds its **Meeting Brief**: the account's state, where you left off, what attendees owe you and what you owe — see [Meeting Brief](docs/DASHBOARDS.md#meeting-brief) |

The tracker, insights, weekly reviews, series notes and account overviews also rebuild themselves whenever you open them, however you get there, and have a **↻** icon at the top right to rebuild them while open. Their open items are checkboxes: ticking one checks it off in its meeting note. **Add AI reply** updates the overview of the account it saves — see [Keeping the Meeting Hub notes current](docs/DASHBOARDS.md#keeping-the-meeting-hub-notes-current).
| **Import Krisp transcript into this note** | Suggests the open note's Krisp recording and, once you confirm, fills its empty Transcript section — see [Krisp transcripts](#krisp-transcripts) |
| **Copy meeting for AI assistant** | Copies the open note's meeting details, notes and transcript (and, if switched on, the instructions) — see [AI summaries](#ai-summaries-copy-and-paste) |
| **Add AI reply to this meeting** | Files the AI reply on the clipboard into the open note's Executive Summary, Next Steps, Summary by Topic, Key Decisions, Additional Items and Speakers |

The plugin adds six buttons to the ribbon (the icon strip on the far left of the window):

| Icon | Opens |
|---|---|
| Calendar | The event picker — same as **Create note from calendar event** |
| Calendar with clock | The **Today's meetings** panel |
| Checklist | The **Meeting action items** panel |
| Dashboard (four squares) | The **Meetings dashboard** |
| Gauge | The **Meeting tracker** |
| Calendar with check mark | **This week's review** |

Hover over a button to see its name.

### Status bar

The status bar at the bottom of the window shows the meeting in progress (*Now: Standup · ends in 10 min*) or the next one (*Next: Design Review in 25 min*, *at 3:00 PM*, or *tomorrow at 9:00 AM*). Click it to open the meeting's note and join link. Turn it off with **Show next meeting in status bar**.

---

## Dashboards

New to these? **[Dashboards — a step-by-step guide](docs/DASHBOARDS.md)** explains what each one is, where to find it, and how to use it. Setting everything up for the first time? See **[Recommended setup](docs/SETUP.md)**. Using the Tasks plugin? See **[Tasks and meeting action items](docs/TASKS.md)**.

### Today's meetings

Click the **calendar-with-clock** button in the left ribbon (or run **Open today's meetings**). A panel in the right sidebar lists today's meetings in order: finished ones faded, the current one marked **Now**. Under each title is a link to the meeting's note or, if it has none, **Note deleted**, **No note was created** (past meetings) or **Note not created yet** (meetings still to come), so stepping back through past days finds meetings whose note you deleted. Each has an **Open note** (or **Create note**, or **Recreate note** for a deleted one) button and, while the meeting is still to come or in progress, a **Join** button. Use the **‹** / **›** arrows beside the date to see the day before or after, and **Today** to come back. **New note** asks for a title and creates a note from your template for a meeting that isn't on your calendar, dated on the day shown. Once a meeting has started and has a note, it also gets three small buttons: **Import Krisp transcript**, **Copy meeting for AI assistant** and **Add AI reply** (hover for the name). It re-reads the calendar every 5 minutes, or straight away with **Refresh**.

### Meetings dashboard

Click the **dashboard** button in the left ribbon (or run **Open meetings dashboard**). It creates a [Bases](https://obsidian.md/help/bases) file (Obsidian 1.9 or later) listing every meeting note, with **Next 7 days**, **Last 7 days**, **By account**, **By category**, **Customer meetings**, **By sentiment**, **By outcome**, **Needs AI summary**, **AI-summarized** and **All meetings** views. It is an ordinary `.base` file — edit its columns, filters, and views like any other base. Views added in later versions are added to your copy once.

### Meeting action items

Click the **checklist** button in the left ribbon (or press **Cmd + P** and run **Open meeting action items**). This opens a panel in the right sidebar listing every unchecked task (`- [ ] …`) in your meeting notes, grouped by meeting with the newest first. Click a meeting to open its note; tick an item to check it off in that note. The list updates as you edit notes, and needs no other plugins.

Give an item an owner with `@Name` (or `@[[Full Name]]`) and a due date with `📅 2026-10-10` or `[due:: 2026-10-10]` (the Tasks plugin's formats). The menu at the top of the panel groups items **By meeting**, **By person**, or **By due date** (Overdue, Today, Next 7 days, Later, No due date); overdue dates show in red.

---

## Troubleshooting

### Apple Calendar — no events found

1. Run **Settings → Apple Calendar → Run Diagnostics** to identify the issue
2. Verify Obsidian has **Full Calendar Access** in **System Settings → Privacy & Security → Calendars**, then restart Obsidian
3. Open Calendar.app and check the meeting appears there — the plugin sees exactly what Calendar.app has synced

If the plugin can't read your calendar during a background check, it shows one notice and keeps retrying; the notice appears again only after a later failure that follows a success.

### Notes not being created

- Check **Hours in advance** — events too far in the future are not in the window yet
- Check **Your email address** — if set, declined events are filtered out
- Use the **Rebuild** button (Settings → Manual Actions) to force a re-check
- Cancelled meetings never get a new note
- Check the Obsidian developer console (Cmd+Option+I → Console) for `[CalendarNoteIntegration]` warnings and errors. For step-by-step Apple Calendar fetch details, set the console's log level to include **Verbose**.

### Google Calendar — authentication errors

- **OAuth**: click **Sign in with Google** in Settings to refresh the token
- **iCal**: verify the secret iCal URL is still valid; regenerate it in Google Calendar if needed

---

## Privacy and Security

| Mode | Data handling |
|------|--------------|
| Apple Calendar | All data stays on-device. No network requests are made by the plugin; Calendar.app manages its own syncing independently. |
| Krisp and AI assistants | Krisp transcripts are read from a folder on this Mac. Meetings are only copied to your clipboard for an AI assistant; you choose where to paste them. |
| iCal URL | The plugin fetches your iCal URL directly from Obsidian. The URL is stored encrypted in your vault. |
| OAuth | Access tokens are stored encrypted in your vault. The plugin requests read-only scope (`calendar.readonly`). No data is sent to any third-party server. |

Security measures in the code:

- All user-controlled strings written to YAML frontmatter are escaped to prevent injection
- Markdown table fields (attendee names/emails) are sanitised against pipe/newline injection
- Conference link URIs must be HTTPS before they are embedded
- JXA scripts interpolate only validated integers (never raw user strings)
- `execFile` is used instead of `exec` — no shell expansion possible
- OAuth refresh tokens are preserved across refreshes to prevent auth loss
- JXA output is capped at 5 MB before JSON parsing to prevent OOM

---

## Building from Source

```bash
git clone https://github.com/brianpavane/obsidian-meeting-notes-apple-calendar.git
cd obsidian-meeting-notes-apple-calendar
npm install
npm run build   # production build -> main.js
npm run dev     # watch mode for development
```

---

## License

MIT
