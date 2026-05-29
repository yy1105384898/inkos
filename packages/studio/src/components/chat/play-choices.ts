import type { Message } from "../../store/chat/types";

const PLAY_TOOLS = new Set(["play_start", "play_step"]);

export function latestPlayChoices(messages: ReadonlyArray<Message>): string[] {
  for (let i = messages.length - 1; i >= 0; i--) {
    const parts = messages[i]?.parts ?? [];
    for (let p = parts.length - 1; p >= 0; p--) {
      const part = parts[p];
      if (part.type !== "tool") continue;
      const exec = part.execution;
      if (!PLAY_TOOLS.has(exec.tool) || exec.status !== "completed") continue;
      const details = exec.details as { suggestedActions?: unknown } | undefined;
      const actions = Array.isArray(details?.suggestedActions)
        ? details.suggestedActions.filter((a): a is string => typeof a === "string" && a.trim().length > 0)
        : [];
      return actions;
    }
  }
  return [];
}
