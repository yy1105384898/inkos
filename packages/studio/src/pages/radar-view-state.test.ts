import { describe, expect, it } from "vitest";
import { buildRadarScanBody } from "./radar-view-state";

describe("buildRadarScanBody", () => {
  it("prefers the current model picker selection", () => {
    expect(buildRadarScanBody({
      selectedService: "yynewapi",
      selectedModel: "gpt-5.4",
      configuredService: "google",
      configuredModel: "gemini-2.5-flash",
    })).toEqual({ service: "yynewapi", model: "gpt-5.4" });
  });

  it("falls back to the saved text model selection", () => {
    expect(buildRadarScanBody({
      configuredService: "google",
      configuredModel: "gemini-2.5-flash",
    })).toEqual({ service: "google", model: "gemini-2.5-flash" });
  });
});
