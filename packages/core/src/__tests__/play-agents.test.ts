import { describe, expect, it, vi } from "vitest";
import {
  PlayActionInterpreterAgent,
  PlaySceneRendererAgent,
  PlayWorldMutatorAgent,
  buildSceneRendererSystemPrompt,
} from "../play/play-agents.js";

const ctx = {
  client: { provider: "openai" } as never,
  model: "test-model",
  projectRoot: "/tmp/inkos-play-test",
};

describe("play agents", () => {
  it("interprets free user text into a bounded play action", async () => {
    const agent = new PlayActionInterpreterAgent(ctx);
    vi.spyOn(agent as unknown as { chat: PlayActionInterpreterAgent["chat"] }, "chat").mockResolvedValue({
      content: JSON.stringify({
        actionKind: "look",
        targetEntityLabel: "导航记录",
        intent: "查看常用地址统计",
        manner: "不让丈夫发现",
      }),
    } as never);

    await expect(agent.interpret({
      input: "我假装看天气，顺手点开车机导航记录",
      sceneBrief: "车内，丈夫刚把东西放进后备箱。",
    })).resolves.toMatchObject({
      actionKind: "look",
      targetEntityLabel: "导航记录",
      intent: "查看常用地址统计",
    });
  });

  it("degrades invalid mutator output into a safe no-op mutation instead of throwing", async () => {
    const agent = new PlayWorldMutatorAgent(ctx);
    vi.spyOn(agent as unknown as { chat: PlayWorldMutatorAgent["chat"] }, "chat").mockResolvedValue({
      content: JSON.stringify({ eventId: "", turn: -1, actionKind: "teleport" }),
    } as never);

    // The chat agent must not hard-crash on bad model output: the bad enum falls back to "do",
    // eventId is backfilled, and the turn degrades to a no-op rather than a thrown error.
    const mutation = await agent.proposeMutation({
      turn: 1,
      input: "我打开导航",
      action: { actionKind: "look", intent: "查看导航" },
      context: "车内。",
    });
    expect(mutation.actionKind).toBe("do");
    expect(mutation.eventId).toBe("evt-1");
    expect(mutation.entities.upsert).toEqual([]);
  });

  it("renders the applied state as prose plus suggested actions", async () => {
    const agent = new PlaySceneRendererAgent(ctx);
    vi.spyOn(agent as unknown as { chat: PlaySceneRendererAgent["chat"] }, "chat").mockResolvedValue({
      content: JSON.stringify({
        sceneText: "车机屏幕亮了一下，常用地址统计弹出一行冷冰冰的数字。",
        suggestedActions: ["继续翻看医院记录", "套徐晋安的话"],
      }),
    } as never);

    await expect(agent.render({
      input: "看导航",
      action: { actionKind: "look", intent: "查看导航" },
      mutationSummary: "发现新城花园 187 次。",
      stateBrief: "证据：常用地址统计=seen。",
    })).resolves.toMatchObject({
      sceneText: expect.stringContaining("车机屏幕"),
      suggestedActions: ["继续翻看医院记录", "套徐晋安的话"],
    });
  });
});

describe("scene renderer prompt by mode", () => {
  it("guided 模式把选项做成可选跳板，而非每回合强制", () => {
    const prompt = buildSceneRendererSystemPrompt("guided");
    expect(prompt).toContain("0-3");
    expect(prompt).toContain("不必每回合");
    expect(prompt).toContain("不是唯一前进方式");
    expect(prompt).not.toMatch(/必须给 2-4|每回合都要给/);
  });

  it("允许'在场'回合并让世界自走、不催玩家行动", () => {
    const prompt = buildSceneRendererSystemPrompt("guided");
    expect(prompt).toContain("呼吸"); // presence is a valid, breathing turn
    expect(prompt).toContain("世界不是死的"); // world runs on its own clock
  });

  it("open 模式不强制选项数量", () => {
    const prompt = buildSceneRendererSystemPrompt("open");
    expect(prompt).not.toContain("必须给 2-4");
  });

  it("renders the scene prompt in English when language is en", () => {
    const prompt = buildSceneRendererSystemPrompt("guided", "en");
    expect(prompt).toContain("interactive-fiction scene-response author");
    expect(prompt).toContain("suggestedActions");
    expect(prompt).not.toMatch(/[一-鿿]/); // no CJK leaks into the English prompt
  });
});
