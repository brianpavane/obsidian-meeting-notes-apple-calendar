/**
 * @file assistant.ts
 * @description The copy/paste round trip with an AI assistant (Gemini,
 * Claude, ChatGPT, Copilot…): copy a meeting's details, notes and transcript,
 * and file the assistant's reply into the note. The plugin never contacts
 * any AI service itself.
 *
 * Reply shapes understood:
 *   - the six-section report (see docs/AGENT_INSTRUCTIONS.md and the
 *     built-in instructions): Executive Summary, Next Steps, Summary (by
 *     topic), Key Decisions/Agreements, Additional Items and Speakers, each
 *     filed into the note section of the same name;
 *   - older formats: a short `Summary` / `Decisions` / `Action items` reply,
 *     or a full report whose whole text becomes the Executive Summary, with
 *     decisions from a "Key Decisions" list and action items from a table.
 */

import { addFrontmatterTags, hasFrontmatterKey, setFrontmatterList, setFrontmatterValue } from "./noteCreator";
import { appendToSection, replaceSection, sectionLines, sectionText } from "./sections";

export const SUMMARY_SECTIONS = ["Executive Summary", "Meeting Summary", "Summary"];
export const ACTION_SECTIONS = ["Next Steps", "Action items"];
export const TOPICS_SECTIONS = ["Summary by Topic", "Summary (by topic)"];
export const DECISIONS_SECTIONS = ["Key Decisions", "Key Decisions/Agreements", "Decisions"];
export const ADDITIONAL_SECTIONS = ["Additional Items"];
export const SPEAKERS_SECTIONS = ["Speakers"];
export const NOTES_SECTIONS = ["Notes"];
export const TRANSCRIPT_SECTIONS = ["Transcript"];

/** How the assistant should rank Next Steps; shared by the built-in instructions and docs/AGENT_INSTRUCTIONS.md. */
export const PRIORITY_RULES = [
  "Give every next step a priority in its brackets, after any date: High, Medium, Low or Someday. High: someone called it urgent or blocking, a customer is waiting on it, or it's due within 5 working days. Medium: a real commitment without that urgency. Low: nice to have, or \"when you get a chance\". Someday: mentioned, but nobody committed to it and it will probably never get done.",
  "Use High sparingly: at most 5 High next steps per meeting across everyone, ideally 3 or fewer, and at most 2 of them owned by me (Me in MEETING DETAILS).",
];

export const DEFAULT_INSTRUCTIONS = [
  "Write up the meeting below from my notes and the transcript. MEETING DETAILS comes from my calendar and is correct; MY NOTES are my own notes and take priority over the transcript.",
  "Work out who each transcript speaker (Speaker 0, Speaker 1…) is from the dialogue, and write each person as an Obsidian link, [[Full Name]], throughout.",
  "Only people who speak in the transcript may appear in Speakers, own next steps or be credited with decisions. The Attendees line is the invite list, not who joined: use it only to complete a name the transcript already gives, and leave unnamed speakers as Unidentified.",
  "Reply in Markdown with this metadata block and then exactly these six headings, in this order, and nothing before or after them:",
  "",
  "## Meeting Metadata",
  "- **Category:** Customer | Partner | Internal Account | 1:1 | Team Sync | Misc (pick one)",
  "- **Account / Project:** The customer or initiative, or General",
  "- **Organizations:** Every organization represented, comma-separated",
  "- **Key Topics:** 3–6 short topic names, comma-separated",
  "- **Sentiment:** Positive | Neutral | Mixed | Negative (pick one)",
  "- **Outcome:** Decision Made | Progress | Blocked | Informational (pick one)",
  "- **Search Tags:** #Category #Account #Topic (no spaces inside a tag)",
  "",
  "## Executive Summary",
  "One paragraph of at most 175 words: why the meeting was held, what was covered and the outcome.",
  "",
  "---",
  "",
  "**Core Elements for Next Meeting Continuity:**",
  "- 3 to 5 bullets: what the next meeting must pick up from this one.",
  "",
  "## Next Steps",
  "- [ ] **[[Full Name]]**: One checkbox per follow-up task, with its owner (YYYY-MM-DD, Priority)",
  "",
  "## Summary (by topic)",
  "### Topic name",
  "A short paragraph or bullets per topic discussed.",
  "",
  "## Key Decisions/Agreements",
  "- **[[Full Name]]**: One bullet per decision or agreement. Write \"- None\" if there were none.",
  "",
  "## Additional Items",
  "- Side topics, risks and open questions. Write \"- No additional items noted.\" if there were none.",
  "",
  "## Speakers",
  "| Transcript Reference | Identified Name | Organization / Role | Identification Context |",
  "",
  "In Next Steps, give a due date in brackets as YYYY-MM-DD only when one was mentioned; turn relative dates such as \"by Friday\" into dates using the meeting date.",
  ...PRIORITY_RULES,
  "Use only what's in the notes and transcript; don't invent tasks, owners or dates. Write [TBD] or [Unclear from audio] for anything ambiguous.",
].join("\n");

export interface MeetingInfo {
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** e.g. "10:00 AM – 10:30 AM" */
  time: string;
  attendees: string[];
  /** The user's name, so the assistant knows which next steps are theirs. */
  me?: string;
}

/**
 * What to paste into the assistant: optional instructions, then the meeting's
 * details, notes and transcript. Undefined if the note has neither notes nor
 * a transcript.
 */
export function copyText(content: string, meeting: MeetingInfo, instructions?: string): string | undefined {
  const notes = sectionText(content, NOTES_SECTIONS);
  const transcript = sectionText(content, TRANSCRIPT_SECTIONS);
  if (!notes && !transcript) return undefined;
  const block = [
    "MEETING DETAILS",
    `Title: ${meeting.title}`,
    ...(meeting.date ? [`Date: ${meeting.date}`] : []),
    ...(meeting.time ? [`Time: ${meeting.time}`] : []),
    ...(meeting.attendees.length > 0 ? [`Attendees: ${meeting.attendees.join(", ")}`] : []),
    ...(meeting.me ? [`Me: ${meeting.me}`] : []),
    "",
    "MY NOTES",
    notes || "(none)",
    "",
    "TRANSCRIPT",
    transcript || "(none)",
  ].join("\n");
  return instructions?.trim() ? `${instructions.trim()}\n\n${block}` : block;
}

export interface ActionItem {
  task: string;
  /** People who own the task, each written as `@[[Name]]`. */
  people?: string[];
  /** A role or team that owns the task, written as `(owner: …)`. */
  role?: string;
  priority?: "High" | "Medium" | "Low" | "Someday";
  /** YYYY-MM-DD */
  due?: string;
  /** Text already in the assistant's own task format (short replies). */
  raw?: string;
  /** Already done (a Status column saying Done, Complete or Closed). */
  done?: boolean;
}

export interface AssistantReply {
  summary: string[];
  decisions: string[];
  actionItems: ActionItem[];
  /** Summary (by topic), Additional Items and Speakers: section bodies, empty if the reply has none. */
  topics: string[];
  additional: string[];
  speakers: string[];
  category?: string;
  account?: string;
  tags: string[];
  /** From the Meeting Metadata block. */
  organizations: string[];
  keyTopics: string[];
  sentiment?: string;
  outcome?: string;
  /** Identified names from the Speakers table. */
  speakerNames: string[];
}

const HEADING_RE = /^\s*(#{1,6})\s+(.+?)\s*#*\s*$/;
const LABEL_RE = /^\s*(?:[-*]\s+|\d+[.)]\s+)?\*\*(.+?)\*\*\s*:?\s*$/;
/** A bold label with text after it on the same line: "- **Key Decisions**: None". */
const INLINE_LABEL_RE = /^\s*(?:[-*]\s+|\d+[.)]\s+)?\*\*([^*]+?)\s*:?\s*\*\*\s*:?\s*(\S.*)$/;
const QUOTE_RE = /^\s*(?:>\s?)+/;
const PLAIN_HEADING_RE = /^\s*(summary|decisions|action items)\s*:?\s*$/i;
const BULLET_RE = /^\s*(?:[-*+•]|\d+[.)])\s+(?:\[[ xX]?\]\s*)?/;
const RULE_RE = /^\s*(?:-{3,}|\*{3,}|_{3,})\s*$/;
const FIELD_RE = /^\s*(?:[-*]\s+)?\*\*([^*]+?)\s*:?\s*\*\*\s*:?\s*(.*)$/;
/** "- Label: value" without bold, read only inside the Meeting Metadata block. */
const PLAIN_FIELD_RE = /^\s*(?:[-*]\s+)?([A-Za-z][A-Za-z /]{1,40}?)\s*:\s*(.*)$/;

/** The text of a heading or a bold label line ("**Key Decisions Made:**"), without numbering or colon. */
function headingText(line: string): { level: number; text: string } | undefined {
  const heading = line.match(HEADING_RE);
  const label = heading ? undefined : line.match(LABEL_RE) ?? line.match(PLAIN_HEADING_RE);
  const raw = heading?.[2] ?? label?.[1];
  if (raw === undefined) return undefined;
  const text = raw.replace(/\*\*/g, "").replace(/^\d+[.)]\s*/, "").replace(/:\s*$/, "").trim();
  return { level: heading ? heading[1].length : 7, text };
}

function trimBlank(lines: string[]): string[] {
  const out = [...lines];
  while (out.length > 0 && !out[0].trim()) out.shift();
  while (out.length > 0 && !out[out.length - 1].trim()) out.pop();
  return out;
}

const isNone = (s: string) => /^(none|none noted|no additional items noted|n\/a|-+)\.?$/i.test(s.trim());

/** Bullets following the line at `from`, up to the next heading, label or other text. */
function bulletsAfter(lines: string[], from: number): string[] {
  const out: string[] = [];
  for (let i = from + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    if (headingText(line) || !BULLET_RE.test(line)) break;
    const text = line.replace(BULLET_RE, "").trim();
    if (text && !isNone(text)) out.push(text);
  }
  return out;
}

function cells(row: string): string[] {
  return row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.replace(/\*\*/g, "").trim());
}

const ROLE_WORDS = /\b(team|group|customer|client|vendor|partner|it|ops|engineering|lead|leads|manager|management|leadership|sales|support|security|legal|finance|procurement|all|everyone|both|us|we|me|you|i|tbd|owner|unassigned|inferred)\b/i;
const PERSON_RE = /^[\p{Lu}][\p{L}'’.-]*(?:\s+[\p{Lu}][\p{L}'’.-]*){0,3}$/u;

const isPerson = (name: string) => PERSON_RE.test(name) && !ROLE_WORDS.test(name);

/**
 * Who owns a task, from an Owner cell: `@[[Bob Jones]]` links (one or more),
 * plain names ("Bob Jones", "Bob Jones / Alice Smith"), or a role or team
 * (which may contain a link, as in "[[XYZ]] Network Team").
 */
function owner(cell: string): Pick<ActionItem, "people" | "role"> {
  const links = [...cell.matchAll(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g)].map((m) => m[1].trim()).filter(Boolean);
  const besideLinks = cell.replace(/\[\[[^\]]*\]\]/g, "").replace(/\band\b|[\s,/&@]/gi, "");
  if (links.length > 0) return besideLinks ? { role: cell.trim() } : { people: links };
  const value = cell.replace(/^\[|\]$/g, "").replace(/^@/, "").trim();
  if (!value || isNone(value) || /^(unassigned|tbd)\b/i.test(value)) return {};
  if (/^(you|me|i|myself)$/i.test(value)) return { role: "me" };
  const names = value.split(/\s*(?:[,/&]|\band\b)\s*/).map((n) => n.replace(/^@/, "").trim()).filter(Boolean);
  return names.every(isPerson) ? { people: names } : { role: value };
}

function priority(cell: string): ActionItem["priority"] {
  if (/^h/i.test(cell)) return "High";
  if (/^s/i.test(cell)) return "Someday";
  if (/^m/i.test(cell)) return "Medium";
  if (/^l/i.test(cell)) return "Low";
  return undefined;
}

/** Rows of the first Markdown table after `from`, before the next heading. */
function tableAfter(lines: string[], from: number): ActionItem[] | undefined {
  let i = from + 1;
  while (i < lines.length && !lines[i].trim().startsWith("|")) {
    if (headingText(lines[i]) && headingText(lines[i])!.level <= 6) return undefined;
    if (BULLET_RE.test(lines[i])) return undefined;
    i++;
  }
  if (i >= lines.length) return undefined;
  const header = cells(lines[i]).map((h) => h.toLowerCase());
  const col = (re: RegExp, fallback: number) => {
    const found = header.findIndex((h) => re.test(h));
    return found === -1 ? fallback : found;
  };
  const taskCol = col(/action|task|item|description/, 0);
  const ownerCol = col(/owner|assignee|who/, -1);
  const priorityCol = col(/priority/, -1);
  const dueCol = col(/due|date|timeline|when/, -1);
  const statusCol = col(/status|state/, -1);
  const items: ActionItem[] = [];
  for (i++; i < lines.length && lines[i].trim().startsWith("|"); i++) {
    const row = cells(lines[i]);
    if (row.every((c) => /^:?-+:?$/.test(c) || !c)) continue;
    const task = row[taskCol] ?? "";
    if (!task || isNone(task)) continue;
    items.push({
      task,
      ...(ownerCol >= 0 ? owner(row[ownerCol] ?? "") : {}),
      priority: priorityCol >= 0 ? priority(row[priorityCol] ?? "") : undefined,
      due: dueCol >= 0 ? (row[dueCol] ?? "").match(/\d{4}-\d{2}-\d{2}/)?.[0] : undefined,
      done: statusCol >= 0 && /^(done|complete|completed|closed|resolved)\b/i.test(row[statusCol] ?? "") ? true : undefined,
    });
  }
  return items;
}

/** The full report as it goes under the Meeting Summary heading: headings demoted below it, no horizontal rules. */
function reportBody(lines: string[]): string[] {
  const levels = lines.map((l) => l.match(HEADING_RE)?.[1].length).filter((n): n is number => n !== undefined);
  const shift = levels.length > 0 ? Math.max(0, 3 - Math.min(...levels)) : 0;
  const out = lines.map((l) => {
    if (RULE_RE.test(l)) return "";
    const m = l.match(HEADING_RE);
    return m && shift ? `${"#".repeat(Math.min(6, m[1].length + shift))} ${m[2]}` : l.replace(/\s+$/, "");
  });
  return trimBlank(out).filter((l, i, all) => l.trim() || all[i - 1]?.trim());
}

/**
 * The reply itself, without chat around it: the inside of its code block if
 * the assistant used one, otherwise everything from the first heading or
 * label on (an opening "Sure! Here's…" line is dropped).
 */
function replyLines(text: string): string[] {
  const all = text.replace(/\r\n/g, "\n").split("\n");
  const fences = all.map((l, i) => (/^\s*```/.test(l) ? i : -1)).filter((i) => i !== -1);
  if (fences.length >= 2) return trimBlank(all.slice(fences[0] + 1, fences[fences.length - 1]));
  const lines = all.filter((l) => !/^\s*```/.test(l));
  const first = lines.findIndex((l) => {
    const unquoted = l.replace(QUOTE_RE, "");
    return !!headingText(unquoted) || FIELD_RE.test(unquoted);
  });
  return trimBlank(first > 0 ? lines.slice(first) : lines);
}

/** Every `- [ ] **[[Owner]]**: Task (date, Priority)` line in `text`, as action items. */
export function nextStepsIn(text: string): ActionItem[] {
  return text.replace(/\r\n/g, "\n").split("\n")
    .map((l) => l.match(/^\s*[-*+]\s+\[ \]\s+(\S.*)$/)?.[1])
    .filter((t): t is string => !!t)
    .map(nextStep);
}

/** Instructions for turning an email or chat message into next steps, in the format {@link nextStepsIn} reads. */
export function captureInstructions(me: string | undefined, today: string): string {
  return [
    `Find the action items in the message below${me ? ` for me (${me}) or that others promised me` : ""}. Today is ${today}.`,
    "Reply with only a list, one line per action item, in exactly this form:",
    "- [ ] **[[Full Name]]**: What needs doing (YYYY-MM-DD, Priority)",
    `The owner is the person who has to do it${me ? `; write me as [[${me}]]` : ""}. Give a date only if one was asked for, turning "by Friday" into a date. ` +
      "Priority is High (urgent, blocking, or someone is waiting on it), Medium, Low, or Someday (mentioned, but nobody committed). " +
      "Don't invent action items; if there are none, reply \"None\".",
  ].join("\n");
}

/**
 * A Next Steps line: `**[[Owner]]**: Task (2026-10-10, High)`. Brackets at the
 * end holding a date or a priority are read and dropped from the task; other
 * wording, such as `(before the kickoff)`, is kept as written.
 */
function nextStep(text: string): ActionItem {
  const m = text.match(/^\*\*(.+?)\*\*\s*:?\s*(.+)$/);
  if (!m) return { task: text, raw: text };
  let task = m[2].trim();
  // "(2026-10-09, High)", also "(2026-10-09 – High)", "[High]", "(**High**)" and "(High priority)".
  const tail = task.match(/\s*\(([^()]*)\)\s*$/) ?? task.match(/\s*\[((?:high|medium|low|someday)(?: priority)?)\]\s*$/i);
  const parts = tail ? tail[1].replace(/\*\*/g, "").split(/\s*[,;]\s*|\s+[–—-]\s+/) : [];
  const due = parts.map((p) => p.match(/\d{4}-\d{2}-\d{2}/)?.[0]).find(Boolean);
  const level = parts
    .map((p) => p.replace(/^\[|\]$/g, "").replace(/^priority:\s*/i, "").replace(/\s+priority$/i, "").trim())
    .find((p) => /^(high|medium|low|someday)$/i.test(p));
  if (tail && (due || level)) task = task.slice(0, tail.index).trim();
  return { task, ...owner(m[1].replace(/:\s*$/, "").trim()), due, priority: level ? priority(level) : undefined };
}

/** `[[Target|Alias]]` and `[[Target]]` links reduced to their target. */
const unlink = (s: string) => s.replace(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, "$1");

/**
 * The Executive Summary as filed: a horizontal rule (the agent puts one
 * before its continuity points) gets blank lines around it, so Obsidian
 * doesn't read the paragraph above as a heading; a rule at either end is dropped.
 */
function summaryBody(lines: string[]): string[] {
  let out = trimBlank(lines);
  while (out.length > 0 && RULE_RE.test(out[0])) out = trimBlank(out.slice(1));
  while (out.length > 0 && RULE_RE.test(out[out.length - 1])) out = trimBlank(out.slice(0, -1));
  return out
    .flatMap((l) => (RULE_RE.test(l) ? ["", "---", ""] : [l]))
    .filter((l, i, all) => l.trim() || all[i - 1]?.trim());
}

type ReplySection = keyof Pick<AssistantReply, "summary" | "actionItems" | "topics" | "decisions" | "additional" | "speakers">;

const SIX_SECTIONS: Array<[ReplySection, RegExp]> = [
  ["summary", /^executive summary$/],
  ["actionItems", /^(next steps|action items)\b/],
  ["topics", /^summary\s*\(?by topics?\)?$|^topics$/],
  ["decisions", /^key decisions/],
  ["additional", /^additional items/],
  ["speakers", /^speakers\b/],
];

/**
 * The six-section report, or undefined if the reply has no Executive Summary
 * or Next Steps heading. A section runs to the next of the six headings, so
 * the topic subheadings stay inside Summary (by topic); headings below the
 * level of Executive Summary never start a section. A Meeting Metadata
 * heading ends a section too, so metadata placed after the six is still read.
 */
function parseSixSections(lines: string[]): Omit<AssistantReply, keyof Metadata | "speakerNames"> & { metadataLines: string[] } | undefined {
  const headings = lines.map(headingText);
  const anchor = headings.findIndex((h) => !!h && /^(executive summary|next steps)$/i.test(h.text));
  if (anchor === -1) return undefined;
  const top = headings[anchor]!.level;
  const starts: Array<[number, ReplySection | "metadata"]> = [];
  headings.forEach((h, i) => {
    if (h && /^meeting metadata$/i.test(h.text) && !starts.some(([, k]) => k === "metadata")) starts.push([i, "metadata"]);
    if (!h || h.level > top) return;
    const key = SIX_SECTIONS.find(([, re]) => re.test(h.text.toLowerCase()))?.[0];
    if (key && !starts.some(([, k]) => k === key)) starts.push([i, key]);
  });
  const body = (key: ReplySection | "metadata") => {
    const at = starts.findIndex(([, k]) => k === key);
    if (at === -1) return [];
    const end = starts.find(([i]) => i > starts[at][0])?.[0];
    return lines.slice(starts[at][0] + 1, end);
  };
  const bullets = (key: ReplySection) =>
    body(key)
      .filter((l) => /^(?:[-*+•]|\d+[.)])\s/.test(l))
      .map((l) => l.replace(BULLET_RE, "").trim())
      .filter((l) => l && !isNone(l));
  const block = (key: ReplySection) => {
    const out = reportBody(body(key));
    return out.every((l) => !l.trim() || isNone(l.replace(BULLET_RE, ""))) ? [] : out;
  };
  return {
    summary: summaryBody(body("summary")),
    actionItems: bullets("actionItems").map(nextStep),
    topics: block("topics"),
    decisions: bullets("decisions"),
    additional: block("additional"),
    speakers: block("speakers"),
    metadataLines: [...lines.slice(0, Math.min(...starts.map(([i]) => i))), ...body("metadata")],
  };
}

type Metadata = Pick<AssistantReply, "category" | "account" | "tags" | "organizations" | "keyTopics" | "sentiment" | "outcome">;

/** A comma- or semicolon-separated field value as a list. */
const listValue = (value?: string) =>
  unlink(value ?? "").split(/\s*[,;]\s*/).map((v) => v.replace(/^\[|\]$/g, "").trim()).filter((v) => v && !isNone(v) && !/^(tbd|general)$/i.test(v));

/**
 * The Meeting Metadata fields: "**Label:** value" lines, also inside a quote
 * or several on one line split by " | ". With `loose`, for lines known to be
 * the metadata block, also "Label: value" lines and "| Label | Value |" table rows.
 */
function metadata(lines: string[], loose = false): Metadata {
  const field = (re: RegExp) => {
    for (const line of lines) {
      const unquoted = line.replace(QUOTE_RE, "");
      if (loose && unquoted.trim().startsWith("|")) {
        const [label, value] = cells(unquoted).map((c) => c.replace(/\*\*/g, "").replace(/:\s*$/, "").trim());
        if (label && re.test(label)) return value || undefined;
        continue;
      }
      for (const part of unquoted.split(/\s+\|\s+/)) {
        const m = part.match(FIELD_RE) ?? (loose ? part.match(PLAIN_FIELD_RE) : null);
        if (m && re.test(m[1].trim())) return m[2].trim() || undefined;
      }
    }
    return undefined;
  };
  const single = (raw?: string) => {
    const value = raw && unlink(raw);
    return value && !isNone(value) && !/^\[?tbd\]?$/i.test(value) ? value.replace(/^\[|\]$/g, "") : undefined;
  };
  const account = single(field(/^(primary )?(account|project|customer)(\s*\/\s*(project|account|customer|initiative))?$/i));
  return {
    category: single(field(/^(meeting )?category$/i)),
    account: account && !/^general$/i.test(account) ? account : undefined,
    tags: [...(field(/^(search )?tags$/i) ?? "").matchAll(/#([\p{L}\p{N}_/-]+)/gu)].map((m) => m[1]).filter((t) => !/^\d+$/.test(t)),
    organizations: listValue(field(/^organi[sz]ations?$/i)),
    keyTopics: listValue(field(/^(key )?topics$/i)),
    sentiment: single(field(/^sentiment$/i)),
    outcome: single(field(/^outcome$/i)),
  };
}

/** Names in the Speakers table's name column, leaving out speakers it couldn't identify. */
function speakerNames(table: string[]): string[] {
  const rows = table.filter((l) => l.trim().startsWith("|")).map(cells);
  if (rows.length < 2) return [];
  const col = rows[0].findIndex((h) => /name/i.test(h));
  if (col === -1) return [];
  const names = rows.slice(1)
    .map((r) => unlink(r[col] ?? "").replace(/`/g, "").replace(/^.*->\s*/, "").replace(/\s*\(.*\)\s*$/, "").trim())
    .filter((n) => n && !/^:?-+:?$/.test(n) && !/unidentified|unknown|unclear|tbd|^n\/a$/i.test(n));
  return [...new Set(names)];
}

/** The parts of an assistant's reply, or undefined if it has neither a summary nor action items to file. */
export function parseReply(text: string): AssistantReply | undefined {
  const lines = replyLines(text);
  const six = parseSixSections(lines);
  if (six) {
    const { metadataLines, ...sections } = six;
    return { ...sections, ...metadata(metadataLines, true), speakerNames: speakerNames(six.speakers) };
  }
  const headings = lines.map(headingText);
  const find = (test: (t: string) => boolean) => headings.findIndex((h) => !!h && test(h.text.toLowerCase()));

  const summaryAt = find((t) => t === "summary");
  let decisionsAt = find((t) => t.includes("decision"));
  const actionsAt = find((t) => t.includes("action item"));
  const inlineDecisions: string[] = [];
  if (decisionsAt === -1) {
    decisionsAt = lines.findIndex((l) => /decision/i.test(l.match(INLINE_LABEL_RE)?.[1] ?? ""));
    const rest = decisionsAt === -1 ? "" : lines[decisionsAt].match(INLINE_LABEL_RE)![2].trim();
    if (rest && !isNone(rest)) inlineDecisions.push(rest.replace(/^[-*]\s+/, ""));
  }

  let summary: string[];
  if (summaryAt !== -1) {
    const end = headings.findIndex((h, i) => i > summaryAt && !!h);
    summary = trimBlank(lines.slice(summaryAt + 1, end === -1 ? undefined : end))
      .map((l) => l.replace(/^\s*#{1,6}\s+(.*)$/, "**$1**"));
  } else {
    summary = decisionsAt !== -1 || actionsAt !== -1 ? reportBody(lines) : [];
  }

  let actionItems: ActionItem[] = [];
  if (actionsAt !== -1) {
    actionItems = tableAfter(lines, actionsAt) ?? bulletsAfter(lines, actionsAt).map((raw) => ({ task: raw, raw }));
  }

  if (summary.length === 0 && actionItems.length === 0 && decisionsAt === -1) return undefined;

  return {
    summary,
    decisions: decisionsAt !== -1 ? [...inlineDecisions, ...bulletsAfter(lines, decisionsAt)] : [],
    actionItems,
    topics: [],
    additional: [],
    speakers: [],
    ...metadata(lines),
    speakerNames: [],
  };
}

/** The Tasks plugin's priority markers. */
const PRIORITY_MARK = { High: "⏫", Medium: "🔼", Low: "🔽", Someday: "⏬" } as const;

/**
 * An action item as a task line, in the Tasks plugin's format: owner in the
 * text, then priority, created date (`created`, if given) and due date.
 */
export function actionLine(item: ActionItem, created?: string): string {
  const added = created ? `➕ ${created}` : "";
  if (item.raw !== undefined) return [`- [ ] ${item.raw}`, added].filter(Boolean).join(" ");
  return [
    `- [${item.done ? "x" : " "}] ${item.task}`,
    ...(item.people ?? []).map((p) => `@[[${p}]]`),
    item.role ? `(owner: ${item.role})` : "",
    item.priority ? PRIORITY_MARK[item.priority] : "",
    added,
    item.due ? `📅 ${item.due}` : "",
    item.done && created ? `✅ ${created}` : "",
  ].filter(Boolean).join(" ");
}

/** A task or bullet reduced to its wording, for spotting one that is already in the note. */
function sameItem(line: string): string {
  return line
    .replace(BULLET_RE, "")
    .replace(/(?:📅|➕|✅|⏳|🛫)\s*\d{4}-\d{2}-\d{2}/gu, "")
    .replace(/[⏫🔼🔽🔺⏬]/gu, "")
    .replace(/\((?:priority|owner):[^)]*\)/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export interface ApplyResult {
  content: string;
  decisions: number;
  actionItems: number;
}

/** The note's AI sections in order, for placing one that the note lacks before the sections that follow it. */
const AFTER_SUMMARY = [ACTION_SECTIONS, TOPICS_SECTIONS, DECISIONS_SECTIONS, ADDITIONAL_SECTIONS, SPEAKERS_SECTIONS, TRANSCRIPT_SECTIONS];
const after = (names: string[]) => AFTER_SUMMARY.slice(AFTER_SUMMARY.indexOf(names) + 1).flat();

/**
 * File the reply into the note: the summary, topics, additional items and
 * speakers replace their sections; decisions and next steps not already in
 * their sections are added; the
 * category, account and tags become properties when `saveProperties` is set.
 * New action items are stamped with `today` as their created date, and
 * `ai_summarized` records the day a reply was first filed.
 * Applying the same reply twice changes nothing the second time.
 */
export function applyReply(content: string, reply: AssistantReply, saveProperties: boolean, today?: string): ApplyResult {
  let out = content;
  if (reply.summary.length > 0) out = replaceSection(out, SUMMARY_SECTIONS, reply.summary, AFTER_SUMMARY.flat());

  const fresh = (names: string[], candidates: string[]) => {
    const seen = new Set(sectionLines(out, names).map(sameItem));
    return candidates.filter((line) => {
      const key = sameItem(line);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  };
  const actions = fresh(ACTION_SECTIONS, reply.actionItems.map((item) => actionLine(item, today)));
  if (actions.length > 0) out = appendToSection(out, ACTION_SECTIONS, actions, after(ACTION_SECTIONS));
  if (reply.topics.length > 0) out = replaceSection(out, TOPICS_SECTIONS, reply.topics, after(DECISIONS_SECTIONS));
  const decisions = fresh(DECISIONS_SECTIONS, reply.decisions.map((d) => `- ${d}`));
  if (decisions.length > 0) out = appendToSection(out, DECISIONS_SECTIONS, decisions, after(DECISIONS_SECTIONS));
  if (reply.additional.length > 0) out = replaceSection(out, ADDITIONAL_SECTIONS, reply.additional, after(ADDITIONAL_SECTIONS));
  if (reply.speakers.length > 0) out = replaceSection(out, SPEAKERS_SECTIONS, reply.speakers, after(SPEAKERS_SECTIONS));

  if (saveProperties) {
    if (reply.category) out = setFrontmatterValue(out, "meeting_category", reply.category);
    if (reply.account) out = setFrontmatterValue(out, "account", reply.account);
    if (reply.sentiment) out = setFrontmatterValue(out, "sentiment", reply.sentiment);
    if (reply.outcome) out = setFrontmatterValue(out, "outcome", reply.outcome);
    if (reply.organizations.length > 0) out = setFrontmatterList(out, "organizations", reply.organizations);
    if (reply.keyTopics.length > 0) out = setFrontmatterList(out, "key_topics", reply.keyTopics);
    if (reply.speakerNames.length > 0) out = setFrontmatterList(out, "speakers", reply.speakerNames);
    if (reply.tags.length > 0) out = addFrontmatterTags(out, reply.tags);
    if (today && !hasFrontmatterKey(out, "ai_summarized")) out = setFrontmatterValue(out, "ai_summarized", today);
  }
  return { content: out, decisions: decisions.length, actionItems: actions.length };
}
