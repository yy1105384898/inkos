import { beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
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
});
