/**
 * @file dashboard.ts
 * @description Contents of the meetings dashboard, an Obsidian Bases file
 * listing every note the plugin manages.
 */

export const DASHBOARD_FILENAME = "Meetings.base";

export const DASHBOARD_CONTENT = `filters:
  and:
    - 'file.hasProperty("calendar_event_id")'
views:
  - type: table
    name: Next 7 days
    filters:
      and:
        - 'note.start >= today()'
        - 'note.start < today() + "7d"'
    order:
      - file.name
      - note.start
      - note.location
      - note.attendees
      - note.calendar
    groupBy:
      property: note.date
      direction: ASC
  - type: table
    name: Last 7 days
    filters:
      and:
        - 'note.start < now()'
        - 'note.start >= today() - "7d"'
    order:
      - file.name
      - note.start
      - note.attendees
      - note.calendar
    groupBy:
      property: note.date
      direction: DESC
  - type: table
    name: By account
    filters:
      and:
        - 'file.hasProperty("account")'
    order:
      - file.name
      - note.start
      - note.meeting_category
      - note.attendees
    groupBy:
      property: note.account
      direction: ASC
  - type: table
    name: By category
    filters:
      and:
        - 'file.hasProperty("meeting_category")'
    order:
      - file.name
      - note.start
      - note.account
      - note.attendees
    groupBy:
      property: note.meeting_category
      direction: ASC
  - type: table
    name: Customer meetings
    filters:
      and:
        - 'note.meeting_category == "Customer"'
    order:
      - file.name
      - note.start
      - note.sentiment
      - note.outcome
      - note.key_topics
    groupBy:
      property: note.account
      direction: ASC
  - type: table
    name: By sentiment
    filters:
      and:
        - 'file.hasProperty("sentiment")'
    order:
      - file.name
      - note.start
      - note.account
      - note.outcome
      - note.key_topics
    groupBy:
      property: note.sentiment
      direction: ASC
  - type: table
    name: By outcome
    filters:
      and:
        - 'file.hasProperty("outcome")'
    order:
      - file.name
      - note.start
      - note.account
      - note.sentiment
      - note.key_topics
    groupBy:
      property: note.outcome
      direction: ASC
  - type: table
    name: Needs AI summary
    filters:
      and:
        - 'note.start < now()'
        - 'note.start >= today() - "14d"'
        - '!file.hasProperty("ai_summarized")'
        - '!file.hasProperty("status")'
    order:
      - file.name
      - note.start
      - note.krisp_recording
      - note.attendees
    groupBy:
      property: note.date
      direction: DESC
  - type: table
    name: AI-summarized
    filters:
      and:
        - 'file.hasProperty("ai_summarized")'
    order:
      - file.name
      - note.start
      - note.account
      - note.meeting_category
      - note.sentiment
      - note.outcome
      - note.key_topics
      - note.organizations
      - note.speakers
    groupBy:
      property: note.date
      direction: DESC
  - type: table
    name: All meetings
    order:
      - file.name
      - note.start
      - note.organizer
      - note.attendees
      - note.calendar
      - note.status
    groupBy:
      property: note.date
      direction: DESC
`;

const VIEW_START = /^ {2}- type: /;

/** The built-in dashboard's views as YAML blocks, by name. */
function builtInViews(): Map<string, string[]> {
  const lines = DASHBOARD_CONTENT.split("\n");
  const views = new Map<string, string[]>();
  let current: string[] | undefined;
  for (const line of lines.slice(lines.indexOf("views:") + 1)) {
    if (VIEW_START.test(line)) {
      current = [line];
      continue;
    }
    if (!current || !line.trim()) continue;
    current.push(line);
    const name = line.match(/^ {4}name: (.+)$/)?.[1];
    if (name) views.set(name, current);
  }
  return views;
}

export const DASHBOARD_VIEW_NAMES = [...builtInViews().keys()];

/**
 * Add the built-in views a dashboard file doesn't have yet (matched by
 * name), except those in `skip`, to the end of its views. A file whose last
 * top-level key isn't `views:` is returned unchanged, so a hand-edited
 * layout is never broken.
 */
export function addMissingViews(content: string, skip: Iterable<string> = []): string {
  const keys = content.split("\n").filter((l) => /^[A-Za-z_]+:/.test(l));
  if (keys[keys.length - 1]?.trim() !== "views:") return content;
  const have = new Set([...content.matchAll(/^\s+name:\s*["']?(.+?)["']?\s*$/gm)].map((m) => m[1]).concat([...skip]));
  const missing = [...builtInViews()].filter(([name]) => !have.has(name)).flatMap(([, block]) => block);
  return missing.length > 0 ? `${content.replace(/\s*$/, "")}\n${missing.join("\n")}\n` : content;
}
