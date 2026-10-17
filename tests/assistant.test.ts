import test from "node:test";
import assert from "node:assert/strict";
import { actionLine, applyReply, copyText, DEFAULT_INSTRUCTIONS, parseReply } from "../src/assistant";
import { builtInTemplate } from "../src/noteCreator";
import { continuityItems } from "../src/sections";

const meeting = { title: "Design Review", date: "2026-10-06", time: "11:00 AM – 12:00 PM", attendees: ["Alice Smith", "Bob Jones"] };
const blankNote = `---\ntitle: "Design Review"\ntags:\n  - meeting\n---\n` + builtInTemplate().split("---\n").slice(2).join("---\n").replace(/\{\{[a-z_]+\}\}/g, "");

const AGENT_REPLY = `### Meeting Overview
**Title:** Acme Zero Trust POV Review
**Date:** 2026-10-06
**Category:** External Customer
**Confidence:** High
**Primary Account / Project:** Acme Corp
**Participants:**
- Alice Smith (Acme, Network Architect)
- Bob Jones (Our team, SE Lead)
**Search Tags:** #External-Customer #Acme-Corp #MeetingNotes #ZeroTrust #POV #2026

### Executive Synthesis
**TL;DR:** Acme reviewed the POV results. They agreed to move to a production pilot.
**Key Decisions Made:**
- Move to a production pilot in November
- Keep SSL inspection off for finance traffic

---
### Action Items & Commitments
| Action Item | Owner | Priority | Due |
| :--- | :--- | :--- | :--- |
| Send the pilot scope document | Bob Jones | High | 2026-10-09 |
| Confirm firewall change window | Customer IT team | Med | TBD |
| Book the kickoff | Unassigned | Low | Next sync |

### Risks, Blockers & Concerns
#### Technical / Architectural
- Firewall policy conflicts
#### Business / Timeline
- None noted

### Customer Deep Dive
- **Customer Sentiment & Account Health**: Aligned.`;

test("copyText sends the calendar details, notes and transcript, with or without instructions", () => {
  const content = "## Notes\n\n- Budget is tight\n\n## Transcript\n\nYou\n0:09 - Let's ship Friday.\n";
  const plain = copyText(content, meeting) ?? "";
  assert.equal(plain, [
    "MEETING DETAILS",
    "Title: Design Review",
    "Date: 2026-10-06",
    "Time: 11:00 AM – 12:00 PM",
    "Attendees: Alice Smith, Bob Jones",
    "",
    "MY NOTES",
    "- Budget is tight",
    "",
    "TRANSCRIPT",
    "You\n0:09 - Let's ship Friday.",
  ].join("\n"));
  const withInstructions = copyText(content, meeting, DEFAULT_INSTRUCTIONS) ?? "";
  assert.ok(withInstructions.startsWith(DEFAULT_INSTRUCTIONS + "\n\nMEETING DETAILS\n"));
  assert.doesNotMatch(DEFAULT_INSTRUCTIONS, /2026/, "the instructions hold no meeting-specific text");
});

test("copyText returns undefined when there is nothing to send", () => {
  assert.equal(copyText("## Notes\n\n- \n\n## Transcript\n\n", meeting), undefined);
});

test("parseReply reads the short format in its usual variations", () => {
  const reply = parseReply([
    "```markdown",
    "**Summary**",
    "We reviewed the design and agreed to ship.",
    "### Key points",
    "",
    "### Decisions:",
    "* Ship on Friday",
    "1. Keep the old API",
    "",
    "## Action Items",
    "- [ ] Update the docs @[[Bob Jones]] 📅 2026-10-09",
    "- Book the launch room",
    "```",
  ].join("\n"));
  assert.deepEqual(reply?.summary, ["We reviewed the design and agreed to ship."]);
  assert.deepEqual(reply?.decisions, ["Ship on Friday", "Keep the old API"]);
  assert.deepEqual(reply?.actionItems.map((i) => actionLine(i)), ["- [ ] Update the docs @[[Bob Jones]] 📅 2026-10-09", "- [ ] Book the launch room"]);
});

test("parseReply reads a full agent report: whole report as summary, decisions, table rows and properties", () => {
  const reply = parseReply(AGENT_REPLY);
  assert.ok(reply);
  assert.equal(reply.summary[0], "### Meeting Overview");
  assert.ok(reply.summary.includes("| Send the pilot scope document | Bob Jones | High | 2026-10-09 |"));
  assert.ok(!reply.summary.some((l) => /^-{3,}$/.test(l)), "horizontal rules are dropped");
  assert.deepEqual(reply.decisions, ["Move to a production pilot in November", "Keep SSL inspection off for finance traffic"]);
  assert.deepEqual(reply.actionItems.map((i) => actionLine(i)), [
    "- [ ] Send the pilot scope document @[[Bob Jones]] ⏫ 📅 2026-10-09",
    "- [ ] Confirm firewall change window (owner: Customer IT team) 🔼",
    "- [ ] Book the kickoff 🔽",
  ]);
  assert.equal(reply.category, "External Customer");
  assert.equal(reply.account, "Acme Corp");
  assert.deepEqual(reply.tags, ["External-Customer", "Acme-Corp", "MeetingNotes", "ZeroTrust", "POV"]);
});

test("parseReply demotes a report's top-level headings below the Meeting Summary heading", () => {
  const reply = parseReply("# Overview\nText\n## Action Items\n| Task | Owner |\n|---|---|\n| Do it | Bob |");
  assert.deepEqual(reply?.summary.slice(0, 3), ["### Overview", "Text", "#### Action Items"]);
  assert.deepEqual(reply?.actionItems.map((i) => actionLine(i)), ["- [ ] Do it @[[Bob]]"]);
});

test("parseReply copes with a report whose table is missing or malformed", () => {
  const reply = parseReply("### Executive Synthesis\n**Key Decisions Made:**\n- None\n### Action Items & Commitments\n- Call Bob\n");
  assert.deepEqual(reply?.decisions, []);
  assert.deepEqual(reply?.actionItems.map((i) => actionLine(i)), ["- [ ] Call Bob"]);
  assert.equal(reply?.category, undefined);
  assert.equal(parseReply("Sure! Here is a summary of the meeting."), undefined);
});

test("applyReply files a full report and changes nothing when applied twice", () => {
  const reply = parseReply(AGENT_REPLY)!;
  const once = applyReply(blankNote, reply, true);
  assert.equal(once.decisions, 2);
  assert.equal(once.actionItems, 3);
  assert.match(once.content, /## Next Steps\n\n- \[ \] Send the pilot scope document @\[\[Bob Jones\]\] ⏫ 📅 2026-10-09\n/);
  assert.match(once.content, /## Key Decisions\n\n- Move to a production pilot in November\n- Keep SSL inspection off for finance traffic\n\n## Additional Items/);
  assert.match(once.content, /## Executive Summary\n\n### Meeting Overview\n/);
  assert.match(once.content, /\n## Transcript\n/);
  assert.match(once.content, /^meeting_category: "External Customer"$/m);
  assert.match(once.content, /^account: "Acme Corp"$/m);
  assert.match(once.content, /^tags:\n {2}- meeting\n {2}- External-Customer\n {2}- Acme-Corp\n {2}- MeetingNotes\n {2}- ZeroTrust\n {2}- POV$/m);

  const twice = applyReply(once.content, reply, true);
  assert.equal(twice.content, once.content);
  assert.equal(twice.decisions, 0);
  assert.equal(twice.actionItems, 0);
});

test("applyReply keeps the user's own items, skips ticked duplicates, and can leave properties alone", () => {
  const note = blankNote
    .replace("## Key Decisions\n\n- \n", "## Key Decisions\n\n- My own decision\n")
    .replace("## Next Steps\n\n- [ ] \n", "## Next Steps\n\n- [x] Send the pilot scope document @[[Bob Jones]] 📅 2026-10-09\n");
  const result = applyReply(note, parseReply(AGENT_REPLY)!, false);
  assert.match(result.content, /## Key Decisions\n\n- My own decision\n- Move to a production pilot/);
  assert.equal(result.actionItems, 2);
  assert.doesNotMatch(result.content, /meeting_category|account:/);
});

test("parseReply ignores the chat around a reply and writes an owner of You as me", () => {
  const fenced = parseReply("Sure! Here's the analysis.\n\n```markdown\n### Overview\n**Key Decisions Made:**\n- Go\n### Action Items\n| Task | Owner |\n|---|---|\n| Review bands | You |\n```\nLet me know if you need more.");
  assert.equal(fenced?.summary[0], "### Overview");
  assert.ok(!fenced?.summary.some((l) => /Let me know|Sure!/.test(l)));
  assert.deepEqual(fenced?.actionItems.map((i) => actionLine(i)), ["- [ ] Review bands (owner: me)"]);

  const unfenced = parseReply("Here you go:\n\n### Overview\n**Key Decisions Made:**\n- Go");
  assert.equal(unfenced?.summary[0], "### Overview");
});

test("action items from a reply get the Tasks plugin's created date", () => {
  const reply = parseReply(AGENT_REPLY)!;
  assert.equal(actionLine(reply.actionItems[0], "2026-10-07"), "- [ ] Send the pilot scope document @[[Bob Jones]] ⏫ ➕ 2026-10-07 📅 2026-10-09");
  const once = applyReply(blankNote, reply, false, "2026-10-07");
  assert.match(once.content, /- \[ \] Book the kickoff 🔽 ➕ 2026-10-07\n/);
  const nextDay = applyReply(once.content, reply, false, "2026-10-08");
  assert.equal(nextDay.content, once.content, "a later run doesn't add the same items with a new created date");
});

const MODE2_REPLY = `> # Acme Zero Trust POV Review
> **Date:** 2026-10-06 | **Category:** Customer
> **Participants:** @[[Alice Smith]], @[[Bob Jones]]
> **Search Tags:** #Customer #Acme #MeetingNotes #ZeroTrust

### 2. Executive Synthesis
- **Executive Summary**: Acme reviewed the POV and agreed to a pilot.
- **Key Decisions**:
  - Move to a production pilot
  - Keep SSL inspection off for finance

### 3. Action Items Table
| Task Description | Owner | Target Date | Status |
| :--- | :--- | :--- | :--- |
| Send the pilot scope | @[[Bob Jones]] | 📅 2026-10-09 | Open |
| Confirm the firewall window | @[[Alice Smith]], @[[Bob Jones]] | TBD | Open |
| Share POV results | Customer IT team | 📅 2026-10-06 | Done |

### 4. Risks, Blockers & Concerns
- **Technical/Architectural**: Firewall policy conflicts.`;

test("parseReply reads the agent's Mode 2 report: quoted details block, link owners, status column", () => {
  const reply = parseReply(MODE2_REPLY)!;
  assert.equal(reply.summary[0], "> # Acme Zero Trust POV Review", "the details block stays in the summary");
  assert.equal(reply.category, "Customer");
  assert.deepEqual(reply.tags, ["Customer", "Acme", "MeetingNotes", "ZeroTrust"]);
  assert.equal(reply.account, undefined);
  assert.deepEqual(reply.decisions, ["Move to a production pilot", "Keep SSL inspection off for finance"]);
  assert.deepEqual(reply.actionItems.map((i) => actionLine(i, "2026-10-07")), [
    "- [ ] Send the pilot scope @[[Bob Jones]] ➕ 2026-10-07 📅 2026-10-09",
    "- [ ] Confirm the firewall window @[[Alice Smith]] @[[Bob Jones]] ➕ 2026-10-07",
    "- [x] Share POV results (owner: Customer IT team) ➕ 2026-10-07 📅 2026-10-06 ✅ 2026-10-07",
  ]);
});

test("parseReply reads numbered bold section labels, inline decisions and an Account / Project field", () => {
  const reply = parseReply([
    "1. **Semantic Metadata Block**:",
    "> **Date:** 2026-10-06 | **Category:** 1:1 | **Account / Project:** Q4 Hiring",
    "2. **Executive Synthesis**:",
    "- **Executive Summary**: Talked hiring.",
    "- **Key Decisions**: Open two SE roles",
    "3. **Action Items Table**:",
    "| Task Description | Owner | Target Date | Status |",
    "| --- | --- | --- | --- |",
    "| Draft the job description | Bob Jones / Alice Smith | 2026-10-13 | Open |",
  ].join("\n"))!;
  assert.equal(reply.category, "1:1");
  assert.equal(reply.account, "Q4 Hiring");
  assert.deepEqual(reply.decisions, ["Open two SE roles"]);
  assert.deepEqual(reply.actionItems.map((i) => actionLine(i)), ["- [ ] Draft the job description @[[Bob Jones]] @[[Alice Smith]] 📅 2026-10-13"]);
  assert.equal(parseReply("- **Key Decisions**: None\n### Action Items\n| Task | Owner |\n|---|---|\n| Do it | Bob |")?.decisions.length, 0);
});

test("parseReply reads the agent's Mode 1 reply", () => {
  const reply = parseReply([
    "## Summary",
    "We reviewed the pilot. Acme agreed to proceed. Dates were set.",
    "",
    "## Decisions",
    "- Proceed with the pilot",
    "",
    "## Action items",
    "- [ ] Send the scope @[[Bob Jones]] 📅 2026-10-09",
    "- [ ] Book the kickoff @[[Alice Smith]]",
    "- [ ] Confirm the budget 📅 2026-10-15",
  ].join("\n"))!;
  assert.deepEqual(reply.summary, ["We reviewed the pilot. Acme agreed to proceed. Dates were set."]);
  assert.deepEqual(reply.decisions, ["Proceed with the pilot"]);
  assert.deepEqual(reply.actionItems.map((i) => actionLine(i, "2026-10-07")), [
    "- [ ] Send the scope @[[Bob Jones]] 📅 2026-10-09 ➕ 2026-10-07",
    "- [ ] Book the kickoff @[[Alice Smith]] ➕ 2026-10-07",
    "- [ ] Confirm the budget 📅 2026-10-15 ➕ 2026-10-07",
  ]);
});

test("a Mode 2 report filed twice changes nothing, including its already-done item", () => {
  const once = applyReply(blankNote, parseReply(MODE2_REPLY)!, true, "2026-10-07");
  assert.match(once.content, /^meeting_category: "Customer"$/m);
  assert.match(once.content, /## Executive Summary\n\n> # Acme Zero Trust POV Review\n/);
  assert.equal(applyReply(once.content, parseReply(MODE2_REPLY)!, true, "2026-10-08").content, once.content);
});

const SIX_SECTION_REPLY = `Here is the meeting write-up.

### 1. Executive Summary
ABC Corp and Initech met to review the **log feed** rollout. The team agreed on a TLS fix.

### 2. Next Steps
- [ ] **John Smith**: Send the TLS certificate runbook (by Friday, 2026-10-09)
- [ ] **[Mike Brown / Jane Doe]**: Confirm the firewall window ([TBD])
  - Depends on the change board
- [ ] **Initech IT team**: Upgrade the connectors
- [ ] Review the pilot @[[Alice Smith]]

### 3. Summary (by topic)
### log feed alerts
Mike Brown raised alert volume.
- TLS error threshold at 5%
### Pricing decisions
- Deferred to next call

### 4. Key Decisions/Agreements
- **John Smith, Mike Brown**: Raise the TLS threshold to 5%.

### 5. Additional Items
- No additional items noted.

---

### 6. Speakers
| Transcript Reference | Identified Name | Organization / Role | Identification Context |
|---|---|---|---|
| \`Speaker 0\` | John Smith | ABC Corp / Specialist SA | Addressed as John |`;

test("parseReply reads the six-section report", () => {
  const reply = parseReply(SIX_SECTION_REPLY)!;
  assert.deepEqual(reply.summary, ["ABC Corp and Initech met to review the **log feed** rollout. The team agreed on a TLS fix."]);
  assert.deepEqual(reply.actionItems.map((i) => actionLine(i, "2026-10-07")), [
    "- [ ] Send the TLS certificate runbook @[[John Smith]] ➕ 2026-10-07 📅 2026-10-09",
    "- [ ] Confirm the firewall window ([TBD]) @[[Mike Brown]] @[[Jane Doe]] ➕ 2026-10-07",
    "- [ ] Upgrade the connectors (owner: Initech IT team) ➕ 2026-10-07",
    "- [ ] Review the pilot @[[Alice Smith]] ➕ 2026-10-07",
  ]);
  assert.deepEqual(reply.topics, ["### log feed alerts", "Mike Brown raised alert volume.", "- TLS error threshold at 5%", "### Pricing decisions", "- Deferred to next call"]);
  assert.deepEqual(reply.decisions, ["**John Smith, Mike Brown**: Raise the TLS threshold to 5%."]);
  assert.deepEqual(reply.additional, [], "\"No additional items noted\" files nothing");
  assert.equal(reply.speakers.length, 3);
  assert.match(reply.speakers[2], /John Smith \| ABC Corp/);
});

test("a six-section report fills each section of a new note, and filing it twice changes nothing", () => {
  const once = applyReply(blankNote, parseReply(SIX_SECTION_REPLY)!, true, "2026-10-07");
  assert.equal(once.actionItems, 4);
  assert.equal(once.decisions, 1);
  assert.match(once.content, /## Executive Summary\n\nABC Corp and Initech[^\n]*\n\n## Next Steps\n\n- \[ \] Send the TLS/);
  assert.match(once.content, /## Summary by Topic\n\n### log feed alerts\n[\s\S]*- Deferred to next call\n\n## Key Decisions\n\n- \*\*John Smith, Mike Brown\*\*: Raise/);
  assert.match(once.content, /## Additional Items\n\n- \n\n## Speakers\n\n\| Transcript Reference [^\n]*\n\|---[^\n]*\n\| `Speaker 0` [^\n]*\n\n## Transcript/);
  assert.equal(applyReply(once.content, parseReply(SIX_SECTION_REPLY)!, true, "2026-10-08").content, once.content);
});

test("a six-section report filed into an older note adds the new sections before the Transcript", () => {
  const old = "# Sync\n\n## Notes\n\n- Mine\n\n## Decisions\n\n- \n\n## Action items\n\n- [ ] \n\n## Meeting Summary\n\n\n\n## Transcript\n\nYou\n";
  const out = applyReply(old, parseReply(SIX_SECTION_REPLY)!, false).content;
  assert.match(out, /## Decisions\n\n- \*\*John Smith/);
  assert.match(out, /## Action items\n\n- \[ \] Send the TLS/);
  assert.match(out, /## Meeting Summary\n\nABC Corp and Initech[^\n]*\n\n## Summary by Topic\n\n### log feed alerts\n[\s\S]*\n## Speakers\n\n\|[\s\S]*\n\n## Transcript\n\nYou\n$/);
  assert.doesNotMatch(out, /## Executive Summary|## Next Steps|## Additional Items/);
});

test("the Meeting Metadata block and Speakers table become properties, and ai_summarized keeps its first date", () => {
  const reply = parseReply([
    "### Meeting Metadata",
    "- **Category:** Customer",
    "- **Account / Project:** Initech",
    "- **Organizations:** ABC Corp, Initech; Umbrella Security",
    "- **Key Topics:** log feeds, TLS inspection",
    "- **Sentiment:** Mixed",
    "- **Outcome:** Decision Made",
    "- **Search Tags:** #Customer #Initech #ZeroTrust",
    "",
    SIX_SECTION_REPLY.slice(SIX_SECTION_REPLY.indexOf("### 1.")).replace(
      "| `Speaker 0` | John Smith |",
      "| `Speaker 0` | John Smith |  |  |\n| `Speaker 1` | Mike Brown (High confidence) | Initech | Named |\n| `Speaker 2` | Unidentified |"
    ),
  ].join("\n"))!;
  assert.equal(reply.category, "Customer");
  assert.equal(reply.account, "Initech");
  assert.deepEqual(reply.organizations, ["ABC Corp", "Initech", "Umbrella Security"]);
  assert.deepEqual(reply.keyTopics, ["log feeds", "TLS inspection"]);
  assert.equal(reply.sentiment, "Mixed");
  assert.equal(reply.outcome, "Decision Made");
  assert.deepEqual(reply.tags, ["Customer", "Initech", "ZeroTrust"]);
  assert.deepEqual(reply.speakerNames, ["John Smith", "Mike Brown"]);
  assert.equal(reply.summary[0].slice(0, 8), "ABC Corp", "the metadata block isn't filed as text");
  assert.deepEqual(reply.decisions, ["**John Smith, Mike Brown**: Raise the TLS threshold to 5%."], "decision owners aren't read as metadata");

  const once = applyReply(blankNote, reply, true, "2026-10-07").content;
  assert.match(once, /^meeting_category: "Customer"$/m);
  assert.match(once, /^account: "Initech"$/m);
  assert.match(once, /^sentiment: "Mixed"$/m);
  assert.match(once, /^outcome: "Decision Made"$/m);
  assert.match(once, /^organizations:\n {2}- "ABC Corp"\n {2}- "Initech"\n {2}- "Umbrella Security"$/m);
  assert.match(once, /^key_topics:\n {2}- "log feeds"\n {2}- "TLS inspection"$/m);
  assert.match(once, /^speakers:\n {2}- "John Smith"\n {2}- "Mike Brown"$/m);
  assert.match(once, /^ai_summarized: "2026-10-07"$/m);
  assert.equal(applyReply(once, reply, true, "2026-10-09").content, once);
  assert.doesNotMatch(applyReply(blankNote, reply, false, "2026-10-07").content, /ai_summarized|sentiment|speakers:/);
});

test("metadata placeholders such as General, TBD and None aren't saved", () => {
  const reply = parseReply("- **Category:** TBD\n- **Account / Project:** General\n- **Organizations:** None\n- **Sentiment:** [TBD]\n### Executive Summary\nShort.")!;
  assert.equal(reply.category, undefined);
  assert.equal(reply.account, undefined);
  assert.deepEqual(reply.organizations, []);
  assert.equal(reply.sentiment, undefined);
});

test("the account is read however the assistant writes the metadata block", () => {
  const sections = "\n## Executive Summary\nShort.\n\n## Next Steps\n- [ ] **[[Ann Lee]]**: Send the deck\n";
  for (const meta of [
    "## Meeting Metadata\n- **Category:** Customer\n- **Account/Project:** XYZ",
    "## Meeting Metadata\n- **Customer / Account:** XYZ",
    "## Meeting Metadata\n- Category: Customer\n- Account / Project: XYZ",
    "## Meeting Metadata\n| Field | Value |\n| --- | --- |\n| Category | Customer |\n| **Account / Project** | XYZ |",
  ]) {
    assert.equal(parseReply(meta + "\n" + sections)?.account, "XYZ", meta);
  }
});

test("a Meeting Metadata block after the six sections is read and not filed into Speakers", () => {
  const reply = parseReply([
    "## Executive Summary", "Short.", "",
    "## Speakers", "| Transcript Reference | Identified Name |", "| --- | --- |", "| Speaker 0 | [[Ann Lee]] |", "",
    "## Meeting Metadata", "- **Account / Project:** XYZ", "- **Sentiment:** Positive",
  ].join("\n"))!;
  assert.equal(reply.account, "XYZ");
  assert.equal(reply.sentiment, "Positive");
  assert.doesNotMatch(reply.speakers.join("\n"), /Metadata|XYZ/);
});

test("unbolded Label: value lines outside the metadata block aren't read as metadata", () => {
  const reply = parseReply("## Executive Summary\n- Outcome: we shipped it.\n\n## Next Steps\n- [ ] **[[Ann Lee]]**: Send the deck\n")!;
  assert.equal(reply.outcome, undefined);
});

const SCRIBE_REPLY = `## 1. Executive Summary
[[XYZ]] and ABC Corp reviewed the **ABC Cloud** POV. The team agreed to pilot TLS Decryption.
---
**Core Elements for Next Meeting Continuity:**
- Confirm the [[XYZ]] POV success criteria
- Review Log Feed alerts volume
- Decide on the Cloud Connector rollout

---

## 2. Next Steps
- [ ] **[[Jane Doe]]**: Send the TLS Decryption runbook (2026-10-09)
- [ ] **[[Tom Clark]], [[John Smith]]**: Book the XYZ architecture review ([TBD])
- [ ] **[[XYZ]] Network Team**: Open the firewall change

## 3. Summary (by topic)
### TLS Decryption
- [[Jane Doe]] reported a 2% error rate.

## 4. Key Decisions/Agreements
- **[[XYZ]], [[John Smith]]**: Pilot TLS Decryption for finance.

## 5. Additional Items
- No additional items noted.

## 6. Speakers
| Transcript Reference | Identified Name | Organization / Role | Identification Context |
|---|---|---|---|
| \`Speaker 0\` | [[John Smith]] | ABC Corp / Senior Director, Specialist SA | Self-identified |
| \`Speaker 2\` | Speaker 2 -> [[Jane Doe]] (High confidence: addressed by name) | ABC Corp | Addressed as Jane |`;

test("the Meeting Scribe reply: wiki-link owners, continuity points and the summary's horizontal rule", () => {
  const reply = parseReply(SCRIBE_REPLY)!;
  assert.deepEqual(reply.summary, [
    "[[XYZ]] and ABC Corp reviewed the **ABC Cloud** POV. The team agreed to pilot TLS Decryption.",
    "",
    "---",
    "",
    "**Core Elements for Next Meeting Continuity:**",
    "- Confirm the [[XYZ]] POV success criteria",
    "- Review Log Feed alerts volume",
    "- Decide on the Cloud Connector rollout",
  ], "a blank line keeps the rule from turning the paragraph into a heading, and the trailing rule is dropped");
  assert.deepEqual(reply.actionItems.map((i) => actionLine(i)), [
    "- [ ] Send the TLS Decryption runbook @[[Jane Doe]] 📅 2026-10-09",
    "- [ ] Book the XYZ architecture review ([TBD]) @[[Tom Clark]] @[[John Smith]]",
    "- [ ] Open the firewall change (owner: [[XYZ]] Network Team)",
  ]);
  assert.deepEqual(reply.decisions, ["**[[XYZ]], [[John Smith]]**: Pilot TLS Decryption for finance."]);
  assert.deepEqual(reply.topics, ["### TLS Decryption", "- [[Jane Doe]] reported a 2% error rate."]);
  assert.deepEqual(reply.speakerNames, ["John Smith", "Jane Doe"]);

  const filed = applyReply(blankNote, reply, true, "2026-10-08").content;
  assert.match(filed, /## Executive Summary\n\n\[\[XYZ\]\] and ABC Corp[^\n]*\n\n---\n\n\*\*Core Elements/);
  assert.deepEqual(continuityItems(filed), [
    "Confirm the [[XYZ]] POV success criteria",
    "Review Log Feed alerts volume",
    "Decide on the Cloud Connector rollout",
  ]);
  assert.match(filed, /^speakers:\n {2}- "John Smith"\n {2}- "Jane Doe"$/m);
  assert.equal(applyReply(filed, reply, true, "2026-10-09").content, filed);
});

test("a full Meeting Scribe reply with its Meeting Metadata block files sections and properties", () => {
  const reply = parseReply([
    "## Meeting Metadata",
    "- **Category:** Customer",
    "- **Account / Project:** XYZ",
    "- **Organizations:** ABC Corp, XYZ",
    "- **Key Topics:** TLS Decryption, Cloud Connector",
    "- **Sentiment:** Positive",
    "- **Outcome:** Progress",
    "- **Search Tags:** #Customer #XYZ #TLS-Decryption",
    "",
    SCRIBE_REPLY.replace("- **[[XYZ]], [[John Smith]]**: Pilot TLS Decryption for finance.", "- None"),
  ].join("\n"))!;
  assert.equal(reply.category, "Customer");
  assert.equal(reply.account, "XYZ");
  assert.deepEqual(reply.organizations, ["ABC Corp", "XYZ"]);
  assert.deepEqual(reply.keyTopics, ["TLS Decryption", "Cloud Connector"]);
  assert.equal(reply.sentiment, "Positive");
  assert.equal(reply.outcome, "Progress");
  assert.deepEqual(reply.tags, ["Customer", "XYZ", "TLS-Decryption"]);
  assert.deepEqual(reply.decisions, []);
  assert.equal(reply.actionItems.length, 3);
  assert.match(reply.summary[0], /^\[\[XYZ\]\] and ABC Corp/);
});

test("Next Steps priorities in the brackets become Tasks priority marks, with or without a date", () => {
  const reply = parseReply([
    "## Executive Summary", "Short.", "",
    "## Next Steps",
    "- [ ] **[[Ann Lee]]**: Send the runbook (by Friday, 2026-10-09, High)",
    "- [ ] **[[Bob Jones]]**: Book the review (Medium)",
    "- [ ] **[[Ann Lee]]**: Share slides ([TBD], Low)",
    "- [ ] **[[Bob Jones]]**: Explore a partner integration (Someday)",
    "- [ ] **[[Ann Lee]]**: Confirm scope (before the POV kickoff)",
    "- [ ] **[[Ann Lee]]**: Review pricing (high level)",
  ].join("\n"))!;
  assert.deepEqual(reply.actionItems.map((i) => actionLine(i)), [
    "- [ ] Send the runbook @[[Ann Lee]] ⏫ 📅 2026-10-09",
    "- [ ] Book the review @[[Bob Jones]] 🔼",
    "- [ ] Share slides @[[Ann Lee]] 🔽",
    "- [ ] Explore a partner integration @[[Bob Jones]] ⏬",
    "- [ ] Confirm scope (before the POV kickoff) @[[Ann Lee]]",
    "- [ ] Review pricing (high level) @[[Ann Lee]]",
  ]);
});

test("the copied meeting names the user, and the built-in instructions ask for capped priorities", () => {
  const text = copyText("## Notes\n\n- Mine\n", { ...meeting, me: "John Smith" }, DEFAULT_INSTRUCTIONS)!;
  assert.match(text, /Attendees: Alice Smith, Bob Jones\nMe: John Smith\n/);
  assert.match(DEFAULT_INSTRUCTIONS, /\(YYYY-MM-DD, Priority\)/);
  assert.match(DEFAULT_INSTRUCTIONS, /High, Medium, Low or Someday/);
  assert.match(DEFAULT_INSTRUCTIONS, /at most 5 High next steps per meeting across everyone, ideally 3 or fewer, and at most 2 of them owned by me/);
});

test("Next Steps priorities are read in the other shapes assistants write them", () => {
  const tail = (step: string) =>
    actionLine(parseReply(`## Executive Summary\nx\n\n## Next Steps\n- [ ] **[[Ann Lee]]**: Send the runbook ${step}\n`)!.actionItems[0])
      .replace("- [ ] Send the runbook @[[Ann Lee]]", "").trim();
  assert.deepEqual(["(2026-10-09 – High)", "[High]", "(**Low**)", "(Medium priority)"].map(tail), ["⏫ 📅 2026-10-09", "⏫", "🔽", "🔼"]);
  assert.equal(actionLine(parseReply("## Executive Summary\nx\n\n## Next Steps\n- [ ] **[[Ann Lee]]**: Send the runbook (P1)\n")!.actionItems[0]),
    "- [ ] Send the runbook (P1) @[[Ann Lee]]", "unknown labels stay in the task");
});
