/**
 * @file noteCreator.ts
 * @description Builds structured Obsidian Markdown notes from calendar events
 * and writes them to the vault.
 *
 * Security notes:
 *   - YAML injection: All values written to frontmatter are escaped with
 *     {@link escapeYaml} so that newlines and special characters cannot inject
 *     additional YAML keys.
 *   - Markdown body injection: Inline fields are flattened and their Markdown
 *     syntax escaped with {@link escapeInlineMd}; link targets are stripped of
 *     wikilink syntax with {@link linkTarget}.
 *   - URL injection: Conference entry-point URIs are validated with
 *     {@link isSafeHttpsUrl} before being embedded in a Markdown link.
 */

import { App, moment, normalizePath, TFile } from "obsidian";
import { CalendarEvent, ResponseStatus } from "./calendarApi";
import { canonicalEventId } from "./appleCalendarApi";
import { continuityItems } from "./sections";

// ---------------------------------------------------------------------------
// Public options interface
// ---------------------------------------------------------------------------

/** Options that control the content and filename format of generated notes. */
export interface NoteOptions {
  /** Vault-relative folder path. Empty = vault root. */
  noteFolder: string;
  /** When true, include the event's original description in a collapsed callout. */
  includeEventNotes: boolean;
  /** When true, attendees and organizer are written as `[[Name]]` links. */
  linkAttendees: boolean;
  /** Daily-note naming used to link each meeting to its day. Undefined = no link. */
  dailyNote?: DailyNoteConfig;
  /** Contents of the user's template note. Undefined = built-in template. */
  template?: string;
  /** Vault path (without `.md`) of the previous meeting in the same series. */
  previousNote?: string;
  /** Vault path (without `.md`) of the recurring meeting's series note. */
  seriesNote?: string;
  /** Open action items of the previous meeting, listed in the new note's Agenda. */
  carriedItems?: string[];
  /** The previous meeting's "Core Elements for Next Meeting Continuity", listed in the new note's Agenda. */
  carriedContinuity?: string[];
  /**
   * "before" → "2026-03-30 - Meeting Title.md"
   * "after"  → "Meeting Title - 2026-03-30.md"
   */
  datePosition: "before" | "after";
}

/** Where daily notes live and how they are named (a moment.js format). */
export interface DailyNoteConfig {
  format: string;
  folder: string;
}

// ---------------------------------------------------------------------------
// Security helpers
// ---------------------------------------------------------------------------

function escapeYaml(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\r/g, "\\r")
    .replace(/\n/g, "\\n")
    .replace(/\t/g, "\\t");
}

function sanitizeInline(value: string): string {
  return value.replace(/\r?\n|\r/g, " ").trim();
}

function isSafeHttpsUrl(uri: string): boolean {
  try {
    const url = new URL(uri);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// HTML → plain text helpers
// ---------------------------------------------------------------------------

function stripHtml(html: string): string {
  // Cap input before DOM parsing to prevent DoS on pathologically large descriptions.
  const safe = html.length > 10_000 ? html.slice(0, 10_000) : html;
  try {
    const doc = new DOMParser().parseFromString(safe, "text/html");

    function walk(node: Node): string {
      if (node.nodeType === Node.TEXT_NODE) {
        return node.textContent ?? "";
      }
      if (node.nodeType !== Node.ELEMENT_NODE) {
        return "";
      }
      const el = node as Element;
      const tag = el.tagName.toLowerCase();
      const blockTags = new Set([
        "p", "div", "br", "li", "h1", "h2", "h3", "h4", "h5", "h6",
        "tr", "blockquote", "pre",
      ]);
      const prefix = blockTags.has(tag) ? "\n" : "";
      let inner = "";
      for (const child of Array.from(el.childNodes)) {
        inner += walk(child);
      }
      return prefix + inner;
    }

    return walk(doc.body)
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } catch {
    return html.replace(/<[^>]+>/g, " ").trim();
  }
}

/**
 * Remove Zoom / Google Meet / Teams invite boilerplate from plain text so
 * it does not appear in the Agenda section of the generated note.
 * The conference link itself is already extracted and placed in the note
 * header when "Include conference link" is enabled.
 */
function stripConferenceBoilerplate(text: string): string {
  // Google Calendar wraps the entire conference block between delimiter lines
  // that start with "-::~:~::".  Remove everything from the first such line
  // to the last (inclusive), handling both LF and CRLF line endings.
  const gcalDelimRe = /^-::~:~::/m;
  if (gcalDelimRe.test(text)) {
    // Find the first and last occurrence of the delimiter line and strip the
    // entire span between them (the block always has an opening and closing
    // delimiter line, but guard against a lone delimiter by trimming the rest).
    const lines = text.split(/\r?\n/);
    const firstIdx = lines.findIndex((l) => /^-::~:~::/.test(l));
    const lastIdx  = lines.reduceRight(
      (found, l, i) => (found === -1 && /^-::~:~::/.test(l) ? i : found),
      -1
    );
    if (firstIdx !== -1) {
      text = [
        ...lines.slice(0, firstIdx),
        ...lines.slice(lastIdx + 1),
      ].join("\n");
    }
  }

  // Lines containing a known conference URL are always removed.
  const conferenceUrlRe =
    /https?:\/\/(?:[\w.-]+\.zoom\.us|meet\.google\.com|teams\.microsoft\.com|teams\.live\.com)\//i;

  // Common Zoom / Teams / Meet invite boilerplate line prefixes.
  const boilerplatePrefixes = [
    /^join\s+(?:zoom\s+)?meeting\b/i,
    /^meeting\s+id\s*:/i,
    /^passcode\s*:/i,
    /^password\s*:/i,
    /^dial\s+by\s+your\s+location\b/i,
    /^dial\s+in\s+by\s+phone\b/i,
    /^one\s+tap\s+mobile\b/i,
    /^find\s+your\s+local\s+number\b/i,
    /^join\s+by\s+sip\b/i,
    /^join\s+by\s+h\.?323\b/i,
    /^join\s+by\s+skype\b/i,
    /^\+\d[\d\s,*#]{6,}$/,  // dial-in phone numbers
    /^\d{6,}(?:\s*#)+$/,    // numeric conference codes
  ];

  const cleaned = text.split("\n").filter((line) => {
    const t = line.trim();
    if (!t) return true;
    if (conferenceUrlRe.test(t)) return false;
    if (boilerplatePrefixes.some((re) => re.test(t))) return false;
    return true;
  });
  return cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function descriptionLines(description: string): string[] {
  const lines = stripConferenceBoilerplate(stripHtml(description))
    .split("\n")
    .map((line) => line.replace(/\s+$/, ""));
  while (lines.length > 0 && lines[0].trim() === "") lines.shift();
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") lines.pop();
  return lines;
}

// ---------------------------------------------------------------------------
// Date / time helpers
// ---------------------------------------------------------------------------

interface LocalParts {
  date: string;
  time: string;
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/**
 * Calendar date and wall-clock time of an ISO timestamp. A timestamp with an
 * explicit UTC offset keeps the event's own local date and time; a UTC ("Z")
 * timestamp is converted to this machine's time zone.
 */
function localParts(iso: string): LocalParts {
  const dateOnly = iso.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (dateOnly) return { date: dateOnly[1], time: "00:00" };

  const withOffset = iso.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?[+-]\d{2}:?\d{2}$/);
  if (withOffset) return { date: withOffset[1], time: withOffset[2] };

  const d = new Date(iso);
  const valid = isNaN(d.getTime()) ? new Date() : d;
  return {
    date: `${valid.getFullYear()}-${pad2(valid.getMonth() + 1)}-${pad2(valid.getDate())}`,
    time: `${pad2(valid.getHours())}:${pad2(valid.getMinutes())}`,
  };
}

/**
 * Short time zone label for an ISO timestamp: this machine's zone name (e.g.
 * "EST") when the timestamp is UTC or matches this machine's offset, otherwise
 * the timestamp's own offset as "GMT-5" / "GMT+5:30".
 */
function zoneLabel(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  const offset = iso.match(/([+-])(\d{2}):?(\d{2})$/);
  if (offset) {
    const minutes = (offset[1] === "-" ? -1 : 1) * (Number(offset[2]) * 60 + Number(offset[3]));
    if (minutes !== -d.getTimezoneOffset()) {
      const h = Math.floor(Math.abs(minutes) / 60);
      const m = Math.abs(minutes) % 60;
      return minutes === 0 ? "GMT" : `GMT${offset[1]}${h}${m ? `:${pad2(m)}` : ""}`;
    }
  }
  return new Intl.DateTimeFormat("en-US", { timeZoneName: "short" })
    .formatToParts(d)
    .find((p) => p.type === "timeZoneName")?.value ?? "";
}

function formatDateLong(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime12h(time: string): string {
  const [h, m] = time.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  return `${pad2(h % 12 === 0 ? 12 : h % 12)}:${pad2(m)} ${suffix}`;
}

function formatDuration(ms: number): string {
  if (ms <= 0) return "0m";
  const totalMinutes = Math.round(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

interface EventTiming {
  allDay: boolean;
  date: string;
  start?: string;
  end?: string;
  dateLong: string;
  startTime: string;
  endTime: string;
  timeRange: string;
  duration: string;
}

function getEventTiming(event: CalendarEvent): EventTiming {
  if (!event.start.dateTime) {
    const date = event.start.date ?? localParts(new Date().toISOString()).date;
    return {
      allDay: true,
      date,
      dateLong: formatDateLong(date),
      startTime: "",
      endTime: "",
      timeRange: "All day",
      duration: "All day",
    };
  }

  const startDt = event.start.dateTime;
  const endDt = event.end.dateTime ?? startDt;
  const s = localParts(startDt);
  const e = localParts(endDt);
  const startZone = zoneLabel(startDt);
  const endZone = zoneLabel(endDt);
  const withZone = (time: string, zone: string) => (zone ? `${time} ${zone}` : time);
  const startTime = withZone(formatTime12h(s.time), startZone);
  const endTime = withZone(formatTime12h(e.time), endZone);
  return {
    allDay: false,
    date: s.date,
    start: `${s.date}T${s.time}`,
    end: `${e.date}T${e.time}`,
    dateLong: formatDateLong(s.date),
    startTime,
    endTime,
    timeRange: startZone === endZone
      ? `${formatTime12h(s.time)} – ${endTime}`
      : `${startTime} – ${endTime}`,
    duration: formatDuration(new Date(endDt).getTime() - new Date(startDt).getTime()),
  };
}

// ---------------------------------------------------------------------------
// Attendee helpers
// ---------------------------------------------------------------------------

const RESPONSE_ICON: Record<ResponseStatus, string> = {
  accepted: "🟢",
  declined: "🔴",
  tentative: "🟡",
  needsAction: "⚪",
};

function responseIcon(status: string | undefined): string {
  return RESPONSE_ICON[(status ?? "needsAction") as ResponseStatus] ?? "⚪";
}

function escapeInlineMd(value: string): string {
  return sanitizeInline(value).replace(/([\\`*_[\]<>|#])/g, "\\$1");
}

function linkTarget(name: string): string {
  return sanitizeInline(name).replace(/[[\]|#^\\]/g, "").trim();
}

interface Person {
  name: string;
  email: string;
  hasName: boolean;
  icon: string;
  organizer: boolean;
}

function buildPeople(event: CalendarEvent): Person[] {
  const people: Person[] = [];
  if (event.organizer && !(event.attendees ?? []).some((a) => a.email === event.organizer!.email)) {
    const name = event.organizer.displayName?.trim();
    people.push({
      name: name || event.organizer.email,
      email: event.organizer.email,
      hasName: !!name,
      icon: "🔷",
      organizer: true,
    });
  }
  for (const a of event.attendees ?? []) {
    if (a.self) continue;
    const name = a.displayName?.trim();
    people.push({
      name: name || a.email,
      email: a.email,
      hasName: !!name,
      icon: responseIcon(a.responseStatus),
      organizer: !!a.organizer || a.email === event.organizer?.email,
    });
  }
  return people;
}

function personProperty(p: Person, linkAttendees: boolean): string {
  if (linkAttendees && p.hasName && linkTarget(p.name)) return `[[${linkTarget(p.name)}]]`;
  return p.hasName && p.email !== p.name ? `${sanitizeInline(p.name)} <${sanitizeInline(p.email)}>` : sanitizeInline(p.email);
}

function personInline(p: Person, linkAttendees: boolean): string {
  const label = linkAttendees && p.hasName && linkTarget(p.name)
    ? `[[${linkTarget(p.name)}]]`
    : escapeInlineMd(p.name);
  return p.organizer ? `${label} *(organizer)*` : label;
}

// ---------------------------------------------------------------------------
// Note content
// ---------------------------------------------------------------------------

interface MeetingLink {
  url: string;
  platform: string;
}

function meetingLink(event: CalendarEvent): MeetingLink | undefined {
  const entry = event.conferenceData?.entryPoints?.find((ep) => ep.entryPointType === "video");
  if (!entry || !isSafeHttpsUrl(entry.uri)) return undefined;
  return {
    url: new URL(entry.uri).href.replace(/\(/g, "%28").replace(/\)/g, "%29"),
    platform: sanitizeInline(event.conferenceData?.conferenceSolution?.name ?? "") || "Video call",
  };
}

function noteTitle(event: CalendarEvent): string {
  return sanitizeInline(event.summary?.trim() || "Untitled Event");
}

function organizerName(event: CalendarEvent): string | undefined {
  if (!event.organizer) return undefined;
  return sanitizeInline(event.organizer.displayName?.trim() || event.organizer.email) || undefined;
}

/** Frontmatter keys the plugin keeps in sync with the calendar. `null` = remove. */
type SyncOptions = Pick<NoteOptions, "linkAttendees" | "dailyNote" | "previousNote" | "seriesNote"> & {
  /** You declined this meeting. */
  declined?: boolean;
};

/** `status` values of a meeting that didn't happen (for you). */
const SKIPPED_STATUSES = new Set(["cancelled", "removed", "declined"]);

/** True if a note's `status` property says the meeting was cancelled, removed or declined. */
export function isSkippedStatus(status: unknown): boolean {
  return typeof status === "string" && SKIPPED_STATUSES.has(status);
}

interface DailyLink {
  target: string;
  name: string;
}

function dailyNoteLink(date: string, config: DailyNoteConfig | undefined): DailyLink | undefined {
  if (!config) return undefined;
  const formatted = moment(date, "YYYY-MM-DD").format(config.format || "YYYY-MM-DD");
  const folder = config.folder.trim() ? normalizePath(config.folder.trim()) + "/" : "";
  return { target: `${folder}${formatted}`, name: formatted.split("/").pop() ?? formatted };
}

function wikilink(link: DailyLink, alias = link.name): string {
  return link.target === alias ? `[[${link.target}]]` : `[[${link.target}|${alias}]]`;
}

function previousLink(path: string | undefined): DailyLink | undefined {
  return path ? { target: path, name: path.split("/").pop() ?? path } : undefined;
}

function managedFrontmatter(
  event: CalendarEvent,
  options: SyncOptions
): Array<[string, string[] | null]> {
  const timing = getEventTiming(event);
  const people = buildPeople(event).filter((p) => !p.organizer || (event.attendees ?? []).some((a) => a.email === p.email));
  const organizer = organizerName(event);
  const organizerPerson = buildPeople(event).find((p) => p.organizer);
  const link = meetingLink(event);
  const quoted = (key: string, value: string | undefined): [string, string[] | null] =>
    [key, value ? [`${key}: "${escapeYaml(value)}"`] : null];

  return [
    quoted("title", noteTitle(event)),
    ["date", [`date: ${timing.date}`]],
    quoted("daily_note", (() => {
      const link = dailyNoteLink(timing.date, options.dailyNote);
      return link ? wikilink(link) : undefined;
    })()),
    quoted("previous_meeting", (() => {
      const link = previousLink(options.previousNote);
      return link ? wikilink(link) : undefined;
    })()),
    quoted("series", (() => {
      const link = previousLink(options.seriesNote);
      return link ? wikilink(link) : undefined;
    })()),
    ["start", timing.start ? [`start: ${timing.start}`] : null],
    ["end", timing.end ? [`end: ${timing.end}`] : null],
    quoted("calendar", event.calendarName ? sanitizeInline(event.calendarName) : undefined),
    quoted("organizer", organizerPerson ? personProperty(organizerPerson, options.linkAttendees) : organizer),
    ["attendees", people.length > 0
      ? ["attendees:", ...people.map((p) => `  - "${escapeYaml(personProperty(p, options.linkAttendees))}"`)]
      : null],
    quoted("location", event.location ? sanitizeInline(event.location) : undefined),
    quoted("meeting_url", link?.url),
    quoted("conference_platform", link ? link.platform : undefined),
    ["status", event.cancelled ? ["status: cancelled"] : options.declined ? ["status: declined"] : null],
    quoted("calendar_event_id", event.id),
  ];
}

const DETAILS_CALLOUT_RE = /^> \[!(info|danger|warning)\] Meeting (details|cancelled|declined|removed from calendar)\s*$/;

function renderDetailsCallout(event: CalendarEvent, options: SyncOptions): string[] {
  const timing = getEventTiming(event);
  const link = meetingLink(event);
  const lines = [
    event.cancelled ? "> [!danger] Meeting cancelled"
      : options.declined ? "> [!warning] Meeting declined"
      : "> [!info] Meeting details",
  ];

  const daily = dailyNoteLink(timing.date, options.dailyNote);
  const day = daily ? wikilink(daily, timing.dateLong) : timing.dateLong;
  lines.push(
    timing.allDay
      ? `> **When:** ${day} · All day`
      : `> **When:** ${day} · ${timing.timeRange} (${timing.duration})`
  );
  const previous = previousLink(options.previousNote);
  if (previous) lines.push(`> **Previous:** ${wikilink(previous)}`);
  const series = previousLink(options.seriesNote);
  if (series) lines.push(`> **Series:** ${wikilink(series)}`);
  if (event.location) lines.push(`> **Where:** ${escapeInlineMd(event.location)}`);
  if (link) lines.push(`> **Join:** [Join ${escapeInlineMd(link.platform)}](${link.url})`);

  const organizer = organizerName(event);
  if (organizer) lines.push(`> **Organizer:** ${escapeInlineMd(organizer)}`);

  const people = buildPeople(event);
  if (people.length > 0) {
    lines.push(`> **Attendees:** ${people.map((p) => `${p.icon} ${personInline(p, options.linkAttendees)}`).join(" · ")}`);
  }
  return lines;
}

/** The sections of the built-in note layout that can be switched off. */
export interface NoteSections {
  agenda: boolean;
  notes: boolean;
  summary: boolean;
  actionItems: boolean;
  topics: boolean;
  decisions: boolean;
  additional: boolean;
  speakers: boolean;
  transcript: boolean;
}

export const ALL_SECTIONS: NoteSections = {
  agenda: true,
  notes: true,
  summary: true,
  actionItems: true,
  topics: true,
  decisions: true,
  additional: true,
  speakers: true,
  transcript: true,
};

const SECTION_BLOCKS: Array<[keyof NoteSections, string]> = [
  ["agenda", "## Agenda\n\n{{agenda}}\n"],
  ["notes", "## Notes\n\n- \n"],
  ["summary", "## Executive Summary\n\n\n"],
  ["actionItems", "## Next Steps\n\n- [ ] \n"],
  ["topics", "## Summary by Topic\n\n\n"],
  ["decisions", "## Key Decisions\n\n- \n"],
  ["additional", "## Additional Items\n\n- \n"],
  ["speakers", "## Speakers\n\n\n"],
  ["transcript", "## Transcript\n\n"],
];

/** The built-in note layout with the chosen sections, written in the same placeholder syntax as user templates. */
export function builtInTemplate(sections: NoteSections = ALL_SECTIONS): string {
  const blocks = SECTION_BLOCKS.filter(([key]) => sections[key]).map(([, block]) => `\n${block}`);
  return `---\ntype: meeting\ntags:\n  - meeting\n---\n\n# {{title}}\n\n{{details}}\n${blocks.join("")}`;
}

export const DEFAULT_TEMPLATE = builtInTemplate();

/** Placeholders available in templates, mapped to their value for this event. */
function templateValues(
  event: CalendarEvent,
  options: Pick<NoteOptions, "includeEventNotes" | "linkAttendees" | "dailyNote" | "previousNote" | "seriesNote" | "carriedItems" | "carriedContinuity">
): Record<string, string> {
  const timing = getEventTiming(event);
  const link = meetingLink(event);
  const people = buildPeople(event);
  const organizer = buildPeople(event).find((p) => p.organizer);
  const daily = dailyNoteLink(timing.date, options.dailyNote);
  const description = options.includeEventNotes && event.description
    ? descriptionLines(event.description)
    : [];
  const previous = previousLink(options.previousNote);
  const carried = [
    ...(previous && options.carriedContinuity?.length
      ? [`- Where we left off in ${wikilink(previous, "last meeting")}:`, ...options.carriedContinuity.map((item) => `  - ${item}`)]
      : []),
    ...(previous && options.carriedItems?.length
      ? [`- Open items from ${wikilink(previous, "last meeting")}:`, ...options.carriedItems.map((item) => `  - ${item}`)]
      : []),
  ];

  return {
    title: noteTitle(event),
    date: timing.date,
    date_long: timing.dateLong,
    start: timing.start ?? "",
    end: timing.end ?? "",
    start_time: timing.startTime,
    end_time: timing.endTime,
    time: timing.timeRange,
    duration: timing.duration,
    location: event.location ? escapeInlineMd(event.location) : "",
    calendar: event.calendarName ? escapeInlineMd(event.calendarName) : "",
    organizer: organizer
      ? personInline({ ...organizer, organizer: false }, options.linkAttendees)
      : escapeInlineMd(organizerName(event) ?? ""),
    attendees: people.map((p) => personInline({ ...p, organizer: false }, options.linkAttendees)).join(", "),
    attendee_list: people.map((p) => `- ${p.icon} ${personInline(p, options.linkAttendees)}`).join("\n"),
    meeting_url: link?.url ?? "",
    platform: link ? escapeInlineMd(link.platform) : "",
    join_link: link ? `[Join ${escapeInlineMd(link.platform)}](${link.url})` : "",
    description: description.join("\n"),
    agenda: [...description.filter((l) => l.trim()).map((l) => `- ${l.trim()}`), ...carried, "- "].join("\n"),
    description_callout: description.length > 0
      ? ["> [!quote]- Event description", ...description.map((l) => (l.trim() ? `> ${l}` : ">"))].join("\n")
      : "",
    details: renderDetailsCallout(event, options).join("\n"),
    daily_note: daily ? wikilink(daily) : "",
    previous_meeting: previous ? wikilink(previous) : "",
    event_id: escapeInlineMd(event.id),
  };
}

const PLACEHOLDER_RE = /\{\{\s*([a-z_]+)\s*\}\}/g;

/**
 * Fill a template's placeholders. A line holding only placeholders that come
 * out empty is dropped, together with a blank line that would then double up.
 * Unknown placeholders (and other syntax such as Templater's) are left as-is.
 */
function fillPlaceholders(text: string, values: Record<string, string>): string {
  const out: string[] = [];
  const lines = text.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const filled = line.replace(PLACEHOLDER_RE, (m, key: string) => (key in values ? values[key] : m));
    const onlyPlaceholders = line.trim() !== "" && line.replace(PLACEHOLDER_RE, "").trim() === "";
    if (onlyPlaceholders && filled.trim() === "") {
      if (out.length > 0 && out[out.length - 1].trim() === "" && lines[i + 1]?.trim() === "") i++;
      continue;
    }
    out.push(filled);
  }
  return out.join("\n");
}

type FrontmatterBlock = { key: string | null; lines: string[] };

function parseFrontmatter(content: string): { blocks: FrontmatterBlock[]; end: string; rest: string } | null {
  const fm = content.match(/^---\r?\n([\s\S]*?)\r?\n---(\r?\n|$)/) ?? content.match(/^---\r?\n()---(\r?\n|$)/);
  if (!fm) return null;
  const blocks: FrontmatterBlock[] = [];
  for (const line of fm[1] ? fm[1].split(/\r?\n/) : []) {
    const key = line.match(/^([A-Za-z0-9_-]+):/)?.[1] ?? null;
    if (key || blocks.length === 0) blocks.push({ key, lines: [line] });
    else blocks[blocks.length - 1].lines.push(line);
  }
  return { blocks, end: fm[2], rest: content.slice(fm[0].length) };
}

/**
 * Write the managed keys into a frontmatter block list: existing keys are
 * replaced in place, keys set to null are removed, and new keys go before
 * `tags` (or at the end).
 */
function applyManagedFrontmatter(blocks: FrontmatterBlock[], entries: Array<[string, string[] | null]>): void {
  for (const [key, lines] of entries) {
    const index = blocks.findIndex((b) => b.key === key);
    if (lines === null) {
      if (index !== -1) blocks.splice(index, 1);
    } else if (index !== -1) {
      blocks[index] = { key, lines };
    } else {
      const tags = blocks.findIndex((b) => b.key === "tags");
      blocks.splice(tags === -1 ? blocks.length : tags, 0, { key, lines });
    }
  }
}

/**
 * Build the full Markdown content for a new meeting note from the user's
 * template (or the built-in one). The plugin's calendar properties are always
 * added to the frontmatter so the note can be kept in sync.
 */
export function createNoteContent(
  event: CalendarEvent,
  options: Pick<NoteOptions, "includeEventNotes" | "linkAttendees" | "dailyNote" | "template" | "previousNote" | "seriesNote" | "carriedItems" | "carriedContinuity">
): string {
  const template = (options.template ?? DEFAULT_TEMPLATE).replace(/\r\n/g, "\n");
  const values = templateValues(event, options);
  const managed = managedFrontmatter(event, options);

  const parsed = parseFrontmatter(template);
  if (!parsed) {
    const lines = managed.flatMap(([, l]) => l ?? []);
    return `---\n${lines.join("\n")}\n---\n\n${fillPlaceholders(template, values)}`;
  }

  const yamlValues: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    yamlValues[key] = value.includes("\n") ? "" : escapeYaml(value);
  }
  const blocks = parsed.blocks.map((b) => ({
    key: b.key,
    lines: b.lines.map((l) => l.replace(PLACEHOLDER_RE, (m, key: string) => (key in yamlValues ? yamlValues[key] : m))),
  }));
  applyManagedFrontmatter(blocks, managed);

  return `---\n${blocks.flatMap((b) => b.lines).join("\n")}\n---\n${fillPlaceholders(parsed.rest, values)}`;
}

/**
 * Bring an existing note's calendar details up to date with the event.
 *
 * Only the managed frontmatter keys and the "Meeting details" callout are
 * rewritten; everything else in the note is returned unchanged. Notes without
 * a frontmatter block are returned as-is.
 */
export function updateNoteContent(
  content: string,
  event: CalendarEvent,
  options: SyncOptions
): string {
  const parsed = parseFrontmatter(content);
  if (!parsed) return content;

  applyManagedFrontmatter(parsed.blocks, managedFrontmatter(event, options));

  const newFrontmatter = `---\n${parsed.blocks.flatMap((b) => b.lines).join("\n")}\n---${parsed.end}`;
  const bodyLines = parsed.rest.split("\n");

  const start = bodyLines.findIndex((line) => DETAILS_CALLOUT_RE.test(line.replace(/\r$/, "")));
  if (start !== -1) {
    let end = start + 1;
    while (end < bodyLines.length && bodyLines[end].startsWith(">")) end++;
    bodyLines.splice(start, end - start, ...renderDetailsCallout(event, options));
  }

  return newFrontmatter + bodyLines.join("\n");
}

/** Set one quoted string property in a note's frontmatter; a note without frontmatter is returned unchanged. */
export function setFrontmatterValue(content: string, key: string, value: string): string {
  const parsed = parseFrontmatter(content);
  if (!parsed) return content;
  applyManagedFrontmatter(parsed.blocks, [[key, [`${key}: "${escapeYaml(sanitizeInline(value))}"`]]]);
  return `---\n${parsed.blocks.flatMap((b) => b.lines).join("\n")}\n---${parsed.end}${parsed.rest}`;
}

/** Set a list property in a note's frontmatter, replacing any value it had; a note without frontmatter is returned unchanged. */
export function setFrontmatterList(content: string, key: string, values: string[]): string {
  const parsed = parseFrontmatter(content);
  if (!parsed) return content;
  applyManagedFrontmatter(parsed.blocks, [[key, [`${key}:`, ...values.map((v) => `  - "${escapeYaml(sanitizeInline(v))}"`)]]]);
  return `---\n${parsed.blocks.flatMap((b) => b.lines).join("\n")}\n---${parsed.end}${parsed.rest}`;
}

/** Whether a note's frontmatter has the property `key`. */
export function hasFrontmatterKey(content: string, key: string): boolean {
  return !!parseFrontmatter(content)?.blocks.some((b) => b.key === key);
}

/**
 * Add tags to a note's `tags` property (skipping ones it already has, in any
 * case), writing it as a list. A note without frontmatter is returned unchanged.
 */
export function addFrontmatterTags(content: string, tags: string[]): string {
  const parsed = parseFrontmatter(content);
  if (!parsed) return content;
  const block = parsed.blocks.find((b) => b.key === "tags");
  const existing: string[] = [];
  if (block) {
    const inline = block.lines[0].replace(/^tags:\s*/, "").trim();
    if (inline) existing.push(...inline.replace(/^\[|\]$/g, "").split(/[,\s]+/).filter(Boolean));
    for (const line of block.lines.slice(1)) {
      const item = line.match(/^\s*-\s*(.+?)\s*$/)?.[1];
      if (item) existing.push(item);
    }
  }
  const bare = (t: string) => t.replace(/^["']|["']$/g, "").replace(/^#/, "").toLowerCase();
  const have = new Set(existing.map(bare));
  const added = tags.map((t) => t.replace(/^#/, "")).filter((t) => {
    if (!t || have.has(t.toLowerCase())) return false;
    have.add(t.toLowerCase());
    return true;
  });
  if (added.length === 0) return content;
  applyManagedFrontmatter(parsed.blocks, [["tags", ["tags:", ...[...existing, ...added].map((t) => `  - ${t}`)]]]);
  return `---\n${parsed.blocks.flatMap((b) => b.lines).join("\n")}\n---${parsed.end}${parsed.rest}`;
}

/** HTTPS join URL for the event's video meeting, if it has one. */
export function joinUrl(event: CalendarEvent): string | undefined {
  return meetingLink(event)?.url;
}

/**
 * Mark a note whose meeting is no longer in the calendar: `status: removed`
 * and a "Meeting removed from calendar" box. The next sync that sees the
 * meeting again restores both. Returns true if the note changed.
 */
export async function markNoteRemoved(app: App, file: TFile): Promise<boolean> {
  const mark = (content: string): string => {
    const parsed = parseFrontmatter(content);
    if (!parsed) return content;
    applyManagedFrontmatter(parsed.blocks, [["status", ["status: removed"]]]);
    const body = parsed.rest
      .split("\n")
      .map((line) => (DETAILS_CALLOUT_RE.test(line.replace(/\r$/, "")) ? "> [!danger] Meeting removed from calendar" : line))
      .join("\n");
    return `---\n${parsed.blocks.flatMap((b) => b.lines).join("\n")}\n---${parsed.end}${body}`;
  };

  const current = await app.vault.read(file);
  if (mark(current) === current) return false;
  await app.vault.process(file, mark);
  return true;
}

/** Calendar date (YYYY-MM-DD) used for the event's filename and `date` property. */
export function eventDate(event: CalendarEvent): string {
  return getEventTiming(event).date;
}

// ---------------------------------------------------------------------------
// File system helpers
// ---------------------------------------------------------------------------

/**
 * Generate a filesystem-safe filename for the meeting note.
 *
 * "before": `YYYY-MM-DD - Event Title`
 * "after":  `Event Title - YYYY-MM-DD`
 *
 * Characters forbidden by common file systems are replaced with hyphens.
 *
 * @param event        Calendar event.
 * @param datePosition Whether the date comes before or after the title.
 * @returns            Filename string without the `.md` extension.
 */
export function generateNoteFilename(
  event: CalendarEvent,
  datePosition: "before" | "after" = "before"
): string {
  return noteFilename(event.summary?.trim() || "Untitled Event", eventDate(event), datePosition);
}

/** A title with the characters file systems forbid replaced by hyphens. */
export function safeFilename(title: string): string {
  return title
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "") || "Untitled Event";
}

function noteFilename(title: string, date: string, datePosition: "before" | "after"): string {
  const safe = safeFilename(title);
  return datePosition === "after" ? `${safe} - ${date}` : `${date} - ${safe}`;
}

/** Return value of {@link createNoteFile}. */
export interface CreateNoteResult {
  file: TFile;
  wasCreated: boolean;
}

/**
 * Compute the vault file path that {@link createNoteFile} would use for a given event,
 * without creating or modifying any files. Useful for existence checks before calling
 * {@link createNoteFile}.
 */
export function resolveNoteFilePath(
  event: CalendarEvent,
  options: Pick<NoteOptions, "noteFolder" | "datePosition">
): string {
  const filename = generateNoteFilename(event, options.datePosition);
  const trimmedFolder = options.noteFolder.trim();
  const folderPath = trimmedFolder ? normalizePath(trimmedFolder) : "";
  return normalizePath(folderPath ? `${folderPath}/${filename}.md` : `${filename}.md`);
}

/**
 * Create a meeting-note file in the vault for the given event.
 *
 * Idempotent — if the file already exists it is returned unchanged.
 * The destination folder is created recursively if needed.
 *
 * @param app     The Obsidian `App` instance.
 * @param event   Calendar event to create a note for.
 * @param options Note content and location options.
 */
export async function createNoteFile(
  app: App,
  event: CalendarEvent,
  options: NoteOptions
): Promise<CreateNoteResult> {
  const content = createNoteContent(event, options);
  const filename = generateNoteFilename(event, options.datePosition);

  const trimmedFolder = options.noteFolder.trim();
  const folderPath = trimmedFolder ? normalizePath(trimmedFolder) : "";
  const filePath = normalizePath(
    folderPath ? `${folderPath}/${filename}.md` : `${filename}.md`
  );

  if (folderPath && !app.vault.getAbstractFileByPath(folderPath)) {
    await app.vault.createFolder(folderPath);
  }

  const existing = app.vault.getAbstractFileByPath(filePath);
  if (existing instanceof TFile) {
    return { file: existing, wasCreated: false };
  }

  const file = await app.vault.create(filePath, content);
  return { file, wasCreated: true };
}

/**
 * Every meeting note in the vault (a note with a `calendar_event_id`), with
 * its id as {@link findNotesByEventId} indexes it. Unlike that index, notes
 * sharing an id are all included, so lists and summaries never drop one.
 */
export function findMeetingNotes(app: App): Array<{ id: string; file: TFile }> {
  const notes: Array<{ id: string; file: TFile }> = [];
  for (const file of app.vault.getMarkdownFiles()) {
    const stored = app.metadataCache.getFileCache(file)?.frontmatter?.calendar_event_id;
    if (typeof stored === "string" && stored) notes.push({ id: canonicalEventId(stored), file });
  }
  return notes;
}

/**
 * Index every note in the vault by its `calendar_event_id` property, so notes
 * filed away from the note folder are still found. Ids saved with a moved
 * occurrence's "/RID=…" are indexed without it; if two notes end up with the
 * same id, the one whose saved id already matches wins. Notes kept by
 * {@link keepMovedNote} are left out: the meeting has moved on from them.
 */
export function findNotesByEventId(app: App): Map<string, TFile> {
  const byId = new Map<string, TFile>();
  const exact = new Set<string>();
  for (const file of app.vault.getMarkdownFiles()) {
    const fm = app.metadataCache.getFileCache(file)?.frontmatter;
    const stored = fm?.calendar_event_id;
    if (typeof stored !== "string" || !stored || fm?.moved_to) continue;
    const id = canonicalEventId(stored);
    if (exact.has(id) || (byId.has(id) && stored !== id)) continue;
    byId.set(id, file);
    if (stored === id) exact.add(id);
  }
  return byId;
}

/** Notes kept by {@link keepMovedNote}, by event id; the latest-dated one when there are several. */
export function findMovedNotes(app: App): Map<string, TFile> {
  const byId = new Map<string, { file: TFile; date: string }>();
  for (const file of app.vault.getMarkdownFiles()) {
    const fm = app.metadataCache.getFileCache(file)?.frontmatter;
    const stored = fm?.calendar_event_id;
    if (typeof stored !== "string" || !stored || !fm?.moved_to) continue;
    const id = canonicalEventId(stored);
    const date = frontmatterDay(fm.date) || frontmatterDay(fm.start);
    const known = byId.get(id);
    if (!known || date > known.date) byId.set(id, { file, date });
  }
  return new Map([...byId].map(([id, { file }]) => [id, file]));
}

function frontmatterDay(value: unknown): string {
  return value instanceof Date ? value.toISOString().slice(0, 10) : typeof value === "string" ? value.slice(0, 10) : "";
}

/**
 * True if the note's meeting had already started by `now` and the calendar
 * now has it on another day: the organizer moved an invite that took place,
 * so the note is a record of that day rather than of the new one.
 */
export function movedAfterItStarted(frontmatter: Record<string, unknown>, event: CalendarEvent, now: Date): boolean {
  const day = frontmatterDay(frontmatter.date) || frontmatterDay(frontmatter.start);
  if (!day || day === eventDate(event)) return false;
  const value = frontmatter.start ?? frontmatter.date;
  const start = value instanceof Date ? value : typeof value === "string" ? new Date(value.length === 10 ? `${value}T00:00` : value) : undefined;
  return !!start && !isNaN(start.getTime()) && start <= now;
}

/**
 * Stop syncing a note whose meeting was moved after it took place: set
 * `moved_to` to the meeting's new day and leave everything else as it is.
 */
export async function keepMovedNote(app: App, file: TFile, movedTo: string): Promise<void> {
  await app.vault.process(file, (content) => {
    const parsed = parseFrontmatter(content);
    if (!parsed) return content;
    applyManagedFrontmatter(parsed.blocks, [["moved_to", [`moved_to: ${movedTo}`]]]);
    return `---\n${parsed.blocks.flatMap((b) => b.lines).join("\n")}\n---${parsed.end}${parsed.rest}`;
  });
}

/**
 * Groups of two or more notes for the same meeting: the same
 * `calendar_event_id` and the same date. Notes of different occurrences of
 * a recurring meeting are never grouped, even if an older version of the
 * plugin saved them with one id.
 */
export function findDuplicateNotes(app: App): TFile[][] {
  const byId = new Map<string, TFile[]>();
  for (const file of app.vault.getMarkdownFiles()) {
    const fm = app.metadataCache.getFileCache(file)?.frontmatter;
    const stored = fm?.calendar_event_id;
    if (typeof stored !== "string" || !stored) continue;
    const key = `${canonicalEventId(stored)}|${frontmatterDay(fm?.date) || frontmatterDay(fm?.start)}`;
    byId.set(key, [...(byId.get(key) ?? []), file]);
  }
  return [...byId.values()].filter((files) => files.length > 1);
}

/** The series part of a recurring meeting's occurrence id (before the last `::`); undefined for one-off meetings. */
export function seriesId(eventId: string): string | undefined {
  const sep = eventId.lastIndexOf("::");
  return sep === -1 ? undefined : eventId.slice(0, sep);
}

/** Every series note in the vault, by its `series_id` property. */
export function findSeriesNotes(app: App): Map<string, TFile> {
  const byId = new Map<string, TFile>();
  for (const file of app.vault.getMarkdownFiles()) {
    const id = app.metadataCache.getFileCache(file)?.frontmatter?.series_id;
    if (typeof id === "string" && id && !byId.has(id)) byId.set(id, file);
  }
  return byId;
}

/** Options for {@link syncNoteFile}: the note sync options plus how it may rename the note. */
export type SyncFileOptions = SyncOptions & {
  datePosition?: "before" | "after";
  /** Rename the note, and its `# heading`, when the meeting's title changes. */
  renameOnTitleChange?: boolean;
};

export interface SyncFileResult {
  changed: boolean;
  /** Path of the note that stopped this one being renamed, because it has the new name. */
  blockedBy?: string;
}

const DATE_IN_NAME_RE = /\d{4}-\d{2}-\d{2}/;

function frontmatterTitle(content: string): string | undefined {
  const fm = parseFrontmatter(content);
  const line = fm?.blocks.find((b) => b.key === "title")?.lines[0];
  const m = line?.match(/^title:\s*(?:"((?:[^"\\]|\\.)*)"|(.*?))\s*$/);
  if (!m) return undefined;
  return (m[1] !== undefined ? m[1].replace(/\\(["\\])/g, "$1") : m[2]) || undefined;
}

function replaceHeading(content: string, oldTitle: string, newTitle: string): string {
  const lines = content.split("\n");
  const i = lines.findIndex((line) => line.replace(/\r$/, "") === `# ${oldTitle}`);
  if (i === -1) return content;
  lines[i] = `# ${newTitle}`;
  return lines.join("\n");
}

/**
 * The note's new basename, or undefined to keep it. The date in the filename
 * is compared with the meeting's (not the `date` property), so a rename that
 * was blocked once is retried. A filename the plugin generated from the old
 * title also takes the new title; one the user edited only gets its date changed.
 */
function renamedBasename(basename: string, event: CalendarEvent, oldTitle: string | undefined, options: SyncFileOptions): string | undefined {
  const dateInName = basename.match(DATE_IN_NAME_RE)?.[0];
  if (!dateInName) return undefined;
  const newDate = eventDate(event);
  const position = options.datePosition ?? "before";
  const target = options.renameOnTitleChange && oldTitle && basename === noteFilename(oldTitle, dateInName, position)
    ? noteFilename(noteTitle(event), newDate, position)
    : basename.replace(dateInName, newDate);
  return target === basename ? undefined : target;
}

/**
 * Update an existing note's calendar details from the event, and rename it if
 * the meeting moved to another day or (with `renameOnTitleChange`) was retitled.
 * A rename is skipped when another note already has the new name.
 */
export async function syncNoteFile(
  app: App,
  file: TFile,
  event: CalendarEvent,
  options: SyncFileOptions
): Promise<SyncFileResult> {
  let changed = false;
  const current = await app.vault.read(file);
  const oldTitle = frontmatterTitle(current);
  const newTitle = noteTitle(event);
  const update = (content: string) => {
    const updated = updateNoteContent(content, event, options);
    return options.renameOnTitleChange && oldTitle && oldTitle !== newTitle
      ? replaceHeading(updated, oldTitle, newTitle)
      : updated;
  };
  if (update(current) !== current) {
    await app.vault.process(file, update);
    changed = true;
  }

  const slash = file.path.lastIndexOf("/");
  const target = renamedBasename(file.path.slice(slash + 1).replace(/\.md$/, ""), event, oldTitle, options);
  if (!target) return { changed };
  const newPath = `${slash === -1 ? "" : file.path.slice(0, slash + 1)}${target}.md`;
  if (app.vault.getAbstractFileByPath(newPath)) return { changed, blockedBy: newPath };
  await app.fileManager.renameFile(file, newPath);
  return { changed: true };
}

/**
 * The note of the previous occurrence of a recurring meeting. Occurrence IDs
 * are `<series uid>::<original start, ISO UTC>`, so the previous one is the
 * note in the same series with the latest earlier start.
 */
export function previousNoteInSeries(notesById: Map<string, TFile>, eventId: string): TFile | undefined {
  const sep = eventId.lastIndexOf("::");
  if (sep === -1) return undefined;
  const series = eventId.slice(0, sep + 2);
  const occurrence = eventId.slice(sep + 2);
  let best: { occurrence: string; file: TFile } | undefined;
  for (const [id, file] of notesById) {
    if (!id.startsWith(series) || id.indexOf("::", series.length) !== -1) continue;
    const other = id.slice(series.length);
    if (other < occurrence && (!best || other > best.occurrence)) best = { occurrence: other, file };
  }
  return best?.file;
}

/** An unchecked task in a note, with its 0-based line number. */
export interface OpenTask {
  line: number;
  text: string;
}

const OPEN_TASK_RE = /^\s*[-*+] \[ \] (.*\S)\s*$/;

function tasksMatching(content: string, re: RegExp): OpenTask[] {
  const tasks: OpenTask[] = [];
  content.split("\n").forEach((line, i) => {
    const m = line.replace(/\r$/, "").match(re);
    if (m) tasks.push({ line: i, text: m[1] });
  });
  return tasks;
}

/** Unchecked, non-empty tasks (`- [ ] …`) in a note's content. */
export function openTasks(content: string): OpenTask[] {
  return tasksMatching(content, OPEN_TASK_RE);
}

const DONE_TASK_RE = /^\s*[-*+] \[[xX]\] (.*\S)\s*$/;

/** Ticked, non-empty tasks (`- [x] …`) in a note's content. */
export function doneTasks(content: string): OpenTask[] {
  return tasksMatching(content, DONE_TASK_RE);
}

/** Cancelled ("won't do"), non-empty tasks (`- [-] …`) in a note's content. */
export function cancelledTasks(content: string): OpenTask[] {
  return tasksMatching(content, /^\s*[-*+] \[-\] (.*\S)\s*$/);
}

/**
 * Note options for one event: its series note, if one exists, the link to
 * the previous meeting in its series that took place (cancelled, removed and
 * declined ones are skipped) and, when `withItems` is set (new notes), that
 * meeting's open action items and its continuity points.
 */
export async function seriesOptions(
  app: App,
  notesById: Map<string, TFile>,
  event: CalendarEvent,
  withItems: boolean,
  seriesNotes: Map<string, TFile> = findSeriesNotes(app)
): Promise<Pick<NoteOptions, "previousNote" | "seriesNote" | "carriedItems" | "carriedContinuity">> {
  const id = seriesId(event.id);
  const seriesNote = id ? seriesNotes.get(id)?.path.replace(/\.md$/, "") : undefined;
  const held = new Map(
    [...notesById].filter(([, file]) => !isSkippedStatus(app.metadataCache.getFileCache(file)?.frontmatter?.status))
  );
  const previous = previousNoteInSeries(held, event.id);
  if (!previous) return { seriesNote };
  return { ...(await previousNoteOptions(app, previous, withItems)), seriesNote };
}

/** `previous` as a new note's Previous meeting, with its open items and continuity carried over when `withItems`. */
export async function previousNoteOptions(
  app: App,
  previous: TFile,
  withItems: boolean
): Promise<Pick<NoteOptions, "previousNote" | "carriedItems" | "carriedContinuity">> {
  const content = withItems ? await app.vault.read(previous) : undefined;
  return {
    previousNote: previous.path.replace(/\.md$/, ""),
    carriedItems: content !== undefined ? openTasks(content).map((t) => t.text) : undefined,
    carriedContinuity: content !== undefined ? continuityItems(content) : undefined,
  };
}

/**
 * Link a meeting note to its series note: the `series` property and a
 * **Series:** line in the "Meeting details" box (after **Previous:**, or
 * after **When:**). A note without frontmatter is returned unchanged.
 */
export function setSeriesLink(content: string, seriesNote: string): string {
  const parsed = parseFrontmatter(content);
  if (!parsed) return content;
  const link = wikilink(previousLink(seriesNote) as DailyLink);
  applyManagedFrontmatter(parsed.blocks, [["series", [`series: "${escapeYaml(link)}"`]]]);

  const body = parsed.rest.split("\n");
  const start = body.findIndex((line) => DETAILS_CALLOUT_RE.test(line.replace(/\r$/, "")));
  if (start !== -1) {
    let end = start + 1;
    while (end < body.length && body[end].startsWith(">")) end++;
    const line = `> **Series:** ${link}`;
    const box = body.slice(start, end);
    const existing = box.findIndex((l) => l.startsWith("> **Series:**"));
    if (existing !== -1) {
      body[start + existing] = line;
    } else {
      const previous = box.findIndex((l) => l.startsWith("> **Previous:**"));
      const when = box.findIndex((l) => l.startsWith("> **When:**"));
      body.splice(start + Math.max(previous, when, 0) + 1, 0, line);
    }
  }
  return `---\n${parsed.blocks.flatMap((b) => b.lines).join("\n")}\n---${parsed.end}${body.join("\n")}`;
}
