/**
 * yysubapi
 *
 * - 官网：https://yysubapi.yangyangnj.top/
 * - API 文档：https://yysubapi.yangyangnj.top/docs
 * - 模型列表：https://yysubapi.yangyangnj.top/models
 *
 * OpenAI-compatible 聚合入口。使用统一 /v1 API 入口，模型列表优先从
 * live /models 获取，bank 仅保留基础可用兜底。
 */
import type { InkosEndpoint } from "../types.js";

export const YYSUBAPI: InkosEndpoint = {
  id: "yysubapi",
  label: "yysubapi",
  group: "aggregator",
  api: "openai-completions",
  baseUrl: "https://yysubapi.yangyangnj.top/v1",
  modelsBaseUrl: "https://yysubapi.yangyangnj.top/v1",
  checkModel: "gpt-5.4",
  temperatureRange: [0, 2],
  defaultTemperature: 0.9,
  writingTemperature: 1.2,
  models: [
    { id: "gpt-5.4", maxOutput: 128000, contextWindowTokens: 1_050_000, enabled: true },
    { id: "gpt-5.4-mini", maxOutput: 128000, contextWindowTokens: 400000, enabled: true },
    { id: "gpt-5.2", maxOutput: 128000, contextWindowTokens: 400000 },
    { id: "deepseek-v4-flash", maxOutput: 393216, contextWindowTokens: 1_000_000 },
    { id: "deepseek-v4-pro", maxOutput: 393216, contextWindowTokens: 1_000_000 },
  ],
};
