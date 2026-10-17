/**
 * @file capture.ts
 * @description "Add tasks from a message": paste an email or chat thread,
 * copy it with instructions for an AI assistant, then paste the assistant's
 * list of action items back to add them to My To-Dos. The plugin never
 * contacts any AI service itself.
 */

import { App, Modal, Notice, Setting } from "obsidian";
import { captureInstructions, nextStepsIn, type ActionItem } from "./assistant";
import type { TodoSource } from "./todos";

export class CaptureModal extends Modal {
  private message = "";
  private reply = "";
  private from: TodoSource = "email";

  constructor(
    app: App,
    private readonly me: string | undefined,
    private readonly today: string,
    private readonly onAdd: (items: ActionItem[], from: TodoSource) => Promise<void>
  ) {
    super(app);
  }

  onOpen(): void {
    this.titleEl.setText("Add tasks from a message");
    const el = this.contentEl;
    new Setting(el).setName("From").addDropdown((dropdown) => {
      dropdown.addOption("email", "Email").addOption("chat", "Slack or Teams").setValue(this.from);
      dropdown.onChange((value) => (this.from = value as TodoSource));
    });

    el.createEl("p", { cls: "setting-item-description", text: "1. Paste the email or chat thread, then copy it for your AI assistant." });
    const message = el.createEl("textarea", { cls: "cal-notes-capture", attr: { rows: "6", placeholder: "Paste the message here…" } });
    message.addEventListener("input", () => (this.message = message.value));
    new Setting(el).addButton((button) =>
      button.setButtonText("Copy for AI").onClick(async () => {
        if (!this.message.trim()) {
          new Notice("Calendar Notes: Paste the message first.");
          return;
        }
        await navigator.clipboard.writeText(`${captureInstructions(this.me, this.today)}\n\nMESSAGE\n${this.message.trim()}`);
        new Notice("Calendar Notes: Copied. Paste it into your AI assistant, then paste its reply below.");
      })
    );

    el.createEl("p", { cls: "setting-item-description", text: "2. Paste the assistant's reply, then add the tasks to My To-Dos." });
    const reply = el.createEl("textarea", { cls: "cal-notes-capture", attr: { rows: "6", placeholder: "- [ ] **[[Full Name]]**: What needs doing (2026-10-15, High)" } });
    reply.addEventListener("input", () => (this.reply = reply.value));
    new Setting(el).addButton((button) =>
      button.setButtonText("Add tasks").setCta().onClick(async () => {
        const items = nextStepsIn(this.reply);
        if (items.length === 0) {
          new Notice("Calendar Notes: No tasks found in the reply. It needs lines like - [ ] **[[Name]]**: Task.");
          return;
        }
        await this.onAdd(items, this.from);
        this.close();
      })
    );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
