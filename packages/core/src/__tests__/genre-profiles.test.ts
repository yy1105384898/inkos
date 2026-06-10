import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { listAvailableGenres, readGenreProfile } from "../agents/rules-reader.js";

const NEW_CHINESE_GENRES = [
  "antihero",
  "apocalypse",
  "beast-taming",
  "brain-hole",
  "business",
  "campus",
  "court-politics",
  "crime",
  "cyberpunk",
  "detective",
  "e-sports",
  "entertainment",
  "family-ethics",
  "fantasy",
  "fanfic-zh",
  "farming",
  "female-lead",
  "food",
  "folklore",
  "game",
  "healing",
  "mystery",
  "historical",
  "kehuan",
  "legal",
  "light-novel",
  "live-stream",
  "mecha",
  "medical",
  "military",
  "myth",
  "officialdom",
  "palace",
  "period",
  "quick-transmigration",
  "rebirth",
  "romance",
  "slice-of-life",
  "space-opera",
  "sports",
  "steampunk",
  "summoning",
  "supernatural",
  "survival",
  "tomb-raider",
  "transmigration",
  "treasure-hunt",
  "western-fantasy",
  "workplace",
  "wuxia",
  "infinite-flow",
  "system-flow",
] as const;

describe("built-in Chinese genre profiles", () => {
  it("loads the added Chinese webnovel profiles", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "inkos-genre-profiles-"));
    try {
      for (const id of NEW_CHINESE_GENRES) {
        const { profile, body } = await readGenreProfile(tmp, id);
        expect(profile.id).toBe(id);
        expect(profile.language).toBe("zh");
        expect(profile.chapterTypes.length).toBeGreaterThan(0);
        expect(profile.satisfactionTypes.length).toBeGreaterThan(0);
        expect(body).toContain("## ");
      }
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });

  it("lists the added profiles as built-in genres", async () => {
    const tmp = await mkdtemp(join(tmpdir(), "inkos-genre-list-"));
    try {
      const genres = await listAvailableGenres(tmp);
      for (const id of NEW_CHINESE_GENRES) {
        expect(genres).toContainEqual(expect.objectContaining({ id, source: "builtin" }));
      }
    } finally {
      await rm(tmp, { recursive: true, force: true });
    }
  });
});
