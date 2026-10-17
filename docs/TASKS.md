# The Tasks plugin and meeting action items

Your meeting notes' **Action items** are ordinary Markdown checkboxes, written in the format of **Tasks**, a free community plugin. You don't need Tasks — the plugin's own **Meeting action items** panel and **Meeting tracker** work without it — but with Tasks installed you get:

- live, always-current lists of action items that you can put in any note (your daily note, a project note, a page per customer)
- filtering and grouping by due date, priority, owner, account, done date
- a date picker and priority picker when you edit a task

Tasks runs entirely in Obsidian on your Mac; it sends nothing anywhere.

---

## How an action item is written

```markdown
- [ ] Send the pilot scope document @[[Bob Jones]] ⏫ ➕ 2026-10-07 📅 2026-10-09
```

| Part | Meaning | Who writes it |
|---|---|---|
| `- [ ]` | An open task (`- [x]` when done) | You, or **Add AI reply to this meeting** |
| `@[[Bob Jones]]` (or `@Bob`) | Who owns it. `(owner: Customer IT team)` for a team or role | You, or the AI reply |
| `⏫` / `🔼` / `🔽` | High / medium / low priority (`🔺` highest, `⏬` lowest) | The AI reply, from its Priority column — or you |
| `➕ 2026-10-07` | Date the item was created | The AI reply, on the day you add it |
| `📅 2026-10-09` | Due date | You, or the AI reply |
| `✅ 2026-10-08` | Date it was done | Added when you tick the item — in the **Meeting action items** panel, or in the note with Tasks installed |

Owners are this plugin's convention; Tasks treats them as part of the task text, which is why the lists below can still group by them.

---

## Installing Tasks

1. **Settings → Community plugins**. (If you see **Turn on community plugins**, click it — it's already on if you installed this plugin with BRAT.)
2. Click **Browse**, search for **Tasks**, choose **Tasks** (its description starts "Track tasks across your vault"), click **Install**, then **Enable**.

## Recommended Tasks settings

Open **Settings → Tasks** (under Community plugins).

| Setting | Set to | Why |
|---|---|---|
| **Task Format** | **Tasks Emoji Format** (the default) | Required. Meeting action items use the emoji format (`📅`, `⏫`, `➕`, `✅`) |
| **Global filter** | **Empty** (the default) | Required. If set (for example to `#task`), Tasks ignores every checkbox without that tag — including all your meeting action items |
| **Set created date on every added task** | On | Tasks then adds `➕` to items you create with its **Create or edit task** command, matching the ones from AI replies |
| **Set done date on every completed task** | On (the default) | Adds `✅` when you tick an item in a note — the same thing the Meeting action items panel does |
| **Recurring tasks**, **Statuses** | Leave as they are | Not used by meeting notes |

Nothing needs changing in this plugin's settings for Tasks.

## Version

The lists below need **Tasks 7.7 or later** for the ones that use note properties (**by account**). Check under **Settings → Community plugins → Tasks**.

---

## Ready-to-paste lists

Paste any of these into a note. In Reading view (or Live Preview) each becomes a live list; tick items right there.

Every list includes `heading includes Action items`, so it only picks up meeting action items (wherever you filed the note), and `description regex matches /\S/`, which skips the empty `- [ ]` placeholder in new notes.

### All my open meeting action items, by due date

````markdown
```tasks
not done
heading includes Action items
description regex matches /\S/
group by due
sort by priority
```
````

### Overdue

````markdown
```tasks
not done
heading includes Action items
due before today
sort by due
```
````

### Due this week

````markdown
```tasks
not done
heading includes Action items
due this week
sort by due
sort by priority
```
````

### High priority

````markdown
```tasks
not done
heading includes Action items
priority is above medium
sort by due
```
````

### By owner

````markdown
```tasks
not done
heading includes Action items
description regex matches /\S/
group by function task.description.match(/@\[\[([^\]|]+)/)?.[1] ?? task.description.match(/@([\p{L}\p{N}_.-]+)/u)?.[1] ?? task.description.match(/\(owner: ([^)]+)\)/)?.[1] ?? 'Unassigned'
sort by due
```
````

### By account (Tasks 7.7+)

Uses the `account` property that **Add AI reply to this meeting** saves.

````markdown
```tasks
not done
heading includes Action items
description regex matches /\S/
group by function task.file.property('account') ?? 'No account'
sort by due
```
````

### One customer's open items

Change `Acme Corp` to the account name (Tasks 7.7+).

````markdown
```tasks
not done
heading includes Action items
filter by function task.file.property('account') === 'Acme Corp'
sort by due
```
````

### Done in the last 7 days

````markdown
```tasks
done
heading includes Action items
done after 7 days ago
group by done
```
````

### In your daily note: today's follow-ups

````markdown
```tasks
not done
heading includes Action items
due before tomorrow
sort by priority
```
````

---

## How it fits with the rest of the plugin

| | Needs Tasks? | Best for |
|---|---|---|
| **Meeting action items** panel (ribbon: checklist) | No | A quick sidebar of everything open, by meeting, person or due date; tick items off in place |
| **Meeting tracker** (ribbon: gauge) | No | A one-page snapshot: overdue, due soon, high priority, by account and person, recent decisions, this week's meetings |
| **Tasks lists** (above) | Yes | Live lists inside your own notes, with any filter you like |

They all read the same checkboxes, so ticking an item anywhere updates all three. The Meeting tracker lists items as plain bullets, not checkboxes, so Tasks never counts them twice.
