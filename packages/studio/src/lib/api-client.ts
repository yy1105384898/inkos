import { Capacitor, CapacitorHttp } from "@capacitor/core";

const COOKIE_STORAGE_KEY = "inkos:native-api-cookies";

function isNativeHttpEnabled(): boolean {
  if (typeof window === "undefined") return false;
  return Capacitor.isNativePlatform() || window.location.protocol === "capacitor:";
}

function headersToRecord(headers: HeadersInit | undefined): Record<string, string> {
  if (!headers) return {};
  if (headers instanceof Headers) return Object.fromEntries(headers.entries());
  if (Array.isArray(headers)) return Object.fromEntries(headers);
  return { ...headers };
}

function getStoredCookieHeader(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(COOKIE_STORAGE_KEY) ?? "";
}

export function clearNativeApiCookies(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(COOKIE_STORAGE_KEY);
}

function storeSetCookieHeader(headers: Record<string, string>): void {
  if (typeof window === "undefined") return;
  const raw = headers["set-cookie"] ?? headers["Set-Cookie"];
  if (!raw) return;

  const previous = new Map(
    getStoredCookieHeader()
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        return index > 0 ? [part.slice(0, index), part] : [part, part];
      }),
  );

  for (const cookie of raw.split(/,(?=\s*[^;,]+=)/)) {
    const pair = cookie.split(";")[0]?.trim();
    const index = pair?.indexOf("=") ?? -1;
    if (!pair || index <= 0) continue;
    const name = pair.slice(0, index);
    const value = pair.slice(index + 1);
    if (!value) previous.delete(name);
    else previous.set(name, pair);
  }

  const next = [...previous.values()].join("; ");
  if (next) window.localStorage.setItem(COOKIE_STORAGE_KEY, next);
  else window.localStorage.removeItem(COOKIE_STORAGE_KEY);
}

function normalizeBody(body: BodyInit | null | undefined, headers: Record<string, string>): unknown {
  if (body == null) return undefined;
  if (typeof body !== "string") return body;

  const contentType = Object.entries(headers).find(([key]) => key.toLowerCase() === "content-type")?.[1] ?? "";
  if (contentType.includes("application/json")) {
    try {
      return JSON.parse(body);
    } catch {
      return body;
    }
  }
  return body;
}

export async function apiFetch(
  url: string,
  init: RequestInit = {},
  fetchImpl: typeof fetch = fetch,
): Promise<Response> {
  if (!isNativeHttpEnabled()) {
    return fetchImpl(url, { credentials: "include", ...init });
  }

  const headers = headersToRecord(init.headers);
  const cookie = getStoredCookieHeader();
  if (cookie) headers.Cookie = cookie;

  const response = await CapacitorHttp.request({
    url,
    method: (init.method ?? "GET").toUpperCase(),
    headers,
    data: normalizeBody(init.body, headers),
    responseType: "text",
  });

  storeSetCookieHeader(response.headers ?? {});

  const responseHeaders = new Headers();
  for (const [key, value] of Object.entries(response.headers ?? {})) {
    if (key.toLowerCase() !== "set-cookie") {
      responseHeaders.set(key, value);
    }
  }

  const body = typeof response.data === "string" ? response.data : JSON.stringify(response.data ?? "");
  return new Response(body, {
    status: response.status,
    statusText: String(response.status),
    headers: responseHeaders,
  });
}
