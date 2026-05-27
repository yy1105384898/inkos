import { describe, it, expect, beforeEach } from "vitest";
import { mkdtemp, rm, mkdir, writeFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createUser,
  authenticateUser,
  createSession,
  findSession,
  deleteSession,
  ensureLegacyMigration,
  userProjectRoot,
  listUsers,
  loadUsers,
  USERS_DIR_NAME,
  changeUserPassword,
  setUserRole,
  deleteUser,
  createInvite,
  redeemInvite,
  listInvites,
  revokeInvite,
  transferBookOwnership,
} from "../auth/user-store.js";

let dataRoot: string;

beforeEach(async () => {
  dataRoot = await mkdtemp(join(tmpdir(), "inkos-auth-"));
  return async () => {
    await rm(dataRoot, { recursive: true, force: true });
  };
});

describe("user-store", () => {
  it("creates a user and authenticates with the correct password", async () => {
    const user = await createUser(dataRoot, { username: "alice", password: "hunter22" });
    expect(user.id).toBe("alice");
    expect(user.role).toBe("admin");
    expect(user.passwordHash).not.toContain("hunter22");

    const ok = await authenticateUser(dataRoot, "alice", "hunter22");
    expect(ok?.id).toBe("alice");

    const bad = await authenticateUser(dataRoot, "alice", "wrong");
    expect(bad).toBeNull();
  });

  it("rejects duplicate usernames case-insensitively", async () => {
    await createUser(dataRoot, { username: "Bob", password: "secret123" });
    await expect(createUser(dataRoot, { username: "bob", password: "other123" })).rejects.toThrow();
  });

  it("only the first user becomes admin", async () => {
    const a = await createUser(dataRoot, { username: "first", password: "abcdef" });
    const b = await createUser(dataRoot, { username: "second", password: "abcdef" });
    expect(a.role).toBe("admin");
    expect(b.role).toBe("user");
  });

  it("rejects weak credentials", async () => {
    await expect(createUser(dataRoot, { username: "ab", password: "secret123" })).rejects.toThrow();
    await expect(createUser(dataRoot, { username: "good", password: "12345" })).rejects.toThrow();
  });

  it("creates and revokes sessions", async () => {
    const user = await createUser(dataRoot, { username: "carol", password: "hunter22" });
    const session = await createSession(dataRoot, user.id);
    const found = await findSession(dataRoot, session.id);
    expect(found?.userId).toBe(user.id);

    await deleteSession(dataRoot, session.id);
    expect(await findSession(dataRoot, session.id)).toBeNull();
  });

  it("expired sessions are not returned", async () => {
    const user = await createUser(dataRoot, { username: "dave", password: "hunter22" });
    const session = await createSession(dataRoot, user.id, { ttlMs: -1 });
    expect(await findSession(dataRoot, session.id)).toBeNull();
  });

  it("userProjectRoot rejects path traversal", () => {
    expect(() => userProjectRoot(dataRoot, "../escape")).toThrow();
    expect(() => userProjectRoot(dataRoot, "a/b")).toThrow();
  });

  it("ensureLegacyMigration moves legacy data into the default admin user", async () => {
    await mkdir(join(dataRoot, "books", "demo"), { recursive: true });
    await writeFile(join(dataRoot, "books", "demo", "book.json"), "{}");
    await writeFile(join(dataRoot, "inkos.json"), "{}");

    const result = await ensureLegacyMigration(dataRoot, {
      defaultUsername: "admin",
      defaultPassword: "supersecret",
    });
    expect(result.migrated).toBe(true);
    expect(result.userId).toBe("admin");

    const users = await listUsers(dataRoot);
    expect(users).toHaveLength(1);
    expect(users[0].username).toBe("admin");

    const adminRoot = userProjectRoot(dataRoot, "admin");
    const movedBooks = await readdir(join(adminRoot, "books"));
    expect(movedBooks).toContain("demo");
  });

  it("ensureLegacyMigration is a no-op when users already exist", async () => {
    await createUser(dataRoot, { username: "alice", password: "hunter22" });
    const before = await loadUsers(dataRoot);
    const result = await ensureLegacyMigration(dataRoot);
    expect(result.migrated).toBe(false);
    const after = await loadUsers(dataRoot);
    expect(after.users.length).toBe(before.users.length);
  });

  it("places per-user data under <dataRoot>/users/<id>", () => {
    const root = userProjectRoot(dataRoot, "alice");
    expect(root).toBe(join(dataRoot, USERS_DIR_NAME, "alice"));
  });

  it("changes a password and invalidates the old one", async () => {
    await createUser(dataRoot, { username: "edward", password: "hunter22" });
    await changeUserPassword(dataRoot, "edward", "newpass1");
    expect(await authenticateUser(dataRoot, "edward", "hunter22")).toBeNull();
    expect((await authenticateUser(dataRoot, "edward", "newpass1"))?.id).toBe("edward");
  });

  it("changeUserPassword rejects too-short passwords", async () => {
    await createUser(dataRoot, { username: "edward", password: "hunter22" });
    await expect(changeUserPassword(dataRoot, "edward", "12345")).rejects.toThrow();
  });

  it("setUserRole protects the last admin", async () => {
    await createUser(dataRoot, { username: "alice", password: "hunter22" });
    await expect(setUserRole(dataRoot, "alice", "user")).rejects.toThrow();
    await createUser(dataRoot, { username: "bob", password: "hunter22" });
    await setUserRole(dataRoot, "bob", "admin");
    const after = await setUserRole(dataRoot, "alice", "user");
    expect(after.role).toBe("user");
  });

  it("deleteUser archives the user dir and removes sessions", async () => {
    await createUser(dataRoot, { username: "alice", password: "hunter22" });
    await createUser(dataRoot, { username: "bob", password: "hunter22" });
    const session = await createSession(dataRoot, "bob");
    await deleteUser(dataRoot, "bob");
    expect(await findSession(dataRoot, session.id)).toBeNull();
    const users = await listUsers(dataRoot);
    expect(users.find((u) => u.id === "bob")).toBeUndefined();
  });

  it("deleteUser cannot remove the last admin", async () => {
    await createUser(dataRoot, { username: "alice", password: "hunter22" });
    await expect(deleteUser(dataRoot, "alice")).rejects.toThrow();
  });

  it("invites can be created and redeemed once", async () => {
    await createUser(dataRoot, { username: "owner", password: "hunter22" });
    const invite = await createInvite(dataRoot, { createdBy: "owner", role: "user" });
    await createUser(dataRoot, { username: "guest", password: "hunter22" });
    const redeemed = await redeemInvite(dataRoot, invite.code, "guest");
    expect(redeemed?.usedBy).toBe("guest");
    const second = await redeemInvite(dataRoot, invite.code, "guest");
    expect(second).toBeNull();
  });

  it("expired invites cannot be redeemed", async () => {
    await createUser(dataRoot, { username: "owner", password: "hunter22" });
    const invite = await createInvite(dataRoot, { createdBy: "owner", ttlMs: -1 });
    await createUser(dataRoot, { username: "guest", password: "hunter22" });
    expect(await redeemInvite(dataRoot, invite.code, "guest")).toBeNull();
  });

  it("revokeInvite removes the invite", async () => {
    await createUser(dataRoot, { username: "owner", password: "hunter22" });
    const invite = await createInvite(dataRoot, { createdBy: "owner" });
    await revokeInvite(dataRoot, invite.code);
    const list = await listInvites(dataRoot);
    expect(list.find((i) => i.code === invite.code)).toBeUndefined();
  });

  it("transferBookOwnership moves the book directory", async () => {
    await createUser(dataRoot, { username: "alice", password: "hunter22" });
    await createUser(dataRoot, { username: "bob", password: "hunter22" });
    const aliceBookDir = join(userProjectRoot(dataRoot, "alice"), "books", "demo");
    await mkdir(aliceBookDir, { recursive: true });
    await writeFile(join(aliceBookDir, "book.json"), "{}");

    await transferBookOwnership(dataRoot, "alice", "bob", "demo");

    const bobBook = await readdir(join(userProjectRoot(dataRoot, "bob"), "books"));
    expect(bobBook).toContain("demo");
    await expect(readdir(aliceBookDir)).rejects.toThrow();
  });

  it("transferBookOwnership accepts Chinese book ids", async () => {
    await createUser(dataRoot, { username: "alice", password: "hunter22" });
    await createUser(dataRoot, { username: "bob", password: "hunter22" });
    const bookId = "运潮帝道-布局苍生-举国证仙";
    const aliceBookDir = join(userProjectRoot(dataRoot, "alice"), "books", bookId);
    await mkdir(aliceBookDir, { recursive: true });
    await writeFile(join(aliceBookDir, "book.json"), "{}");

    await transferBookOwnership(dataRoot, "alice", "bob", bookId);

    const bobBook = await readdir(join(userProjectRoot(dataRoot, "bob"), "books"));
    expect(bobBook).toContain(bookId);
    await expect(readdir(aliceBookDir)).rejects.toThrow();
  });

  it("transferBookOwnership refuses to overwrite existing target", async () => {
    await createUser(dataRoot, { username: "alice", password: "hunter22" });
    await createUser(dataRoot, { username: "bob", password: "hunter22" });
    const aliceBook = join(userProjectRoot(dataRoot, "alice"), "books", "demo");
    const bobBook = join(userProjectRoot(dataRoot, "bob"), "books", "demo");
    await mkdir(aliceBook, { recursive: true });
    await writeFile(join(aliceBook, "book.json"), "{}");
    await mkdir(bobBook, { recursive: true });
    await writeFile(join(bobBook, "book.json"), "{}");
    await expect(transferBookOwnership(dataRoot, "alice", "bob", "demo")).rejects.toThrow();
  });
});
