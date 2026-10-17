# Dashboards — a step-by-step guide

The plugin gives you seven dashboards. A dashboard is a page that pulls information together and shows it in one place, so you don't have to open each note or flip to Calendar.app.

| Dashboard | What it answers | Where it appears |
|---|---|---|
| **Today's meetings** | "What's on today, and how do I get into the next one?" | A panel in the **right sidebar** |
| **Meeting action items** | "What did I promise to do, in any meeting? What's overdue? What does Bob owe me?" | A panel in the **right sidebar** |
| **Meetings dashboard** | "What meetings do I have coming up, and what did I have last week?" | A table that opens in the **main editor area**, like a note |
| **Meeting tracker** | "Across everything: what's overdue, what's due this week, what's open per customer and per person, what did we decide?" | A note, `Meeting Tracker.md`, in the **main editor area** |
| **Weekly review** | "How did this week go, and what carries into next week?" | A note per week in `Weekly Reviews`, in the **main editor area** |
| **Meeting insights** | "Where does my time go? Which accounts need attention? What topics keep coming up? Who do I meet most, and are action items getting done?" | A note, `Meeting Insights.md`, in the **main editor area** |
| **Account overviews** | "Everything about one customer: every meeting, its sentiment, open items, decisions, topics and people" | A note per account in `Accounts`, in the **main editor area** |

**Today's meetings** reads your Apple Calendar. The other six are built from the meeting notes the plugin created (notes with a `calendar_event_id` property, wherever in the vault you've filed them). None of them ever change your calendar.

---

## The quickest way: the ribbon buttons

The **ribbon** is the thin strip of icons down the far-left edge of the Obsidian window. The plugin adds a button there for each dashboard:

| Button | Opens |
|---|---|
| **Sun** icon | **My Day**: today's meetings, your focus and loose ends, prepared each night |
| **Calendar-with-clock** icon | **Today's meetings** |
| **Checklist** icon (☑ with lines) | **Meeting action items** |
| **List with a plus** icon | **Add a to-do**: a quick box for a task that isn't from a meeting |
| **Dashboard** icon (four squares) | **Meetings dashboard** |
| **Gauge** icon (a dial) | **Meeting tracker** |
| **Calendar with a check mark** | **This week's review** |
| **Trending-up arrow** icon (a zigzag line going up) | **Meeting insights** |

(The plain **calendar** icon next to them is the older "create a note from an event" button.)

Hover over a button and a tooltip says what it opens. Click it to open the dashboard.

**Don't see the buttons?** Make sure the plugin is updated (6.15.0 or later for the gauge). If the ribbon itself is hidden, turn it back on under **Settings → Appearance → Show ribbon**. If a button is missing, right-click the ribbon and tick it in the list.

## My Day and the Daily Briefing

**My Day** (`My Day.md` in your Meeting Hub folder) is the page to start from. Its sections are the same every day:

| Section | What's in it |
|---|---|
| **At a glance** | How many meetings, when the first one is, your focus and due-today counts, what's overdue, loose ends |
| **Meetings** | The day's meetings in order: time, a link to the note, account, who's in it, whether its brief is ready or its AI reply added, and a **Join** link |
| **Focus** | Your 5 most pressing items (as in the Tracker), plus anything else due that day — tick them here |
| **Before your meetings** | For each meeting, what its attendees owe you (from that series or account), so you can follow up in the meeting |
| **Waiting on others: overdue** | What others owe you that's past due |
| **Loose ends** | Meetings from the last two days still without their AI reply, and Krisp recordings to import |
| **Done today** | What you've checked off that day |

From 6 PM, My Day shows tomorrow, so you can see what's coming before you finish.

**Prepared each night.** At **12:30 AM** (set under **Prepare my day each night** in the settings) the plugin gets the day ready: it creates the notes for the day's meetings with their Meeting Brief, refreshes briefs of notes already made, rebuilds the Meeting Tracker and My Day, and writes the Daily Briefing. Obsidian has to be open and the Mac on power; if a night is missed, it runs as soon as Obsidian is open again. Run **Prepare my day** (or click **Prepare now** in the settings) to do it yourself, for example as you finish for the day.

**The Daily Briefing for Gemini.** Set **Copy the Daily Briefing to** to a folder that Google Drive for desktop syncs (for example `~/Library/CloudStorage/GoogleDrive-you@company.com/My Drive/Obsidian Briefing`). Each time My Day is rebuilt, the plugin writes it there as `Daily Briefing.md` in plain text — no properties, links reduced to names — for Gemini Enterprise's 2 AM and 7 AM runs to read. The plugin only writes a file on your Mac; Google Drive does the syncing.

## Wrap up your day

Run **Wrap up my day** (or click **Wrap up my day** at the top of My Day, or the 5:30 PM notification). A window lists:

- **Slipped**: your items due today or overdue, oldest first
- **Added today, no due date**: so nothing new drifts

Each has **Done**, **Tomorrow**, **Next week** (Monday), **Park** and **Won't do**; a choice updates the item in its meeting note straight away. Finish with **Prepare tomorrow**, which gets tomorrow's notes, briefs, Tracker, My Day and Daily Briefing ready.

## Notifications

While Obsidian is open, the plugin shows Mac notifications (set them under the plugin's settings):

- **Before a meeting** (5 minutes before, by default): the meeting and time, and whether its brief is ready. Click to open its note.
- **After a meeting**, 10 minutes after it ends if its note has no AI reply yet: a reminder to import the Krisp transcript and add the reply. Click to open the note.
- **Morning summary** (8:30 AM by default): the day's meetings and how many of your items are due today or overdue. Click to open My Day.
- **Wrap-up reminder** (5:30 PM by default): how many of your items slipped today. Click to wrap up.

Each is shown once. If Obsidian's notifications are turned off in **System Settings → Notifications**, turn them on there.

## The other way: the command palette

You can also open every dashboard with a *command*. Obsidian runs commands from the **command palette**:

1. Press **Cmd + P** (or click the **>_** "Open command palette" icon in the left ribbon).
2. A search box appears. Start typing the command's name, for example `action items`.
3. Click the matching line, or press **Return**.

In the palette, every command from this plugin starts with **Meeting Notes for Apple Calendar:**, so typing `meeting` lists most of them.

> **Tip — give it a shortcut.** Open **Settings → Hotkeys**, search for `today's meetings`, `action items`, or `meetings dashboard`, click the **+** next to the command, and press the keys you want, for example **Cmd + Shift + A**.

## Keeping the Meeting Hub notes current

The Meeting Tracker, Meeting Insights, weekly reviews, series notes and account overviews are built from your meeting notes. They bring themselves up to date:

- **When you open one**, however you open it (ribbon button, command, file list, a link, search), the plugin rebuilds it first.
- **Click the ↻ icon** at the top right of the note to rebuild it while it's open, for example after adding an AI reply to a meeting in another tab.
- **Add AI reply** with an account also updates that account's overview note straight away, creating it if it's new.

Each note's *Updated …* line at the top says when it was last rebuilt.

**Checking items off from a hub note.** Open items in these notes are checkboxes. Tick one and the plugin checks it off in the meeting note it came from (with today's ✅ date), then rebuilds the hub note so the item leaves every list. Done items in a weekly review are plain bullets. Every item still lives only in its meeting note; the hub notes just show it.

> **Using the Tasks plugin's queries?** The hub notes list open items as checkboxes, so a vault-wide Tasks query would show each item again from the hub notes. Add `path does not include Meeting Hub` (your Meeting Hub folder's name) to the query, or once to **Settings → Tasks → Global query** to apply it to every query. Until you do, this plugin's settings show a warning under **Meeting Hub folder** with the exact line to add; the plugin only reads Tasks' settings, it never changes them.

---

## 1. Today's meetings

### What it is

A list of every meeting on today's calendar, from first to last, with a button to open its note and a button to join. It's the "what's my day look like?" view, and the fastest way into your next call.

### How to open it

Click the **calendar-with-clock** button in the left ribbon.

Or: press **Cmd + P**, type `today`, and choose **Open today's meetings**.

It opens in the **right sidebar**. Like the action items panel, it stays there as a tab (with the calendar-with-clock icon) until you close it.

### What you see

```
‹ Tuesday, October 6 ›        [New note] [Refresh]

9:00 AM – 9:15 AM                        ← faded: already over
Standup
[Open note] [🎵] [📋→] [📋+]

11:00 AM – 12:00 PM  [Now]               ← highlighted: happening now
Design Review
[Open note] [Join] [🎵] [📋→] [📋+]

3:00 PM – 4:00 PM
Planning
[Create note] [Join]
```

- **Faded** meetings are over. The meeting happening **now** has a coloured bar and a **Now** badge.
- **Open note** opens the meeting's note. If the note doesn't exist yet, the button says **Create note** and makes it, using your template, with the link to the previous meeting and its open items.
- **Join** opens the Zoom / Meet / Teams / Webex link. It appears only when the meeting has one, and disappears once the meeting is over.
- Clicking a meeting's **title** does the same as Open note / Create note.
- Once a meeting has started and has a note, three small buttons follow up on it (hover for the name): **Import Krisp transcript**, **Copy meeting for AI assistant** and **Add AI reply**. So after a meeting: click the first, confirm the recording, click the second, paste into your AI assistant, copy its reply, click the third. The same three icons are in the top-right corner of every meeting note.
- All-day events, cancelled meetings, and meetings you declined are left out, just as they are for note creation.

### Other days

Click **‹** beside the date to see the day before, or **›** for the day after. Keep clicking to go further. On a past day every meeting is faded; you can still open or create its note. A **Today** button appears while you're on another day; click it to come back.

### Notes for meetings that aren't on your calendar

Click **New note**, type a title (for example `Hallway chat with Bob`), and press **Enter**. The plugin creates a note from your template, just like a calendar meeting's note, dated on the day the panel is showing and starting at the current time (rounded down to the quarter hour). Fill in who was there and what was said as usual. Because the meeting isn't on your calendar, it doesn't appear in the panel's list, and syncing never changes or flags the note.

### Keeping it current

The list re-reads your calendar every 5 minutes, and the Now / faded markers update every minute. Click **Refresh** to re-read it straight away, for example after adding a meeting in Calendar.app.

### Meeting Brief

Each new note for an upcoming meeting starts with a **Meeting Brief** above the Agenda, so you walk in knowing where things stand:

- **Account**: the meeting's account (or its series' latest one), when you last met, the sentiment and outcome, and **⚠ at risk** if that meeting was Negative or Blocked
- **Where we left off**: the latest continuity points from this series or account (left out when the Agenda already shows them, as it does for recurring meetings)
- **They owe you**: open items owned by this meeting's attendees, overdue first — from this series or account, so another customer's items never show up (a meeting with neither, like an ad-hoc 1:1, shows everything they owe you)
- **You owe**: your open items from this series or account

The items are plain bullets linking to the meeting each came from; tick them off there, in the action items panel or in the Tracker. The brief refreshes itself when you open the note in the hour before the meeting (not once it has started, so it never changes under the notes you're taking), or click the **clipboard** icon at the top right of the note (or run **Refresh meeting brief**). Once you **Add AI reply**, the brief is removed: the AI write-up is the record from then on.

---

## 2. Meeting action items

### What it is

Every meeting note has a **Next Steps** section (**Action items** in older notes) with checkboxes:

```markdown
## Next Steps

- [ ] Send the deck to Bob
- [ ] Book the review room
- [x] Share notes        ← already done
```

Over weeks of meetings, those unchecked boxes end up spread across dozens of notes. The **Meeting action items** panel gathers every unchecked box from every meeting note into one list, so nothing gets forgotten.

### How to open it

Click the **checklist** button in the left ribbon.

Or: press **Cmd + P**, type `action items`, and choose **Open meeting action items**.

A panel titled **Open action items** opens in the **right sidebar** (the column on the right edge of the Obsidian window).

**Can't see the right sidebar?** Click the **sidebar icon** in the top-right corner of the window, or press **Cmd + P** and run **Toggle right sidebar**.

**Opening it next time:** after the first time, the panel stays in the right sidebar as a small tab with a **checklist icon** (☑ with lines) at the top of the sidebar, next to tabs like Backlinks and Outline. Click that icon to come back. Clicking the ribbon button again also brings it to the front.

### What you see

```
Open action items

Weekly Sync                     ← meeting title (click to open the note)
2026-10-06 10:00                ← when the meeting was
  ☐ Send the deck to Bob
  ☐ Book the review room

Design Review
2026-10-02 14:00
  ☐ Draft the Q4 plan
```

- Meetings are listed **newest first**.
- Only **unchecked** items appear. Checked items (`- [x]`) and empty checkboxes (`- [ ]` with nothing after it) are left out.
- Meetings with nothing left to do don't appear at all.
- If no meeting has an open item, the panel says **No open action items in your meeting notes.**

### How to use it

- **Tick a box** → the item is checked off *in its meeting note* (the `[ ]` becomes `[x]`) and disappears from the list. There is no separate copy to keep in sync.
- **Click a meeting title** → its note opens in the main area.
- **Add an item** → type `- [ ] something` in any meeting note. It appears in the panel within a second or so.

Any unchecked checkbox in a meeting note counts, not only the ones under **Action items**. A `- [ ] Ask about budget` line in your **Notes** section shows up too.

### How it works with recurring meetings

When the plugin creates the next note in a recurring series (for example next week's Weekly Sync), its **Agenda** reminds you where you left off — the **Core Elements for Next Meeting Continuity** from last time's AI write-up — and what is still open:

```markdown
## Agenda

- Where we left off in [[last meeting]]:
  - Confirm the POV success criteria
- Open items from [[last meeting]]:
  - Send the deck to Bob
- 
```

These reminders are plain bullets, not checkboxes, on purpose: each to-do stays in **one** place, the note where it was written. Tick it off in the panel (or in that earlier note) and it's done everywhere.

### Who owns it, and when it's due

You can add two optional tags to any action item:

| To say… | Type… | Example |
|---|---|---|
| Who owns it | `@` and a name | `- [ ] Send the deck @Bob` |
| Who owns it (name with spaces) | `@` and a link | `- [ ] Send the deck @[[Bob Jones]]` |
| When it's due | `📅` and a date (year-month-day) | `- [ ] Send the deck @Bob 📅 2026-10-10` |
| When it's due (easier to type) | `[due:: ` date `]` | `- [ ] Send the deck @Bob [due:: 2026-10-10]` |

The 📅 and `[due:: ]` formats are the ones the **Tasks** community plugin uses, so if you use Tasks it understands these dates too. (To type 📅 on a Mac, press **Ctrl + Cmd + Space** and search for "calendar".)

In the panel, a due date shows under the item, in **red** once the date has passed.

### Priority

Mark an item's priority with the Tasks plugin's symbols: `⏫` high, `🔼` medium, `🔽` low (`🔺` highest, `⏬` lowest, which the plugin treats as **Someday**: never in the Tracker's Focus, always under **Gone stale?**). Action items added from an AI reply get these from the priority the AI writes at the end of each next step, e.g. `(2026-10-09, High)` — see [AI agent instructions](AGENT_INSTRUCTIONS.md). The panel shows **High** in red, and when grouped by person or due date, puts higher-priority items first.

Ticking an item in the panel also adds the date it was done (`✅ 2026-10-08`), in the same format the Tasks plugin uses. More in **[Tasks and meeting action items](TASKS.md)**.

### Grouping: by meeting, by person, or by due date

At the top of the panel is a menu, set to **By meeting** at first. Change it to see the same items another way:

| Choice | Groups | Good for |
|---|---|---|
| **By meeting** | One group per meeting, newest first | "What came out of yesterday's review?" |
| **By person** | One group per `@owner`, A–Z; items without an owner go under **Unassigned** | "What does Bob owe me?" before a 1:1 |
| **By due date** | **Overdue**, **Today**, **Next 7 days**, **Later**, **No due date** | "What's late?" at the start of the day |

When grouped by person or due date, each item shows which meeting it came from. Click that name to open the meeting's note. The panel remembers your choice.

### Mine, or waiting on others

Once the plugin knows your name, a second menu shows **Mine** (items owned by you, or by no one), **Waiting on others** (items someone else owns: your follow-ups) or **Everyone**. It finds your name from **Your name** in the plugin's settings, and from your entry in calendar invites when **Your email address** is set. Until then the panel shows everyone's items.

### Your own to-dos

Tasks that aren't from a meeting go in **My To-Dos**, a note in your Meeting Hub folder. Click the **list with a plus** icon in the ribbon, the **+ To-do** button at the top of this panel, or run **Add a to-do** (give it a hotkey under **Settings → Hotkeys**). Type the task, optionally pick a due date and a priority, and press **Enter**; it's added without opening the note. You can also type `- [ ] …` lines straight into the note (**Open my to-dos**).

**From email or chat.** In the **Add a to-do** box, pick **From** (Email, or Slack or Teams) and paste a link back to the message if it has one, such as a Slack permalink; the to-do is tagged `#from-email` or `#from-chat`. For a long email or thread, run **Add tasks from an email or chat message** (or click **Tasks from a message** in My Day): paste the message, click **Copy for AI** and paste that into your assistant, then paste its reply and click **Add tasks**. Your action items go on your list; what others promised goes to Waiting on others. As with meeting replies, the plugin never contacts the AI itself.

To-dos are always yours. They lead this panel, are ranked into the Tracker's **Focus** with your meeting items, go to **Gone stale?** when old and undated (or marked Someday), and count in the weekly review's Done and Overdue lists.

### Park: keep it for the account, off your list

Some items still matter for a customer or a 1:1 series, but aren't something you'll work on now. Hover over the item and click **⏸ Park**. It stays open — and keeps showing, marked *parked*, in the account overview, the series note, the Meeting Brief, the Tracker's **Open items by account** and the next meeting's Agenda — so it comes up when that account or series does. But it's off your own lists: the Tracker's Focus, Overdue, Due soon, High priority, Waiting on others and Gone stale?, and this panel's **Mine** and **Waiting on others**.

Parking adds a `#parked` tag to the task in its meeting note; type or delete the tag to park or unpark by hand. Choose **Parked** in the panel's menu to see everything parked, and click **▶ Unpark** to put one back on your list. Park someone else's item to stop chasing it without dropping it.

### Won't do

Not every item is worth doing. Hover over an item and click **×** to drop it: it's marked cancelled in its meeting note (`- [-] … ❌ 2026-10-10`, the Tasks plugin's format), leaves every list, and isn't counted as done.

---

## 3. Meetings dashboard

### What it is

A table of all your meeting notes, with views for upcoming and recent meetings, accounts, categories, customer meetings, sentiment, outcome and AI summaries. It is an Obsidian **Bases** file named `Meetings.base`, saved in your Meeting Hub folder (the meeting-notes folder unless you set one in settings).

**Requires Obsidian 1.9 or later** (Bases was added in 1.9). Check your version under **Settings → About**.

### How to open it

Click the **dashboard** button (four squares) in the left ribbon.

Or: press **Cmd + P**, type `meetings dashboard`, and choose **Open meetings dashboard**.

The first time, the plugin creates `Meetings.base` in your Meeting Hub folder and opens it. After that you can also open it by clicking **Meetings.base** in the file list on the left, like any note.

### What you see

At the top left of the table is a **view menu** showing the current view's name. Click it to switch between:

| View | Shows | Columns |
|---|---|---|
| **Next 7 days** | Meetings starting from today through the next 7 days | Note, start, location, attendees, calendar |
| **Last 7 days** | Meetings from the past 7 days, up to now | Note, start, attendees, calendar |
| **By account** | Meetings with an `account` property, grouped by account | Note, start, category, attendees |
| **By category** | Meetings with a `meeting_category` property, grouped by category | Note, start, account, attendees |
| **Customer meetings** | Meetings whose category is `Customer`, grouped by account | Note, start, sentiment, outcome, key topics |
| **By sentiment** | Meetings with a `sentiment` (Positive, Neutral, Mixed, Negative), grouped by it | Note, start, account, outcome, key topics |
| **By outcome** | Meetings with an `outcome` (Decision Made, Progress, Blocked, Informational), grouped by it | Note, start, account, sentiment, key topics |
| **Needs AI summary** | Meetings in the last 14 days that took place and have no AI reply filed yet | Note, start, Krisp recording, attendees |
| **AI-summarized** | Meetings with an AI reply filed, with everything it recorded | Note, start, account, category, sentiment, outcome, key topics, organizations, speakers |
| **All meetings** | Every meeting note, newest day first | Note, start, organizer, attendees, calendar, status |

The day views are grouped by day. The account, category, sentiment, outcome and topic views fill in as you file AI replies that start with a **Meeting Metadata** block (see [AI agent instructions](AGENT_INSTRUCTIONS.md)); you can also type those properties yourself.

> **Already have `Meetings.base`?** When you open it after an update, the plugin adds the new built-in views to the end of its view list, once, and changes nothing else. A built-in view you delete or rename stays that way. If you've rearranged the file so that `views:` isn't its last section, it's left alone. **Click a note name** to open that meeting's note. The **status** column shows `cancelled`, `removed` or `declined` for meetings that were cancelled, deleted from your calendar or declined.

### Changing it

`Meetings.base` is yours to edit. Add or remove columns, change sorting, or add views from the toolbar above the table. See Obsidian's [Bases help](https://obsidian.md/help/bases). The plugin never overwrites your changes; it only adds built-in views that are new in an update, once each. To get the original back, delete `Meetings.base` and run **Open meetings dashboard** again.

---

## 4. Meeting tracker

### What it is

One page summarizing every meeting note, your own items first:

| Section | What's in it |
|---|---|
| **At a glance** | Counts of your open, overdue, due-soon and high-priority items, what others owe you, items gone stale, parked items, and this week's meetings |
| **Focus** | Your 7 most pressing items, each tagged with why: *overdue* (longest overdue first), *due soon* (next 7 days), *high priority*, *at-risk account* (its latest meeting was Negative or Blocked), then *from this week* |
| **Overdue**, **Due in the next 7 days**, **High priority** | Your items only |
| **Waiting on others** | Items someone else owns, by person, late ones marked *overdue* — your follow-up list (10 per person; the rest are in the action items panel) |
| **Gone stale?** | Items with no due date from meetings over 30 days ago (not high priority). **Ticking one here marks it won't do**, not done |
| **Open items by account** | Everyone's, parked ones included and marked *parked*; 10 per account, with a link to the account overview for the rest |
| **Decisions in the last 30 days**, **Meetings this week** | As before |

Your items are those owned by you or by no one; see [Mine, or waiting on others](#mine-or-waiting-on-others) for how the plugin knows your name. Without it, every item counts as yours. Each item links to its meeting.

It needs no other plugins. Accounts and categories come from the `account` and `meeting_category` properties that **Add AI reply to this meeting** saves (or that you type yourself).

### How to open it

Click the **gauge** button in the left ribbon, or press **Cmd + P** and run **Open meeting tracker**.

It's a snapshot: each time you open it, the plugin rebuilds `Meeting Tracker.md` in your Meeting Hub folder with the latest numbers (click **↻** at the top right to rebuild it while it's open). Don't write in it — your edits are replaced the next time. To tick an item off, tick its box right here (the plugin checks it off in the meeting's own note), or use the **Meeting action items** panel. Meetings that were cancelled, deleted from your calendar or declined aren't listed under this week's meetings, but their open items still are.

The items are plain bullets, not checkboxes, so the action items panel and the Tasks plugin never count them twice.

---

## 5. Weekly review

### What it is

One note per week (Monday to Sunday), named like `2026-W41 Weekly Review.md`, in a **Weekly Reviews** folder inside your Meeting Hub folder. The plugin creates the folder the first time.

The top part is filled in for you:

| Section | Shows |
|---|---|
| **At a glance** | Meetings held, decisions made, items done, items still open, items overdue |
| **Meetings** | The week's meetings by day, with their category and account |
| **Decisions** | Each meeting's decisions |
| **Done this week** | Action items ticked off this week (they need a done date — the action items panel and the Tasks plugin add one) |
| **Still open from this week's meetings** | What came out of this week and isn't done, highest priority first |
| **Overdue** | Anything past its due date, from any meeting |

Below that is yours: **Wins**, **Concerns** and **Next week's focus**.

### How to open it

Click the **calendar with a check mark** in the left ribbon, or press **Cmd + P** and run **Open this week's review**. On Monday morning, run **Open last week's review** to look back at the week that just ended.

### Reopening it

Open the review again any time during the week: the plugin refreshes the top part with the latest numbers and leaves everything else — your Wins, Concerns, Next week's focus, and anything you add — exactly as you wrote it. The top part sits between two hidden markers; don't delete them, or the review can no longer be refreshed (your writing is still kept).

Each week keeps its own note, so the folder becomes a history of your weeks.

---

## 6. Meeting insights

### What it is

One page of analytics across every meeting note, in `Meeting Insights.md` in your Meeting Hub folder:

| Section | Shows |
|---|---|
| **Last 30 days at a glance** | Meetings held, hours in meetings, how many have an AI summary, next steps added and done, items overdue now |
| **Needs attention** | Accounts whose latest meeting was **Negative** or **Mixed**, or **Blocked**; blocked meetings in the last 30 days; accounts you haven't met in over 30 days ("gone quiet") |
| **Meetings per week** | The last 12 weeks, with hours and a bar for each week |
| **Where the time goes** | Meetings and hours by category over the last 30 days, with a pie chart |
| **Accounts** | Each account met in the last 90 days: meetings, last met, open and overdue items, sentiment over its last five meetings (🟢 Positive · ⚪ Neutral · 🟡 Mixed · 🔴 Negative) and latest outcome. Each account links to its overview note |
| **Sentiment** and **Outcomes** | How many meetings had each sentiment (90 days) and outcome (30 days) |
| **Trending topics** | Key topics of the last 30 days, compared with the 30 days before (↑ ↓ → or 🆕) |
| **People you meet most** | Attendees and identified speakers over the last 30 days, with the items each owns |
| **Action items by owner** | Open, overdue, and done in the last 30 days, per owner |
| **Oldest open items** | The ten items open longest |
| **Meetings without an AI summary** | Meetings in the last 14 days with no AI reply filed yet |
| **Busiest days** | Meetings per weekday over 90 days |

Category, account, sentiment, outcome, topics and speakers come from the properties **Add AI reply** saves from the reply's **Meeting Metadata** block (see [AI agent instructions](AGENT_INSTRUCTIONS.md)); hours come from each note's start and end. Meetings that were cancelled, removed or declined aren't counted. To leave yourself out of **People you meet most**, set **Your email address** in the plugin's settings.

### How to open it

Click the **trending-up arrow** button in the left ribbon, or press **Cmd + P** and run **Open meeting insights**.

Like the tracker, it's rebuilt each time you open it — don't write in it. Opening it also refreshes every account overview note.

---

## 7. Account overviews

### What it is

One note per account, in an **Accounts** folder inside your Meeting Hub folder, named after the account (for example `Accounts/Acme Corp.md`). The plugin's part shows:

- **At a glance**: meetings held, last met, the next meeting on the calendar, open and overdue items, and the sentiment trend
- **Where we left off**: the continuity points of the latest meeting that has them
- **Meetings**: every meeting with the account, newest first, with its category, sentiment and outcome
- **Open items**, **Recent decisions** (the last five meetings with decisions), **Key topics** and **People** (with how many meetings each was in), and the organizations involved

Above it are **Overview** and **Key contacts** sections for your own notes; they're never changed. An account is the `account` property of meeting notes; different capitalizations (`Acme`, `ACME`) count as one account.

### How to open it

- Run **Open meeting insights**: it creates or refreshes the note of every account met in the last 90 days, and links each one from its **Accounts** table.
- Or, in any meeting note with an `account`, press **Cmd + P** and run **Open account overview**.
- **Add AI reply** creates or refreshes the overview of the account it saves.

The plugin's part sits between two hidden markers and is rebuilt each time you open the note or click **↻** at its top right; write above it.

---

## Troubleshooting

**The action items panel is empty, but I have open items.**
- The items must be in notes the plugin created: notes with a `calendar_event_id` property. They can be in any folder.
- The line must be a checkbox with text: `- [ ] Do the thing`. A plain bullet (`- Do the thing`) isn't a to-do.

**Today's meetings says "Couldn't read your calendar."**
The plugin couldn't reach Apple Calendar. Open **Settings → Meeting Notes for Apple Calendar** and click **Test connection**; see the README's Troubleshooting section for the usual fixes (Calendar access permission).

**An item has a date, but it isn't red / isn't under Overdue.**
The date must be written year-month-day with two-digit month and day, e.g. `📅 2026-10-05`, not `📅 10/5`.

**I can't find a panel after closing it.**
Click its button in the left ribbon (calendar-with-clock for Today, checklist for action items), or run **Open today's meetings** / **Open meeting action items** from the command palette (**Cmd + P**).

**`Meetings.base` opens as text, or nothing displays.**
Update Obsidian to 1.9 or later, and make sure **Settings → Core plugins → Bases** is turned on.

**A meeting is missing from the Meetings dashboard.**
Only meetings that have a note appear. Notes are created for meetings within **Hours in advance**. Use **Create note from calendar event** to make one for a meeting further out.
