/**
 * @file settings.ts
 * @description Plugin settings interface, defaults, and the Obsidian settings
 * tab UI for Meeting Notes for Apple Calendar.
 *
 * Supports three authentication modes:
 *   - "apple" — Apple Calendar on macOS via EventKit (primary, no auth required)
 *   - "ical"  — iCal secret URL (deprecated)
 *   - "oauth" — Google OAuth 2.0 via REST API (deprecated)
 */

import {
  AbstractInputSuggest,
  App,
  Modal,
  Notice,
  PluginSettingTab,
  Setting,
  TextAreaComponent,
  TFile,
  TFolder,
  ToggleComponent,
} from "obsidian";
import type GoogleCalendarPlugin from "./main";
import { IcalCalendarApi, GoogleCalendarApi } from "./calendarApi";
import { GoogleAuth } from "./googleAuth";
import { encrypt, decrypt } from "./secureStorage";
import { listAppleCalendars, runAppleCalendarDiagnostic } from "./appleCalendarApi";
import { ALL_SECTIONS, NoteSections } from "./noteCreator";
import { DEFAULT_INSTRUCTIONS } from "./assistant";
import { singleWordNames } from "./actionItems";

// ---------------------------------------------------------------------------
// Settings interface & defaults
// ---------------------------------------------------------------------------

export interface GoogleCalendarSettings {
  authMode: "ical" | "oauth" | "apple";
  icalUrl: string;
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string;
  tokenExpiry: number;
  calendarId: string;
  appleCalendars: string;
  selfEmail: string;
  /** Comma-separated names the user is written as in action items. */
  myNames: string;
  noteFolder: string;
  /** Folder for the Meeting Tracker, dashboard and weekly reviews; empty = the note folder. */
  hubFolder: string;
  hoursInAdvance: number;
  pollIntervalMinutes: number;
  includePastEvents: boolean;
  daysBack: number;
  includeEventNotes: boolean;
  linkAttendees: boolean;
  dailyNoteLink: boolean;
  showStatusBar: boolean;
  /** Open the Today's meetings panel in the right sidebar when Obsidian starts, if it isn't open. */
  openTodayOnStartup: boolean;
  /** Vault path of a template note; empty = built-in template. */
  templatePath: string;
  datePosition: "before" | "after";
  daysAhead: number;
  /** Days ahead to keep existing notes in sync (renamed when moved, updated when changed). */
  syncDaysAhead: number;
  /** Rename a note, and its heading, when its meeting's title changes. */
  renameOnTitleChange: boolean;
  maxEvents: number;
  /** IDs of events that have already been processed (note created or skipped). */
  processedEventIds: string[];
  /** Plugin version of the last completed startup sweep; a change triggers a rebuild. */
  lastRunVersion: string;
  /** Prepare the day (My Day, meeting notes and briefs, Daily Briefing) each night at `prepTime`. */
  prepEnabled: boolean;
  /** "HH:MM", 24-hour. */
  prepTime: string;
  /** When the day was last prepared (ISO time); empty = never. */
  lastPreparedAt: string;
  /** Folder outside the vault (e.g. a Google Drive folder) to copy the Daily Briefing to; empty = don't copy. */
  briefingFolder: string;
  /** Minutes before a meeting to notify; 0 = off. */
  notifyBeforeMinutes: number;
  /** Notify after a meeting ends to import the transcript and add the AI reply. */
  notifyAfterMeeting: boolean;
  /** "HH:MM" for the morning summary notification; empty = off. */
  morningReminderTime: string;
  /** The day (YYYY-MM-DD) of the last morning summary. */
  lastMorningReminder: string;
  /** "HH:MM" for the wrap-up reminder; empty = off. */
  wrapUpReminderTime: string;
  /** The day (YYYY-MM-DD) of the last wrap-up reminder. */
  lastWrapUpReminder: string;
  /** Sections of the built-in note format (ignored when a template file is set). */
  noteSections: NoteSections;
  /** Title fragments (one per line) of meetings that never get a note automatically. */
  skipTitles: string;
  /** Don't create notes automatically for events with no other attendees. */
  skipSolo: boolean;
  /** Folder Krisp saves recordings in (one subfolder per recording). */
  krispFolder: string;
  /** Offer Krisp transcripts for recent meetings after every sync (always confirmed). */
  krispAutoImport: boolean;
  /** Put the instructions in front of the meeting when copying it for an AI assistant. */
  aiIncludeInstructions: boolean;
  /** Instructions for the AI assistant; empty = the built-in instructions. */
  aiInstructions: string;
  /** Save the Meeting Metadata, speakers and filing date of an AI reply as note properties. */
  aiSaveProperties: boolean;
  /** Built-in dashboard views already offered in Meetings.base; never added again, so a deleted one stays deleted. */
  dashboardViewsAdded: string[];
}

export const DEFAULT_SETTINGS: GoogleCalendarSettings = {
  authMode: "apple",
  icalUrl: "",
  clientId: "",
  clientSecret: "",
  accessToken: "",
  refreshToken: "",
  tokenExpiry: 0,
  calendarId: "primary",
  appleCalendars: "",
  selfEmail: "",
  myNames: "",
  noteFolder: "Meeting Notes",
  hubFolder: "",
  hoursInAdvance: 12,
  pollIntervalMinutes: 30,
  includePastEvents: false,
  daysBack: 1,
  includeEventNotes: true,
  linkAttendees: false,
  dailyNoteLink: true,
  showStatusBar: true,
  openTodayOnStartup: true,
  templatePath: "",
  datePosition: "before",
  daysAhead: 7,
  syncDaysAhead: 30,
  renameOnTitleChange: true,
  maxEvents: 20,
  processedEventIds: [],
  lastRunVersion: "",
  prepEnabled: true,
  prepTime: "00:30",
  lastPreparedAt: "",
  briefingFolder: "",
  notifyBeforeMinutes: 5,
  notifyAfterMeeting: true,
  morningReminderTime: "08:30",
  lastMorningReminder: "",
  wrapUpReminderTime: "17:30",
  lastWrapUpReminder: "",
  noteSections: { ...ALL_SECTIONS },
  skipTitles: "",
  skipSolo: false,
  krispFolder: "~/Documents/Transcripts/Krisp Meetings",
  krispAutoImport: false,
  aiIncludeInstructions: true,
  aiInstructions: "",
  aiSaveProperties: true,
  dashboardViewsAdded: [],
};

// ---------------------------------------------------------------------------
// Folder suggest
// ---------------------------------------------------------------------------

class FolderSuggest extends AbstractInputSuggest<TFolder> {
  private el: HTMLInputElement;

  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
    this.el = inputEl;
  }

  getSuggestions(query: string): TFolder[] {
    return this.app.vault
      .getAllLoadedFiles()
      .filter((f): f is TFolder => f instanceof TFolder)
      .filter((f) => f.path.toLowerCase().includes(query.toLowerCase()));
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.setText(folder.path);
  }

  selectSuggestion(folder: TFolder): void {
    this.setValue(folder.path);
    this.el.dispatchEvent(new Event("input"));
    this.close();
  }
}

class FileSuggest extends AbstractInputSuggest<TFile> {
  private el: HTMLInputElement;

  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
    this.el = inputEl;
  }

  getSuggestions(query: string): TFile[] {
    return this.app.vault
      .getMarkdownFiles()
      .filter((f) => f.path.toLowerCase().includes(query.toLowerCase()));
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.setText(file.path);
  }

  selectSuggestion(file: TFile): void {
    this.setValue(file.path);
    this.el.dispatchEvent(new Event("input"));
    this.close();
  }
}

// ---------------------------------------------------------------------------
// Settings tab UI
// ---------------------------------------------------------------------------

export class GoogleCalendarSettingTab extends PluginSettingTab {
  plugin: GoogleCalendarPlugin;

  constructor(app: App, plugin: GoogleCalendarPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Meeting Notes for Apple Calendar" });

    const versionEl = containerEl.createEl("p", {
      text: `Version ${this.plugin.manifest.version} — built ${__BUILD_DATE__}`,
    });
    versionEl.style.color = "var(--text-muted)";
    versionEl.style.fontSize = "var(--font-smaller)";
    versionEl.style.marginTop = "-8px";

    // ----- Connection Method ------------------------------------------------
    containerEl.createEl("h3", { text: "Connection Method" });

    new Setting(containerEl)
      .setName("Calendar source")
      .setDesc(
        "Apple Calendar reads directly from Calendar.app on this Mac and is the supported source. " +
          "iCal URL and Google Account still work but are deprecated and may be removed in a future release."
      )
      .addDropdown((drop) => {
        drop.addOption("apple", "Apple Calendar — this Mac (recommended)");
        drop.addOption("ical", "iCal URL (deprecated)");
        drop.addOption("oauth", "Google Account (deprecated)");
        drop.setValue(this.plugin.settings.authMode);
        drop.onChange(async (value: string) => {
          this.plugin.settings.authMode = value as "ical" | "oauth" | "apple";
          await this.plugin.saveSettings();
          this.display();
        });
      });

    if (this.plugin.settings.authMode !== "apple") {
      const deprecatedEl = containerEl.createEl("p", {
        text: "⚠ This calendar source is deprecated. Switch to Apple Calendar to keep receiving fixes.",
      });
      deprecatedEl.style.color = "var(--text-warning)";
    }

    // ----- iCal Section -----------------------------------------------------
    if (this.plugin.settings.authMode === "ical") {
      containerEl.createEl("h3", { text: "iCal Connection" });

      const helpDiv = containerEl.createEl("div");
      helpDiv.createEl("p", {
        text: "Use the private iCal URL from Google Calendar — no API keys or Google Cloud setup required.",
      });
      const ol = helpDiv.createEl("ol");
      ol.createEl("li", { text: "Open Google Calendar → Settings." });
      ol.createEl("li", { text: "Click the calendar name in the left sidebar." });
      ol.createEl("li", { text: 'Scroll to "Integrate calendar".' });
      ol.createEl("li", { text: 'Copy the "Secret address in iCal format" URL (ends in .ics).' });
      ol.createEl("li", { text: "Paste it below and click Test." });

      const isConnected = !!decrypt(this.plugin.settings.icalUrl);
      const statusEl = containerEl.createEl("p", {
        text: isConnected ? "✓ iCal URL configured" : "✗ No iCal URL configured",
      });
      statusEl.style.fontWeight = "bold";
      statusEl.style.color = isConnected ? "var(--color-green)" : "var(--color-red)";

      new Setting(containerEl)
        .setName("iCal URL")
        .setDesc('The "Secret address in iCal format". Treat this as a password.')
        .addText((text) => {
          text.inputEl.type = "password";
          text.inputEl.style.width = "100%";
          text
            .setPlaceholder("https://calendar.google.com/calendar/ical/…/basic.ics")
            .setValue(decrypt(this.plugin.settings.icalUrl))
            .onChange(async (value) => {
              this.plugin.settings.icalUrl = encrypt(value.trim());
              await this.plugin.saveSettings();
            });
        });

      new Setting(containerEl)
        .setName("Test connection")
        .setDesc("Verify the iCal URL returns valid calendar data.")
        .addButton((button) =>
          button.setButtonText("Test").setCta().onClick(async () => {
            const icalUrl = decrypt(this.plugin.settings.icalUrl);
            if (!icalUrl) {
              new Notice("Please enter an iCal URL first.");
              return;
            }
            button.setButtonText("Testing…").setDisabled(true);
            try {
              const api = new IcalCalendarApi(icalUrl);
              const events = await api.fetchAllEvents();
              const msg =
                events.length === 0
                  ? "✓ Connected — feed is valid but contains 0 events. Open developer console (Ctrl+Shift+I) for details."
                  : `✓ Connected! Found ${events.length} event${events.length !== 1 ? "s" : ""} in the feed.`;
              new Notice(msg, events.length === 0 ? 8000 : 4000);
              this.display();
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              new Notice(`Connection failed: ${msg.replace(/[\r\n]+/g, " ").slice(0, 300)}`, 10000);
            } finally {
              button.setButtonText("Test").setDisabled(false);
            }
          })
        );
    }

    // ----- OAuth Section ----------------------------------------------------
    if (this.plugin.settings.authMode === "oauth") {
      containerEl.createEl("h3", { text: "Google Account" });

      const isAuthenticated = !!decrypt(this.plugin.settings.refreshToken);

      if (!isAuthenticated) {
        const helpDiv = containerEl.createEl("div");
        helpDiv.createEl("p", { text: "One-time setup: create OAuth credentials in Google Cloud Console." });
        const ol = helpDiv.createEl("ol");
        ol.createEl("li", { text: "Go to console.cloud.google.com and create (or open) a project." });
        ol.createEl("li", { text: 'Enable the "Google Calendar API" for the project.' });
        ol.createEl("li", { text: 'Go to APIs & Services → Credentials → Create Credentials → OAuth client ID.' });
        ol.createEl("li", { text: 'Set Application type to "Desktop app" and click Create.' });
        ol.createEl("li", { text: "Copy the Client ID and Client Secret into the fields below." });
        ol.createEl("li", { text: 'Click "Sign in with Google" to authorize the plugin.' });
      }

      const statusEl = containerEl.createEl("p", {
        text: isAuthenticated ? "✓ Authenticated with Google" : "✗ Not authenticated",
      });
      statusEl.style.fontWeight = "bold";
      statusEl.style.color = isAuthenticated ? "var(--color-green)" : "var(--color-red)";

      new Setting(containerEl)
        .setName("Client ID")
        .setDesc("OAuth 2.0 Client ID from Google Cloud Console.")
        .addText((text) => {
          text.inputEl.style.width = "100%";
          text
            .setPlaceholder("xxxxxxxxxxxx-xxxxxxxxxxxxxxxx.apps.googleusercontent.com")
            .setValue(this.plugin.settings.clientId)
            .onChange(async (value) => {
              this.plugin.settings.clientId = value.trim();
              await this.plugin.saveSettings();
            });
        });

      new Setting(containerEl)
        .setName("Client Secret")
        .setDesc("OAuth 2.0 Client Secret from Google Cloud Console.")
        .addText((text) => {
          text.inputEl.type = "password";
          text.inputEl.style.width = "100%";
          text
            .setPlaceholder("GOCSPX-…")
            .setValue(decrypt(this.plugin.settings.clientSecret))
            .onChange(async (value) => {
              this.plugin.settings.clientSecret = encrypt(value.trim());
              await this.plugin.saveSettings();
            });
        });

      if (!isAuthenticated) {
        new Setting(containerEl)
          .setName("Sign in with Google")
          .setDesc("Opens your browser to the Google authorization page. Enter Client ID and Client Secret first.")
          .addButton((button) =>
            button.setButtonText("Sign in with Google").setCta().onClick(async () => {
              if (!this.plugin.settings.clientId || !decrypt(this.plugin.settings.clientSecret)) {
                new Notice("Please enter your Client ID and Client Secret first.");
                return;
              }
              button.setButtonText("Waiting for browser…").setDisabled(true);
              try {
                const auth = new GoogleAuth(
                  this.plugin.settings.clientId,
                  decrypt(this.plugin.settings.clientSecret)
                );
                const tokens = await auth.authorize();
                this.plugin.settings.accessToken = encrypt(tokens.access_token);
                this.plugin.settings.refreshToken = encrypt(tokens.refresh_token);
                this.plugin.settings.tokenExpiry = tokens.expiry_date;
                await this.plugin.saveSettings();
                new Notice("✓ Google Calendar authenticated successfully!", 5000);
                this.display();
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                new Notice(`Authentication failed: ${msg.replace(/[\r\n]+/g, " ").slice(0, 200)}`, 8000);
                button.setButtonText("Sign in with Google").setDisabled(false);
              }
            })
          );
      } else {
        new Setting(containerEl)
          .setName("Disconnect")
          .setDesc("Revoke authorization and clear stored credentials.")
          .addButton((button) =>
            button.setButtonText("Disconnect").setWarning().onClick(async () => {
              try {
                const auth = new GoogleAuth(
                  this.plugin.settings.clientId,
                  decrypt(this.plugin.settings.clientSecret)
                );
                const token =
                  decrypt(this.plugin.settings.accessToken) ||
                  decrypt(this.plugin.settings.refreshToken);
                if (token) await auth.revokeToken(token);
              } catch {
                // revocation failure is non-fatal
              }
              this.plugin.settings.accessToken = "";
              this.plugin.settings.refreshToken = "";
              this.plugin.settings.tokenExpiry = 0;
              await this.plugin.saveSettings();
              new Notice("Disconnected from Google Calendar.");
              this.display();
            })
          );

        new Setting(containerEl)
          .setName("Calendar ID")
          .setDesc(
            'Which calendar to fetch. Use "primary" for your main calendar, ' +
              "or paste a specific calendar ID from Google Calendar → Settings → Integrate calendar."
          )
          .addText((text) => {
            text.inputEl.style.width = "100%";
            text
              .setPlaceholder("primary")
              .setValue(this.plugin.settings.calendarId)
              .onChange(async (value) => {
                this.plugin.settings.calendarId = value.trim() || "primary";
                await this.plugin.saveSettings();
              });
          });

        new Setting(containerEl)
          .setName("Test connection")
          .setDesc("Verify the OAuth token is valid and the calendar is accessible.")
          .addButton((button) =>
            button.setButtonText("Test").setCta().onClick(async () => {
              button.setButtonText("Testing…").setDisabled(true);
              try {
                const accessToken = await this.plugin.getValidAccessToken();
                const api = new GoogleCalendarApi(accessToken);
                const calendarId = this.plugin.settings.calendarId || "primary";
                const events = await api.listUpcomingEvents(calendarId, 50, 30);
                new Notice(
                  `✓ Connected! Found ${events.length} event${events.length !== 1 ? "s" : ""} in the next 30 days.`,
                  5000
                );
              } catch (err) {
                const msg = err instanceof Error ? err.message : String(err);
                new Notice(`Connection failed: ${msg.replace(/[\r\n]+/g, " ").slice(0, 300)}`, 10000);
              } finally {
                button.setButtonText("Test").setDisabled(false);
              }
            })
          );
      }
    }

    // ----- Apple Calendar Section -------------------------------------------
    if (this.plugin.settings.authMode === "apple") {
      containerEl.createEl("h3", { text: "Apple Calendar" });

      containerEl.createEl("p", {
        text: "Events are read from the calendars on this Mac (the ones Calendar.app shows). " +
          "All accounts synced to Calendar.app (iCloud, Google, Exchange) are available — " +
          "no extra sign-in needed.",
      });
      containerEl.createEl("p", {
        text: "Required permission: System Settings → Privacy & Security → Calendars → " +
          "set Obsidian to Full Calendar Access (not Add Only). macOS asks the first time " +
          "the plugin reads your calendars.",
      });

      containerEl.createEl("h4", { text: "Calendar Selection" });
      containerEl.createEl("p", {
        text: "Select which calendars to include. Uncheck all to include every calendar.",
      });

      const calContainer = containerEl.createDiv();
      const loadingEl = calContainer.createEl("p", { text: "Loading calendars…" });
      loadingEl.style.fontStyle = "italic";

      listAppleCalendars()
        .then((calendars) => {
          loadingEl.remove();

          if (calendars.length === 0) {
            calContainer.createEl("p", {
              text: "No calendars found. Ensure Obsidian is set to Full Calendar Access " +
                "(not Add Only) in System Settings → Privacy & Security → Calendars.",
            });
            return;
          }

          const selectedSet = new Set(
            this.plugin.settings.appleCalendars
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          );
          const allSelected = selectedSet.size === 0;
          const toggleMap = new Map<string, ToggleComponent>();

          const saveSelection = async (): Promise<void> => {
            const checked = Array.from(toggleMap.entries())
              .filter(([, t]) => t.getValue())
              .map(([name]) => name);
            this.plugin.settings.appleCalendars =
              checked.length === calendars.length ? "" : checked.join(", ");
            await this.plugin.saveSettings();
          };

          for (const cal of calendars) {
            const row = new Setting(calContainer).setName(cal.name);
            if (cal.account) row.setDesc(cal.account);
            row.addToggle((toggle) => {
              toggleMap.set(cal.name, toggle);
              toggle
                .setValue(allSelected || selectedSet.has(cal.name))
                .onChange(() => saveSelection());
            });
          }
        })
        .catch((err) => {
          loadingEl.remove();
          const msg = err instanceof Error ? err.message : String(err);
          calContainer.createEl("p", { text: `Could not load calendars: ${msg.slice(0, 200)}` });
          new Setting(calContainer)
            .setName("Calendar filter (manual)")
            .setDesc("Comma-separated calendar names. Leave empty to include all.")
            .addText((text) => {
              text.inputEl.style.width = "100%";
              text
                .setPlaceholder("Work, Personal")
                .setValue(this.plugin.settings.appleCalendars)
                .onChange(async (value) => {
                  this.plugin.settings.appleCalendars = value;
                  await this.plugin.saveSettings();
                });
            });
        });

      new Setting(containerEl)
        .setName("Run diagnostics")
        .setDesc(
          "Three-step check: run a script → check calendar access and list calendars → " +
          "read the next 7 days of events. Run this first if notes are not being created."
        )
        .addButton((button) =>
          button.setButtonText("Run Diagnostics").onClick(async () => {
            button.setButtonText("Running…").setDisabled(true);
            try {
              const filter = this.plugin.settings.appleCalendars
                .split(",")
                .map((n) => n.trim())
                .filter(Boolean);
              const report = await runAppleCalendarDiagnostic(filter);
              new DiagnosticModal(this.app, report).open();
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              new DiagnosticModal(this.app, `Diagnostic error:\n\n${msg}`).open();
            } finally {
              button.setButtonText("Run Diagnostics").setDisabled(false);
            }
          })
        );

      new Setting(containerEl)
        .setName("Test connection")
        .setDesc("Read upcoming events from the selected calendars to verify access is working.")
        .addButton((button) =>
          button.setButtonText("Test").setCta().onClick(async () => {
            button.setButtonText("Testing…").setDisabled(true);
            try {
              const svc = await this.plugin.getCalendarService();
              const events = await svc.fetchAllEvents();
              new Notice(
                `✓ Connected! Found ${events.length} upcoming event${events.length !== 1 ? "s" : ""}.`,
                5000
              );
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              new Notice(`Connection failed: ${msg.slice(0, 300)}`, 10000);
            } finally {
              button.setButtonText("Test").setDisabled(false);
            }
          })
        );
    }

    // ----- Personal Settings ------------------------------------------------
    containerEl.createEl("h3", { text: "Personal Settings" });

    new Setting(containerEl)
      .setName("Your email address")
      .setDesc(
        "Your calendar account email. When set, your own entry is hidden from the attendees " +
          "table in generated notes. Leave blank to show all attendees."
      )
      .addText((text) =>
        text
          .setPlaceholder("you@example.com")
          .setValue(this.plugin.settings.selfEmail)
          .onChange(async (value) => {
            this.plugin.settings.selfEmail = value.trim().toLowerCase();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Your name")
      .setDesc(
        "How you're written as an owner in action items: your full name, e.g. John Smith. Separate other spellings with commas. " +
          "Items owned by you, or by no one, are yours; the rest are listed as Waiting on others. " +
          "Your name in calendar invites (found with Your email address above) is used too."
      )
      .addText((text) =>
        text
          .setPlaceholder("First Last")
          .setValue(this.plugin.settings.myNames)
          .onChange(async (value) => {
            this.plugin.settings.myNames = value;
            await this.plugin.saveSettings();
            showNameWarning();
          })
      );
    const nameWarning = containerEl.createDiv({ cls: "setting-item-description mod-warning" });
    const showNameWarning = () => {
      const single = singleWordNames(this.plugin.settings.myNames);
      nameWarning.setText(single.length > 0
        ? `⚠ "${single[0]}" is a single name: items owned by anyone else written as just "${single[0]}" would count as yours. Use full names.`
        : "");
      nameWarning.toggle(single.length > 0);
    };
    showNameWarning();

    // ----- Note Settings ----------------------------------------------------
    containerEl.createEl("h3", { text: "Note Settings" });

    new Setting(containerEl)
      .setName("Note folder")
      .setDesc("Vault folder where meeting notes are created. Leave empty for vault root.")
      .addText((text) => {
        new FolderSuggest(this.app, text.inputEl);
        text
          .setPlaceholder("Meeting Notes")
          .setValue(this.plugin.settings.noteFolder)
          .onChange(async (value) => {
            this.plugin.settings.noteFolder = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Meeting Hub folder")
      .setDesc("Vault folder for the Meeting Tracker, the Meetings dashboard, Weekly Reviews and series notes. Leave empty to use the note folder.")
      .addText((text) => {
        new FolderSuggest(this.app, text.inputEl);
        text
          .setPlaceholder("Same as note folder")
          .setValue(this.plugin.settings.hubFolder)
          .onChange(async (value) => {
            this.plugin.settings.hubFolder = value.trim();
            await this.plugin.saveSettings();
            void showTasksWarning();
          });
      });

    const tasksWarning = containerEl.createDiv({ cls: "setting-item-description mod-warning" });
    tasksWarning.hide();
    const showTasksWarning = async () => {
      const warning = await this.plugin.tasksQueryWarning();
      tasksWarning.setText(warning ? `⚠ ${warning}` : "");
      tasksWarning.toggle(!!warning);
    };
    void showTasksWarning();

    new Setting(containerEl)
      .setName("Move existing files")
      .setDesc("Move the Meeting Tracker, Meeting Insights, the Meetings dashboard, Weekly Reviews, series notes and account overviews from the note folder into the Meeting Hub folder. Links to them keep working.")
      .addButton((button) =>
        button.setButtonText("Move existing files").onClick(async () => {
          button.setDisabled(true);
          try {
            await this.plugin.moveHubFiles();
          } finally {
            button.setDisabled(false);
          }
        })
      );

    new Setting(containerEl)
      .setName("Prepare my day each night")
      .setDesc(
        "At the time below, build My Day, create the day's meeting notes with their Meeting Brief, and rebuild the Meeting Tracker, " +
          "so everything is ready (and the Daily Briefing written) before you start. Obsidian must be open and the Mac awake or on power. " +
          "If a night is missed, it runs as soon as Obsidian is open again."
      )
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.prepEnabled).onChange(async (value) => {
          this.plugin.settings.prepEnabled = value;
          await this.plugin.saveSettings();
        })
      )
      .addText((text) => {
        text.inputEl.type = "time";
        text.setValue(this.plugin.settings.prepTime.padStart(5, "0")).onChange(async (value) => {
          if (!/^\d{1,2}:\d{2}$/.test(value)) return;
          this.plugin.settings.prepTime = value;
          await this.plugin.saveSettings();
        });
      })
      .addButton((button) =>
        button.setButtonText("Prepare now").onClick(async () => {
          button.setDisabled(true);
          try {
            await this.plugin.prepareDay(true);
          } finally {
            button.setDisabled(false);
          }
        })
      );

    new Setting(containerEl)
      .setName("Notify before a meeting")
      .setDesc("Minutes before a meeting starts to show a notification that opens its note and brief. 0 = off.")
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "0";
        text.inputEl.max = "60";
        text.setValue(String(this.plugin.settings.notifyBeforeMinutes)).onChange(async (value) => {
          const minutes = Number(value);
          if (!Number.isFinite(minutes)) return;
          this.plugin.settings.notifyBeforeMinutes = Math.max(0, Math.min(60, Math.round(minutes)));
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("Notify after a meeting")
      .setDesc("10 minutes after a meeting ends, if its note has no AI reply yet: a reminder to import the Krisp transcript and add the reply.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.notifyAfterMeeting).onChange(async (value) => {
          this.plugin.settings.notifyAfterMeeting = value;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("Morning summary")
      .setDesc("A notification with the day's meetings and what's due or overdue, opening My Day. Clear the time to turn it off.")
      .addText((text) => {
        text.inputEl.type = "time";
        text.setValue(this.plugin.settings.morningReminderTime ? this.plugin.settings.morningReminderTime.padStart(5, "0") : "")
          .onChange(async (value) => {
            if (value && !/^\d{1,2}:\d{2}$/.test(value)) return;
            this.plugin.settings.morningReminderTime = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Wrap-up reminder")
      .setDesc("A notification with how many of your items slipped today, opening Wrap up my day. Clear the time to turn it off.")
      .addText((text) => {
        text.inputEl.type = "time";
        text.setValue(this.plugin.settings.wrapUpReminderTime ? this.plugin.settings.wrapUpReminderTime.padStart(5, "0") : "")
          .onChange(async (value) => {
            if (value && !/^\d{1,2}:\d{2}$/.test(value)) return;
            this.plugin.settings.wrapUpReminderTime = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Copy the Daily Briefing to")
      .setDesc(
        "A folder outside the vault, such as one Google Drive for desktop syncs, for an assistant like Gemini to read: " +
          "e.g. ~/Library/CloudStorage/GoogleDrive-you@company.com/My Drive/Obsidian Briefing. " +
          "My Day is written there as \"Daily Briefing.md\" each time it's rebuilt. Leave empty to keep it in the vault only."
      )
      .addText((text) =>
        text
          .setPlaceholder("~/Library/CloudStorage/GoogleDrive-…/My Drive/Obsidian Briefing")
          .setValue(this.plugin.settings.briefingFolder)
          .onChange(async (value) => {
            this.plugin.settings.briefingFolder = value.trim();
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Hours in advance")
      .setDesc("Hours before an event starts to auto-create its note. (1–48)")
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.inputEl.max = "48";
        text.inputEl.step = "1";
        text.inputEl.style.width = "80px";
        text
          .setValue(String(this.plugin.settings.hoursInAdvance))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num >= 1 && num <= 48) {
              this.plugin.settings.hoursInAdvance = num;
              await this.plugin.saveSettings();
            }
          });
      });

    new Setting(containerEl)
      .setName("Poll interval (minutes)")
      .setDesc("How often the plugin checks for new events. (5–120)")
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "5";
        text.inputEl.max = "120";
        text.inputEl.step = "5";
        text.inputEl.style.width = "80px";
        text
          .setValue(String(this.plugin.settings.pollIntervalMinutes))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num >= 5 && num <= 120) {
              this.plugin.settings.pollIntervalMinutes = num;
              await this.plugin.saveSettings();
              this.plugin.restartPolling();
            }
          });
      });

    new Setting(containerEl)
      .setName("Include past events")
      .setDesc(
        "When enabled, also auto-creates notes for events that have already started " +
          "within the lookback window below."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includePastEvents)
          .onChange(async (value) => {
            this.plugin.settings.includePastEvents = value;
            await this.plugin.saveSettings();
            this.display();
          })
      );

    if (this.plugin.settings.includePastEvents) {
      new Setting(containerEl)
        .setName("Days back to look")
        .setDesc("How many days in the past to create notes for. (1–30)")
        .addText((text) => {
          text.inputEl.type = "number";
          text.inputEl.min = "1";
          text.inputEl.max = "30";
          text.inputEl.step = "1";
          text.inputEl.style.width = "80px";
          text
            .setValue(String(this.plugin.settings.daysBack))
            .onChange(async (value) => {
              const num = parseInt(value, 10);
              if (!isNaN(num) && num >= 1 && num <= 30) {
                this.plugin.settings.daysBack = num;
                await this.plugin.saveSettings();
              }
            });
        });
    }

    new Setting(containerEl)
      .setName("Keep notes in sync for meetings up to this many days ahead")
      .setDesc(
        "Notes that already exist are updated when their meeting changes, and renamed when it moves to " +
          "another day, as long as the meeting is within this many days. New notes are still only created " +
          "Hours in advance. (1–90)"
      )
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.inputEl.max = "90";
        text.inputEl.step = "1";
        text.inputEl.style.width = "80px";
        text
          .setValue(String(this.plugin.settings.syncDaysAhead))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num >= 1 && num <= 90) {
              this.plugin.settings.syncDaysAhead = num;
              await this.plugin.saveSettings();
            }
          });
      });

    new Setting(containerEl)
      .setName("Rename notes when the meeting title changes")
      .setDesc(
        "When a meeting is retitled, rename its note and update the note's heading. A note you renamed " +
          "yourself keeps your name; only its date is updated."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.renameOnTitleChange)
          .onChange(async (value) => {
            this.plugin.settings.renameOnTitleChange = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Skip meetings titled")
      .setDesc(
        "Meetings whose title contains any of these words or phrases (one per line, any case) " +
          "never get a note automatically, for example Focus time, Lunch, or Hold. You can still " +
          "create one from the Today's meetings panel or the event picker."
      )
      .addTextArea((text) => {
        text.inputEl.rows = 4;
        text
          .setPlaceholder("Focus time\nLunch\nHold")
          .setValue(this.plugin.settings.skipTitles)
          .onChange(async (value) => {
            this.plugin.settings.skipTitles = value;
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Skip meetings with no one else invited")
      .setDesc(
        "Don't create notes automatically for events with no attendees besides you, such as " +
          "blocks you put on your own calendar. Set your email address above so the plugin can tell which attendee is you."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.skipSolo)
          .onChange(async (value) => {
            this.plugin.settings.skipSolo = value;
            await this.plugin.saveSettings();
          })
      );

    // ----- Note Contents ----------------------------------------------------
    containerEl.createEl("h3", { text: "Note Contents" });

    new Setting(containerEl)
      .setName("Include event description")
      .setDesc(
        "When enabled, the event's description is added to the Agenda section of new notes."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.includeEventNotes)
          .onChange(async (value) => {
            this.plugin.settings.includeEventNotes = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Link attendees")
      .setDesc(
        "Write the organizer and attendees as [[Name]] links so each person's note lists " +
          "their meetings. When off, they are written as plain names and email addresses."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.linkAttendees)
          .onChange(async (value) => {
            this.plugin.settings.linkAttendees = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Show next meeting in status bar")
      .setDesc(
        "Show the meeting in progress or coming up next at the bottom of the window. " +
          "Click it to open the meeting's note and join link."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.showStatusBar)
          .onChange(async (value) => {
            this.plugin.settings.showStatusBar = value;
            await this.plugin.saveSettings();
            this.plugin.updateStatusBar();
          })
      );

    new Setting(containerEl)
      .setName("Open Today's meetings at startup")
      .setDesc("Open the Today's meetings panel, with its Join buttons, in the right sidebar when Obsidian starts.")
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.openTodayOnStartup)
          .onChange(async (value) => {
            this.plugin.settings.openTodayOnStartup = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Template file")
      .setDesc(
        "A note to use as the template for new meeting notes, with placeholders such as " +
          "{{title}}, {{details}}, {{join_link}}, {{agenda}}, and {{attendees}} (see the README " +
          "for the full list). Leave empty to use the built-in format."
      )
      .addText((text) => {
        new FileSuggest(this.app, text.inputEl);
        text
          .setPlaceholder("Templates/Meeting.md")
          .setValue(this.plugin.settings.templatePath)
          .onChange(async (value) => {
            this.plugin.settings.templatePath = value.trim();
            await this.plugin.saveSettings();
          });
      });

    containerEl.createEl("h4", { text: "Sections in new notes" });
    containerEl.createEl("p", {
      text: "Which sections the built-in format includes. Ignored when a template file is set — " +
        "edit the template instead. Existing notes are not changed.",
    });
    const sectionNames: Array<[keyof NoteSections, string]> = [
      ["agenda", "Agenda"],
      ["notes", "Notes"],
      ["summary", "Executive Summary"],
      ["actionItems", "Next Steps"],
      ["topics", "Summary by Topic"],
      ["decisions", "Key Decisions"],
      ["additional", "Additional Items"],
      ["speakers", "Speakers"],
      ["transcript", "Transcript"],
    ];
    for (const [key, name] of sectionNames) {
      new Setting(containerEl).setName(name).addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.noteSections[key])
          .onChange(async (value) => {
            this.plugin.settings.noteSections[key] = value;
            await this.plugin.saveSettings();
          })
      );
    }

    const daily = this.plugin.getDailyNoteConfig();
    new Setting(containerEl)
      .setName("Link to daily note")
      .setDesc(
        "Link each meeting note to that day's daily note, so the daily note's backlinks list " +
          `the day's meetings. Uses your Daily Notes settings (format ${daily.format}` +
          (daily.folder ? `, folder ${daily.folder}` : "") + ")."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.dailyNoteLink)
          .onChange(async (value) => {
            this.plugin.settings.dailyNoteLink = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("Date position in filename")
      .setDesc("Where the date appears in the generated note's filename.")
      .addDropdown((drop) => {
        drop.addOption("before", "Before name — 2026-03-30 - Meeting Title");
        drop.addOption("after", "After name — Meeting Title - 2026-03-30");
        drop.setValue(this.plugin.settings.datePosition);
        drop.onChange(async (value: string) => {
          this.plugin.settings.datePosition = value as "before" | "after";
          await this.plugin.saveSettings();
        });
      });

    // ----- Calendar View ----------------------------------------------------
    containerEl.createEl("h3", { text: "Calendar View" });

    new Setting(containerEl)
      .setName("Days ahead to fetch")
      .setDesc("How many days ahead to look in the event picker. (1–30)")
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.inputEl.max = "30";
        text.inputEl.step = "1";
        text.inputEl.style.width = "80px";
        text
          .setValue(String(this.plugin.settings.daysAhead))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num >= 1 && num <= 30) {
              this.plugin.settings.daysAhead = num;
              await this.plugin.saveSettings();
            }
          });
      });

    new Setting(containerEl)
      .setName("Max events to show")
      .setDesc("Maximum events shown in the event picker. (1–50)")
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.inputEl.max = "50";
        text.inputEl.step = "1";
        text.inputEl.style.width = "80px";
        text
          .setValue(String(this.plugin.settings.maxEvents))
          .onChange(async (value) => {
            const num = parseInt(value, 10);
            if (!isNaN(num) && num >= 1 && num <= 50) {
              this.plugin.settings.maxEvents = num;
              await this.plugin.saveSettings();
            }
          });
      });

    // ----- Krisp Transcripts -----------------------------------------------
    containerEl.createEl("h3", { text: "Krisp Transcripts" });

    new Setting(containerEl)
      .setName("Krisp folder")
      .setDesc(
        "The folder on this Mac where Krisp saves recordings (one folder per recording, each " +
          "with a transcript.txt or transcript.md). Run Import Krisp transcript on a meeting note to fill its " +
          "Transcript section. ~ means your home folder."
      )
      .addText((text) => {
        text.inputEl.style.width = "100%";
        text
          .setPlaceholder("~/Documents/Transcripts/Krisp Meetings")
          .setValue(this.plugin.settings.krispFolder)
          .onChange(async (value) => {
            this.plugin.settings.krispFolder = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Import transcripts automatically")
      .setDesc(
        "After each sync, offer the Krisp recordings of meetings that ended in the last 2 days " +
          "and have an empty Transcript section. You always confirm (or change) each match " +
          "before anything is imported. Off: only when you run the command."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.krispAutoImport)
          .onChange(async (value) => {
            this.plugin.settings.krispAutoImport = value;
            await this.plugin.saveSettings();
          })
      );

    // ----- AI Assistant ----------------------------------------------------
    containerEl.createEl("h3", { text: "AI Assistant (copy and paste)" });
    containerEl.createEl("p", {
      text: "Copy meeting for AI assistant copies a meeting's details, notes and transcript for " +
        "pasting into Gemini, Claude, ChatGPT, Copilot or another assistant your organization " +
        "approves; Add AI reply to this meeting files the assistant's reply into the note. The " +
        "plugin never contacts any AI service itself.",
    });

    new Setting(containerEl)
      .setName("Include instructions when copying")
      .setDesc(
        "Put the instructions below in front of the meeting. Turn off if your assistant (a Gem, " +
          "custom GPT, Claude Project or Copilot agent) already has its own instructions."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.aiIncludeInstructions)
          .onChange(async (value) => {
            this.plugin.settings.aiIncludeInstructions = value;
            await this.plugin.saveSettings();
          })
      );

    let instructionsArea: TextAreaComponent | undefined;
    new Setting(containerEl)
      .setName("Instructions")
      .setDesc(
        "What the assistant is asked to do. Keep the six headings (Executive Summary, Next Steps, " +
          "Summary (by topic), Key Decisions/Agreements, Additional Items, Speakers) " +
          "so the reply can be filed. For a custom agent, see docs/AGENT_INSTRUCTIONS.md."
      )
      .addButton((button) =>
        button.setButtonText("Copy").onClick(async () => {
          await navigator.clipboard.writeText(this.plugin.settings.aiInstructions.trim() || DEFAULT_INSTRUCTIONS);
          new Notice("Instructions copied to the clipboard.");
        })
      )
      .addButton((button) =>
        button.setButtonText("Reset to default").onClick(async () => {
          this.plugin.settings.aiInstructions = "";
          await this.plugin.saveSettings();
          instructionsArea?.setValue(DEFAULT_INSTRUCTIONS);
        })
      );
    new Setting(containerEl).setClass("cal-notes-wide-setting").addTextArea((text) => {
      instructionsArea = text;
      text.inputEl.rows = 14;
      text.inputEl.style.width = "100%";
      text
        .setValue(this.plugin.settings.aiInstructions.trim() || DEFAULT_INSTRUCTIONS)
        .onChange(async (value) => {
          this.plugin.settings.aiInstructions = value.trim() === DEFAULT_INSTRUCTIONS ? "" : value;
          await this.plugin.saveSettings();
        });
    });

    new Setting(containerEl)
      .setName("Save the reply's details as properties")
      .setDesc(
        "Save the reply's Meeting Metadata (category, account, organizations, key topics, sentiment, " +
          "outcome, search tags), its speakers and the day it was filed as note properties, for the dashboards."
      )
      .addToggle((toggle) =>
        toggle
          .setValue(this.plugin.settings.aiSaveProperties)
          .onChange(async (value) => {
            this.plugin.settings.aiSaveProperties = value;
            await this.plugin.saveSettings();
          })
      );

    // ----- Manual Actions ---------------------------------------------------
    containerEl.createEl("h3", { text: "Manual Actions" });

    new Setting(containerEl)
      .setName("Refresh")
      .setDesc(
        "Fetches calendar events, creates notes for new events, and updates the calendar " +
        "details of existing notes. Notes you deleted are not recreated — use Rebuild for " +
        "that. Uses the time window configured in Note Settings above."
      )
      .addButton((button) =>
        button.setButtonText("Refresh").setCta().onClick(async () => {
          button.setButtonText("Refreshing…").setDisabled(true);
          await this.plugin.refreshNotes(true);
          button.setButtonText("Refresh").setDisabled(false);
        })
      );

    new Setting(containerEl)
      .setName("Rebuild")
      .setDesc(
        "Same as Refresh, but also recreates notes you deleted. Runs automatically once " +
        "after the plugin is installed or upgraded. Your own writing in existing notes is " +
        "never changed. Uses the time window configured in Note Settings above."
      )
      .addButton((button) =>
        button.setButtonText("Rebuild").onClick(async () => {
          button.setButtonText("Rebuilding…").setDisabled(true);
          await this.plugin.rebuildNotes(true);
          button.setButtonText("Rebuild").setDisabled(false);
        })
      );
  }
}

// ---------------------------------------------------------------------------
// Diagnostic result modal
// ---------------------------------------------------------------------------

class DiagnosticModal extends Modal {
  private report: string;

  constructor(app: App, report: string) {
    super(app);
    this.report = report;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.createEl("h2", { text: "Apple Calendar Diagnostic" });

    const pre = contentEl.createEl("pre");
    pre.setText(this.report);
    Object.assign(pre.style, {
      whiteSpace: "pre-wrap",
      wordBreak: "break-word",
      maxHeight: "60vh",
      overflowY: "auto",
      fontFamily: "var(--font-monospace)",
      fontSize: "12px",
      lineHeight: "1.5",
      padding: "8px",
      background: "var(--background-secondary)",
      borderRadius: "4px",
      userSelect: "text",
    });

    new Setting(contentEl)
      .addButton((btn) =>
        btn.setButtonText("Copy to Clipboard").onClick(async () => {
          await navigator.clipboard.writeText(this.report);
          new Notice("Diagnostic report copied to clipboard.");
        })
      )
      .addButton((btn) =>
        btn.setButtonText("Close").setCta().onClick(() => this.close())
      );
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
