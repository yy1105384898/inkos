import { describe, expect, it } from "vitest";
import { parseHash, routeToHash } from "./use-hash-route";

describe("hash route", () => {
  describe("parseHash", () => {
    it("parses empty hash as dashboard", () => {
      expect(parseHash("")).toEqual({ page: "dashboard" });
    });

    it("parses #/ as dashboard", () => {
      expect(parseHash("#/")).toEqual({ page: "dashboard" });
    });

    it("parses chat route", () => {
      expect(parseHash("#/chat")).toEqual({ page: "chat" });
    });

    it("parses book route", () => {
      expect(parseHash("#/book/my-novel")).toEqual({ page: "book", bookId: "my-novel" });
    });

    it("parses book settings route", () => {
      expect(parseHash("#/book/my-novel/settings")).toEqual({ page: "book-settings", bookId: "my-novel" });
    });

    it("parses chapter route", () => {
      expect(parseHash("#/book/my-novel/chapters/12")).toEqual({
        page: "chapter",
        bookId: "my-novel",
        chapterNumber: 12,
      });
    });

    it("parses book scoped tool routes", () => {
      expect(parseHash("#/book/my-novel/analytics")).toEqual({ page: "analytics", bookId: "my-novel" });
      expect(parseHash("#/book/my-novel/truth")).toEqual({ page: "truth", bookId: "my-novel" });
    });

    it("decodes encoded bookId", () => {
      expect(parseHash("#/book/%E4%B9%9D%E9%BE%99")).toEqual({ page: "book", bookId: "九龙" });
    });

    it("parses book/new as book-create", () => {
      expect(parseHash("#/book/new")).toEqual({ page: "book-create" });
    });

    it("parses config as services (redirect)", () => {
      expect(parseHash("#/config")).toEqual({ page: "services" });
    });

    it("parses services", () => {
      expect(parseHash("#/services")).toEqual({ page: "services" });
    });

    it("parses global tool pages", () => {
      expect(parseHash("#/daemon")).toEqual({ page: "daemon" });
      expect(parseHash("#/logs")).toEqual({ page: "logs" });
      expect(parseHash("#/genres")).toEqual({ page: "genres" });
      expect(parseHash("#/style")).toEqual({ page: "style" });
      expect(parseHash("#/import")).toEqual({ page: "import" });
      expect(parseHash("#/radar")).toEqual({ page: "radar" });
      expect(parseHash("#/doctor")).toEqual({ page: "doctor" });
      expect(parseHash("#/admin")).toEqual({ page: "admin" });
    });

    it("parses service-detail", () => {
      expect(parseHash("#/services/openai")).toEqual({ page: "service-detail", serviceId: "openai" });
    });

    it("decodes encoded serviceId", () => {
      expect(parseHash("#/services/%E8%87%AA%E5%AE%9A%E4%B9%89")).toEqual({ page: "service-detail", serviceId: "自定义" });
    });

    it("falls back to dashboard for unknown hash", () => {
      expect(parseHash("#/unknown/route")).toEqual({ page: "dashboard" });
    });
  });

  describe("routeToHash", () => {
    it("dashboard -> #/", () => {
      expect(routeToHash({ page: "dashboard" })).toBe("#/");
    });

    it("chat -> #/chat", () => {
      expect(routeToHash({ page: "chat" })).toBe("#/chat");
    });

    it("book -> #/book/{id}", () => {
      expect(routeToHash({ page: "book", bookId: "novel-1" })).toBe("#/book/novel-1");
    });

    it("book-settings -> #/book/{id}/settings", () => {
      expect(routeToHash({ page: "book-settings", bookId: "novel-1" })).toBe("#/book/novel-1/settings");
    });

    it("chapter -> #/book/{id}/chapters/{chapter}", () => {
      expect(routeToHash({ page: "chapter", bookId: "novel-1", chapterNumber: 12 })).toBe("#/book/novel-1/chapters/12");
    });

    it("book scoped tool routes -> hash", () => {
      expect(routeToHash({ page: "analytics", bookId: "novel-1" })).toBe("#/book/novel-1/analytics");
      expect(routeToHash({ page: "truth", bookId: "novel-1" })).toBe("#/book/novel-1/truth");
    });

    it("encodes Chinese bookId", () => {
      const hash = routeToHash({ page: "book", bookId: "九龙城夜行" });
      expect(hash).toContain("#/book/");
      expect(decodeURIComponent(hash)).toContain("九龙城夜行");
    });

    it("book-create -> #/book/new", () => {
      expect(routeToHash({ page: "book-create" })).toBe("#/book/new");
    });

    it("services -> #/services", () => {
      expect(routeToHash({ page: "services" })).toBe("#/services");
    });

    it("service-detail -> #/services/{id}", () => {
      expect(routeToHash({ page: "service-detail", serviceId: "openai" })).toBe("#/services/openai");
    });

    it("encodes Chinese serviceId", () => {
      const hash = routeToHash({ page: "service-detail", serviceId: "自定义" });
      expect(hash).toContain("#/services/");
      expect(decodeURIComponent(hash)).toContain("自定义");
    });

    it("global tool pages -> hash", () => {
      expect(routeToHash({ page: "daemon" })).toBe("#/daemon");
      expect(routeToHash({ page: "logs" })).toBe("#/logs");
      expect(routeToHash({ page: "genres" })).toBe("#/genres");
      expect(routeToHash({ page: "style" })).toBe("#/style");
      expect(routeToHash({ page: "import" })).toBe("#/import");
      expect(routeToHash({ page: "radar" })).toBe("#/radar");
      expect(routeToHash({ page: "doctor" })).toBe("#/doctor");
      expect(routeToHash({ page: "admin" })).toBe("#/admin");
    });
  });
});
