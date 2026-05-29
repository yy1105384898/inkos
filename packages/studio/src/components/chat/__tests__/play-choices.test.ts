import { describe, it, expect } from "vitest";
import { latestPlayChoices } from "../play-choices";

describe("latestPlayChoices", () => {
  it("returns suggestedActions from the most recent play tool execution", () => {
    const messages = [
      { role: "assistant", parts: [{ type: "tool", execution: { tool: "play_start", status: "completed", details: { kind: "play_world_started", suggestedActions: ["看账本", "问来人"] } } }] },
      { role: "assistant", parts: [{ type: "tool", execution: { tool: "play_step", status: "completed", details: { kind: "play_turn_advanced", suggestedActions: ["上楼", "离开"] } } }] },
    ] as any;
    expect(latestPlayChoices(messages)).toEqual(["上楼", "离开"]);
  });

  it("returns [] when there is no play execution", () => {
    expect(latestPlayChoices([{ role: "user", content: "hi" }] as any)).toEqual([]);
  });
});
