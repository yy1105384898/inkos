import { useState, useEffect, useCallback } from "react";
import { buildApiUrl } from "../lib/api-base";
import { apiFetch, clearNativeApiCookies } from "../lib/api-client";

export interface AuthUser {
  readonly id: string;
  readonly username: string;
  readonly role: string;
  readonly createdAt: string;
}

interface MeResponse {
  readonly user: AuthUser | null;
}

export interface AuthState {
  readonly user: AuthUser | null;
  readonly loading: boolean;
  readonly error: string | null;
  refresh(): Promise<void>;
  login(username: string, password: string): Promise<void>;
  register(username: string, password: string, invite?: string): Promise<void>;
  logout(): Promise<void>;
}

async function postAuth<T>(path: string, body: unknown): Promise<T> {
  const url = buildApiUrl(`/auth/${path}`);
  if (!url) throw new Error("API path is required");
  const res = await apiFetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const json = await res.json() as { error?: string | { message?: string } };
      if (typeof json?.error === "string") message = json.error;
      if (json?.error && typeof json.error === "object" && json.error.message) message = json.error.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  return await res.json() as T;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const url = buildApiUrl("/auth/me");
      if (!url) {
        setUser(null);
        return;
      }
      const res = await apiFetch(url);
      if (!res.ok) {
        setUser(null);
        return;
      }
      const json = await res.json() as MeResponse;
      setUser(json.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = () => {
      setUser(null);
    };
    window.addEventListener("inkos:unauthenticated", handler);
    return () => window.removeEventListener("inkos:unauthenticated", handler);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    setError(null);
    try {
      const json = await postAuth<{ user: AuthUser }>("login", { username, password });
      setUser(json.user);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      throw e;
    }
  }, []);

  const register = useCallback(async (username: string, password: string, invite?: string) => {
    setError(null);
    try {
      const json = await postAuth<{ user: AuthUser }>("register", { username, password, invite });
      setUser(json.user);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      setError(message);
      throw e;
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      const url = buildApiUrl("/auth/logout");
      if (url) {
        await apiFetch(url, { method: "POST" });
      }
    } finally {
      clearNativeApiCookies();
      setUser(null);
    }
  }, []);

  return { user, loading, error, refresh, login, register, logout };
}
