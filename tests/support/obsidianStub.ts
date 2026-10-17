export class TFile {
  path: string;
  name: string;
  content?: string;

  constructor(path: string) {
    this.path = path;
    this.name = path.split("/").pop() ?? path;
  }

  get basename(): string {
    return this.name.replace(/\.md$/, "");
  }
}

export class TFolder {
  path: string;

  constructor(path: string) {
    this.path = path;
  }
}

type RequestUrlResponse = {
  status: number;
  text: string;
  json?: unknown;
};

type RequestUrlOptions = {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  throw?: boolean;
};

let requestUrlMock: (options: RequestUrlOptions) => Promise<RequestUrlResponse> =
  async () => ({
    status: 200,
    text: "",
    json: {},
  });

const notices: Array<{ message: string; timeout?: number }> = [];

export function setRequestUrlMock(
  mock: (options: RequestUrlOptions) => Promise<RequestUrlResponse>
): void {
  requestUrlMock = mock;
}

export async function requestUrl(
  options: RequestUrlOptions
): Promise<RequestUrlResponse> {
  return requestUrlMock(options);
}

export function resetObsidianTestState(): void {
  notices.length = 0;
  requestUrlMock = async () => ({
    status: 200,
    text: "",
    json: {},
  });
}

export function getNotices(): Array<{ message: string; timeout?: number }> {
  return [...notices];
}

export class Notice {
  message: string;
  timeout?: number;
  hidden = false;
  messageEl = createFakeEl();

  constructor(message: string, timeout?: number) {
    this.message = message;
    this.timeout = timeout;
    notices.push({ message, timeout });
  }

  hide(): void {
    this.hidden = true;
  }
}

export class Plugin {
  app: App;
  manifest: { version: string };
  private storedData: unknown;

  constructor(app?: App, manifest?: { version?: string }) {
    this.app = app ?? ({} as App);
    this.manifest = { version: manifest?.version ?? "test" };
    this.storedData = {};
  }

  addRibbonIcon(): void {}
  addCommand(): void {}
  addSettingTab(): void {}
  registerInterval(): void {}
  registerEvent(): void {}
  registerView(): void {}

  async loadData(): Promise<unknown> {
    return this.storedData;
  }

  async saveData(data: unknown): Promise<void> {
    this.storedData = data;
  }
}

export class WorkspaceLeaf {}

export class ItemView {
  app = {} as App;
  contentEl = createFakeEl();

  constructor(public leaf: WorkspaceLeaf) {}

  registerEvent(): void {}
  registerInterval(): void {}
  getState(): Record<string, unknown> { return {}; }
  async setState(): Promise<void> {}
}

export class MarkdownView extends ItemView {
  file: TFile | null = null;
  actions: Array<{ icon: string; title: string; callback: () => void; removed: boolean }> = [];

  addAction(icon: string, title: string, callback: () => void): HTMLElement {
    const action = { icon, title, callback, removed: false };
    this.actions.push(action);
    return { remove: () => { action.removed = true; } } as unknown as HTMLElement;
  }
}

export function setIcon(): void {}

export function debounce<T extends (...args: unknown[]) => unknown>(fn: T): T {
  return fn;
}

export class Modal {
  app: App;
  titleEl = createFakeEl();
  contentEl = createFakeEl();

  constructor(app: App) {
    this.app = app;
  }

  open(): void {}
  close(): void {}
}

export class PluginSettingTab {
  app: App;
  plugin: Plugin;
  containerEl = createFakeEl();

  constructor(app: App, plugin: Plugin) {
    this.app = app;
    this.plugin = plugin;
  }
}

export class AbstractInputSuggest<T> {
  app: App;
  inputEl: HTMLInputElement;

  constructor(app: App, inputEl: HTMLInputElement) {
    this.app = app;
    this.inputEl = inputEl;
  }

  setValue(value: string): void {
    this.inputEl.value = value;
  }

  close(): void {}
}

export class ToggleComponent {}

export class Setting {
  constructor(public containerEl: unknown) {}

  setName(): this { return this; }
  setDesc(): this { return this; }
  addDropdown(cb: (dropdown: FakeDropdown) => void): this {
    cb(new FakeDropdown());
    return this;
  }
  addText(cb: (text: FakeTextComponent) => void): this {
    cb(new FakeTextComponent());
    return this;
  }
  addButton(cb: (button: FakeButtonComponent) => void): this {
    cb(new FakeButtonComponent());
    return this;
  }
  addToggle(cb: (toggle: FakeToggleComponent) => void): this {
    cb(new FakeToggleComponent());
    return this;
  }
}

export class FuzzySuggestModal<T> extends Modal {
  setPlaceholder(): void {}
  setInstructions(): void {}
  getItems(): T[] { return []; }
  getItemText(): string { return ""; }
  onChooseItem(): void {}
  renderSuggestion(): void {}
}

export interface App {
  vault: {
    getAllLoadedFiles?: () => Array<TFile | TFolder>;
    getMarkdownFiles: () => TFile[];
    getAbstractFileByPath: (path: string) => unknown;
    createFolder: (path: string) => Promise<void>;
    create: (path: string, content: string) => Promise<TFile>;
    process: (file: TFile, fn: (content: string) => string) => Promise<string>;
    read: (file: TFile) => Promise<string>;
    cachedRead: (file: TFile) => Promise<string>;
  };
  metadataCache: {
    getFileCache: (file: TFile) => { frontmatter?: Record<string, unknown> } | null;
  };
  fileManager: {
    renameFile: (file: TFile, newPath: string) => Promise<void>;
  };
  workspace: {
    getLeaf: (newLeaf?: boolean) => { openFile: (file: TFile) => Promise<void> };
  };
}

export function moment(date: string, _inputFormat?: string) {
  const [year, month, day] = date.split("-");
  return {
    format: (fmt: string) =>
      fmt.replace(/YYYY/g, year).replace(/MM/g, month).replace(/DD/g, day),
  };
}

export function normalizePath(path: string): string {
  return path
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/(^|\/)\.\//g, "$1")
    .replace(/\/$/, "");
}

class FakeDropdown {
  addOption(): this { return this; }
  setValue(): this { return this; }
  onChange(): this { return this; }
}

class FakeTextComponent {
  inputEl = { type: "text", style: {}, value: "", dispatchEvent() {} } as unknown as HTMLInputElement;
  setPlaceholder(): this { return this; }
  setValue(): this { return this; }
  onChange(): this { return this; }
}

class FakeButtonComponent {
  setButtonText(): this { return this; }
  setCta(): this { return this; }
  setWarning(): this { return this; }
  setDisabled(): this { return this; }
  onClick(): this { return this; }
}

class FakeToggleComponent {
  setValue(): this { return this; }
  onChange(): this { return this; }
}

function createFakeEl() {
  return {
    style: {},
    empty() {},
    setText() {},
    createEl() { return createFakeEl(); },
    createDiv() { return createFakeEl(); },
    createSpan() { return createFakeEl(); },
    addEventListener() {},
  };
}
