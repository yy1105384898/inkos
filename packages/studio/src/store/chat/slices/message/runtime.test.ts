import { describe, expect, it } from "vitest";
import { extractErrorMessage, extractToolError, settleStreamingMessage } from "./runtime";

describe("chat runtime error copy", () => {
  it("localizes known assistant errors", () => {
    expect(extractErrorMessage({
      message: "Latest chapter 1 is state-degraded. Repair state or rewrite that chapter before continuing.",
    })).toBe("最新第 1 章处于状态降级（state-degraded）。继续写下一章前，请先修复状态，或重写这一章。");
  });

  it("localizes known tool errors", () => {
    expect(extractToolError({
      content: [
        {
          type: "text",
          text: "Latest chapter 2 is state-degraded. Repair state or rewrite that chapter before continuing.",
        },
      ],
    })).toBe("最新第 2 章处于状态降级（state-degraded）。继续写下一章前，请先修复状态，或重写这一章。");
  });

  it("settles streaming thinking and running tools when stopped", () => {
    const messages = settleStreamingMessage([
      {
        role: "assistant",
        content: "",
        thinkingStreaming: true,
        timestamp: 1,
        parts: [
          { type: "thinking", content: "thinking", streaming: true },
          {
            type: "tool",
            execution: {
              id: "tool-1",
              tool: "sub_agent",
              label: "writer",
              status: "running",
              startedAt: 1,
            },
          },
        ],
      },
    ], "Stopped", 2);

    const message = messages[0];
    expect(message.thinkingStreaming).toBeUndefined();
    expect(message.parts?.[0]).toEqual({ type: "thinking", content: "thinking", streaming: false });
    expect(message.toolExecutions?.[0]).toMatchObject({
      id: "tool-1",
      status: "error",
      error: "Stopped",
      completedAt: 2,
    });
  });
});
