import { FuzzySuggestModal, App } from "obsidian";
import { CalendarEvent } from "./calendarApi";

function formatEventDateTime(event: CalendarEvent): string {
  if (event.start.date) {
    // All-day event
    const d = new Date(event.start.date + "T12:00:00");
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    }) + " · All day";
  }

  const startIso = event.start.dateTime ?? new Date().toISOString();
  const start = new Date(startIso);
  const end = new Date(event.end.dateTime ?? startIso);

  const datePart = start.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const startTime = start.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
  const endTime = end.toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  return `${datePart} · ${startTime} – ${endTime}`;
}

/**
 * A fuzzy-search modal that lets the user pick one calendar event
 * from a list of upcoming events.
 */
export class EventSuggestModal extends FuzzySuggestModal<CalendarEvent> {
  private events: CalendarEvent[];
  private onChoose: (event: CalendarEvent) => void;

  constructor(
    app: App,
    events: CalendarEvent[],
    onChoose: (event: CalendarEvent) => void
  ) {
    super(app);
    this.events = events;
    this.onChoose = onChoose;
    this.setPlaceholder("Type to search upcoming calendar events…");
    this.setInstructions([
      { command: "↑↓", purpose: "navigate" },
      { command: "↵", purpose: "create note" },
      { command: "esc", purpose: "cancel" },
    ]);
  }

  getItems(): CalendarEvent[] {
    return this.events;
  }

  getItemText(event: CalendarEvent): string {
    // This text is used for fuzzy matching — include title and date
    return `${event.summary ?? "Untitled Event"} ${formatEventDateTime(event)}`;
  }

  onChooseItem(event: CalendarEvent): void {
    this.onChoose(event);
  }

  renderSuggestion(
    item: { item: CalendarEvent; match: { score: number } },
    el: HTMLElement
  ): void {
    const event = item.item;

    const container = el.createDiv({ cls: "gcal-suggestion" });

    // Title row
    container.createDiv({
      cls: "gcal-suggestion-title",
      text: event.summary?.trim() || "Untitled Event",
    });

    // Meta row
    const meta = container.createDiv({ cls: "gcal-suggestion-meta" });
    meta.createSpan({
      cls: "gcal-suggestion-time",
      text: formatEventDateTime(event),
    });

    // Attendee count badge
    const otherAttendees = (event.attendees ?? []).filter((a) => !a.self);
    if (otherAttendees.length > 0) {
      meta.createSpan({ text: " · " });
      meta.createSpan({
        cls: "gcal-suggestion-badge",
        text: `${otherAttendees.length} attendee${otherAttendees.length !== 1 ? "s" : ""}`,
      });
    }

    // "Has agenda" badge when the event has a description
    if (event.description?.trim()) {
      meta.createSpan({ text: " · " });
      meta.createSpan({
        cls: "gcal-suggestion-badge gcal-badge-agenda",
        text: "has agenda",
      });
    }

    // Video badge
    const hasVideo = event.conferenceData?.entryPoints?.some(
      (ep) => ep.entryPointType === "video"
    );
    if (hasVideo) {
      meta.createSpan({ text: " · " });
      meta.createSpan({
        cls: "gcal-suggestion-badge gcal-badge-video",
        text: "video",
      });
    }
  }
}
