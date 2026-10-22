# Changelog

All notable changes to **Meeting Notes for Apple Calendar** (formerly Calendar Note Integration - Apple-iCal-Google) are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versioning follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added

**Today's meetings shows each meeting's note, or why it has none**
Every meeting in the Today's meetings panel now has a line under its title. It links to the meeting's note, or says **Note deleted**, **No note was created** (a past meeting) or **Note not created yet** (a meeting still to come). Step back with the ‹ arrow to find past meetings whose note you deleted. Their button reads **Recreate note**, so you can bring the note back and fill it in.

### Changed

**Notes made from the Today panel or the event picker count as made**
A note created by clicking **Create note** is now remembered like one the plugin created on its own. If you delete it, the panel shows **Note deleted**, and Refresh doesn't bring it back. Rebuild still does.

---

## [6.24.2] – 2026-10-13

### Changed

**Docs and examples use generic names**
The ready-made AI agent instructions in `docs/AGENT_INSTRUCTIONS.md`, the **Your name** setting's hint, the README and the changelog no longer name a real person, employer, customer or colleague. The agent now takes your name from the `Me:` line the plugin already sends, and the examples use placeholder names such as John Smith and ABC Corp. The docs now point out where to add your own product terms, customers and projects.

---

## [6.24.1] – 2026-10-12

### Fixed

**A meeting moved after it took place gets a new note**
When an organizer reuses an invite for a follow-up call by moving it to another day, the note of the meeting that already happened is no longer renamed and re-dated with its transcript and summary still in it. That note now stays as the record of its day, with a `moved_to` property giving the new date, and the meeting gets a new note for the new day, linked to the earlier one as its Previous meeting with its open action items carried over. Meetings moved before they start are still just renamed.

---

## [6.24.0] – 2026-10-10

### Added

**Tasks from email and Slack/Teams**
**Add a to-do** now records where a task came from (Email, or Slack or Teams) and an optional link back to the message. A new **Add tasks from an email or chat message** command takes a pasted message through your AI assistant (copy/paste, as with meeting replies) and adds its action items to My To-Dos with owners, dates and priorities.

**1:1 series notes show what each of you owes**
The series note of a recurring 1:1 (every meeting just you and one other person) now also lists what that person owes you from any meeting, not only the 1:1, and what you owe them from any meeting with them.

**Wrap up my day**
A new end-of-day window lists your items due today or overdue, and items added today without a date, each with Done, Tomorrow, Next week, Park and Won't do, then **Prepare tomorrow**. Open it from My Day, the command, or a 5:30 PM reminder.

**Desktop notifications**
Mac notifications before each meeting (with whether its brief is ready), 10 minutes after a meeting that still has no AI reply (import the Krisp transcript and add the reply), and a morning summary of the day's meetings and what's due or overdue that opens My Day. Each can be set or turned off in the settings.

**My Day, prepared each night, and a Daily Briefing for Gemini**
A new **My Day** page (sun icon) shows the day's meetings with their brief status and Join links, your focus, what the people you're meeting owe you, others' overdue items, loose ends (meetings without their AI reply, Krisp recordings to import) and what you've done — tomorrow's from 6 PM. Each night at 12:30 AM (or with **Prepare my day**) the plugin creates the day's meeting notes with their briefs, rebuilds the Tracker and My Day, and can copy My Day as plain text to a Google Drive folder as `Daily Briefing.md` for Gemini Enterprise to read. A missed night is caught up as soon as Obsidian is open.

**Warning for a first name alone in Your name**
The **Your name** setting now warns when an entry is a single name like "John": items owned by anyone else written as just "John" would count as yours. Matching is always on the whole name, so with your full name only, another John's items stay theirs.

---

## [6.23.0] – 2026-10-10

### Added

**Park an item: kept for the account or series, off your list**
A new **Park** button (⏸) in the action items panel tags an item `#parked`. It stays open and keeps showing, marked *parked*, in the account overview, series note, Meeting Brief, the Tracker's Open items by account and the next meeting's Agenda — but leaves your Focus, Overdue, Due soon, High priority, Waiting on others and Gone stale? lists and the panel's Mine view. A new **Parked** view in the panel lists them, with **Unpark** to put one back.

### Changed

**A readable Meeting Tracker, however many items you have**
Open items by account and Waiting on others now show 10 items per account or person, most pressing first, then "…and N more" with a link to the account overview (or a pointer to the action items panel). Gone stale? shows 25 at a time. In a vault with thousands of open items the tracker shrinks from about 14,000 lines to about 1,200.

### Fixed

**Items assigned to "me" count as yours**
Next steps an AI reply assigned to "You" or "Me" (saved as `(owner: me)`) were listed under Waiting on others; they're now yours in Focus, the action items panel and the Meeting Brief.

**Old weekly reviews stay as they were**
Opening a weekly review older than last week no longer rewrites it with today's open and overdue items, so it stays a record of its week. This week's and last week's still refresh when opened, and any review's ↻ icon still rebuilds it.

**A hub tick that can't be matched says so**
Ticking an item in a Meeting Hub note after its wording changed in the meeting note used to do nothing silently. The plugin now says it couldn't find the item and rebuilds the list from the notes as they are. Ticked lines you write yourself, outside the part the plugin rebuilds, are left alone.

**Meeting Brief shows only this account's items**
The brief's *They owe you* listed an attendee's open items from every meeting, so a colleague's items for another customer could appear in a customer meeting's note. It now lists only items from this meeting's series or account; a meeting with neither, like an ad-hoc 1:1, still shows everything the attendees owe you.

**AI priorities read in more shapes**
A next step's priority is now read when the assistant writes it as `(2026-10-09 – High)`, `[High]`, `(**High**)` or `(High priority)`, not only `(2026-10-09, High)`.

**Hub notes refresh on open right after an update**
After the plugin was updated or re-enabled mid-session, hub notes and Meeting Briefs didn't refresh when opened until some note changed. They now do straight away.

**Meeting Brief never changes while you take notes**
The brief used to refresh whenever its note was opened during the meeting, rewriting the note you were typing in. It now refreshes on its own only in the hour before the meeting starts; its icon still refreshes it any time.

**A damaged Meeting Brief is replaced cleanly**
If one of the brief's hidden markers was deleted, the next refresh left the old brief behind as a second copy. The brief is now replaced in one piece and a leftover marker is removed, without touching your writing.

**Meeting Brief kept apart from the Meeting details box**
The brief is always separated from the details box above it by a blank line, so a template without one can't pull the brief into the box.

---

## [6.22.0] – 2026-10-10

### Fixed

**Meeting notes no longer hidden from the hub when they share a calendar id**
If two meeting notes had the same `calendar_event_id`, as older notes for different weeks of a recurring meeting can, the Meeting Tracker, Insights, account overviews, series notes, weekly reviews and the action items panel counted only one of them, so the other's open items silently disappeared. Every meeting note is now included.

### Changed

**Tracker sections reorganized around your own items**
**Open items by person** is replaced by **Waiting on others**, and the At a glance counts are now your items, plus what others owe you and what's gone stale.

**Meeting Hub notes keep themselves up to date**
The Meeting Tracker, Meeting Insights, weekly reviews, series notes and account overviews are now rebuilt whenever you open them — from the file list, a link or search, not only from their ribbon button or command — so they no longer show stale meetings. Their *Updated* line says so.

**Add AI reply updates the account's overview**
When a reply saves an account, that account's overview note is brought up to date (or created) straight away, so the meeting shows up there without any other step.

### Added

**Meeting Brief in each upcoming meeting's note**
New notes for upcoming meetings start with a Meeting Brief: the account's state (last met, sentiment, outcome, at risk), where you left off, what the attendees owe you and what you owe from this series or account. It refreshes when you open the note in the hour before the meeting, or with the new brief icon at the top right, and is removed once you add the AI reply.

**My To-Dos for tasks that aren't from a meeting**
**Add a to-do** (a ribbon icon, a command and a **+ To-do** button in the action items panel) adds a task, with an optional due date and priority, to a My To-Dos note in the Meeting Hub. To-dos are ranked into the Tracker's Focus with your meeting items, lead the action items panel, and count in the weekly review.

**Clearer ribbon tooltips**
Each of the plugin's ribbon icons now has a tooltip saying what it opens, not just its name.

**The AI ranks each next step: High, Medium, Low or Someday**
The built-in AI instructions and the Meeting Scribe agent instructions now ask for a priority at the end of each next step's brackets, e.g. `(2026-10-09, High)`, with at most 5 High per meeting (ideally 3) and at most 2 of them yours. **Add AI reply** turns it into the Tasks priority mark (⏫ 🔼 🔽 ⏬). Someday items never appear in Focus and go straight to **Gone stale?**. **Copy meeting for AI assistant** now adds a `Me:` line with your name so the AI knows which items are yours. Update your saved agent's instructions from `docs/AGENT_INSTRUCTIONS.md` to use it.

**Focus: your most pressing items at the top of the Tracker**
The Meeting Tracker opens with a short Focus list of your 7 most pressing items, each tagged with why: overdue, due soon, high priority, for an at-risk account (latest meeting Negative or Blocked), or from this week. Overdue, Due soon and High priority now list only your items.

**Mine vs. Waiting on others**
A new **Your name** setting (plus your name from calendar invites) tells the plugin which items are yours. Items others own move to a **Waiting on others** section in the Tracker, grouped by person, and the action items panel gets a **Mine / Waiting on others / Everyone** menu.

**Won't do, and Gone stale?**
Drop an item you won't do with the **×** next to it in the action items panel: it's marked cancelled (`- [-]`, the Tasks plugin's format) and leaves every list without counting as done. The Tracker's new **Gone stale?** section lists undated items from meetings over 30 days ago; ticking one there marks it won't do.

**Check items off straight from the Meeting Hub**
Open items in the Meeting Tracker, account overviews, series notes and weekly reviews are now checkboxes. Ticking one checks it off in the meeting note it came from and removes it from the hub note, so you no longer have to open each meeting to clear its items. If you use Tasks plugin queries, exclude your Meeting Hub folder (for example in Tasks' Global query) so items aren't listed twice; the plugin's settings show a warning with the line to add until you do.

**Refresh icon on Meeting Hub notes**
A ↻ icon at the top right of each Meeting Hub note rebuilds it while it's open, for example after adding an AI reply in another tab.

---

## [6.21.1] – 2026-10-09

### Fixed

**Account saved from more AI reply layouts, so meetings show up in the Meeting Hub again**
**Add AI reply** missed the account when the assistant wrote `Account/Project` without spaces, put the Meeting Metadata in a table or without bold labels, or placed it after the six sections. The meeting then had no `account` property and was left out of account overviews and Insights' accounts. All of these layouts are now read; run **Add AI reply** again on an affected note to add the account.

---

## [6.21.0] – 2026-10-08

### Fixed

**Recurring meetings no longer reported as "notes for the same meeting"**
Occurrences of a Google recurring meeting that had been moved were all given the same id, so their notes, though for different weeks, were reported as duplicates (and could be matched to the wrong occurrence). Each moved occurrence now keeps an id of its own, notes saved with the older id are matched again, and occurrences read without recurrence details get their date added. The warning now only lists notes with the same meeting and the same date.

**One duplicate-notes notice that closes by itself**
All duplicate and blocked-rename cases are shown in a single notice. After a background sync it closes after 20 seconds instead of staying on screen over the sidebar; **Refresh** still shows it until you close it.

### Added

**Open Today's meetings at startup**
A new setting (on by default) opens the **Today's meetings** panel, with its **Join** buttons, in the right sidebar when Obsidian starts, without taking focus.

---

## [6.20.1] – 2026-10-08

### Changed

**Agent instructions include the Meeting Metadata and list only people in the transcript**
The Meeting Scribe instructions in `docs/AGENT_INSTRUCTIONS.md` now include the Meeting Metadata block directly, so the dashboards fill without an add-on. They also tell the agent that the `Attendees:` line is only the invite list: only people who speak in the transcript appear in Speakers, own next steps or are credited with decisions, and the invite list is used only to complete a name the transcript already gives. The built-in instructions follow the same rule. Next Steps deadlines are asked for as `YYYY-MM-DD` dates so they become due dates.

---

## [6.20.0] – 2026-10-08

### Changed

**Meeting notes follow the AI write-up's six sections**
New notes now have **Executive Summary**, **Next Steps**, **Summary by Topic**, **Key Decisions**, **Additional Items** and **Speakers** between Notes and Transcript, in place of Decisions, Action items and Meeting Summary. Each can be switched off under **Sections in new notes**. Existing notes keep their sections.

**Add AI reply files the six-section write-up**
A reply with Executive Summary, Next Steps, Summary (by topic), Key Decisions/Agreements, Additional Items and Speakers fills the note section of the same name. Next steps such as `- [ ] **Bob Jones**: Send the scope (2026-10-09)` become tasks with `@[[Bob Jones]]` as owner and a due date. In older notes the reply fills Meeting Summary, Decisions and Action items and adds the new sections before the Transcript. Older reply formats are still understood.

**New agent and built-in instructions**
`docs/AGENT_INSTRUCTIONS.md` now holds the Meeting Scribe & Action Intelligence Agent instructions. They resolve transcript speakers to `[[wiki-linked]]` names and end the Executive Summary with 3–5 **Core Elements for Next Meeting Continuity**. The Meeting Metadata block is an optional add-on there. The built-in instructions ask for the same format, metadata included.

**Next Steps owners written as wiki-links**
`- [ ] **[[Jane Doe]]**: …` and `**[[Tom Clark]], [[John Smith]]**: …` become tasks owned by `@[[Jane Doe]]` and so on; a team such as `[[XYZ]] Network Team` becomes `(owner: [[XYZ]] Network Team)`. Wiki-linked names in the Speakers table and metadata are saved as plain names.

**The summary's horizontal rule no longer turns it into a heading**
The `---` the agent puts after the Executive Summary paragraph is filed with blank lines around it, so Obsidian doesn't read the paragraph as a heading.

### Added

**Where we left off**
A recurring meeting's new note opens its Agenda with the previous meeting's **Core Elements for Next Meeting Continuity**, ahead of its open items. Series notes and account overviews show them under **Where we left off**.

**Meeting Metadata in AI replies**
The built-in instructions (and the optional add-on to the agent instructions) start the reply with a Meeting Metadata block: category, account / project, organizations, key topics, sentiment, outcome and search tags. **Add AI reply** saves them as the note's `meeting_category`, `account`, `organizations`, `key_topics`, `sentiment`, `outcome` and `tags` properties, the Speakers table's names as `speakers`, and the day the first reply was filed as `ai_summarized`. The setting is now called **Save the reply's details as properties**.

**Meeting insights**
A new **Open meeting insights** command and ribbon button build `Meeting Insights.md` in the Meeting Hub. It covers the last 30 days at a glance, accounts needing attention (negative or mixed sentiment, blocked, gone quiet), meetings and hours per week, time by category with a pie chart, an accounts table with sentiment trends, sentiment and outcome counts, trending topics, the people you meet most, action items by owner, the oldest open items, meetings still needing an AI summary, and the busiest weekdays.

**Account overviews**
One note per account in the Meeting Hub's **Accounts** folder. It lists every meeting with its sentiment and outcome, open items, recent decisions, key topics, people and organizations, and has Overview and Key contacts sections for your own notes. Opening insights refreshes all of them; **Open account overview** opens the current meeting's account.

**New dashboard views**
`Meetings.base` gains **Customer meetings**, **By sentiment**, **By outcome**, **Needs AI summary** and **AI-summarized** views. An existing dashboard gets them added once when you next open it; a built-in view you delete stays deleted.

---

## [6.19.0] – 2026-10-07

### Added

**Series notes for recurring meetings**
Click the new **repeat** icon on a recurring meeting's note or its row in **Today's meetings**, or run **Open series note**, to get one note for the whole series in **Meeting Hub/Series**. It has **Purpose** and **Standing agenda** sections for you, and lists every occurrence, open items across the series and recent decisions, refreshed each time you open it. Each occurrence's note links back to it.

**Notes are renamed when a meeting's title changes**
A new setting, **Rename notes when the meeting title changes** (on by default), renames a retitled meeting's note and updates its heading. Notes you renamed yourself keep your name.

**Choose how far ahead existing notes are kept in sync**
A new setting, **Keep notes in sync for meetings up to this many days ahead** (default 30), so a meeting moved up to a month out has its note renamed straight away instead of being marked removed.

**Warning about duplicate meeting notes**
When two notes are for the same meeting, or a note can't be renamed because another note has the new name, a notice names both notes with links, so you can merge them.

### Fixed

**A note whose rename was blocked once is renamed later**
If a moved meeting's note couldn't be renamed because a note with the new name existed, deleting that note didn't help: the plugin had already updated the time and never retried. It now compares the date in the filename with the meeting's, so the rename happens on the next sync.

---

## [6.18.0] – 2026-10-07

### Added

**Declined meetings are marked in their notes**
If you decline a meeting that already has a note, the note now gets `status: declined` and a yellow **Meeting declined** box instead of keeping stale details. Accepting again restores it.

### Fixed

**Skipped occurrences no longer break a recurring meeting's Previous link**
When one occurrence of a weekly meeting was cancelled, deleted or declined after its note was made, the next week's **Previous** link (and its carried-over items) pointed to the meeting that didn't happen. It now points to the last meeting that took place.

**Meetings that didn't happen aren't counted in the tracker or weekly review**
Cancelled, removed and declined meetings are left out of the Meeting Tracker's and weekly review's meeting lists and counts. Any open items written in their notes are still listed.

---

## [6.17.1] – 2026-10-07

### Fixed

**Moving one occurrence of a Google recurring meeting no longer creates a second note**
When a single occurrence of a recurring meeting from a Google account was moved, Calendar.app gave it a new identifier, so the plugin made a new note for the new date and left the old one behind. The moved occurrence now keeps matching its existing note, which is renamed to the new date. A note already created this way for the moved occurrence is recognised too and becomes the meeting's note; if both notes exist, the original is kept in sync, so delete the one you don't want.

---

## [6.17.0] – 2026-10-07

### Added

**Meeting Hub folder**
A new **Meeting Hub folder** setting keeps the Meeting Tracker, the Meetings dashboard and Weekly Reviews out of your meeting-notes folder. Leave it empty to keep them in the note folder as before. A **Move existing files** button moves the ones you already have, keeping links to them and your writing in weekly reviews.

### Fixed

**Notes of meetings moved to a later day are renamed right away**
Moving a meeting from today to later in the week used to leave its note under the old date until the new day came within the creation window. The next sync now renames the note to the new date and updates its time, as long as the new date is within the look-ahead range (7 days by default).

---

## [6.16.0] – 2026-10-07

### Added

**Weekly review**
**Open this week's review** (and a new ribbon button) creates a note per week in a **Weekly Reviews** folder inside your meeting-notes folder (created if needed), showing the week's meetings by day, decisions, items done, items still open and anything overdue, with **Wins**, **Concerns** and **Next week's focus** sections for you. Reopening it refreshes the numbers and keeps what you wrote. **Open last week's review** looks back at the week before.

**One-click buttons for transcripts and AI summaries**
Every meeting note now has three icons in its top-right corner — **Import Krisp transcript**, **Copy meeting for AI assistant** and **Add AI reply** — and every meeting that has started gets the same three buttons in the **Today's meetings** panel. No more command palette for the after-meeting steps.

### Changed

**Reads more agent report layouts**
**Add AI reply to this meeting** now also reads: details in a quote block with several fields on one line (`> **Date:** … | **Category:** …`); owners written as `@[[Full Name]]` (one or more) in the table; numbered bold section labels (`3. **Action Items Table**:`); a **Status** column (Done items are added already ticked); `**Key Decisions**: None` on one line; and an **Account / Project** field. `docs/AGENT_INSTRUCTIONS.md` now holds the two-mode agent instructions, with notes on choosing the mode.

---

## [6.15.0] – 2026-10-07

### Added

**Meeting tracker**
**Open meeting tracker** (and a new gauge button in the ribbon) builds one page from all your meeting notes: open, overdue, due-soon and high-priority counts; overdue, due in the next 7 days and high-priority lists; open items by account and by person; decisions from the last 30 days; and this week's meetings by category. It needs no other plugins and is rebuilt each time you open it.

**Priorities in the action items panel**
Action items with the Tasks plugin's priority symbols (⏫ high, 🔼 medium, 🔽 low) show their priority, High in red, and higher-priority items come first when grouped by person or due date. `(owner: Customer IT team)` owners now group under that team in **By person**.

**Tasks plugin guide**
`docs/TASKS.md` explains installing and setting up the Tasks community plugin, how meeting action items are written, and ready-to-paste lists (overdue, due this week, high priority, by owner, by account, done this week). The setup guide covers it too.

### Changed

**Renamed to Meeting Notes for Apple Calendar**
The plugin is now called **Meeting Notes for Apple Calendar**, with a description that covers what it does today. Its ID is unchanged, so your settings, hotkeys and BRAT updates carry on as before. Commands in the command palette now start with "Meeting Notes for Apple Calendar:".

**Action items in the Tasks plugin's format**
Action items added from an AI reply now carry the Tasks plugin's priority symbol and created date (`⏫ ➕ 2026-10-07`) instead of `(priority: High)`, and ticking an item in the action items panel adds its done date (`✅ 2026-10-08`). Items written by 6.14.0 are still read correctly.

---

## [6.14.0] – 2026-10-07

### Added

**Works with any AI assistant**
The copy and paste commands are now **Copy meeting for AI assistant** and **Add AI reply to this meeting**, for Gemini, Claude, ChatGPT, Copilot or your own agent. Existing hotkeys keep working.

**Instructions are optional and editable**
New **AI Assistant** settings: **Include instructions when copying** (turn off if your assistant has its own), an editable **Instructions** box with **Copy** and **Reset to default**, and **Save category, account and tags as properties**. The copied meeting now starts with a **MEETING DETAILS** block (title, date, time, attendees from your calendar).

**Full agent reports**
**Add AI reply to this meeting** now also understands a full report from a custom agent: the whole report goes into Meeting Summary, **Key Decisions Made** into Decisions, and each row of an action items table becomes a checkbox with its owner (`@[[Full Name]]`), priority and due date. Category, account and search tags become note properties. `docs/AGENT_INSTRUCTIONS.md` has ready-to-copy instructions for such an agent.

**By account and By category dashboard views**
New Meetings dashboards include **By account** and **By category** views built on those properties. Delete an existing `Meetings.base` and reopen the dashboard to get them.

**Recommended setup guide**
`docs/SETUP.md` walks through the settings, Obsidian features and add-ons that get the most out of the plugin.

### Changed

**Adding an AI reply twice is safe**
Meeting Summary is now replaced rather than added to, and decisions and action items already in the note are not added again.

---

## [6.13.0] – 2026-10-06

### Added

**Krisp transcript import**
Run **Import Krisp transcript into this note** to fill a meeting note's empty Transcript section from its Krisp recording (`transcript.txt` or `transcript.md`). The plugin suggests the recording that started closest to the meeting (allowing for joining a few minutes early or late) and always asks you to confirm or pick another before importing. Set the folder under **Krisp Transcripts** in settings (default `~/Documents/Transcripts/Krisp Meetings`). **Import transcripts automatically** (off by default) offers recordings for every meeting that ended in the last 2 days after each sync, still asking before anything is imported.

**Gemini summaries by copy and paste**
**Copy Gemini prompt for this meeting** copies a prompt built from the note's notes and transcript. Paste it into Gemini, copy the reply, and run **Add Gemini reply to this meeting** to put the summary, decisions and action items (with `@owner` and `📅` due dates) into their sections. The plugin never contacts Gemini itself.

**Skip rules for automatic notes**
New settings stop notes being created automatically for meetings whose title contains words you list (such as Focus time or Lunch), and optionally for events with no one else invited. You can still create these notes by hand.

**Choose the sections in new notes**
Under **Sections in new notes**, switch off any of Agenda, Notes, Decisions, Action items, Meeting Summary or Transcript in the built-in format. All are on by default; a template file, if you use one, is unaffected.

### Fixed

**Notes filed in other folders are still found**
Meeting notes moved out of the Note folder used to be invisible to the plugin: the Today's meetings panel offered **Create note** (making a duplicate), the action items panel dropped them, and recurring meetings lost their Previous link. The plugin now finds meeting notes anywhere in the vault.

---

## [6.12.0] – 2026-10-06

### Added

**Browse other days in Today's meetings**
The Today's meetings panel has **‹** and **›** arrows beside the date to step a day back or ahead, and a **Today** button to jump back. Past days show every meeting as finished, so you can open or create notes for yesterday's meetings and prepare tomorrow's.

**New note button in Today's meetings**
A **New note** button in the panel asks for a title and creates a meeting note from your template for a meeting that isn't on your calendar (a hallway chat or ad-hoc call). It is dated on the day shown, starting at the current time.

---

## [6.11.0] – 2026-10-06

### Added

**Today's meetings panel**
A new right-sidebar panel lists today's meetings in order: finished ones faded, the current one marked **Now**. Each has an **Open note** / **Create note** button and a **Join** button. Open it from its ribbon button or **Open today's meetings**.

**Owners and due dates on action items**
Write `@Bob` (or `@[[Bob Jones]]`) and `📅 2026-10-10` (or `[due:: 2026-10-10]`) on an action item. The action items panel can now group items by meeting, by person, or by due date, and shows overdue dates in red.

**Ribbon buttons for the dashboards**
New buttons in the left ribbon open **Today's meetings** (calendar-with-clock icon), the **Meeting action items** panel (checklist icon), and the **Meetings dashboard** (dashboard icon), so you no longer need the command palette to find them.

**Dashboards guide**
A step-by-step guide, `docs/DASHBOARDS.md`, explains the Meeting action items panel and the Meetings dashboard: what each is, how to open it, and how to use it. The README links to it.

---

## [6.10.0] – 2026-10-06

### Added

**Recurring meetings link to the previous meeting**
Each note of a recurring meeting shows a **Previous** link (and a `previous_meeting` property) to the last occurrence, and a new note's Agenda lists that meeting's open action items. Existing notes get the link on their next sync. Templates can use `{{previous_meeting}}`.

**Meeting action items view**
The **Open meeting action items** command opens a sidebar listing every open action item across your meeting notes, grouped by meeting. Tick an item to check it off in its note.

**Meeting Summary and Transcript sections**
New meeting notes end with empty **Meeting Summary** and **Transcript** sections, ready for a pasted summary and transcript from a recording or AI note-taker. Existing notes and custom templates are unchanged.

### Changed

**Meeting times show the time zone**
The **When** line in Meeting details and the `{{time}}`, `{{start_time}}`, and `{{end_time}}` template placeholders now include the time zone, e.g. `10:00 AM – 11:00 AM EST`. Times are in your Mac's time zone; an event with a different fixed offset shows it as `GMT+5:30`. Existing notes pick this up the next time they sync.

---

## [6.9.1] – 2026-10-06

### Fixed

**Plugin description matches the plugin**
The description shown in Obsidian's plugin list no longer mentions Google Calendar, iCal feeds, or the old Summary and Actions sections; it now describes Apple Calendar meeting notes with a join link and the current sections.

---

## [6.9.0] – 2026-10-06

### Added

**Next meeting in the status bar**
The status bar shows the meeting in progress ("Now: Standup · ends in 10 min") or the next one ("Next: Design Review in 25 min"). Click it to open the meeting's note and join link. Turn it off with **Show next meeting in status bar**.

**Join current or next meeting command**
Opens the note for the meeting in progress, or starting within 30 minutes, creating it if needed, and opens its join link in one step.

**Meetings dashboard**
The **Open meetings dashboard** command creates `Meetings.base` in your meeting-notes folder: a Bases view (Obsidian 1.9+) of every meeting note with Next 7 days, Last 7 days, and All meetings views grouped by day.

**Notes of deleted meetings are marked**
When a meeting disappears from Apple Calendar, its note gets `status: removed` and a red "Meeting removed from calendar" box. Only meetings in the time window from calendars the plugin read are affected, and the note is restored if the meeting reappears.

### Changed

**Poll interval applies immediately**
Changing **Poll interval** no longer needs an Obsidian restart.

**Background sync failures are shown**
If a background check can't read your calendar, a notice explains why (for example missing calendar permission). It appears once, not on every poll, until a check succeeds again.

**Apple Calendar reads through EventKit only**
The Calendar.app scripting fallbacks (Tiers 1–3) are removed; EventKit reads every calendar from the Mac's local store in one fast call. If calendar access hasn't been decided yet, the plugin asks macOS for it; if access is denied or "Add Only", the error says how to fix it. **Run Diagnostics** now checks access, lists calendars with their accounts, and reads the next 7 days.

**Meetings already in progress are included**
Each sync also reads meetings that started earlier but haven't ended, for the status bar and the Join command.

### Removed

**Calendar.app fallback settings**
"Timeout per calendar", "Max events for last-resort scan", and "Skip full-scan fallback" are removed along with the fallbacks they controlled.

### Fixed

**Meetings near the end of the time window were sometimes missed**
With **Days ahead to fetch** set lower than **Hours in advance** covers, Apple Calendar was not read far enough ahead. It now always covers the whole auto-create window.

---

## [6.8.0] – 2026-10-06

### Added

**Custom templates**
A new **Template file** setting creates meeting notes from a note in your vault, using placeholders such as `{{title}}`, `{{details}}`, `{{join_link}}`, `{{agenda}}`, `{{attendees}}`, and `{{daily_note}}` (full list in the README). The plugin's calendar properties are always added, so notes made from any template keep syncing. Templater commands are left in place for Templater to run.

**Daily-note links**
With the new **Link to daily note** setting (on by default), each meeting note gets a `daily_note` property and its date in the Meeting details box links to that day's daily note, using your Daily Notes format and folder. The day's meetings then appear in the daily note's backlinks. The link follows the meeting if it is rescheduled.

### Fixed

**Event description is back in the Agenda section**
6.7.0 moved the event description into a collapsed callout and left Agenda empty. New notes again list the description lines as Agenda bullets. The collapsed callout is still available to custom templates as `{{description_callout}}`.

---

## [6.7.0] – 2026-10-06

### Added

**Notes stay in sync with the calendar**
When a meeting's time, attendees, location, or join link changes, its existing note is updated on the next poll, Refresh, or Rebuild. A meeting moved to another day has its note renamed to the new date, and a cancelled meeting is marked cancelled. Only the calendar properties and the Meeting details box are rewritten — your own writing, extra properties, and tags are never touched.

**One-click Join link**
Every note now shows a clickable **Join** link for Zoom, Google Meet, Microsoft Teams, or Webex meetings, also saved as the `meeting_url` property. For Apple Calendar the link is found in the event's URL field, location, or notes. The "Include conference link" setting is removed because the link is always included.

**Link attendees setting**
Optionally write the organizer and attendees as `[[Name]]` links so each person's note lists their meetings.

**Rebuild after upgrade**
The first sweep after the plugin is installed or upgraded runs a Rebuild, so meetings in the time window get notes with the new version's format and fixes.

### Changed

**New meeting note format**
New notes have typed properties (`type`, `date`, `start`, `end`, `calendar`, `organizer`, `attendees`, `location`, `meeting_url`, `tags`) for searching and querying, a Meeting details box with the time, place, Join link, and attendees with RSVP status, the original invite in a collapsed callout, and Agenda, Notes, Decisions, and Action items (checkbox) sections. Existing notes keep their layout.

**Version is bumped only when releasing**
Routine commits no longer bump the plugin version. Changes are recorded under `[Unreleased]` in this changelog, and `node version-bump.mjs <level>` stamps that section with the new version and date when a release is cut. The pre-commit check no longer requires a version bump, and `RELEASE_PROCESS.md` now covers the bump, release commit, tag, and GitHub release in one sequence.

### Fixed

**Recurring Apple Calendar meetings get a note for every occurrence**
All occurrences of a recurring meeting shared one ID, so only the first occurrence ever got a note. Each occurrence is now tracked separately, and a single occurrence that is moved keeps its note.

**Late-evening Apple Calendar meetings no longer get the next day's date**
Note filenames and the `date` property used the UTC date for Apple Calendar events, so a meeting after about 7–8 pm (US Eastern) was filed under the following day. They now use your Mac's local date.

**Zoom links without a subdomain are detected**
Links like `https://zoom.us/j/…` were missed; only `https://company.zoom.us/…` links were found.

---

## [6.6.1] – 2026-10-06

### Changed

**Install with BRAT**
The README now recommends installing the plugin with BRAT (by TfTHacker), which installs it from GitHub releases and keeps it updated automatically. Manual installation remains documented as an alternative.

---

## [6.6.0] – 2026-10-06

### Changed

**Apple Calendar is now the default and recommended calendar source**
New installs start on Apple Calendar, which reads Calendar.app on your Mac and lets you pick specific calendars. The setting is now called **Calendar source** and lists Apple Calendar first. Existing settings are not changed.

**Minimum Obsidian version raised to 1.4.10**
The note-folder suggester in settings uses an Obsidian API added in 1.4.10. Earlier versions are no longer advertised as supported.

**Conference links must use HTTPS**
Meeting links are only added to notes when they use `https://`. Plain `http://` links are now omitted.

**Clearer console logging**
All console messages now use the `[CalendarNoteIntegration]` prefix. Failed note creations are logged as warnings so they are visible by default, and routine Apple Calendar fetch progress moved to the Verbose log level.

### Fixed

**Declined events are skipped even without your email set**
When the calendar marks which attendee is you (Google OAuth, and Apple Calendar via EventKit), events you declined are now skipped without needing **Your email address**.

**README matches the plugin**
Corrected setting defaults and ranges, button and command names, the sample note, install instructions (the plugin is installed manually and needs `styles.css`), and the console troubleshooting tip.

**Version bump script and release process**
`npm version minor`/`major` no longer leaves `manifest.json` out of sync with `package.json`, and npm-created tags no longer get a `v` prefix. `RELEASE_PROCESS.md` now reads the version from `manifest.json` and attaches `styles.css` to every release.

**Claude Code hooks work from any checkout**
The `.claude/settings.json` hooks use the project directory instead of a hard-coded path. The pre-commit AI agent is replaced by `scripts/pre-commit-check.sh`, which ignores non-commit commands and, on `git commit`, runs the tests and TypeScript check and verifies the changelog entry and version bump instead of performing the bump (replacing the behaviour described in 6.5.4). Routine build, test and git commands are pre-approved so sessions need fewer permission prompts; `git push` and `gh release` still ask.

### Deprecated

**iCal URL and Google OAuth calendar sources**
Both still work but are deprecated and may be removed in a future release. Settings shows a notice when either is selected. To migrate, add the account to Calendar.app and switch to Apple Calendar.

### Removed

**Unused settings styles**
Removed stylesheet rules for settings-tab classes that the plugin never used.

---

## [6.5.5] – 2026-04-03

### Added

**Automatic codebase refresh on every session start**
A `SessionStart` hook in `.claude/settings.json` now injects a live codebase snapshot into Claude's context each time a session opens: current version, branch, last 8 commits, working-tree status, and the full list of source and test files. Claude no longer needs to re-derive this state from memory of prior conversations.

**Corrected and expanded developer contract in `CLAUDE.md`**
Fixed two inaccuracies (`main.js` is a release asset, not a committed file; test files are `.test.ts` TypeScript, not `.mjs`). Added a "Codebase Refresh" section instructing Claude to always read current file state before editing, with specific commands to run and files to check at session start. Added full details on the test support stubs (`obsidianStub.ts`, `electronStub.ts`, `testHelpers.ts`).

---

## [6.5.4] – 2026-04-03

### Added

**Claude AI pre-commit QA workflow (`CLAUDE.md` + `.claude/settings.json`)**
A `CLAUDE.md` file now documents the full developer commit contract: run the test suite, bump the patch version, update `CHANGELOG.md`, and refresh `README.md` on every commit. A Claude Code agent hook (`.claude/settings.json`) enforces this automatically — before any `git commit`, an AI agent runs `npm test`, performs a TypeScript compile check, audits the staged diff for secrets and logic errors, validates that a changelog entry is present when source files changed, and bumps the patch version. The commit is blocked with a plain-English explanation if any check fails.

---

## [6.5.3] – 2026-04-03

### Fixed

**Recurring iCal events now create distinct notes per instance**
Recurring events imported from iCal feeds no longer collapse under a single processed ID. Instance-aware IDs are now derived from `UID` plus recurrence/start information when needed, so separate occurrences are tracked and noted independently.

**TZID-aware iCal timestamps now resolve correctly**
iCal `DTSTART` / `DTEND` values with `TZID` are now converted using the declared timezone instead of being interpreted in the local Obsidian machine timezone. This prevents meetings from appearing at the wrong time when feeds contain explicit timezone metadata.

**Note dates no longer drift by a day for late-night events**
Generated note filenames and frontmatter now preserve the event's original local calendar date instead of deriving the date from a UTC-normalized timestamp.

### Added

**Expanded audit-style regression suite**
The project now includes a substantially broader Node-based test suite covering iCal parsing edge cases, note rendering and sanitization, API client behavior, secure storage fallbacks, OAuth helper paths, and the plugin's refresh/rebuild workflow against an in-memory vault.

---

## [6.5.2] – 2026-03-31

### Fixed

**Background poll no longer recreates manually deleted notes**
`refreshNotes` (used by the background poll, startup sweep, and Refresh button) now uses a two-layer guard. In addition to checking `processedEventIds`, it performs a file-existence pre-check before attempting to create a note. If a note file already exists on disk for an untracked event, the event is silently marked as processed without touching the file. This bootstraps the tracking list for notes created before v6.5.1 and eliminates the edge case where a deleted note could be spuriously recreated.

---

## [6.5.1] – 2026-03-31

### Added

**Version label in Settings pane**
The plugin version number is now displayed directly below the Settings heading, making it easy to confirm which version is installed without leaving Obsidian.

**Distinct Refresh and Rebuild actions**
The Manual Actions section now has two clearly differentiated buttons:

- **Refresh** — fetches calendar events and creates notes only for events that have never been processed before. If you previously had a note for an event and deleted it, Refresh will not recreate it. This is also the behaviour of the automatic background poll.
- **Rebuild** — fetches calendar events and recreates notes for any event whose note file is currently missing, regardless of history. Use this to restore notes that were manually deleted.

Both buttons respect the time window (Hours in advance, Days back) configured in Note Settings.

**`processedEventIds` tracking**
A new `processedEventIds` string array is stored in plugin data to track which event IDs have been processed. This enables the Refresh vs Rebuild distinction to persist across restarts. The list is automatically capped at 5 000 entries (trimmed to 4 000) to prevent unbounded growth.

---

## [6.5.0] – 2026-03-31

### Added

**Reimport / recreate deleted notes button**
A dedicated "Reimport" button is now available in Settings → Manual Actions. It re-runs the full import for the current time window and recreates notes for any events whose notes were manually deleted. Existing notes are not overwritten — only missing ones are created. The same filters apply: declined events and all-day events are excluded.

**EventKit global as the primary calendar path (Tier 0 global)**
A new `buildJxaEventKitGlobalScript` function queries **all** configured calendars in a **single** `osascript` call via `EKEventStore`, rather than one call per calendar. This is tried before all other strategies and before the Calendar.app scripting bridge is touched at all. Benefits:
- Works for all calendar types: Google CalDAV, iCloud, Exchange, local
- Reads the local EventKit SQLite cache — no CalDAV/Exchange network sync triggered
- Returns in < 100 ms regardless of calendar size or cache freshness
- Eliminates per-calendar timeout risk (one hung calendar can no longer block others)

The full fallback chain (Tier 1 → per-calendar Tiers 2/2.5/2.75/3) remains in place if EventKit is unavailable or Calendar permission is not granted.

**Shared `JXA_SERIALIZE_EK_EVENT` constant**
The EventKit event serialisation code is now a single shared constant (`JXA_SERIALIZE_EK_EVENT`) used by both the new global script and the per-calendar Tier 0 fallback. This eliminates the previous code duplication and ensures consistent EKParticipantStatus mapping and attendee handling in both paths.

### Changed

**Renamed to "Calendar Note Integration - Apple-iCal-Google"**
- Plugin `id`: `calendar-note-integration`
- Plugin `name`: `Calendar Note Integration - Apple-iCal-Google`
- All in-app notices updated: `Google Calendar: …` → `Calendar Notes: …`
- Console log tag updated: `[CalendarNoteIntegration]`
- Command names updated to remove Google-specific language
- Settings tab heading updated

**Settings → Manual Refresh → Manual Actions**
Section renamed. The existing Refresh button description is clarified; the new Reimport button is added beneath it.

### Proposed optimisations (not yet removed — kept for robustness)

With EventKit global handling > 99% of cases, Tiers 2.5 (whose-predicate) and 2.75 (bulk `startDate()`) are now effectively vestigial. They add JXA script complexity without benefiting most users. A future cleanup release can safely remove them once EventKit global proves stable across the user base. The `skipTier3` setting similarly has less value now but is retained for edge cases.

---

## [6.0.7] – 2026-03-31

### Fixed

**1. Google Calendar conference block (`-::~:~::` delimiters) appearing in Agenda**

Google Calendar appends the full conference invite block to the event description, wrapped between delimiter lines that start with `-::~:~::`. The previous line-by-line filter caught individual boilerplate lines but left the delimiter lines themselves and any content between them that didn't match a known prefix.

`stripConferenceBoilerplate` now detects the first and last `-::~:~::` delimiter line and removes the entire span (both delimiters and everything between them) before the line-by-line filter runs. Other boilerplate filtering is unaffected.

**2. Attendee accept/decline status showing ⚪ instead of 🟢 / 🔴 (EventKit)**

When events are fetched via the new EventKit Tier 0 path (v6.0.6), attendee status was always showing ⚪ regardless of the actual response. Root cause: `EKParticipant.participantStatus` returns an ObjC-bridged `NSInteger`. In JXA, strict `===` comparison against a JS number literal can fail against an ObjC-wrapped integer object, so all comparisons fell to the `else` branch and status was set to `"unknown"` → ⚪.

Fix: coerce with `Number(att.participantStatus)` before comparing, which correctly extracts the JS primitive value (`0`=unknown, `1`=pending/needsAction, `2`=accepted, `3`=declined, `4`=tentative).

---

## [6.0.6] – 2026-03-31

### Fixed

**Google CalDAV persistent timeouts — root-cause architectural fix via EventKit**

The core issue was architectural: every approach that goes through Calendar.app's scripting bridge (`Application("Calendar")`) — including `eventsFrom`, `events.length`, `events.startDate()`, and `events[j]` — can trigger Calendar.app to sync the CalDAV calendar from Google's servers when its in-process cache is stale. This sync is what causes the 60–150 s timeouts, and no amount of tuning the scan size or JXA method selection fully avoids it.

**The correct approach**: Use **EventKit** (`EKEventStore`) directly via the JXA/Objective-C bridge, bypassing Calendar.app's scripting layer entirely.

- `EKEventStore` reads from the same **local SQLite cache** that Calendar.app maintains.
- That cache is kept current by a macOS background daemon (separate from Calendar.app's process).
- `EKEventStore.eventsMatchingPredicate()` reads from the local store only — it **never makes a CalDAV network request**.
- With a proper date-range predicate, the query returns in **< 100 ms** on any size calendar.

**New Tier 0** (tried before any Calendar.app scripting-bridge access):
```
ObjC.import('EventKit');
var store = $.EKEventStore.alloc.init;
var pred  = store.predicateForEventsWithStartDateEndDateCalendars(startNS, endNS, [calRef]);
var evts  = store.eventsMatchingPredicate(pred);  // local cache only, no network
```

If Tier 0 succeeds, Tiers 2–3 are skipped entirely. If EventKit is unavailable or the process lacks Calendar permission, the full Calendar.app scripting-bridge chain (Tiers 2, 2.5, 2.75, 3) remains as a fallback.

**Attendee data via EventKit**: `EKParticipant.URL` provides the email as a `mailto:` URL (scheme stripped). `EKParticipant.participantStatus` is an integer (`0` unknown, `1` pending, `2` accepted, `3` declined, `4` tentative). Both are correctly mapped to the existing attendee format.

---

## [6.0.5] – 2026-03-31

### Fixed

**Google CalDAV (Google account synced to Calendar.app) — root-cause fix for persistent timeouts**

Previous releases reduced `maxTier3Scan` and switched to lazy indexed access in Tier 3, which helped Exchange accounts but did not fix Google CalDAV. The reason: for CalDAV, **every access to `targetCal.events.*`** (including `.length`) forces Calendar.app to fully sync the calendar from Google's servers before returning. On a cold cache this sync takes 60–150 s regardless of how many events are subsequently iterated.

**Root cause**: Tier 2 (`cal.eventsFrom(windowStart, {to: windowEnd})`) was the correct fix all along — it tells Calendar.app to issue a CalDAV `REPORT` request with a `<time-range>` filter, which Google answers with *only* the matching events (typically 1–5 s). Tier 2 was skipped because it threw `"Can't convert types"` — a JXA type-coercion bug where the automatic JS `Date` → AppleScript `date` conversion fails for CalDAV calendars (it works for Exchange/EWS via a different code path).

**Fix**: Tier 2 now first tries passing `$.NSDate` objects (via `ObjC.import('Foundation')`), which Calendar.app accepts without the type-coercion error. If that also fails, it falls back to the original JS Date attempt (Exchange compatibility). The NSDate path should resolve immediately for Google CalDAV.

**Also:**
- Timeout setting maximum raised 120 s → **300 s** (useful safety net during the first cold sync, or for extremely large calendars). Step size changed from 5 s to 15 s.
- Timeout setting description updated to mention the CalDAV NSDate fix.
- Default `appleMaxTier3Scan` in `DEFAULT_SETTINGS` aligned to 250 (matching the code constant).

---

## [6.0.4] – 2026-03-31

### Fixed

**Google CalDAV calendar (Google account synced to Calendar.app) timing out at 120 s**

Root cause: Tier 3 called `targetCal.events()` — a JXA method call with parentheses — which forces Calendar.app to **materialise the entire event array** as a single AppleEvent response. For a Google CalDAV calendar with thousands of events this triggers a full server sync before returning, reliably exceeding the 120 s process timeout.

Fix: replaced `targetCal.events()` with:
- `targetCal.events.length` — a property access (no parentheses), which reads only the cached count without triggering a full fetch.
- `targetCal.events[j]` — a **lazy indexed object specifier**; Calendar.app resolves only that one event record when a property is subsequently accessed on it.

This brings Tier 3 behaviour in line with Tier 2.75, which already used indexed access (`targetCal.events[m]`) and had the same lazy-evaluation benefit.

**Additional tuning:**
- `DEFAULT_MAX_TIER3_SCAN` reduced from 500 → **250** (a typical active Google CalDAV calendar has ~10 events/day; 250 covers a 25-day window, more than sufficient for any reasonable `hoursInAdvance` setting).
- Tier 2.75 count guard threshold reduced from `4 × maxTier3Scan` → **`3 × maxTier3Scan`** (default: 750 events). The previous threshold of 2 000 was overly generous; 750 keeps Tier 2.75 fast on normal-sized calendars while still falling back to Tier 3 for very large ones.

---

## [6.0.3] – 2026-03-31

### Fixed

**Attendee list and response status not appearing in notes (Apple Calendar / Exchange)**

Two bugs caused attendees to be silently dropped:

1. **JXA individual-getter fallback** — `atts[ai].properties()` often returns an empty object for Exchange-backed attendees (Calendar.app does not always expose Exchange contact data via the bulk properties call). The JXA code now falls back to individual `address()`, `displayName()`, and `participationStatus()` getters when `properties()` yields an empty result.

2. **Display-name-only attendees** — Exchange attendees frequently have a display name but no email address in Calendar.app's scripting bridge (internal contacts, external guests). The previous code did `if (!email) continue` which silently dropped every such attendee. The fix uses the display name as a fallback identifier so the attendee table is populated even without email addresses.

3. **Additional participation status strings** — Added `"invited"` and `"notResponded"` to the status mapping (both map to ⚪ Awaiting response), covering Calendar.app variants seen on macOS Ventura/Sonoma with Exchange.

---

## [6.0.2] – 2026-03-31

### Fixed

**Zoom / Google Meet / Teams invite text no longer appears in the Agenda section**

Calendar event descriptions often contain the full video-conferencing invite block — join URL, Meeting ID, Passcode, dial-in numbers, "One tap mobile" lines, etc. This text was being included verbatim in the Agenda section of generated notes.

`stripConferenceBoilerplate()` is now applied to the description before it is split into agenda items. It removes:
- Any line containing a Zoom, Google Meet, or Microsoft Teams URL
- Common Zoom/Teams/Meet boilerplate prefixes: `Join Meeting`, `Meeting ID:`, `Passcode:`, `Password:`, `Dial by your location`, `Dial in by phone`, `One tap mobile`, `Find your local number`, `Join by SIP`, `Join by H.323`, dial-in phone number lines, and numeric conference code lines

The conference join link itself continues to appear in the note **header** when **Include conference link** is enabled in Settings.

---

## [6.0.1] – 2026-03-31

### Fixed

**1. Notes created for declined events**
- Added `filterDeclinedEvents()` — when **Your email address** is set in Settings, any event where your attendee entry has `responseStatus = "declined"` is excluded from note creation.
- Applied in all three note-creation paths: auto-create (startup/poll), event picker, and "create note for next event" command.
- Events where you are not listed as an attendee at all are kept (organiser-only events, iCal events with no attendee data).

**2. Recurring meetings (set up long ago) missing from note creation**
- Root cause: Tier 2.75's date filter compared event `startDate >= windowStart`, which excluded recurring event instances whose Calendar.app record date fell slightly before the fetch window boundary.
- Fix: Tier 2.75 now looks back an extra **30 days** before `windowStart` (i.e., `startDate >= windowStart − 30 days`). Calendar.app materialises recurring series instances as individual records with their own occurrence `startDate`; the wider net captures those near the boundary.
- Note: if Calendar.app stores only a recurring series master (with the original creation date from years ago) and does not expand instances, those masters will still be excluded — this is a Calendar.app limitation on Exchange/EWS accounts where only `eventsFrom()` triggers proper expansion. The diagnostic tool will show which tier your calendar uses.

**3. Tier 2.75 timing out on very large calendars**
- Root cause: `cal.events.startDate()` on a calendar with thousands of events returns a massive single AppleEvent response that can take >120 s to serialise.
- Fix: Tier 2.75 now checks `targetCal.events.length` first. If the calendar has more than **4 × maxTier3Scan** events (default threshold: 2 000), Tier 2.75 is skipped and execution falls through to Tier 3 (bounded scan of newest N events). Avoids the unbounded bulk fetch on large calendars.
- The `events.length` count is a lightweight property read (cached by Calendar.app) and does not trigger a full event sync.

---

## [6.0.0] – 2026-03-31

### Summary
Major release consolidating all Apple Calendar reliability improvements from the 5.x series, a full security audit with fixes, and updated documentation.

### Added
- **Tier 2.75 — bulk start-date fetch** (from 5.2.1): `cal.events.startDate()` in one IPC call, filtered in JS, `properties()` only on matches. Resolves Exchange/Office 365 timeout root cause (1 000 individual calls → 1 bulk call).
- **Configurable timeout per calendar** (from 5.2.0): Settings → Apple Calendar → Advanced, 15–120 s default 30 s.
- **Skip Tier 3 toggle** (from 5.2.0): Skip full-scan fallback for calendars that always time out.
- **Max events for last-resort scan** (from 5.2.1): Tier 3 scan cap, 50–2 000, default 500.
- **Per-tier timing in console** (from 5.2.0): `t2ms`, `t2.5ms`, `t2.75ms`, `t3ms` logged on every fetch for precise diagnostics.
- **Diagnostic modal** (from 5.1.0): Replaces `Notice` toast with a scrollable `Modal` including Copy to Clipboard button.
- **All-day event exclusion**: All-day events are never used as the basis for note creation.

### Security fixes (audit v6.0.0)
- **`crypto.randomUUID()` for fallback UIDs** — replaced `Math.random()` in `appleCalendarApi.ts` UID fallback path with `crypto.randomUUID()` for cryptographically sound uniqueness.
- **`stripHtml()` DoS hardening** — `noteCreator.ts` now caps HTML input at 10 000 characters before DOM parsing, preventing CPU DoS from malformed/oversized event descriptions.
- **iCal error preview reduced** — `calendarApi.ts` error preview trimmed from 120 → 50 characters to reduce potential information disclosure.
- **Refresh token reuse documented** — `googleAuth.ts` now carries an explicit comment explaining why refresh token fallback is correct and intentional (not a security defect).
- **Audit result: no critical or high-severity vulnerabilities found.** See Security Model in README for full details.

### Performance (Apple Calendar — 5.x cumulative)
- `evt.properties()` batch reads — 1 IPC call per event instead of 7+ individual getters.
- `atts[i].properties()` batch reads for attendees — capped at 20 per event.
- Per-calendar `osascript` isolation — each calendar has its own process and timeout; a hung calendar cannot block others.
- Tier 3 scan cap reduced 5 000 → 500 (default), scans newest-first.
- Tier 2.75 added as primary fallback before individual-call Tier 3.

### Changed
- Version bumped to **6.0.0** to mark the completion of the Apple Calendar reliability work and the security audit milestone.

---

## [5.2.1] – 2026-03-30

### Added
- **Tier 2.75 — bulk start-date fetch** — new fetch strategy inserted between Tier 2.5 and the old full-scan Tier 3. Calls `cal.events.startDate()` once to retrieve ALL event start dates in a single IPC round-trip, filters in JavaScript, then calls `properties()` only on matching events. This is the primary fix for Exchange/Office 365 calendars that time out: instead of 1 000 individual `startDate()` calls (each ~50–100 ms on an Exchange calendar = 50–100 s total), one bulk call typically completes in 1–5 s.
- **Configurable Tier 3 scan cap** — new `appleMaxTier3Scan` setting in Settings → Apple Calendar → Advanced (range 50–2 000, default 500). Tier 3 is now only reached if Tier 2.75 also fails.
- Per-tier timing now includes `t2.75ms` in the developer console log.

### Changed
- Default `MAX_TIER3_SCAN` reduced from 1 000 to **500** (Tier 2.75 handles most cases now; Tier 3 is a last resort).
- Tier 3 fallback description in diagnostic output updated to mention Tier 2.75 is tried first.

---

## [5.2.0] – 2026-03-30

### Added
- **Configurable timeout per calendar** — new setting in Settings → Apple Calendar → Advanced. Range 15–120 seconds (default 30 s). Increase for large Exchange or Office 365 calendars that timeout during fetching. The timeout error message now cites the actual value and links to Settings.
- **Skip full-scan fallback (Tier 3) toggle** — new setting in Settings → Apple Calendar → Advanced. When enabled, calendars that fail Tier 2 and Tier 2.5 are skipped entirely instead of running a slow full-event scan. Prevents one large calendar from blocking other calendars' results.
- **Per-tier timing in console logs** — each per-calendar fetch now logs elapsed milliseconds for every tier attempted (`t2ms`, `t2.5ms`, `t3ms`) so slow steps can be identified immediately from the developer console.

### Changed
- Apple Calendar fetch log now includes `timeout` and `skipTier3` values at the start of every `fetchAllEvents()` call for easier debugging.
- Total-failure error message for timed-out calendars now references the configured timeout value and directs users to the new Advanced settings.

---

## [5.1.0] – 2026-03-30

### Added
- **Per-calendar osascript isolation** — each calendar is now queried in a separate `osascript` process with its own 30-second timeout. A hung or slow calendar no longer blocks other calendars from returning results. Partial results are returned whenever at least one calendar succeeds.
- **Tier 2.5 — `cal.events.whose()` predicate** — added a third fetch strategy between `cal.eventsFrom()` (Tier 2) and the full scan (Tier 3). The `whose` predicate filters events server-side inside Calendar.app without loading all events into memory, fixing the "Can't convert types" error on Exchange calendars.
- **`evt.properties()` batch reads** — instead of 7+ individual IPC calls per event (`evt.startDate()`, `evt.summary()`, etc.), all scalar fields are now fetched in a single `properties()` call. For calendars with many recurring events, this reduces IPC round-trips by ~7×, directly addressing the most common cause of timeouts.
- **Attendee batch reads** — attendee properties are fetched via `atts[i].properties()` (one call per attendee instead of three), capped at 20 attendees per event.

### Changed
- Tier 3 full-scan cap reduced from 5 000 to **1 000 events**. Scan starts from the newest events first (`total - 1000` index forward) so upcoming events are always captured. Previously the scan started from the oldest end, missing all future events on large calendars.
- `runOsascript` error reporting switched from `err.message` (which contained the entire JXA script text) to `stderr` only, extracting the last meaningful error line. Startup console log no longer dumps the full JXA script on Tier 1 failure.
- Diagnostic dialog replaced with a scrollable `Modal` (was a `Notice` toast). The modal includes a **Copy to Clipboard** button and auto-sizes to 60 vh.

---

## [5.0.0] – 2026-03-30

### Added
- **Apple Calendar support** via JavaScript for Automation (JXA / `osascript`). Reads events directly from Calendar.app on macOS — no API keys, OAuth, or network access required. All accounts already synced in Calendar.app (Google, iCloud, Exchange, Office 365) are available automatically.
- Three-tier fetch strategy with automatic fallback:
  - **Tier 1** — `app.eventsFrom()` single application-level call (fastest)
  - **Tier 2** — `cal.eventsFrom()` per-calendar call
  - **Tier 3** — `cal.events()` full scan with JS date filter (compatibility fallback)
- **Calendar selection checkboxes** — settings UI lists all Calendar.app calendars with per-calendar toggles. Only selected calendars are queried; uncheck all to include every calendar.
- **All-day event filtering** — all-day events are excluded from note creation (only timed events get notes).
- **Run Diagnostics button** — three-step check: JXA execution → list calendars → per-calendar fetch strategy probe. Reports which tier each calendar uses, event counts, and any errors.
- **Conference link detection** for Apple Calendar events — Google Meet, Zoom, and Microsoft Teams URLs are extracted from event descriptions and included in notes (same as Google Calendar / iCal modes).
- `runAppleCalendarDiagnostic()` exported from `appleCalendarApi.ts` for use in the settings UI.

### Security
- JXA script templates interpolate only validated integers (`daysBack`, `daysAhead`) and calendar names via `JSON.stringify()` — user strings are never interpolated raw.
- Apple Calendar output capped at 5 MB before `JSON.parse`.
- `execFile` (not `exec`) is used so no shell expansion occurs.

---

## [4.0.0] – 2026-03-30

### Added
- **Google Account (OAuth 2.0) mode restored** alongside iCal URL mode.
- Three authentication modes selectable from a single dropdown: **iCal URL**, **Google Account**, **Apple Calendar**.
- `CalendarService` unified adapter wrapping all three backends with a common interface (`fetchAllEvents`, `listEventsInTimeWindow`, `listUpcomingEvents`).
- Shared `CalendarEvent` / `ResponseStatus` types across all backends.

---

## [2.1.0] – 2026-03-30

### Added
- Initial Apple Calendar (macOS) integration via JXA — proof-of-concept single-call fetch.
- `AppleCalendarApi` class in `appleCalendarApi.ts`.
- macOS-only flag set in `manifest.json` (`isDesktopOnly: true`).

---

## [1.2.0] – 2026-03-30  *(ical branch)*

### Changed — Breaking
- **Replaced OAuth / Google Cloud Console with iCal URL.** The plugin now
  reads events directly from Google Calendar's "Secret address in iCal format"
  URL. No Google Cloud Console project, API keys, or OAuth flow is required.
  Users upgrading from 1.1.0 must paste their iCal URL in Settings; previous
  OAuth credentials are no longer used.

### Added
- `src/icalParser.ts` — RFC 5545 iCal parser handling line unfolding, DATE /
  DATE-TIME (UTC, floating, TZID-qualified), ATTENDEE with PARTSTAT, ORGANIZER,
  X-GOOGLE-CONFERENCE / X-GOOGLE-HANGOUT, and STATUS:CANCELLED suppression.
- `IcalCalendarApi` in `calendarApi.ts` — fetches the iCal feed, appends
  `singleevents=true` to Google Calendar URLs automatically so recurring events
  are expanded server-side, and filters events by time window.
- **"Your email address" setting** — when set, the matching attendee entry is
  marked as `self` and excluded from the attendees table in generated notes.
- **"Test connection" button** in Settings — verifies the iCal URL is reachable
  and reports the total number of events found in the feed.

### Removed
- `src/googleAuth.ts` — OAuth 2.0 authorize / refresh / revoke flows.
- `src/secureStorage.ts` — Electron `safeStorage` credential encryption
  (no longer needed; the iCal URL is read-only and revocable).
- `src/electron.d.ts` — Electron type declarations (no longer needed).
- Settings fields: `clientId`, `clientSecret`, `accessToken`, `refreshToken`,
  `tokenExpiry`, `calendarId`.

### Security
- iCal URL validated as HTTPS before fetch; fetch has a 15-second
  `AbortController` timeout.
- All existing note-content sanitisation (YAML injection, Markdown injection,
  URL injection, DOMParser HTML stripping) is retained unchanged.

---

## [1.1.0] – 2026-03-30

### Added
- **Duration in meeting notes** — each timed event note now displays a
  `**Duration:**` line (e.g. `1h 30m`) directly below the time range, and
  the value is also written to the YAML frontmatter as `duration:`.
- **Refresh button in Settings** — a new "Manual Refresh" section in the
  plugin settings contains a **Refresh** button that immediately fetches
  events within the configured advance window and creates any missing notes,
  without waiting for the next scheduled poll.
- **`version-bump.mjs`** — helper script that bumps the version across
  `manifest.json`, `package.json`, and `versions.json` simultaneously.
  Run via `npm run version:patch`, `npm run version:minor`, or
  `npm run version:major`.
- **`CHANGELOG.md`** — this file.

### Security
- **At-rest credential encryption** (`src/secureStorage.ts`) — OAuth tokens
  and the Client Secret are now encrypted with Electron's `safeStorage` API
  (macOS Keychain / Windows DPAPI / Linux Secret Service) before being written
  to `data.json`. Legacy plaintext values from 1.0.0 are migrated automatically
  on the next save.
- **Dynamic OAuth redirect port** — the local HTTP server now binds to an
  OS-assigned ephemeral port instead of the fixed port 42813, eliminating
  potential port-conflict errors.
- **Cross-origin request blocking** — the OAuth redirect server now rejects
  requests whose `Origin` header does not resolve to localhost (403), blocking
  cross-origin fetch attacks from malicious web pages.
- **HTTP method validation** — the OAuth redirect server now rejects non-GET
  requests with 405.
- **DOMParser HTML stripping** — the event description HTML-to-text conversion
  now uses the browser's `DOMParser` API instead of a regex chain, giving
  spec-compliant, injection-resistant HTML parsing.
- **Input guards** — non-null guards added for `start.dateTime`/`end.dateTime`
  in note and modal code; `formatIsoDate()` now guards against `Invalid Date`;
  leading dots stripped from generated filenames.
- **`safeErrorMessage()` helper** — all user-visible error messages are now
  sanitised (newlines stripped, length capped) to prevent log/Notice injection.
- **Token revocation on disconnect** — the Disconnect button now calls
  Google's revocation endpoint before clearing local credentials.
- **CSRF protection** — the OAuth flow generates a `crypto.randomUUID()` state
  token per attempt and verifies it on the redirect callback.

### Documentation
- Full README rewrite: features table, example note, setup guide,
  configuration reference, note template anatomy, security model, architecture,
  developer docs, troubleshooting, and installation/upgrade instructions.

---

## [1.0.0] – 2026-03-28

### Added
- Initial release.
- Full OAuth 2.0 "installed app" flow for Google Calendar (read-only scope).
- Auto-create meeting notes 1–48 hours before events start.
- Startup sweep and configurable poll interval (5–120 min).
- Structured note template: YAML frontmatter + Agenda / Notes / Summary /
  Actions sections with bullet lists pre-populated from the invite description.
- Attendee table with RSVP status icons (🟢🔴🟡⚪🔷) and email column.
- Fuzzy-search event picker command.
- Settings tab: Client ID/Secret, Calendar ID, note folder, advance window,
  poll interval.
