import { TFile, TFolder, type App } from "./obsidianStub";
import type { CalendarEvent } from "../../src/calendarApi";

export function buildEvent(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "event-1",
    summary: "Team Sync",
    description: "Agenda item",
    start: { dateTime: "2026-04-03T10:00:00-04:00" },
    end: { dateTime: "2026-04-03T11:00:00-04:00" },
    attendees: [],
    ...overrides,
  };
}

export function createMemoryApp(initialFiles: Array<{ path: string; content?: string }> = []): App & {
  files: Map<string, TFile | TFolder>;
  createdPaths: string[];
  openedFiles: string[];
  renamed: Array<[string, string]>;
} {
  const files = new Map<string, TFile | TFolder>();
  const createdPaths: string[] = [];
  const openedFiles: string[] = [];

  for (const entry of initialFiles) {
    const file = new TFile(entry.path);
    file.content = entry.content ?? "";
    files.set(entry.path, file);
  }

  const renamed: Array<[string, string]> = [];

  const app: App & {
    files: Map<string, TFile | TFolder>;
    createdPaths: string[];
    openedFiles: string[];
    renamed: Array<[string, string]>;
  } = {
    files,
    createdPaths,
    openedFiles,
    renamed,
    vault: {
      getAllLoadedFiles: () => Array.from(files.values()),
      getMarkdownFiles: () =>
        Array.from(files.values()).filter(
          (f): f is TFile => f instanceof TFile && f.path.endsWith(".md")
        ),
      read: async (file: TFile) => file.content ?? "",
      cachedRead: async (file: TFile) => file.content ?? "",
      process: async (file: TFile, fn: (content: string) => string) => {
        file.content = fn(file.content ?? "");
        return file.content;
      },
      getAbstractFileByPath: (path: string) => files.get(path) ?? null,
      createFolder: async (path: string) => {
        files.set(path, new TFolder(path));
      },
      create: async (path: string, content: string) => {
        const file = new TFile(path);
        file.content = content;
        files.set(path, file);
        createdPaths.push(path);
        return file;
      },
    },
    metadataCache: {
      getFileCache: (file: TFile) => {
        const fm = (file.content ?? "").match(/^---\n([\s\S]*?)\n---/);
        if (!fm) return null;
        const frontmatter: Record<string, unknown> = {};
        let last: string | undefined;
        for (const line of fm[1].split("\n")) {
          const m = line.match(/^([A-Za-z0-9_-]+):\s*"?(.*?)"?$/);
          if (m) {
            frontmatter[m[1]] = m[2];
            last = m[1];
          }
          const item = line.match(/^\s+-\s+"?(.*?)"?$/);
          if (item && last) {
            const list = Array.isArray(frontmatter[last]) ? frontmatter[last] as string[] : [];
            frontmatter[last] = [...list, item[1]];
          }
        }
        return { frontmatter };
      },
    },
    fileManager: {
      renameFile: async (file: TFile, newPath: string) => {
        files.delete(file.path);
        renamed.push([file.path, newPath]);
        file.path = newPath;
        file.name = newPath.split("/").pop() ?? newPath;
        files.set(newPath, file);
      },
    },
    workspace: {
      getLeaf: () => ({
        openFile: async (file: TFile) => {
          openedFiles.push(file.path);
        },
      }),
    },
  };

  return app;
}
