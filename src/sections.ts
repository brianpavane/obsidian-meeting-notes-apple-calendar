/**
 * @file sections.ts
 * @description Read and fill the `## Heading` sections of a meeting note.
 */

const HEADING_RE = /^(#{1,6})\s+(.+?)\s*#*\s*$/;
/** Blank lines and the empty `- ` / `- [ ] ` bullets a new note starts with. */
const PLACEHOLDER_RE = /^\s*(?:[-*+](?:\s+\[ \])?)?\s*$/;
const LIST_RE = /^\s*(?:[-*+]|\d+\.)\s/;

interface Section {
  start: number;
  end: number;
}

function bodyStart(lines: string[]): number {
  if (lines[0]?.replace(/\r$/, "") !== "---") return 0;
  const close = lines.findIndex((l, i) => i > 0 && l.replace(/\r$/, "") === "---");
  return close === -1 ? 0 : close + 1;
}

function findSection(lines: string[], names: string[]): Section | undefined {
  const wanted = names.map((n) => n.toLowerCase());
  for (let i = bodyStart(lines); i < lines.length; i++) {
    const m = lines[i].replace(/\r$/, "").match(HEADING_RE);
    if (!m || !wanted.includes(m[2].toLowerCase())) continue;
    let end = i + 1;
    while (end < lines.length) {
      const next = lines[end].replace(/\r$/, "").match(HEADING_RE);
      if (next && next[1].length <= m[1].length) break;
      end++;
    }
    return { start: i, end };
  }
  return undefined;
}

function trimBlank(lines: string[]): string[] {
  let a = 0;
  let b = lines.length;
  while (a < b && !lines[a].trim()) a++;
  while (b > a && !lines[b - 1].trim()) b--;
  return lines.slice(a, b);
}

/** The section's text without empty placeholder bullets; "" if the note has no such section. */
export function sectionText(content: string, names: string[]): string {
  const lines = content.split("\n");
  const section = findSection(lines, names);
  if (!section) return "";
  return trimBlank(lines.slice(section.start + 1, section.end).filter((l) => !l.trim() || !PLACEHOLDER_RE.test(l)))
    .join("\n")
    .trim();
}

/** The section's non-blank lines (placeholders included); empty if the note has no such section. */
export function sectionLines(content: string, names: string[]): string[] {
  const lines = content.split("\n");
  const section = findSection(lines, names);
  return section ? lines.slice(section.start + 1, section.end).filter((l) => l.trim()) : [];
}

const CONTINUITY_RE = /^\s*(?:#{1,6}\s+)?\**\s*core elements for next meeting continuity\s*:?\s*\**\s*:?\s*$/i;

/**
 * The bullets under the note's "Core Elements for Next Meeting Continuity"
 * label (written in the Executive Summary by the AI agent), as plain text.
 */
export function continuityItems(content: string): string[] {
  const lines = content.split("\n").map((l) => l.replace(/\r$/, ""));
  const at = lines.slice(bodyStart(lines)).findIndex((l) => CONTINUITY_RE.test(l));
  if (at === -1) return [];
  const items: string[] = [];
  for (const line of lines.slice(bodyStart(lines) + at + 1)) {
    if (!line.trim()) continue;
    if (!/^(?:[-*+]|\d+[.)])\s/.test(line)) break;
    const text = line.replace(/^(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/, "").trim();
    if (text) items.push(text);
  }
  return items;
}

/** Replace a section's contents; a missing section is created as in {@link appendToSection}. */
export function replaceSection(content: string, names: string[], body: string[], beforeNames: string[] = []): string {
  return writeSection(content, names, body, beforeNames, true);
}

/**
 * Add lines to the end of a section, dropping its empty placeholder bullets.
 * A missing section is created as `## <first name>`, before the first
 * `beforeNames` section that exists, or at the end of the note.
 */
export function appendToSection(content: string, names: string[], add: string[], beforeNames: string[] = []): string {
  return writeSection(content, names, add, beforeNames, false);
}

function writeSection(content: string, names: string[], add: string[], beforeNames: string[], replace: boolean): string {
  const lines = content.split("\n");
  const section = findSection(lines, names);
  if (!section) {
    const before = findSection(lines, beforeNames);
    const block = [`## ${names[0]}`, "", ...add, ""];
    if (before) return [...lines.slice(0, before.start), ...block, ...lines.slice(before.start)].join("\n");
    let end = lines.length;
    while (end > 0 && !lines[end - 1].trim()) end--;
    return [...lines.slice(0, end), "", ...block].join("\n");
  }
  const kept = replace
    ? []
    : trimBlank(lines.slice(section.start + 1, section.end).filter((l) => !l.trim() || !PLACEHOLDER_RE.test(l)));
  const gap = kept.length > 0 && !(LIST_RE.test(kept[kept.length - 1]) && LIST_RE.test(add[0] ?? "")) ? [""] : [];
  return [
    ...lines.slice(0, section.start + 1),
    "",
    ...kept,
    ...gap,
    ...add,
    "",
    ...lines.slice(section.end),
  ].join("\n");
}
