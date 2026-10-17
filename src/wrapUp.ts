/**
 * @file wrapUp.ts
 * @description The end-of-day wrap-up: the user's items that slipped (due
 * today or overdue) and items added today without a due date, each with
 * one-click choices — done, tomorrow, next week, park, won't do — then
 * Prepare tomorrow.
 */

import { App, Modal, Setting } from "obsidian";
import { cancelTask, completeTask, isMine, parkTask, parseTaskMeta, rescheduleTask, type MeetingTasks, type TaskMeta } from "./actionItems";
import type { OpenTask } from "./noteCreator";
import { addDays } from "./tracker";

export interface WrapUpRow {
  meeting: MeetingTasks;
  task: OpenTask;
  meta: TaskMeta;
}

/** The user's open, unparked items that are due today or overdue, and those added today with no due date. */
export function wrapUpRows(meetings: MeetingTasks[], myNames: string[], today: string): { slipped: WrapUpRow[]; undated: WrapUpRow[] } {
  const rows = meetings.flatMap((meeting) => meeting.tasks.map((task) => ({ meeting, task, meta: parseTaskMeta(task.text) })))
    .filter((r) => !r.meta.parked && (myNames.length === 0 || isMine(r.meta, myNames)));
  return {
    slipped: rows.filter((r) => r.meta.due && r.meta.due <= today).sort((a, b) => a.meta.due!.localeCompare(b.meta.due!)),
    undated: rows.filter((r) => !r.meta.due && r.meta.created === today),
  };
}

/** The Monday after `date`. */
export function nextMonday(date: string): string {
  const day = new Date(`${date}T12:00:00`).getDay();
  return addDays(date, ((8 - day) % 7) || 7);
}

export class WrapUpModal extends Modal {
  constructor(
    app: App,
    private readonly rows: { slipped: WrapUpRow[]; undated: WrapUpRow[] },
    private readonly today: string,
    private readonly prepareTomorrow: () => Promise<void>
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText("Wrap up your day");
    this.render();
  }

  private render(): void {
    const el = this.contentEl;
    el.empty();
    el.addClass("cal-notes-wrap-up");
    const tomorrow = addDays(this.today, 1);
    const monday = nextMonday(this.today);
    const section = (heading: string, rows: WrapUpRow[], empty: string) => {
      el.createEl("h4", { text: `${heading} (${rows.length})` });
      if (rows.length === 0) {
        el.createDiv({ cls: "setting-item-description", text: empty });
        return;
      }
      for (const row of rows) {
        const setting = new Setting(el)
          .setName(row.meta.text)
          .setDesc([row.meeting.title, row.meta.due && (row.meta.due < this.today ? `overdue since ${row.meta.due}` : "due today")].filter(Boolean).join(" · "));
        const act = (label: string, tooltip: string, run: () => Promise<boolean>) =>
          setting.addButton((button) =>
            button.setButtonText(label).setTooltip(tooltip).onClick(async () => {
              await run();
              for (const list of [this.rows.slipped, this.rows.undated]) {
                const at = list.indexOf(row);
                if (at !== -1) list.splice(at, 1);
              }
              this.render();
            })
          );
        const file = row.meeting.file;
        act("Done", "Check it off", () => completeTask(this.app, file, row.task, this.today));
        act("Tomorrow", `Due ${tomorrow}`, () => rescheduleTask(this.app, file, row.task, tomorrow));
        act("Next week", `Due Monday ${monday}`, () => rescheduleTask(this.app, file, row.task, monday));
        act("Park", "Keep it for its account or series, off your lists", () => parkTask(this.app, file, row.task, true));
        act("Won't do", "Drop it", () => cancelTask(this.app, file, row.task, this.today));
      }
    };
    section("Slipped: due today or overdue", this.rows.slipped, "Nothing slipped. 🎉");
    section("Added today, no due date", this.rows.undated, "Everything added today has a date.");
    new Setting(el).addButton((button) =>
      button.setButtonText("Prepare tomorrow").setCta().onClick(async () => {
        button.setDisabled(true);
        await this.prepareTomorrow();
        this.close();
      })
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
