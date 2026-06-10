import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createStore } from "zustand/vanilla";
import type { ChatStore } from "../../types";
import { initialChatState } from "../../initialState";
import { createCreateSlice } from "../create/action";
import { createMessageSlice } from "./action";

const { fetchJson } = vi.hoisted(() => ({
  fetchJson: vi.fn(),
}));

vi.mock("../../../../hooks/use-api", () => ({
  buildApiUrl: (path: string) => `/api/v1${path}`,
  fetchJson,
}));

class FakeEventSource {
  readonly url: string;
  readonly listeners = new Map<string, Array<(event: MessageEvent) => void>>();
  constructor(url: string) {
    this.url = url;
    fakeEventSources.push(this);
  }
  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    const current = this.listeners.get(type) ?? [];
    current.push(listener);
    this.listeners.set(type, current);
  }
  close() {}
  emit(type: string, data: unknown) {
    for (const listener of this.listeners.get(type) ?? []) {
      listener({ data: JSON.stringify(data) } as MessageEvent);
    }
  }
}

const fakeEventSources: FakeEventSource[] = [];

function createTestStore() {
  return createStore<ChatStore>()((...args) => ({
    ...initialChatState,
    ...createMessageSlice(...args),
    ...createCreateSlice(...args),
  }));
}

describe("chat message actions", () => {
  const originalEventSource = globalThis.EventSource;

  beforeEach(() => {
    fetchJson.mockReset();
    fetchJson.mockResolvedValue({});
    fakeEventSources.length = 0;
    (globalThis as any).EventSource = FakeEventSource;
  });

  afterEach(() => {
    (globalThis as any).EventSource = originalEventSource;
  });

  it("keeps play mode local for draft sessions until the first message persists them", () => {
    const store = createTestStore();
    const sessionId = store.getState().createDraftSession(null, "play", "open");

    store.getState().setSessionPlayMode(sessionId, "guided");

    expect(store.getState().sessions[sessionId]?.playMode).toBe("guided");
    expect(fetchJson).not.toHaveBeenCalled();
  });

  it("stops the agent run through the active stop endpoint", async () => {
    const store = createTestStore();
    const sessionId = store.getState().createDraftSession(null, "book-create");
    store.setState((state) => ({
      sessions: {
        ...state.sessions,
        [sessionId]: {
          ...state.sessions[sessionId]!,
          isStreaming: true,
          messages: [
            {
              role: "assistant",
              content: "",
              timestamp: 1,
              parts: [
                {
                  type: "tool",
                  execution: {
                    id: "writer-1",
                    tool: "sub_agent",
                    agent: "writer",
                    label: "写作",
                    status: "running",
                    startedAt: 1,
                  },
                },
              ],
              toolExecutions: [
                {
                  id: "writer-1",
                  tool: "sub_agent",
                  agent: "writer",
                  label: "写作",
                  status: "running",
                  startedAt: 1,
                },
              ],
            },
          ],
        },
      },
    }));

    await store.getState().stopMessage(sessionId);

    expect(fetchJson).toHaveBeenCalledWith(`/agent/${sessionId}/stop`, { method: "POST" });
    expect(store.getState().sessions[sessionId]?.isStreaming).toBe(false);
    expect(store.getState().sessions[sessionId]?.messages[0]?.toolExecutions?.[0]?.status).toBe("error");
  });

  it("syncs the created book id returned by /agent back into the current runtime session", async () => {
    const store = createTestStore();
    const sessionId = store.getState().createDraftSession(null, "book-create");
    store.getState().setSelectedModel("deepseek-v4-flash", "kkaiapi");
    fetchJson
      .mockResolvedValueOnce({ session: { sessionId, bookId: null, sessionKind: "book-create" } })
      .mockResolvedValueOnce({
        response: "已创建书籍。",
        session: { sessionId, activeBookId: "new-book", sessionKind: "book" },
      });

    await store.getState().sendMessage(sessionId, "创建一本债务悬疑长篇", { sessionKind: "book-create" });

    expect(store.getState().sessions[sessionId]).toMatchObject({
      bookId: "new-book",
      sessionKind: "book",
      isDraft: false,
    });
    expect(store.getState().sessionIdsByBook["new-book"]).toContain(sessionId);
  });

  it("keeps a tool-only stream when /agent returns an empty response after a proposal", async () => {
    const store = createTestStore();
    const sessionId = store.getState().createDraftSession(null, "book-create");
    store.getState().setSelectedModel("deepseek-v4-flash", "kkaiapi");

    let resolveAgent!: (value: unknown) => void;
    fetchJson
      .mockResolvedValueOnce({ session: { sessionId, bookId: null, sessionKind: "book-create" } })
      .mockImplementationOnce(() => new Promise((resolve) => {
        resolveAgent = resolve;
      }));

    const sent = store.getState().sendMessage(sessionId, "创建一本债务悬疑长篇", { sessionKind: "book-create" });
    await vi.waitFor(() => expect(fakeEventSources).toHaveLength(1));

    fakeEventSources[0].emit("tool:start", {
      sessionId,
      id: "proposal-1",
      tool: "propose_action",
    });
    fakeEventSources[0].emit("tool:end", {
      sessionId,
      id: "proposal-1",
      tool: "propose_action",
      details: {
        kind: "proposed_action",
        action: "create_book",
        targetSessionKind: "book-create",
        sameSession: true,
        title: "确认建书",
        instruction: "创建一本债务悬疑长篇",
      },
    });

    resolveAgent({ response: "", session: { sessionId, sessionKind: "book-create" } });
    await sent;

    const messages = store.getState().sessions[sessionId]?.messages ?? [];
    const assistant = messages.find((message) => message.role === "assistant");
    expect(assistant?.content).not.toContain("模型未返回文本内容");
    expect(assistant?.parts).toEqual([
      expect.objectContaining({
        type: "tool",
        execution: expect.objectContaining({
          tool: "propose_action",
          status: "completed",
        }),
      }),
    ]);
  });

  it("restores confirmed proposal cards when loading persisted session messages", () => {
    const store = createTestStore();
    const sessionId = store.getState().createDraftSession(null, "play", "open");

    store.getState().loadSessionMessages(sessionId, [
      {
        role: "assistant",
        content: "",
        timestamp: 1,
        toolExecutions: [
          {
            id: "proposal-1",
            tool: "propose_action",
            label: "确认动作",
            status: "completed",
            startedAt: 1,
            details: {
              kind: "proposed_action",
              action: "play_start",
              targetSessionKind: "play",
              instruction: "启动旧影院",
            },
          },
        ],
      },
      {
        role: "assistant",
        content: "",
        timestamp: 2,
        toolExecutions: [
          {
            id: "play-1",
            tool: "play_start",
            label: "启动互动世界",
            status: "completed",
            startedAt: 2,
            details: { kind: "play_world_started" },
          },
        ],
      },
    ]);

    expect(store.getState().resolvedProposals).toEqual({ "proposal-1": "confirmed" });
  });
});
