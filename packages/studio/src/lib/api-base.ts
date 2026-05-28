export const API_PREFIX = "/api/v1";
export const API_BASE_STORAGE_KEY = "inkos:api-base-url";
export const API_BASE_CHANGE_EVENT = "inkos:api-base-url-change";
export const DEFAULT_ANDROID_API_BASE_URL = "https://yybooks.yangyangnj.top";

function hasProtocol(value: string): boolean {
  return /^[a-z][a-z\d+\-.]*:\/\//i.test(value);
}

export function normalizeApiBaseUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  const candidate = hasProtocol(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(candidate);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Server URL must start with http:// or https://");
  }

  url.hash = "";
  url.search = "";
  let pathname = url.pathname.replace(/\/+$/, "");
  if (pathname.endsWith(API_PREFIX)) {
    pathname = pathname.slice(0, -API_PREFIX.length);
  }
  return `${url.origin}${pathname}`;
}

export function getApiBaseUrl(): string {
  if (typeof window === "undefined") return "";
  if (isLikelyCapacitorShell()) return DEFAULT_ANDROID_API_BASE_URL;
  const saved = window.localStorage.getItem(API_BASE_STORAGE_KEY) ?? "";
  try {
    const normalized = normalizeApiBaseUrl(saved);
    return normalized;
  } catch {
    return "";
  }
}

export function getInitialApiBaseUrl(): string {
  if (typeof window === "undefined") return DEFAULT_ANDROID_API_BASE_URL;
  if (isLikelyCapacitorShell()) return DEFAULT_ANDROID_API_BASE_URL;
  const saved = window.localStorage.getItem(API_BASE_STORAGE_KEY);
  if (saved !== null) {
    try {
      return normalizeApiBaseUrl(saved);
    } catch {
      return "";
    }
  }
  return DEFAULT_ANDROID_API_BASE_URL;
}

function isLikelyCapacitorShell(): boolean {
  if (typeof window === "undefined") return false;
  const maybeCapacitor = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  if (maybeCapacitor?.isNativePlatform?.()) return true;
  if (window.location.protocol === "capacitor:") return true;
  return window.location.hostname === "localhost" && window.location.protocol !== "http:";
}

export function setApiBaseUrl(value: string): string {
  const normalized = normalizeApiBaseUrl(value);
  if (typeof window !== "undefined") {
    if (normalized) {
      window.localStorage.setItem(API_BASE_STORAGE_KEY, normalized);
    } else {
      window.localStorage.removeItem(API_BASE_STORAGE_KEY);
    }
    window.dispatchEvent(new CustomEvent(API_BASE_CHANGE_EVENT, { detail: normalized }));
  }
  return normalized;
}

export function buildApiPath(path: string): string | null {
  const normalized = String(path ?? "").trim();
  if (!normalized) return null;

  if (hasProtocol(normalized)) {
    const url = new URL(normalized);
    return `${url.pathname}${url.search}`;
  }

  if (normalized.startsWith(`${API_PREFIX}/`) || normalized === API_PREFIX) {
    return normalized;
  }
  return normalized.startsWith("/") ? `${API_PREFIX}${normalized}` : `${API_PREFIX}/${normalized}`;
}

export function buildApiUrl(path: string): string | null {
  const normalized = String(path ?? "").trim();
  if (!normalized) return null;
  if (hasProtocol(normalized)) return normalized;

  const apiPath = buildApiPath(normalized);
  if (!apiPath) return null;
  const base = getApiBaseUrl();
  return base ? `${base}${apiPath}` : apiPath;
}
