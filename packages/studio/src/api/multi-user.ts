import { Hono } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";
import {
  authenticateUser,
  changeUserPassword,
  createInvite,
  createSession,
  createUser,
  deleteSession,
  deleteUser,
  ensureLegacyMigration,
  findSession,
  findUserById,
  listInvites,
  listUsers,
  loadProjectConfig,
  redeemInvite,
  revokeInvite,
  runInUserContext,
  setUserRole,
  transferBookOwnership,
  userProjectRoot,
  type ProjectConfig,
  type UserRecord,
} from "@actalk/inkos-core";
import { mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createStudioServer } from "./server.js";

export const SESSION_COOKIE = "inkos_sid";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

interface PerUserApp {
  readonly fetch: (request: Request) => Response | Promise<Response>;
}

interface CachedUserServer {
  readonly app: PerUserApp;
  readonly projectRoot: string;
}

export interface CreateMultiUserStudioOptions {
  readonly allowOpenRegistration?: boolean;
  readonly initialAdminUsername?: string;
  readonly initialAdminPassword?: string;
}

interface AdminEnv {
  Variables: {
    currentUser?: UserRecord;
  };
}

export async function createMultiUserStudioServer(
  dataRoot: string,
  options: CreateMultiUserStudioOptions = {},
): Promise<Hono<AdminEnv>> {
  await mkdir(dataRoot, { recursive: true });
  await ensureLegacyMigration(dataRoot, {
    defaultUsername: options.initialAdminUsername,
    defaultPassword: options.initialAdminPassword,
  });

  const app = new Hono<AdminEnv>();
  const userServers = new Map<string, CachedUserServer>();

  async function getOrBuildUserServer(userId: string): Promise<CachedUserServer> {
    const cached = userServers.get(userId);
    if (cached) return cached;
    const projectRoot = userProjectRoot(dataRoot, userId);
    await mkdir(projectRoot, { recursive: true });
    await ensureBootstrapProjectConfig(projectRoot);
    let config: ProjectConfig;
    try {
      config = await loadProjectConfig(projectRoot, {
        consumer: "studio",
        requireApiKey: false,
      });
    } catch (error) {
      console.error(`[studio] Failed to load project config for user ${userId}`, error);
      throw error;
    }
    const inner = createStudioServer(config, projectRoot);
    const entry: CachedUserServer = { app: inner, projectRoot };
    userServers.set(userId, entry);
    return entry;
  }

  app.post("/api/v1/auth/register", async (c) => {
    const existing = await listUsers(dataRoot);
    let body: { username?: unknown; password?: unknown; invite?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "INVALID_BODY", message: "请求体非法" } }, 400);
    }
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    const inviteCode = typeof body.invite === "string" ? body.invite.trim() : "";
    if (!username || !password) {
      return c.json({ error: { code: "INVALID_CREDENTIALS", message: "用户名和密码不能为空" } }, 400);
    }

    const isFirstUser = existing.length === 0;
    const allowOpen = options.allowOpenRegistration ?? isFirstUser;
    let assignedRole: "admin" | "user" | undefined;

    if (!isFirstUser && !allowOpen) {
      if (!inviteCode) {
        return c.json({ error: { code: "INVITE_REQUIRED", message: "需要邀请码" } }, 403);
      }
    }

    try {
      const user = await createUser(dataRoot, { username, password, role: assignedRole });
      if (!isFirstUser && inviteCode) {
        const redeemed = await redeemInvite(dataRoot, inviteCode, user.id);
        if (!redeemed) {
          await deleteUser(dataRoot, user.id, { archive: false });
          return c.json({ error: { code: "INVALID_INVITE", message: "邀请码无效或已使用" } }, 400);
        }
        if (redeemed.role === "admin") {
          await setUserRole(dataRoot, user.id, "admin");
        }
      }
      const session = await createSession(dataRoot, user.id, { ttlMs: SESSION_TTL_MS });
      setCookie(c, SESSION_COOKIE, session.id, {
        httpOnly: true,
        sameSite: "Lax",
        path: "/",
        maxAge: Math.floor(SESSION_TTL_MS / 1000),
      });
      return c.json({ user: publicUser(await findUserById(dataRoot, user.id) ?? user) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "注册失败";
      return c.json({ error: { code: "REGISTRATION_FAILED", message } }, 400);
    }
  });

  app.post("/api/v1/auth/login", async (c) => {
    let body: { username?: unknown; password?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: { code: "INVALID_BODY", message: "请求体非法" } }, 400);
    }
    const username = typeof body.username === "string" ? body.username.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";
    if (!username || !password) {
      return c.json({ error: { code: "INVALID_CREDENTIALS", message: "用户名和密码不能为空" } }, 400);
    }
    const user = await authenticateUser(dataRoot, username, password);
    if (!user) {
      return c.json({ error: { code: "INVALID_CREDENTIALS", message: "用户名或密码错误" } }, 401);
    }
    const session = await createSession(dataRoot, user.id, { ttlMs: SESSION_TTL_MS });
    setCookie(c, SESSION_COOKIE, session.id, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    });
    return c.json({ user: publicUser(user) });
  });

  app.post("/api/v1/auth/logout", async (c) => {
    const sid = getCookie(c, SESSION_COOKIE);
    if (sid) {
      await deleteSession(dataRoot, sid);
    }
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ ok: true });
  });

  app.get("/api/v1/auth/me", async (c) => {
    const sid = getCookie(c, SESSION_COOKIE);
    if (!sid) return c.json({ user: null });
    const session = await findSession(dataRoot, sid);
    if (!session) return c.json({ user: null });
    const user = await findUserById(dataRoot, session.userId);
    if (!user) return c.json({ user: null });
    return c.json({ user: publicUser(user) });
  });

  app.use("/api/v1/*", async (c, next) => {
    const path = c.req.path;
    if (path.startsWith("/api/v1/auth/")) {
      return next();
    }
    const sid = getCookie(c, SESSION_COOKIE);
    if (!sid) {
      return c.json({ error: { code: "UNAUTHENTICATED", message: "未登录" } }, 401);
    }
    const session = await findSession(dataRoot, sid);
    if (!session) {
      deleteCookie(c, SESSION_COOKIE, { path: "/" });
      return c.json({ error: { code: "UNAUTHENTICATED", message: "会话已过期" } }, 401);
    }
    const user = await findUserById(dataRoot, session.userId);
    if (!user) {
      await deleteSession(dataRoot, sid);
      deleteCookie(c, SESSION_COOKIE, { path: "/" });
      return c.json({ error: { code: "UNAUTHENTICATED", message: "用户不存在" } }, 401);
    }
    if (path.startsWith("/api/v1/admin/")) {
      if (user.role !== "admin") {
        return c.json({ error: { code: "FORBIDDEN", message: "需要管理员权限" } }, 403);
      }
      c.set("currentUser", user);
      return next();
    }
    const entry = await getOrBuildUserServer(user.id);
    return runInUserContext(
      { userId: user.id, username: user.username, projectRoot: entry.projectRoot },
      async () => entry.app.fetch(c.req.raw),
    );
  });

  // ===== Admin routes =====

  app.get("/api/v1/admin/users", async (c) => {
    const users = await listUsers(dataRoot);
    return c.json({ users: users.map(publicUser) });
  });

  app.post("/api/v1/admin/users", async (c) => {
    const body = await readJsonBody<{ username?: string; password?: string; role?: "admin" | "user" }>(c);
    if (!body) return c.json({ error: { code: "INVALID_BODY", message: "请求体非法" } }, 400);
    if (!body.username || !body.password) {
      return c.json({ error: { code: "INVALID_BODY", message: "用户名和密码必填" } }, 400);
    }
    try {
      const user = await createUser(dataRoot, {
        username: body.username,
        password: body.password,
        role: body.role,
      });
      return c.json({ user: publicUser(user) });
    } catch (error) {
      return c.json(
        { error: { code: "CREATE_FAILED", message: error instanceof Error ? error.message : "创建失败" } },
        400,
      );
    }
  });

  app.post("/api/v1/admin/users/:id/password", async (c) => {
    const id = c.req.param("id");
    const body = await readJsonBody<{ password?: string }>(c);
    if (!body?.password) return c.json({ error: { code: "INVALID_BODY", message: "缺少 password" } }, 400);
    try {
      await changeUserPassword(dataRoot, id, body.password);
      return c.json({ ok: true });
    } catch (error) {
      return c.json(
        { error: { code: "UPDATE_FAILED", message: error instanceof Error ? error.message : "更新失败" } },
        400,
      );
    }
  });

  app.post("/api/v1/admin/users/:id/role", async (c) => {
    const id = c.req.param("id");
    const body = await readJsonBody<{ role?: "admin" | "user" }>(c);
    if (!body?.role) return c.json({ error: { code: "INVALID_BODY", message: "缺少 role" } }, 400);
    try {
      const user = await setUserRole(dataRoot, id, body.role);
      userServers.delete(id);
      return c.json({ user: publicUser(user) });
    } catch (error) {
      return c.json(
        { error: { code: "UPDATE_FAILED", message: error instanceof Error ? error.message : "更新失败" } },
        400,
      );
    }
  });

  app.delete("/api/v1/admin/users/:id", async (c) => {
    const id = c.req.param("id");
    const current = c.get("currentUser");
    if (current?.id === id) {
      return c.json({ error: { code: "FORBIDDEN", message: "不能删除自己" } }, 400);
    }
    try {
      await deleteUser(dataRoot, id);
      userServers.delete(id);
      return c.json({ ok: true });
    } catch (error) {
      return c.json(
        { error: { code: "DELETE_FAILED", message: error instanceof Error ? error.message : "删除失败" } },
        400,
      );
    }
  });

  app.get("/api/v1/admin/invites", async (c) => {
    const invites = await listInvites(dataRoot);
    return c.json({ invites });
  });

  app.post("/api/v1/admin/invites", async (c) => {
    const body = await readJsonBody<{ role?: "admin" | "user"; ttlHours?: number }>(c);
    const current = c.get("currentUser");
    if (!current) return c.json({ error: { code: "UNAUTHENTICATED", message: "未登录" } }, 401);
    const ttlMs = Math.max(1, body?.ttlHours ?? 24 * 7) * 60 * 60 * 1000;
    const invite = await createInvite(dataRoot, {
      createdBy: current.id,
      role: body?.role ?? "user",
      ttlMs,
    });
    return c.json({ invite });
  });

  app.delete("/api/v1/admin/invites/:code", async (c) => {
    await revokeInvite(dataRoot, c.req.param("code"));
    return c.json({ ok: true });
  });

  app.get("/api/v1/admin/books", async (c) => {
    const users = await listUsers(dataRoot);
    const result: Array<{ userId: string; username: string; books: string[] }> = [];
    for (const user of users) {
      const booksDir = join(userProjectRoot(dataRoot, user.id), "books");
      try {
        const entries = await readdir(booksDir, { withFileTypes: true });
        const books: string[] = [];
        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          try {
            await stat(join(booksDir, entry.name, "book.json"));
            books.push(entry.name);
          } catch {
            // not a book directory
          }
        }
        result.push({ userId: user.id, username: user.username, books });
      } catch {
        result.push({ userId: user.id, username: user.username, books: [] });
      }
    }
    return c.json({ owners: result });
  });

  app.post("/api/v1/admin/books/:userId/:bookId/transfer", async (c) => {
    const fromUserId = c.req.param("userId");
    const bookId = c.req.param("bookId");
    const body = await readJsonBody<{ targetUserId?: string }>(c);
    if (!body?.targetUserId) {
      return c.json({ error: { code: "INVALID_BODY", message: "缺少 targetUserId" } }, 400);
    }
    try {
      await transferBookOwnership(dataRoot, fromUserId, body.targetUserId, bookId);
      userServers.delete(fromUserId);
      userServers.delete(body.targetUserId);
      return c.json({ ok: true });
    } catch (error) {
      return c.json(
        { error: { code: "TRANSFER_FAILED", message: error instanceof Error ? error.message : "转移失败" } },
        400,
      );
    }
  });

  return app;
}

async function readJsonBody<T>(c: { req: { json(): Promise<unknown> } }): Promise<T | null> {
  try {
    return (await c.req.json()) as T;
  } catch {
    return null;
  }
}

interface PublicUser {
  readonly id: string;
  readonly username: string;
  readonly role: string;
  readonly createdAt: string;
}

function publicUser(user: { id: string; username: string; role: string; createdAt: string }): PublicUser {
  return { id: user.id, username: user.username, role: user.role, createdAt: user.createdAt };
}

async function ensureBootstrapProjectConfig(projectRoot: string): Promise<void> {
  const configPath = join(projectRoot, "inkos.json");
  try {
    await stat(configPath);
    return;
  } catch {
    // Missing project config is expected for freshly created or manually seeded users.
  }

  const bootstrapConfig = {
    name: "我的小说",
    version: "0.1.0",
    language: "zh",
    llm: {
      provider: "openai",
      service: "custom",
      configSource: "studio",
      baseUrl: "",
      model: "",
      apiFormat: "chat",
      stream: true,
    },
    notify: [],
    inputGovernanceMode: "v2",
  };

  await writeFile(configPath, JSON.stringify(bootstrapConfig, null, 2), "utf-8");
}
