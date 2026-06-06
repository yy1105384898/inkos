import { beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createSession,
  createUser,
  userProjectRoot,
} from "@actalk/inkos-core";
import { createMultiUserStudioServer, SESSION_COOKIE } from "./multi-user";

let dataRoot: string;

beforeEach(async () => {
  dataRoot = await mkdtemp(join(tmpdir(), "inkos-multi-user-"));
});

describe("createMultiUserStudioServer", () => {
  async function adminCookie() {
    const user = await createUser(dataRoot, { username: "admin", password: "Yy19971215", role: "admin" });
    const session = await createSession(dataRoot, user.id);
    return {
      user,
      headers: { Cookie: `${SESSION_COOKIE}=${session.id}` },
    };
  }

  it("bootstraps a per-user inkos.json before serving project data", async () => {
    const user = await createUser(dataRoot, { username: "yangyang", password: "Yy19971215", role: "admin" });
    const session = await createSession(dataRoot, user.id);
    const app = await createMultiUserStudioServer(dataRoot);

    const response = await app.request("http://localhost/api/v1/project", {
      headers: {
        Cookie: `${SESSION_COOKIE}=${session.id}`,
      },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      name: "我的小说",
      language: "zh",
      languageExplicit: true,
    });

    const raw = await readFile(join(userProjectRoot(dataRoot, user.id), "inkos.json"), "utf-8");
    expect(JSON.parse(raw)).toMatchObject({
      name: "我的小说",
      version: "0.1.0",
      language: "zh",
    });
  });

  it("creates admin invites with a custom expiry", async () => {
    const { headers } = await adminCookie();
    const app = await createMultiUserStudioServer(dataRoot);

    const before = Date.now();
    const response = await app.request("http://localhost/api/v1/admin/invites", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ role: "user", ttlHours: 2 }),
    });

    expect(response.status).toBe(200);
    const payload = await response.json() as { invite: { expiresAt: string } };
    const expiresAt = new Date(payload.invite.expiresAt).getTime();
    expect(expiresAt - before).toBeGreaterThanOrEqual(2 * 60 * 60 * 1000 - 5_000);
    expect(expiresAt - before).toBeLessThanOrEqual(2 * 60 * 60 * 1000 + 5_000);
  });

  it("rejects invalid invite expiry", async () => {
    const { headers } = await adminCookie();
    const app = await createMultiUserStudioServer(dataRoot);

    const response = await app.request("http://localhost/api/v1/admin/invites", {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ role: "user", ttlHours: 0 }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INVALID_BODY" },
    });
  });

  it("lists all user books with titles for admins", async () => {
    const { headers } = await adminCookie();
    const author = await createUser(dataRoot, { username: "author", password: "Yy19971215", role: "user" });
    const bookDir = join(userProjectRoot(dataRoot, author.id), "books", "river");
    await mkdir(bookDir, { recursive: true });
    await writeFile(join(bookDir, "book.json"), JSON.stringify({
      id: "river",
      title: "长河旧梦",
      genre: "都市",
      status: "active",
      platform: "other",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }), "utf-8");
    const app = await createMultiUserStudioServer(dataRoot);

    const response = await app.request("http://localhost/api/v1/admin/books", { headers });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      owners: expect.arrayContaining([
        {
          userId: author.id,
          username: "author",
          books: expect.arrayContaining([
            expect.objectContaining({ id: "river", title: "长河旧梦", genre: "都市", status: "active" }),
          ]),
        },
      ]),
    });
  });
});
