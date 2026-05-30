import type { AgentMessage } from "@mariozechner/pi-agent-core";
import type { UserMessage } from "@mariozechner/pi-ai";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { isNewLayoutBook } from "../utils/outline-paths.js";

/** Stable files are placed first so upstream prompt-prefix caches can reuse them. */
const STABLE_PRIORITY_FILES = [
  "story_bible.md",
  "volume_outline.md",
  "book_rules.md",
];

/** Volatile files change often and should not break the stable cacheable prefix. */
const VOLATILE_PRIORITY_FILES = [
  "current_focus.md",
  "current_state.md",
  "pending_hooks.md",
  "chapter_summaries.md",
  "particle_ledger.md",
];

const UPGRADE_HINT =
  "提示：这本书仍在使用旧的条目式格式（story_bible.md / volume_outline.md / character_matrix.md）。" +
  "只有作者明确要求升级时，才调用 `sub_agent(architect, { revise: true, bookId, feedback })` " +
  "转换为段落式大纲 + 角色一人一档的新结构；不要擅自触发。";

export function createBookContextTransform(
  bookId: string | null,
  projectRoot: string,
): (messages: AgentMessage[], signal?: AbortSignal) => Promise<AgentMessage[]> {
  if (bookId === null) {
    return async (messages) => messages;
  }

  const bookDir = join(projectRoot, "books", bookId);
  const storyDir = join(bookDir, "story");

  return async (messages) => {
    const sections = await readTruthFiles(storyDir);
    if (sections.length === 0) return messages;

    const isNew = await isNewLayoutBook(bookDir);
    const hintBlock = isNew ? "" : UPGRADE_HINT;
    const stableSections = sections.filter((section) => !section.volatile);
    const volatileSections = sections.filter((section) => section.volatile);
    const stableBody = stableSections.map((s) => `=== ${s.name} ===\n${s.content}`).join("\n\n");
    const volatileBody = volatileSections.map((s) => `=== ${s.name} ===\n${s.content}`).join("\n\n");

    const body = [
      "以下为从磁盘注入的本书真相文件。请以它们为最高事实来源。",
      hintBlock,
      stableBody,
      volatileBody ? `以下为经常变化的当前状态，故意放在后面以提高上游前缀缓存命中率：\n${volatileBody}` : "",
    ].filter((part) => part.length > 0).join("\n\n");

    const injected: UserMessage = {
      role: "user",
      content: body,
      timestamp: Date.now(),
    };

    return [injected, ...messages];
  };
}

interface TruthFileSection {
  name: string;
  content: string;
  volatile: boolean;
}

async function readTruthFiles(storyDir: string): Promise<TruthFileSection[]> {
  let entries: string[];
  try {
    entries = await readdir(storyDir);
  } catch {
    return [];
  }

  const mdFiles = entries.filter((f) => f.endsWith(".md"));
  if (mdFiles.length === 0) return [];

  const stableSet = new Set(STABLE_PRIORITY_FILES);
  const volatileSet = new Set(VOLATILE_PRIORITY_FILES);
  const stablePrioritized = STABLE_PRIORITY_FILES.filter((f) => mdFiles.includes(f));
  const volatilePrioritized = VOLATILE_PRIORITY_FILES.filter((f) => mdFiles.includes(f));
  const restStable = mdFiles
    .filter((f) => !stableSet.has(f) && !volatileSet.has(f))
    .sort();
  const ordered = [...stablePrioritized, ...restStable, ...volatilePrioritized];

  const sections: TruthFileSection[] = [];
  for (const fileName of ordered) {
    try {
      const content = await readFile(join(storyDir, fileName), "utf-8");
      sections.push({ name: fileName, content, volatile: volatileSet.has(fileName) });
    } catch {
      // skip unreadable files
    }
  }
  return sections;
}
