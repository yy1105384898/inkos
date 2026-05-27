export type BrowserApiFormat = "chat" | "responses";

export interface BrowserServiceConfig {
  readonly service: string;
  readonly label: string;
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly apiFormat: BrowserApiFormat;
  readonly stream: boolean;
  readonly temperature: number;
  readonly defaultModel?: string;
}

export interface BrowserServiceSelection {
  readonly service: string;
  readonly model: string;
}

export interface BrowserLlmOverride {
  readonly scope: "browser";
  readonly service: string;
  readonly model: string;
  readonly apiKey: string;
  readonly baseUrl?: string;
  readonly apiFormat: BrowserApiFormat;
  readonly stream: boolean;
  readonly temperature: number;
}

export interface BrowserCoverConfig {
  readonly service: string;
  readonly model: string;
  readonly apiKey: string;
}

export interface BrowserCoverOverride extends BrowserCoverConfig {
  readonly scope: "browser";
}

export const BROWSER_SERVICES_STORAGE_KEY = "inkos.browserServices.v1";
export const BROWSER_SERVICE_SELECTION_KEY = "inkos.browserServiceSelection.v1";
export const BROWSER_COVER_STORAGE_KEY = "inkos.browserCover.v1";

function storage(): Storage | null {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

function readJson<T>(key: string): T | null {
  try {
    const raw = storage()?.getItem(key);
    return raw ? JSON.parse(raw) as T : null;
  } catch {
    return null;
  }
}

function isBrowserServiceConfig(value: unknown): value is BrowserServiceConfig {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<BrowserServiceConfig>;
  return typeof item.service === "string"
    && typeof item.label === "string"
    && typeof item.apiKey === "string"
    && (item.apiFormat === "chat" || item.apiFormat === "responses")
    && typeof item.stream === "boolean"
    && typeof item.temperature === "number";
}

export function loadBrowserServices(): ReadonlyArray<BrowserServiceConfig> {
  const values = readJson<unknown>(BROWSER_SERVICES_STORAGE_KEY);
  return Array.isArray(values) ? values.filter(isBrowserServiceConfig) : [];
}

export function findBrowserService(service: string): BrowserServiceConfig | undefined {
  return loadBrowserServices().find((entry) => entry.service === service);
}

export function saveBrowserService(config: BrowserServiceConfig): void {
  const entries = new Map(loadBrowserServices().map((entry) => [entry.service, entry]));
  entries.set(config.service, config);
  storage()?.setItem(BROWSER_SERVICES_STORAGE_KEY, JSON.stringify([...entries.values()]));
}

export function deleteBrowserService(service: string): void {
  const entries = loadBrowserServices().filter((entry) => entry.service !== service);
  storage()?.setItem(BROWSER_SERVICES_STORAGE_KEY, JSON.stringify(entries));
  const selected = getBrowserServiceSelection();
  if (selected?.service === service) {
    storage()?.removeItem(BROWSER_SERVICE_SELECTION_KEY);
  }
}

export function getBrowserServiceSelection(): BrowserServiceSelection | null {
  const selected = readJson<Partial<BrowserServiceSelection>>(BROWSER_SERVICE_SELECTION_KEY);
  return typeof selected?.service === "string" && typeof selected.model === "string"
    ? { service: selected.service, model: selected.model }
    : null;
}

export function setBrowserServiceSelection(selection: BrowserServiceSelection): void {
  storage()?.setItem(BROWSER_SERVICE_SELECTION_KEY, JSON.stringify(selection));
}

export function getBrowserLlmOverride(
  service?: string | null,
  model?: string | null,
): BrowserLlmOverride | undefined {
  const selected = service && model
    ? { service, model }
    : getBrowserServiceSelection();
  if (!selected) return undefined;
  const config = findBrowserService(selected.service);
  if (!config) return undefined;
  return {
    scope: "browser",
    service: config.service,
    model: selected.model || config.defaultModel || "",
    apiKey: config.apiKey,
    ...(config.baseUrl ? { baseUrl: config.baseUrl } : {}),
    apiFormat: config.apiFormat,
    stream: config.stream,
    temperature: config.temperature,
  };
}

function isBrowserCoverConfig(value: unknown): value is BrowserCoverConfig {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<BrowserCoverConfig>;
  return typeof item.service === "string"
    && typeof item.model === "string"
    && typeof item.apiKey === "string";
}

export function getBrowserCoverConfig(): BrowserCoverConfig | null {
  const value = readJson<unknown>(BROWSER_COVER_STORAGE_KEY);
  return isBrowserCoverConfig(value) ? value : null;
}

export function saveBrowserCoverConfig(config: BrowserCoverConfig): void {
  storage()?.setItem(BROWSER_COVER_STORAGE_KEY, JSON.stringify(config));
}

export function getBrowserCoverOverride(): BrowserCoverOverride | undefined {
  const config = getBrowserCoverConfig();
  return config ? { scope: "browser", ...config } : undefined;
}

export function withBrowserLlmOverride<T extends object>(body: T): T & {
  readonly llmOverride?: BrowserLlmOverride;
  readonly coverOverride?: BrowserCoverOverride;
} {
  const llmOverride = getBrowserLlmOverride();
  const coverOverride = getBrowserCoverOverride();
  return {
    ...body,
    ...(llmOverride ? { llmOverride } : {}),
    ...(coverOverride ? { coverOverride } : {}),
  };
}
