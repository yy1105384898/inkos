import { AsyncLocalStorage } from "node:async_hooks";

export interface UserContext {
  readonly userId: string;
  readonly username: string;
  readonly projectRoot: string;
}

const storage = new AsyncLocalStorage<UserContext>();

export function runInUserContext<T>(ctx: UserContext, fn: () => Promise<T> | T): Promise<T> | T {
  return storage.run(ctx, fn);
}

export function getCurrentUser(): UserContext | undefined {
  return storage.getStore();
}

export function requireCurrentUser(): UserContext {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new Error("No active user context — request did not pass through auth middleware");
  }
  return ctx;
}
