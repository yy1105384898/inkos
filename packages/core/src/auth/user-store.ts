import { readFile, writeFile, mkdir, rename, access, readdir, rm, stat } from "node:fs/promises";
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { join } from "node:path";
import { isSafeBookId } from "../utils/book-id.js";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>;

export const USERS_DIR_NAME = "users";
export const META_DIR_NAME = ".inkos-meta";
const USERS_FILE = "users.json";
const SESSIONS_FILE = "sessions.json";
const INVITES_FILE = "invites.json";
const ARCHIVE_DIR_NAME = "_archived-users";
const SCRYPT_KEYLEN = 64;

export type UserRole = "admin" | "user";

export interface UserRecord {
  readonly id: string;
  readonly username: string;
  readonly passwordHash: string;
  readonly role: UserRole;
  readonly createdAt: string;
}

export interface SessionRecord {
  readonly id: string;
  readonly userId: string;
  readonly createdAt: string;
  readonly expiresAt: string;
}

export interface UsersFile {
  readonly users: ReadonlyArray<UserRecord>;
}

export interface SessionsFile {
  readonly sessions: ReadonlyArray<SessionRecord>;
}

function metaDir(dataRoot: string): string {
  return join(dataRoot, META_DIR_NAME);
}

function isValidUsername(username: string): boolean {
  return /^[a-zA-Z0-9_-]{3,32}$/.test(username);
}

function safeUserId(username: string): string {
  return username.toLowerCase();
}

export function userProjectRoot(dataRoot: string, userId: string): string {
  if (!/^[a-z0-9_-]{1,64}$/.test(userId)) {
    throw new Error(`Invalid user id: ${userId}`);
  }
  return join(dataRoot, USERS_DIR_NAME, userId);
}

async function readJson<T>(path: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJsonAtomic(path: string, data: unknown): Promise<void> {
  const tmp = `${path}.tmp`;
  await writeFile(tmp, JSON.stringify(data, null, 2), "utf-8");
  await rename(tmp, path);
}

export async function loadUsers(dataRoot: string): Promise<UsersFile> {
  await mkdir(metaDir(dataRoot), { recursive: true });
  return readJson<UsersFile>(join(metaDir(dataRoot), USERS_FILE), { users: [] });
}

export async function saveUsers(dataRoot: string, file: UsersFile): Promise<void> {
  await mkdir(metaDir(dataRoot), { recursive: true });
  await writeJsonAtomic(join(metaDir(dataRoot), USERS_FILE), file);
}

export async function loadSessions(dataRoot: string): Promise<SessionsFile> {
  await mkdir(metaDir(dataRoot), { recursive: true });
  const file = await readJson<SessionsFile>(
    join(metaDir(dataRoot), SESSIONS_FILE),
    { sessions: [] },
  );
  const now = Date.now();
  const fresh = file.sessions.filter((s) => Date.parse(s.expiresAt) > now);
  return { sessions: fresh };
}

export async function saveSessions(dataRoot: string, file: SessionsFile): Promise<void> {
  await mkdir(metaDir(dataRoot), { recursive: true });
  await writeJsonAtomic(join(metaDir(dataRoot), SESSIONS_FILE), file);
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, SCRYPT_KEYLEN);
  return `scrypt$${salt.toString("hex")}$${key.toString("hex")}`;
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const parts = hash.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const salt = Buffer.from(parts[1], "hex");
  const expected = Buffer.from(parts[2], "hex");
  const actual = await scrypt(password, salt, expected.length);
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export interface CreateUserInput {
  readonly username: string;
  readonly password: string;
  readonly role?: UserRole;
}

export async function createUser(
  dataRoot: string,
  input: CreateUserInput,
): Promise<UserRecord> {
  if (!isValidUsername(input.username)) {
    throw new Error("用户名必须为 3-32 位字母、数字、下划线或短横线");
  }
  if (input.password.length < 6) {
    throw new Error("密码至少 6 位");
  }
  const file = await loadUsers(dataRoot);
  const id = safeUserId(input.username);
  if (file.users.some((u) => u.id === id)) {
    throw new Error("用户已存在");
  }
  const record: UserRecord = {
    id,
    username: input.username,
    passwordHash: await hashPassword(input.password),
    role: input.role ?? (file.users.length === 0 ? "admin" : "user"),
    createdAt: new Date().toISOString(),
  };
  await saveUsers(dataRoot, { users: [...file.users, record] });
  await mkdir(userProjectRoot(dataRoot, id), { recursive: true });
  return record;
}

export async function findUserByUsername(
  dataRoot: string,
  username: string,
): Promise<UserRecord | null> {
  const file = await loadUsers(dataRoot);
  const id = safeUserId(username);
  return file.users.find((u) => u.id === id) ?? null;
}

export async function findUserById(
  dataRoot: string,
  userId: string,
): Promise<UserRecord | null> {
  const file = await loadUsers(dataRoot);
  return file.users.find((u) => u.id === userId) ?? null;
}

export async function authenticateUser(
  dataRoot: string,
  username: string,
  password: string,
): Promise<UserRecord | null> {
  const user = await findUserByUsername(dataRoot, username);
  if (!user) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  return ok ? user : null;
}

export interface CreateSessionOptions {
  readonly ttlMs?: number;
}

const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export async function createSession(
  dataRoot: string,
  userId: string,
  options?: CreateSessionOptions,
): Promise<SessionRecord> {
  const ttl = options?.ttlMs ?? DEFAULT_TTL_MS;
  const now = Date.now();
  const record: SessionRecord = {
    id: randomBytes(32).toString("hex"),
    userId,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttl).toISOString(),
  };
  const file = await loadSessions(dataRoot);
  await saveSessions(dataRoot, { sessions: [...file.sessions, record] });
  return record;
}

export async function findSession(
  dataRoot: string,
  sessionId: string,
): Promise<SessionRecord | null> {
  const file = await loadSessions(dataRoot);
  const found = file.sessions.find((s) => s.id === sessionId);
  if (!found) return null;
  if (Date.parse(found.expiresAt) <= Date.now()) return null;
  return found;
}

export async function deleteSession(
  dataRoot: string,
  sessionId: string,
): Promise<void> {
  const file = await loadSessions(dataRoot);
  const next = file.sessions.filter((s) => s.id !== sessionId);
  if (next.length !== file.sessions.length) {
    await saveSessions(dataRoot, { sessions: next });
  }
}

export async function listUsers(dataRoot: string): Promise<ReadonlyArray<UserRecord>> {
  const file = await loadUsers(dataRoot);
  return file.users;
}

export async function ensureLegacyMigration(
  dataRoot: string,
  options?: { readonly defaultUsername?: string; readonly defaultPassword?: string },
): Promise<{ readonly migrated: boolean; readonly userId?: string }> {
  const usersFile = await loadUsers(dataRoot);
  if (usersFile.users.length > 0) return { migrated: false };

  const looksLikeLegacy = await hasLegacyLayout(dataRoot);
  if (!looksLikeLegacy) return { migrated: false };

  const username = options?.defaultUsername ?? "admin";
  const password = options?.defaultPassword ?? randomBytes(9).toString("base64url");
  const created = await createUser(dataRoot, { username, password, role: "admin" });
  await migrateLegacyDataInto(dataRoot, created.id);
  if (!options?.defaultPassword) {
    console.warn(
      `[inkos] 已创建初始管理员账号 ${username},临时密码为: ${password} (请尽快登录后修改)`,
    );
  }
  return { migrated: true, userId: created.id };
}

async function pathExists(p: string): Promise<boolean> {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function hasLegacyLayout(dataRoot: string): Promise<boolean> {
  if (await pathExists(join(dataRoot, "books"))) return true;
  if (await pathExists(join(dataRoot, "inkos.json"))) return true;
  if (await pathExists(join(dataRoot, ".inkos"))) return true;
  return false;
}

const LEGACY_TOP_LEVEL = [
  "books",
  "radar",
  ".inkos",
  "inkos.json",
  "inkos.config.json",
  "inkos.yaml",
  "inkos.yml",
  "genres",
  "styles",
  "imports",
];

async function migrateLegacyDataInto(dataRoot: string, userId: string): Promise<void> {
  const target = userProjectRoot(dataRoot, userId);
  await mkdir(target, { recursive: true });
  let entries: string[];
  try {
    entries = await readdir(dataRoot);
  } catch {
    return;
  }
  for (const name of entries) {
    if (!LEGACY_TOP_LEVEL.includes(name)) continue;
    const from = join(dataRoot, name);
    const to = join(target, name);
    if (await pathExists(to)) continue;
    try {
      await rename(from, to);
    } catch {
      // 跨设备或权限等错误时忽略,留给运维手动处理
    }
  }
}

export const __testing__ = { hashPassword, verifyPassword };

// ===== Invites =====

export interface InviteRecord {
  readonly code: string;
  readonly createdBy: string;
  readonly role: UserRole;
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly usedBy?: string;
  readonly usedAt?: string;
}

export interface InvitesFile {
  readonly invites: ReadonlyArray<InviteRecord>;
}

export async function loadInvites(dataRoot: string): Promise<InvitesFile> {
  await mkdir(metaDir(dataRoot), { recursive: true });
  return readJson<InvitesFile>(join(metaDir(dataRoot), INVITES_FILE), { invites: [] });
}

async function saveInvites(dataRoot: string, file: InvitesFile): Promise<void> {
  await mkdir(metaDir(dataRoot), { recursive: true });
  await writeJsonAtomic(join(metaDir(dataRoot), INVITES_FILE), file);
}

export async function createInvite(
  dataRoot: string,
  options: { readonly createdBy: string; readonly role?: UserRole; readonly ttlMs?: number },
): Promise<InviteRecord> {
  const ttl = options.ttlMs ?? 7 * 24 * 60 * 60 * 1000;
  const now = Date.now();
  const record: InviteRecord = {
    code: randomBytes(12).toString("base64url"),
    createdBy: options.createdBy,
    role: options.role ?? "user",
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + ttl).toISOString(),
  };
  const file = await loadInvites(dataRoot);
  await saveInvites(dataRoot, { invites: [...file.invites, record] });
  return record;
}

export async function listInvites(dataRoot: string): Promise<ReadonlyArray<InviteRecord>> {
  const file = await loadInvites(dataRoot);
  return file.invites;
}

export async function revokeInvite(dataRoot: string, code: string): Promise<void> {
  const file = await loadInvites(dataRoot);
  const next = file.invites.filter((i) => i.code !== code);
  if (next.length !== file.invites.length) {
    await saveInvites(dataRoot, { invites: next });
  }
}

export async function redeemInvite(
  dataRoot: string,
  code: string,
  userId: string,
): Promise<InviteRecord | null> {
  const file = await loadInvites(dataRoot);
  const invite = file.invites.find((i) => i.code === code);
  if (!invite) return null;
  if (invite.usedBy) return null;
  if (Date.parse(invite.expiresAt) <= Date.now()) return null;
  const usedAt = new Date().toISOString();
  const updated: InviteRecord = { ...invite, usedBy: userId, usedAt };
  await saveInvites(dataRoot, {
    invites: file.invites.map((i) => (i.code === code ? updated : i)),
  });
  return updated;
}

// ===== User mutations =====

export async function changeUserPassword(
  dataRoot: string,
  userId: string,
  newPassword: string,
): Promise<UserRecord> {
  if (newPassword.length < 6) {
    throw new Error("密码至少 6 位");
  }
  const file = await loadUsers(dataRoot);
  const target = file.users.find((u) => u.id === userId);
  if (!target) throw new Error("用户不存在");
  const updated: UserRecord = {
    ...target,
    passwordHash: await hashPassword(newPassword),
  };
  await saveUsers(dataRoot, {
    users: file.users.map((u) => (u.id === userId ? updated : u)),
  });
  return updated;
}

export async function setUserRole(
  dataRoot: string,
  userId: string,
  role: UserRole,
): Promise<UserRecord> {
  const file = await loadUsers(dataRoot);
  const target = file.users.find((u) => u.id === userId);
  if (!target) throw new Error("用户不存在");
  if (target.role === role) return target;
  const remainingAdmins = file.users.filter((u) => u.role === "admin" && u.id !== userId).length;
  if (target.role === "admin" && role !== "admin" && remainingAdmins === 0) {
    throw new Error("不能移除最后一位管理员");
  }
  const updated: UserRecord = { ...target, role };
  await saveUsers(dataRoot, {
    users: file.users.map((u) => (u.id === userId ? updated : u)),
  });
  return updated;
}

export async function deleteUser(
  dataRoot: string,
  userId: string,
  options?: { readonly archive?: boolean },
): Promise<void> {
  const file = await loadUsers(dataRoot);
  const target = file.users.find((u) => u.id === userId);
  if (!target) return;
  const remainingAdmins = file.users.filter((u) => u.role === "admin" && u.id !== userId).length;
  if (target.role === "admin" && remainingAdmins === 0) {
    throw new Error("不能删除最后一位管理员");
  }
  await saveUsers(dataRoot, { users: file.users.filter((u) => u.id !== userId) });

  const sessions = await loadSessions(dataRoot);
  await saveSessions(dataRoot, {
    sessions: sessions.sessions.filter((s) => s.userId !== userId),
  });

  const userDir = userProjectRoot(dataRoot, userId);
  const archive = options?.archive ?? true;
  try {
    if (archive) {
      const archiveBase = join(dataRoot, ARCHIVE_DIR_NAME);
      await mkdir(archiveBase, { recursive: true });
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      await rename(userDir, join(archiveBase, `${userId}-${stamp}`));
    } else {
      await rm(userDir, { recursive: true, force: true });
    }
  } catch {
    // 数据目录可能已不存在,忽略
  }
}

// ===== Book ownership transfer =====

export async function transferBookOwnership(
  dataRoot: string,
  fromUserId: string,
  toUserId: string,
  bookId: string,
): Promise<void> {
  if (!isSafeBookId(bookId)) {
    throw new Error(`非法的 bookId: ${bookId}`);
  }
  const fromRoot = userProjectRoot(dataRoot, fromUserId);
  const toRoot = userProjectRoot(dataRoot, toUserId);
  const fromBook = join(fromRoot, "books", bookId);
  const toBook = join(toRoot, "books", bookId);
  try {
    await stat(fromBook);
  } catch {
    throw new Error(`源用户没有这本书: ${bookId}`);
  }
  try {
    await stat(toBook);
    throw new Error(`目标用户已有同名书: ${bookId}`);
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("目标用户")) throw error;
    // 期望的"不存在"分支
  }
  await mkdir(join(toRoot, "books"), { recursive: true });
  await rename(fromBook, toBook);
}
