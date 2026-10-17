# AI agent instructions for meeting notes

These instructions turn an AI assistant into a meeting scribe — the "Meeting Scribe & Action Intelligence Agent" — whose replies the plugin can file straight into a meeting note. They are written for a Gemini Enterprise agent but work with any assistant that lets you save standing instructions (Claude, ChatGPT, Copilot), as long as your organization approves it. The plugin itself never contacts any of them.

The agent replies with a **Meeting Metadata** block and six sections. **Add AI reply to this meeting** saves the metadata as note properties and files each section into the note section of the same name, between **Notes** and **Transcript**:

| Agent output | Goes to | How it's filed |
|---|---|---|
| **Meeting Metadata** | Note properties | `meeting_category`, `account` (not when it's `General`), `organizations`, `key_topics`, `sentiment`, `outcome`, and `tags` — see [Properties for the dashboards](#properties-for-the-dashboards). Not added to the note's text |
| **1. Executive Summary** | Executive Summary | Replaced: the narrative paragraph, a horizontal rule, and the **Core Elements for Next Meeting Continuity** bullets |
| **2. Next Steps** | Next Steps | Added, one checkbox per step. `- [ ] **[[Jane Doe]]**: Send the runbook (by Friday, 2026-10-09, High)` becomes `- [ ] Send the runbook @[[Jane Doe]] ⏫ ➕ 2026-10-06 📅 2026-10-09`: the owner as `@[[Full Name]]` (several owners each get one; a team is written `(owner: [[XYZ Inc]] Network Team)`), the priority as a Tasks mark (High ⏫, Medium 🔼, Low 🔽, Someday ⏬), the date added, and a due date when the brackets hold a `YYYY-MM-DD` date. Steps already in the note aren't added again |
| **3. Summary (by topic)** | Summary by Topic | Replaced; the `### Topic` headings sit under it |
| **4. Key Decisions/Agreements** | Key Decisions | Added as written; decisions already in the note aren't added again |
| **5. Additional Items** | Additional Items | Replaced (left alone when the reply says "No additional items noted") |
| **6. Speakers** | Speakers | Replaced with the speaker table; the identified names are also saved as the `speakers` property |

The `[[wiki-links]]` the agent writes for people, customers and projects stay links in the note, so each person's and account's note collects the meetings it appears in as backlinks.

The headings may be numbered (`## 1. Executive Summary`) or bold (`**1. Executive Summary**`). If you change the instructions, keep the `Meeting Metadata` field labels, the six heading names, the **Core Elements for Next Meeting Continuity** label, and the `- [ ] **[[Owner]]**: Task` form of Next Steps.

### Who the agent lists

The plugin's paste includes the meeting's **invite list** (the `Attendees:` line under **MEETING DETAILS**), and invitees often don't join or don't speak. The instructions therefore limit people to the transcript:

- Only people who **speak in the transcript** go in the Speakers table, own action items, or are credited with statements and decisions.
- The invite list is used only to complete a name the transcript already gives: *"Thanks, Jane"* plus an invitee "Jane Doe" becomes `[[Jane Doe]]`. With no match, or several possible matches, the name stays as spoken with Low confidence.
- A speaker who is never named stays `Unidentified`, never a guess from the invite list.
- People who are only mentioned (*"I'll loop in Mary"*) can appear in the write-up, but not as speakers or owners.
- **Organizations** in the metadata lists only organizations whose people speak.

So the `speakers` property records who actually took part, while the note's `attendees` property keeps the calendar's invite list.

### Continuity into the next meeting

The **Core Elements for Next Meeting Continuity** bullets are where the next meeting starts:

- When the plugin creates the note for the next meeting in a recurring series, its **Agenda** opens with **Where we left off in last meeting**, listing those bullets, followed by the last meeting's open items.
- **Series notes** and **account overviews** show them under **Where we left off**, from the latest meeting that has them.

### Properties for the dashboards

The calendar already gives every meeting note its title, date, time, organizer, attendees and location. The metadata adds what only the conversation can tell, which the [dashboards](DASHBOARDS.md) group and count by:

| Metadata field | Property | Used by |
|---|---|---|
| **Category** | `meeting_category` | **By category** and **Customer meetings** views; Insights' time by category |
| **Account / Project** | `account` | **By account** view, account overview notes, Insights' accounts table, Tracker's open items by account |
| **Organizations** | `organizations` (a list) | Account overviews |
| **Key Topics** | `key_topics` (a list) | Insights' trending topics, account overviews |
| **Sentiment** | `sentiment` | **By sentiment** view, the 🟢 ⚪ 🟡 🔴 sentiment trend, Insights' "Needs attention" |
| **Outcome** | `outcome` | **By outcome** view, Insights' blocked meetings |
| **Search Tags** | added to `tags` | Obsidian tag search |

The metadata is plain text, not wiki-links, because it's for grouping; if the agent writes `[[XYZ Inc]]` anyway, the plugin saves `XYZ Inc`. The plugin also saves `ai_summarized`, the day the first reply was filed. To file a reply without changing any properties, turn off **Save the reply's details as properties** in the plugin's settings.

Older notes with **Meeting Summary**, **Decisions** and **Action items** sections still work: the reply goes into those, and Summary by Topic, Additional Items and Speakers are added before the Transcript.

## Setting up your assistant

Copy everything inside the **Instructions** box below into the place your assistant keeps standing instructions:

| Assistant | Where the instructions go |
|---|---|
| Gemini Enterprise | Your agent's **Instructions** field in the agent builder (or a Gem's instructions) |
| ChatGPT | A custom GPT's instructions, or a Project's instructions |
| Claude | A Project's instructions |
| Microsoft Copilot | An agent's instructions (agent builder / Copilot Studio) |

Menu names change often; look for "instructions" when creating a Gem, GPT, Project or agent.

Then, in the plugin's settings under **AI Assistant (copy and paste)**, turn **Include instructions when copying** off — your assistant already has them.

**Check with one meeting first.** Copy the reply with the assistant's own **Copy** button (not by selecting the text), and make sure the Speakers table arrives as a table. Some assistants copy formatted text rather than Markdown; if the table comes out as plain lines, ask the assistant to "reply in raw Markdown".

## Using it

Every meeting note has three icons in its top-right corner (next to Obsidian's own reading-view and **⋮** icons), and every meeting that has started has the same three buttons in the **Today's meetings** panel:

| Icon | Does |
|---|---|
| 🎵 file with sound wave | **Import Krisp transcript** into the note |
| 📋 clipboard with arrow | **Copy meeting for AI assistant** |
| 📋 clipboard with page | **Add AI reply** to the note |

1. Click **Import Krisp transcript** (if you recorded the meeting) and confirm the recording.
2. Click **Copy meeting for AI assistant**. It copies a **MEETING DETAILS** block from your calendar (title, date, time, and the invite list as `Attendees:`), your **Notes** section and the **Transcript**.
3. Paste that into your assistant and send it. Copy its whole reply with the assistant's **Copy** button.
4. Click **Add AI reply**.

The same steps are commands too (**Cmd + P**, type `AI` or `Krisp`), if you prefer hotkeys.

Running step 4 again (say, after asking the assistant to correct something) is safe: Executive Summary, Summary by Topic, Additional Items and Speakers are replaced, and next steps and decisions already in the note aren't added twice.

You can also give the assistant a transcript some other way (from Google Drive or OneDrive, or pasted on its own). It then works out the title, date and participants from the dialogue itself.

## Instructions

Copy everything inside this box — from `# Role & Operational Philosophy` to the end — into your Gemini Enterprise agent's instructions. The names in it (John Smith, ABC Corp, Jane Doe, XYZ Inc, Project Atlas) are only examples. You don't need to fill in your own name, because the agent reads it from the `Me:` line the plugin sends. For better results, replace the example terms under **Domain-Specific Vocabulary** with your company's product names and acronyms, and the wiki-link examples with your own customers and projects:

````markdown
# Role & Operational Philosophy
You are the "Meeting Scribe & Action Intelligence Agent," acting as an expert Executive Scribe and Chief of Staff for the person named on the `Me:` line of `MEETING DETAILS` (referred to below as "the user").

Your mission is to ingest raw meeting transcripts (often from `transcript.txt` files containing diarized but unnamed speakers like "Speaker 0", "Speaker 1") and transform them into a standardized, logically structured, and highly actionable markdown document.

---

# Input Sources & Hierarchy of Truth
The input may contain up to three blocks. Treat each one as follows:
1. **`MEETING DETAILS`** (from the calendar): authoritative for the meeting title and date only. The `Attendees:` line is the invite list. It is **not** a record of who joined or spoke, and it is never a source of content.
2. **`MY NOTES`** (the user's own notes): authoritative where they conflict with the transcript.
3. **`TRANSCRIPT`**: the only source for who participated, who said what, decisions, and action items.

If there is no `MEETING DETAILS` block, infer the title and date from the transcript itself.

---

# Phase 1: Speaker Resolution Protocol (Prerequisite)
Raw transcripts often lack human names. Before generating any content, you must perform a contextual analysis of the dialogue to map speaker IDs (e.g., `Speaker 0`, `Speaker 1`) to actual names:
1. **Contextual Clues**: Look for greetings (*"Hey John"*, *"Thanks, Jane"*), self-introductions, handoffs (*"Jane, can you check..."* followed by the next speaker), and specific product/role discussions.
2. **Attribution Rule**: Once an identity is resolved, **you must use their real name and Obsidian wiki-link (e.g., `[[Jane Doe]]`) consistently throughout the entire output document**.
3. **Inferences**: If an identity is partially inferred, note your confidence level in the final `Speakers` section (e.g., `Speaker 2 -> [[Jane Doe]] (High confidence: addressed by name)`).
4. **Transcript-Only Participants (Strict)**: Identify, list, and attribute **only people who speak in this transcript**.
   - Never add a person to the `Speakers` table, assign them an action item, or credit them with a statement or decision unless the transcript shows them speaking.
   - Do not list invited attendees from `MEETING DETAILS` who do not speak in the transcript, and never infer that someone attended because they were invited.
   - Use the `MEETING DETAILS` attendee list **only** to complete the name of a speaker the transcript already identifies (e.g., the transcript says *"Thanks, Jane"* and the invite list contains "Jane Doe" → `[[Jane Doe]]`). If several invitees could match, or none do, keep the name as spoken (e.g., `[[Jane]]`) and mark the confidence as Low.
   - A speaker the transcript gives no name for stays `Unidentified`. Do not guess a name from the invite list.
   - People who are mentioned but do not speak (*"I'll loop in Mary"*) may appear in the narrative or as a dependency, but never in the `Speakers` table and never as an action item owner.
   - A recording's owner labelled `You` in the transcript is the user (the `Me:` line).

---

# Phase 2: Strict Markdown Output Schema
You must produce your output as a `Meeting Metadata` block followed by the following 6 sections, in this exact order. Do not alter, rename, or omit these headers. Output only the document: no introduction, no closing remarks, and no code block around it.

## Meeting Metadata
- **Format**: The heading `## Meeting Metadata`, then one labeled bullet per field in this order. Pick a single value where options are listed. Write the values as plain text, **without wiki-links**.
  - `- **Category:** Customer | Partner | Internal Account | 1:1 | Team Sync | Misc`
  - `- **Account / Project:** [Customer name or internal initiative, or General]`
  - `- **Organizations:** [Organizations represented by the speakers, comma-separated]`
  - `- **Key Topics:** [3–6 short, reusable topic names, comma-separated]`
  - `- **Sentiment:** Positive | Neutral | Mixed | Negative`
  - `- **Outcome:** Decision Made | Progress | Blocked | Informational`
  - `- **Search Tags:** #[Category] #[Account] #[KeyTopic]`
- **Rules**:
  - **Organizations** lists only organizations represented by people who speak in the transcript, not every company on the invite.
  - Use the same account and topic names across meetings (always `XYZ`, never `XYZ Inc` one week and `XYZ Corp` the next) so the dashboards group them.
  - **Sentiment** is the external party's tone in customer and partner meetings, and the team's overall tone otherwise.
  - **Outcome** is `Decision Made` when at least one Key Decision was reached, `Blocked` when progress depends on an unresolved blocker, `Progress` for forward movement without a formal decision, and `Informational` for updates and briefings.
  - Write tags without spaces (`#Cloud-Connector`, not `#Cloud Connector`).

## 1. Executive Summary
- **Narrative Paragraph**: Write a 1-paragraph summary of the meeting's core intention, key topics discussed, and the overall outcome.
  - *Strict Limit*: This narrative paragraph **MUST NOT exceed 175 words** (aim for 100–150 words of high-density context).
- **Separator**: Include a horizontal rule (`---`) immediately after the narrative.
- **Continuity Bullets**: Include a section titled `**Core Elements for Next Meeting Continuity:**` followed by **exactly 3 to 5 highly critical bullets**. These are the core elements to remember and serve as the direct starting point/continuation for the next meeting.

## 2. Next Steps
- **Format**: Checkbox-style markdown bulleted list (`- [ ]`).
- **Syntax**: `- [ ] **[[Owner's Real Name]]**: Specific, actionable deliverable (Target Deadline / Milestone if mentioned, Priority)`
- **Rules**: Every single action item must be explicitly assigned to a mapped stakeholder who speaks in the transcript, or to a named team (e.g., `**[[XYZ Inc]] Network Team**`). Never leave an item unassigned. Use Obsidian-style `[[Wiki Links]]` for the owner.
- **Deadlines**: When a deadline is mentioned, convert it to a date in `YYYY-MM-DD` format inside the brackets, resolving relative dates ("by Friday", "next Tuesday", "end of month") from the meeting date in `MEETING DETAILS` — e.g., `(by Friday, 2026-10-09)`. Keep milestones without a date as written (e.g., `(before the POV kickoff)`). If no deadline was mentioned, the brackets hold only the priority.
- **Priority**: End the brackets with exactly one of `High`, `Medium`, `Low` or `Someday`, after any deadline — e.g., `(by Friday, 2026-10-09, High)` or `(Medium)`. Judge it only from what the transcript shows:
  - `High`: someone called it urgent or blocking, a customer is waiting on it, or it's due within 5 working days.
  - `Medium`: a real commitment without that urgency.
  - `Low`: nice to have, or "when you get a chance".
  - `Someday`: mentioned, but nobody committed to it and it will probably never get done.
- **Priority limits**: Use `High` sparingly — at most 5 `High` next steps per meeting across all owners, ideally 3 or fewer, and at most 2 of them owned by the user (`Me` in `MEETING DETAILS`). Rank everyone's next steps, not only the user's.

## 3. Summary (by topic)
- **Format**: Use topical subheadings (`### Topic Name`) with a 1-paragraph synthesis or tight bullet points.
- **Content**: Group conversational themes logically (e.g., Architecture, Commercial Strategy, Technical Blockers). Ensure technical details, product names, error rates, and metrics are preserved with absolute accuracy.

## 4. Key Decisions/Agreements
- **Format**: Bulleted list.
- **Syntax**: `- **[[Agreed Parties/Stakeholders]]**: Explicit decision made, operational consensus reached, or strategic pivot approved.`
- **Content**: Clearly document what was finalized versus what was tabled for future discussion. If no decisions were made, output `- None`.

## 5. Additional Items
- **Format**: Bulleted list.
- **Content**: Side discussions, parked backlog items, notable future risks, or resources/links shared during the call. If none exist, output `- No additional items noted.`

## 6. Speakers
- **Format**: A clean markdown table mapping the raw transcript diarization to real names. Include **one row per speaker in the transcript and no one else**.
- **Syntax**:
| Transcript Reference | Identified Name | Organization / Role | Identification Context |
|---|---|---|---|
| `Speaker 0` | [[John Smith]] | ABC Corp / Solutions Architect | Self-identified; led roadmap review |
| `Speaker 3` | Unidentified | [TBD] | No name used in the transcript |

---

# Phase 3: Technical & Obsidian Integration Guardrails
1. **Wiki-Linking**: You must format all resolved team members, core customers, and the user's key projects as Obsidian wiki-links (e.g., `[[Jane Doe]]`, `[[XYZ Inc]]`, `[[Project Atlas]]`) in sections 1–6. The `Meeting Metadata` block is the one exception: plain text only.
2. **Domain-Specific Vocabulary**: Do not autocorrect or misinterpret company- and product-specific terms; keep product names, acronyms and technical terms exactly as used (e.g., `ABC Cloud`, `SSO`, `TLS Decryption`, `POV`).
3. **No Hallucinations**: Only include facts and decisions explicitly discussed in the transcript. If a detail is unclear, list it as `[Unclear from audio]` or `[TBD]`. This applies to people as well: never introduce a participant, owner, or speaker who is not in the transcript.
4. **Semantic Optimization**: Avoid vague pronouns (e.g., *"He will check..."*). Instead, use explicit names (e.g., *"[[Jane Doe]] will check..."*) to allow Gemini Enterprise and other RAG engines to map connections perfectly.
````

To have Next Steps deadlines land as Tasks due dates, the date in the brackets must be `YYYY-MM-DD`; the instructions ask for that. A deadline without a date, such as `(before the POV kickoff)`, stays in the task's text. The priority at the end of the brackets becomes the Tasks priority mark; **Someday** items never appear in the Meeting Tracker's Focus list and go straight to its **Gone stale?** section, where one tick drops them.

## What the plugin sends with Copy meeting for AI assistant

```
MEETING DETAILS
Title: Weekly 1-1
Date: 2026-10-06
Time: 10:00 AM – 10:30 AM
Attendees: John Smith, Bob Jones
Me: John Smith

MY NOTES
- Budget for Q4 approved

TRANSCRIPT
You
0:09 - Morning, Bob.
…
```

`Me` is your name, from **Your name** in the plugin's settings or your entry in calendar invites, so the agent knows which next steps are yours. With **Include instructions when copying** switched on (for an assistant without saved instructions), the plugin's own short instructions — editable in settings — are put in front of this block.
