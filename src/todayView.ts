/**
 * @file todayView.ts
 * @description The "Today's meetings" sidebar view: every timed meeting on
 * one day's calendar (today by default; arrows step a day back or ahead),
 * with buttons to open (or create) its note and to join.
 */

import { App, ItemView, Modal, Setting, setIcon, WorkspaceLeaf } from "obsidian";
import type { CalendarEvent } from "./calendarApi";
import { joinUrl } from "./noteCreator";

export const TODAY_VIEW = "calendar-notes-today";

const RELOAD_MS = 5 * 60_000;
const TICK_MS = 60_000;

export type MeetingState = "done" | "now" | "upcoming";

export interface TodayRow {
  event: CalendarEvent;
  start: Date;
  end: Date;
  state: MeetingState;
}

/** Midnight at the start of the day `offset` days from `now`'s day. */
export function dayStart(now: Date, offset = 0): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
}

/** The day's timed, non-cancelled meetings in start order, marked done / now / upcoming. */
export function dayRows(events: CalendarEvent[], day: Date, now: Date): TodayRow[] {
  const dayEnd = dayStart(day, 1);
  const rows: TodayRow[] = [];
  for (const event of events) {
    if (event.cancelled || !event.start.dateTime) continue;
    const start = new Date(event.start.dateTime);
    const end = new Date(event.end.dateTime ?? event.start.dateTime);
    if (isNaN(start.getTime()) || start >= dayEnd || end <= day) continue;
    const state: MeetingState = end <= now ? "done" : start <= now ? "now" : "upcoming";
    rows.push({ event, start, end, state });
  }
  return rows.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * A meeting that isn't on the calendar, for a note made with the "New note"
 * button: 30 minutes on `day`, starting at the current time of day rounded
 * down to the quarter hour.
 */
export function adHocEvent(title: string, day: Date, now: Date): CalendarEvent {
  const start = new Date(day);
  start.setHours(now.getHours(), now.getMinutes() - (now.getMinutes() % 15), 0, 0);
  const end = new Date(start.getTime() + 30 * 60_000);
  return {
    id: `adhoc-${now.getTime()}`,
    summary: title,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    attendees: [],
  };
}

/** What the view needs from the plugin. */
export interface TodayHost {
  /** The meetings on the day starting at `day`, or null if the calendar couldn't be read. */
  loadDay(day: Date): Promise<CalendarEvent[] | null>;
  /** IDs of events that already have a note. */
  notedEventIds(): Set<string>;
  openNote(event: CalendarEvent): Promise<void>;
  /** Run a follow-up step on the meeting's note. */
  noteAction(event: CalendarEvent, action: NoteAction): Promise<void>;
  /** Open (or create) the recurring meeting's series note. */
  openSeries(event: CalendarEvent): Promise<void>;
}

export type NoteAction = "transcript" | "copy" | "reply";

/** Follow-up buttons on a meeting that has started: icon, label, action. */
const FOLLOW_UPS: Array<[string, string, NoteAction]> = [
  ["file-audio", "Import Krisp transcript", "transcript"],
  ["clipboard-copy", "Copy meeting for AI assistant", "copy"],
  ["clipboard-paste", "Add AI reply", "reply"],
];

class TitleModal extends Modal {
  constructor(app: App, private readonly onSubmit: (title: string) => void) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText("New meeting note");
    let title = "";
    const submit = () => {
      if (!title.trim()) return;
      this.close();
      this.onSubmit(title.trim());
    };
    new Setting(this.contentEl).setName("Title").addText((text) => {
      text.setPlaceholder("Meeting title").onChange((value) => (title = value));
      text.inputEl.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submit();
      });
      window.setTimeout(() => text.inputEl.focus());
    });
    new Setting(this.contentEl).addButton((button) => button.setButtonText("Create").setCta().onClick(submit));
  }

  onClose(): void {
    this.contentEl.empty();
  }
}

const clock = (date: Date) =>
  date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });

export class TodayView extends ItemView {
  private events: CalendarEvent[] | null = [];
  /** Days from today of the day shown. */
  private offset = 0;
  private loadedDay = dayStart(new Date());

  constructor(leaf: WorkspaceLeaf, private readonly host: TodayHost) {
    super(leaf);
  }

  getViewType(): string {
    return TODAY_VIEW;
  }

  getDisplayText(): string {
    return "Today's meetings";
  }

  getIcon(): string {
    return "calendar-clock";
  }

  async onOpen(): Promise<void> {
    this.registerInterval(window.setInterval(() => this.reload(), RELOAD_MS));
    this.registerInterval(window.setInterval(() => this.tick(), TICK_MS));
    this.registerEvent(this.app.vault.on("create", () => this.render()));
    this.registerEvent(this.app.vault.on("delete", () => this.render()));
    await this.reload();
  }

  async reload(): Promise<void> {
    const day = dayStart(new Date(), this.offset);
    const events = await this.host.loadDay(day);
    if (day.getTime() !== dayStart(new Date(), this.offset).getTime()) return;
    this.loadedDay = day;
    this.events = events;
    this.render();
  }

  /** Re-render each minute; reload when the shown day rolls over at midnight. */
  private tick(): void {
    if (dayStart(new Date(), this.offset).getTime() !== this.loadedDay.getTime()) void this.reload();
    else this.render();
  }

  private go(offset: number): void {
    this.offset = offset;
    void this.reload();
  }

  private newNote(): void {
    const day = this.loadedDay;
    new TitleModal(this.app, (title) => this.host.openNote(adHocEvent(title, day, new Date()))).open();
  }

  render(): void {
    const now = new Date();
    const day = this.loadedDay;
    const el = this.contentEl;
    el.empty();
    el.addClass("cal-notes-today");

    const header = el.createDiv({ cls: "cal-notes-header" });
    const nav = header.createDiv({ cls: "cal-notes-day-nav" });
    const back = nav.createEl("button", { text: "‹", attr: { "aria-label": "Previous day" } });
    back.addEventListener("click", () => this.go(this.offset - 1));
    nav.createEl("h4", {
      text: day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" }),
    });
    const ahead = nav.createEl("button", { text: "›", attr: { "aria-label": "Next day" } });
    ahead.addEventListener("click", () => this.go(this.offset + 1));

    const buttons = header.createDiv({ cls: "cal-notes-actions" });
    if (this.offset !== 0) {
      const today = buttons.createEl("button", { text: "Today" });
      today.addEventListener("click", () => this.go(0));
    }
    const create = buttons.createEl("button", { text: "New note", attr: { "aria-label": "New meeting note for this day" } });
    create.addEventListener("click", () => this.newNote());
    const refresh = buttons.createEl("button", { text: "Refresh" });
    refresh.addEventListener("click", () => this.reload());

    if (this.events === null) {
      el.createDiv({ cls: "cal-notes-empty", text: "Couldn't read your calendar. Check the plugin's settings." });
      return;
    }
    const rows = dayRows(this.events, day, now);
    if (rows.length === 0) {
      el.createDiv({ cls: "cal-notes-empty", text: this.offset === 0 ? "No meetings today." : "No meetings this day." });
      return;
    }

    const noted = this.host.notedEventIds();
    for (const row of rows) {
      const item = el.createDiv({ cls: `cal-notes-today-item is-${row.state}` });
      const when = item.createDiv({ cls: "cal-notes-meeting-date" });
      when.setText(`${clock(row.start)} – ${clock(row.end)}`);
      if (row.state === "now") when.createSpan({ cls: "cal-notes-badge", text: "Now" });

      const title = item.createEl("a", { cls: "cal-notes-meeting-title", text: row.event.summary?.trim() || "Untitled Event" });
      title.addEventListener("click", () => this.host.openNote(row.event));

      const actions = item.createDiv({ cls: "cal-notes-actions" });
      const hasNote = noted.has(row.event.id);
      const noteButton = actions.createEl("button", { text: hasNote ? "Open note" : "Create note" });
      noteButton.addEventListener("click", () => this.host.openNote(row.event));
      const url = joinUrl(row.event);
      if (url && row.state !== "done") {
        const join = actions.createEl("button", { cls: "mod-cta", text: "Join" });
        join.addEventListener("click", () => window.open(url));
      }
      if (row.event.id.includes("::")) {
        const series = actions.createEl("button", { cls: "clickable-icon cal-notes-icon-button", attr: { "aria-label": "Open series note" } });
        setIcon(series, "repeat");
        series.addEventListener("click", () => this.host.openSeries(row.event));
      }
      if (hasNote && row.state !== "upcoming") {
        for (const [icon, label, action] of FOLLOW_UPS) {
          const button = actions.createEl("button", { cls: "clickable-icon cal-notes-icon-button", attr: { "aria-label": label } });
          setIcon(button, icon);
          button.addEventListener("click", () => this.host.noteAction(row.event, action));
        }
      }
    }
  }
}
