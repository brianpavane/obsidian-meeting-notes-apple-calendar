/**
 * @file krisp.ts
 * @description Read Krisp recordings from disk and match them to meetings.
 *
 * Krisp saves each recording in its own folder, named "<title> - October 6,
 * 2026 2-30-24 PM", with a `transcript.txt` (or `.md`) that starts with a
 * short header followed by blank lines and the transcript:
 *
 *   Zoom meeting - October 6, 2026 2-30-24 PM
 *   October 6, 2026 2:30:24 PM
 *   30m 9s
 */

import { App, FuzzySuggestModal, Modal, Setting } from "obsidian";
import { promises as fs, Stats } from "fs";
import { homedir } from "os";
import { join } from "path";

const TRANSCRIPT_FILES = ["transcript.txt", "transcript.md"];
/** The " - October 6, 2026 2-30-24 PM" Krisp adds to titles and folder names. */
const STAMP_RE = /\s+-\s+([A-Za-z]+ \d{1,2}, \d{4}) (\d{1,2})-(\d{2})-(\d{2}) ([AP]M)\s*$/i;
const HEADER_BYTES = 2_048;
/** Earliest a recording can start before the meeting and still be offered. */
const EARLIEST_MS = 10 * 60_000;
/** The usual join window: 2 minutes early to 7 minutes late. */
const JOIN_EARLY_MS = 2 * 60_000;
const JOIN_LATE_MS = 7 * 60_000;
/** Length assumed for a meeting note without an end time. */
const DEFAULT_LENGTH_MS = 30 * 60_000;

export interface KrispHeader {
  title: string;
  start?: Date;
  /** Number of lines before the transcript itself. */
  headerLines: number;
}

export interface Recording {
  /** The recording's folder name. */
  name: string;
  path: string;
  title: string;
  /** Start time from the header, else the folder name, else when the transcript file was created. */
  time: Date;
}

export interface MeetingTime {
  title: string;
  start: Date;
  end: Date;
}

function stripLabel(line: string): string {
  return line.replace(/^[A-Za-z][A-Za-z ]{0,19}:\s+(?=\S)/, "").trim();
}

function parseDateLine(line: string): Date | undefined {
  const value = stripLabel(line).replace(/\s+at\s+/i, " ").replace(/(\d)\s*([ap]m)\b/i, "$1 $2");
  if (!/\d{1,2}:\d{2}/.test(value) || !/\d{4}/.test(value)) return undefined;
  const date = new Date(value);
  return isNaN(date.getTime()) ? undefined : date;
}

/** A title or folder name without Krisp's date stamp, and the time in that stamp. */
export function splitStamp(name: string): { title: string; time?: Date } {
  const m = name.match(STAMP_RE);
  if (!m) return { title: name.trim() };
  const time = new Date(`${m[1]} ${m[2]}:${m[3]}:${m[4]} ${m[5]}`);
  return { title: name.slice(0, m.index).trim(), time: isNaN(time.getTime()) ? undefined : time };
}

/** Title and start time from the top of a transcript; the header ends at the first blank line (at most 3 lines). */
export function parseKrispHeader(text: string): KrispHeader {
  const lines = text.split(/\r?\n/);
  let headerLines = 0;
  while (headerLines < 3 && headerLines < lines.length && lines[headerLines].trim()) headerLines++;
  const header = lines.slice(0, headerLines);
  const start = header.map(parseDateLine).find((d) => d !== undefined);
  const titleLine = header.find((l) => parseDateLine(l) === undefined);
  return { title: titleLine ? splitStamp(stripLabel(titleLine)).title : "", start, headerLines };
}

/** The transcript without its header, ready for a note: lines that would read as Markdown headings are escaped. */
export function transcriptBody(text: string): string[] {
  const { headerLines } = parseKrispHeader(text);
  const lines = text.split(/\r?\n/).slice(headerLines);
  while (lines.length > 0 && !lines[0].trim()) lines.shift();
  while (lines.length > 0 && !lines[lines.length - 1].trim()) lines.pop();
  return lines.map((l) => l.replace(/^(\s*)#/, "$1\\#"));
}

export function expandHome(path: string): string {
  return path.trim().replace(/^~(?=$|\/)/, homedir());
}

async function readHead(path: string): Promise<string> {
  const handle = await fs.open(path, "r");
  try {
    const buffer = Buffer.alloc(HEADER_BYTES);
    const { bytesRead } = await handle.read(buffer, 0, HEADER_BYTES, 0);
    return buffer.toString("utf8", 0, bytesRead);
  } finally {
    await handle.close();
  }
}

/** Recordings in the Krisp folder (one subfolder each), newest first; only those changed since `since` if given. */
export async function listRecordings(folder: string, since?: Date): Promise<Recording[]> {
  const root = expandHome(folder);
  const recordings: Recording[] = [];
  for (const entry of await fs.readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    let found: { path: string; stat: Stats } | undefined;
    for (const file of TRANSCRIPT_FILES) {
      const path = join(root, entry.name, file);
      const stat = await fs.stat(path).catch(() => undefined);
      if (stat?.isFile()) {
        found = { path, stat };
        break;
      }
    }
    if (!found || (since && found.stat.mtime < since)) continue;
    const header = parseKrispHeader(await readHead(found.path));
    const folder = splitStamp(entry.name);
    recordings.push({
      name: entry.name,
      path: found.path,
      title: header.title || folder.title,
      time: header.start ?? folder.time ?? found.stat.birthtime,
    });
  }
  return recordings.sort((a, b) => b.time.getTime() - a.time.getTime());
}

const normalize = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

/**
 * Recordings that could be the meeting's, best first: started from 10 minutes
 * before the meeting until it ends, ranked by matching title, then a start
 * from 2 minutes before to 7 minutes after the meeting's (the usual join
 * time), then the closest start.
 */
export function candidateRecordings(recordings: Recording[], meeting: MeetingTime): Recording[] {
  const start = meeting.start.getTime();
  const end = Math.max(meeting.end.getTime(), start + DEFAULT_LENGTH_MS);
  const title = normalize(meeting.title);
  const titleMatches = (r: Recording) => {
    const other = normalize(r.title);
    return !!title && !!other && (other.includes(title) || title.includes(other));
  };
  const offset = (r: Recording) => r.time.getTime() - start;
  const onTime = (r: Recording) => offset(r) >= -JOIN_EARLY_MS && offset(r) <= JOIN_LATE_MS;
  return recordings
    .filter((r) => offset(r) >= -EARLIEST_MS && r.time.getTime() < end)
    .sort((a, b) =>
      Number(titleMatches(b)) - Number(titleMatches(a)) ||
      Number(onTime(b)) - Number(onTime(a)) ||
      Math.abs(offset(a)) - Math.abs(offset(b)));
}

export async function readTranscript(recording: Recording): Promise<string[]> {
  return transcriptBody(await fs.readFile(recording.path, "utf8"));
}

export function recordingLabel(recording: Recording): string {
  const when = recording.time.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
  return `${recording.title} — ${when}`;
}

/** A meeting note waiting for its transcript, and the recordings that could be it. */
export interface TranscriptProposal<F> {
  file: F;
  meeting: MeetingTime;
  candidates: Recording[];
}

/**
 * The recording to preselect for each proposal: its best candidate not
 * already preselected for an earlier one (so double-booked meetings don't
 * both get the same recording), or undefined.
 */
export function preselect<F>(proposals: TranscriptProposal<F>[]): Array<Recording | undefined> {
  const taken = new Set<string>();
  return proposals.map((p) => {
    const choice = p.candidates.find((r) => !taken.has(r.name));
    if (choice) taken.add(choice.name);
    return choice;
  });
}

/** Pick any recording by hand. */
export class RecordingSuggestModal extends FuzzySuggestModal<Recording> {
  constructor(app: App, private readonly recordings: Recording[], private readonly onChoose: (r: Recording) => void) {
    super(app);
    this.setPlaceholder("Choose the Krisp recording for this meeting");
  }

  getItems(): Recording[] {
    return this.recordings;
  }

  getItemText(recording: Recording): string {
    return recordingLabel(recording);
  }

  onChooseItem(recording: Recording): void {
    this.onChoose(recording);
  }
}

const SKIP = "";

/**
 * Ask before importing: each meeting with a dropdown of its candidate
 * recordings (best preselected) or "Don't import". Nothing is written until
 * Import is clicked.
 */
export class TranscriptConfirmModal<F> extends Modal {
  private readonly choices: Array<string>;
  private decided = false;

  constructor(
    app: App,
    private readonly proposals: TranscriptProposal<F>[],
    private readonly onImport: (picks: Array<{ file: F; recording: Recording }>) => void,
    private readonly onDismiss: (files: F[]) => void,
    private readonly onChooseOther?: () => void
  ) {
    super(app);
    this.choices = preselect(proposals).map((r) => r?.name ?? SKIP);
  }

  onOpen(): void {
    const { contentEl } = this;
    this.titleEl.setText(this.proposals.length === 1 ? "Import Krisp transcript?" : "Import Krisp transcripts?");
    contentEl.createEl("p", { text: "Check each meeting's recording. Nothing is imported until you click Import." });

    this.proposals.forEach((proposal, i) => {
      const when = `${proposal.meeting.start.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}`;
      new Setting(contentEl)
        .setName(proposal.meeting.title)
        .setDesc(when)
        .addDropdown((drop) => {
          for (const r of proposal.candidates) drop.addOption(r.name, recordingLabel(r));
          drop.addOption(SKIP, "Don't import");
          drop.setValue(this.choices[i]).onChange((value) => (this.choices[i] = value));
        });
    });

    const buttons = new Setting(contentEl);
    if (this.onChooseOther) {
      buttons.addButton((b) => b.setButtonText("Choose another recording…").onClick(() => {
        this.decided = true;
        this.close();
        this.onChooseOther?.();
      }));
    }
    buttons
      .addButton((b) => b.setButtonText("Not now").onClick(() => this.close()))
      .addButton((b) => b.setButtonText("Import").setCta().onClick(() => {
        this.decided = true;
        this.close();
        const picks: Array<{ file: F; recording: Recording }> = [];
        const skipped: F[] = [];
        this.proposals.forEach((p, i) => {
          const recording = p.candidates.find((r) => r.name === this.choices[i]);
          if (recording) picks.push({ file: p.file, recording });
          else skipped.push(p.file);
        });
        if (skipped.length > 0) this.onDismiss(skipped);
        this.onImport(picks);
      }));
  }

  onClose(): void {
    this.contentEl.empty();
    if (!this.decided) this.onDismiss(this.proposals.map((p) => p.file));
  }
}
