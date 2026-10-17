# Recommended setup

How to set up the plugin, Obsidian and the optional add-ons to get the most out of everything: automatic meeting notes, the Today's meetings panel, Krisp transcripts, AI summaries, action items and dashboards.

Everything here runs on your Mac. The plugin never sends anything over the network.

---

## 1. What you need

| | Required? | Why |
|---|---|---|
| macOS with Calendar.app | Required | The plugin reads your meetings from Apple Calendar |
| Obsidian 1.4.10 or later | Required | |
| Obsidian **1.9** or later | Recommended | The **Meetings dashboard** uses Bases, added in 1.9. Check under **Settings → About** |
| **BRAT** community plugin | Required to install and update | Installs this plugin from GitHub and keeps it up to date |
| Krisp | Optional | For meeting transcripts |
| An approved AI assistant | Optional | Gemini, Claude, ChatGPT, Copilot or your own agent, for summaries |
| **Tasks** community plugin | Recommended | Live action-item lists in any note — see [Tasks and meeting action items](TASKS.md) |

---

## 2. Calendar access

1. Make sure the accounts you want (work Google, Exchange, iCloud) appear in **Calendar.app**.
2. **System Settings → Privacy & Security → Calendars** → set **Obsidian** to **Full Calendar Access** (not "Add Only"). macOS asks the first time the plugin reads your calendar.
3. In the plugin's settings, under **Apple Calendar**, switch on only the calendars whose meetings should get notes, then click **Test**. If no events show up, click **Run Diagnostics**.

---

## 3. Plugin settings

Open **Settings → Meeting Notes for Apple Calendar**. Recommended values:

### Personal

| Setting | Recommended | Why |
|---|---|---|
| Your email address | Your work email | Hides you from attendee lists, skips meetings you declined, and lets **Skip meetings with no one else invited** work |

### Note Settings

| Setting | Recommended | Why |
|---|---|---|
| Note folder | `Meeting Notes` | Where new notes are created. File them anywhere afterwards, as deep as you like — the plugin still finds them |
| Hours in advance | `12` | Tomorrow morning's notes exist by the evening before |
| Poll interval | `30` minutes | |
| Include past events | Off, unless you want notes for meetings you missed | |
| Skip meetings titled | e.g. `Focus time`, `Lunch`, `Hold`, `OOO`, `Commute` (one per line) | No clutter notes for blocks that aren't meetings |
| Skip meetings with no one else invited | On | Same, for blocks you put on your own calendar |

### Note Contents

| Setting | Recommended | Why |
|---|---|---|
| Include event description | On | The invite's agenda lands in the Agenda section |
| Link attendees | On if you keep a note per person | Each person's note then lists every meeting with them |
| Template file | Empty (built-in format) unless you need a custom layout | The built-in format has every section the Krisp, AI and action item features use |
| Sections in new notes | All on | Turn off only sections you never use. Keep **Next Steps**, **Executive Summary**, **Key Decisions** and **Transcript** if you use the action items panel, AI summaries or Krisp |
| Link to daily note | On | Each day's daily note lists that day's meetings in its backlinks |
| Show next meeting in status bar | On | One click to open the note and join |
| Open Today's meetings at startup | On | The Today panel, with Join buttons, opens in the right sidebar |

### Krisp Transcripts

| Setting | Recommended |
|---|---|
| Krisp folder | Where Krisp saves recordings, e.g. `~/Documents/Transcripts/Krisp Meetings` |
| Import transcripts automatically | Start **off** and run **Import Krisp transcript into this note** by hand for a few days. Once the suggested recordings look right, turn it on — you still confirm every import |

### AI Assistant (copy and paste)

| Setting | Recommended |
|---|---|
| Include instructions when copying | **Off** if your assistant has its own instructions (set up from [AI agent instructions](AGENT_INSTRUCTIONS.md)); **on** otherwise |
| Instructions | Leave at the default unless you're not using an agent |
| Save category, account and tags as properties | On — feeds the **By account** and **By category** dashboard views |

---

## 4. Obsidian's built-in features

These are Obsidian core plugins: **Settings → Core plugins**.

| Core plugin | Recommended | Why |
|---|---|---|
| **Daily notes** | On | **Link to daily note** uses its date format and folder |
| **Bases** | On (Obsidian 1.9+) | The **Meetings dashboard** |
| **Properties view** | On | See and edit `account`, `meeting_category` and the other meeting properties |
| **Backlinks** | On | A person's or daily note shows the meetings that link to it |

---

## 5. The Tasks plugin

Install **Tasks** from **Settings → Community plugins → Browse**. Two settings matter — **Task Format: Tasks Emoji Format** and an **empty Global filter** (both the defaults) — and two are worth turning on: **Set created date on every added task** and **Set done date on every completed task**. Full details and ready-to-paste lists are in **[Tasks and meeting action items](TASKS.md)**.

---

## 6. Hotkeys

**Settings → Hotkeys**, search for the command, click **+**, press your keys. Suggestions below use Ctrl + Option, which Obsidian leaves free; if Obsidian shows a key as already in use, pick another.

| Command | Suggested keys |
|---|---|
| Join current or next meeting | Ctrl + Option + J |
| Open today's meetings | Ctrl + Option + T |
| Open meeting action items | Ctrl + Option + A |
| Import Krisp transcript into this note | Ctrl + Option + K |
| Copy meeting for AI assistant | Ctrl + Option + C |
| Add AI reply to this meeting | Ctrl + Option + V |
| Open meeting tracker | Ctrl + Option + M |
| Open this week's review | Ctrl + Option + W |

---

## 7. A typical day

1. **Morning** — open **Today's meetings** (ribbon: calendar with clock). Notes for today's meetings already exist.
2. **Before a meeting** — click **Join** (or the status bar). The note opens with the agenda and last meeting's open items.
3. **During** — type into **Notes**, **Decisions** and **Action items** (`- [ ] Send deck @Bob 📅 2026-10-10`).
4. **After** — click the three icons in the note's top-right corner (or on the meeting in **Today's meetings**), left to right: **Import Krisp transcript** (confirm the recording), **Copy meeting for AI assistant** (paste into your assistant, copy its reply), **Add AI reply**.
5. **File it** — move the note into your own folder structure. Its action items, links and dashboard entries follow it.
6. **Follow up** — the **Meeting action items** panel (ribbon: checklist) shows everything still open, by meeting, person or due date. Tick items off there or in the note.
7. **Any time** — open the **Meeting tracker** (ribbon: gauge) for overdue items, what's due this week, open items by account and person, and the last 30 days' decisions.
8. **Friday (or Monday)** — open **This week's review** (ribbon: calendar with a check mark), or **Last week's review** on a Monday. Read the week's meetings, decisions and what got done, then write your wins, concerns and next week's focus.
