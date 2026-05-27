/**
 * 中文网文质量审稿 Agent
 *
 * 基于 WritingQualityProfile 配置，对章节进行多维度审稿：
 * - 开篇钩子 / 章节末钩子
 * - 冲突推进 / 人设一致 / 伏笔回收
 * - 节奏密度 / 去 AI 腔
 */

import type { LLMMessage } from "../llm/provider.js";
import { BaseAgent, type AgentContext } from "./base.js";
import type { WritingQualityProfile } from "../models/book.js";
import {
  buildQualityAuditPrompt,
  type QualityAuditResult,
  type QualityIssue,
} from "./zh-webnovel-quality.js";

export interface AuditChapterInput {
  readonly chapterContent: string;
  readonly chapterNumber: number;
  readonly qualityProfile: WritingQualityProfile;
}

export interface AuditChapterOutput {
  readonly auditResult: QualityAuditResult;
  readonly rawResponse: string;
}

export class ZhWebnovelQualityAuditor extends BaseAgent {
  constructor(context: AgentContext) {
    super(context);
  }

  get name(): string {
    return "zh-webnovel-quality-auditor";
  }

  async auditChapter(input: AuditChapterInput): Promise<AuditChapterOutput> {
    const systemPrompt = `你是一位资深的中文网文编辑，拥有 10 年以上的网文审稿经验。
你的任务是根据给定的质量配置，对章节进行多维度审稿，并给出具体的改进建议。

审稿时请：
1. 逐一检查每个启用的规则
2. 对每个问题给出具体的位置和改进建议
3. 最后给出一个 0-100 的综合评分
4. 用 JSON 格式返回结果`;

    const userPrompt = buildQualityAuditPrompt(input.qualityProfile, input.chapterContent);

    const messages: LLMMessage[] = [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: userPrompt,
      },
    ];

    const response = await this.chat(messages, { temperature: 0.3 });

    const rawResponse = response.content;

    // 尝试从响应中解析 JSON 结果
    const auditResult = this.parseAuditResponse(rawResponse, input.qualityProfile);

    return {
      auditResult,
      rawResponse,
    };
  }

  private parseAuditResponse(
    response: string,
    profile: WritingQualityProfile,
  ): QualityAuditResult {
    // 尝试提取 JSON 块
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    let parsed: any = null;

    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        // JSON 解析失败，使用默认值
      }
    }

    // 构建默认结果
    const issues: QualityIssue[] = [];
    const suggestions: string[] = [];
    let score = 70; // 默认分数

    if (parsed) {
      if (Array.isArray(parsed.issues)) {
        issues.push(
          ...parsed.issues.map((issue: any) => ({
            rule: issue.rule || "unknown",
            severity: issue.severity || "medium",
            description: issue.description || "",
            location: issue.location,
          })),
        );
      }

      if (Array.isArray(parsed.suggestions)) {
        suggestions.push(...parsed.suggestions);
      }

      if (typeof parsed.score === "number") {
        score = Math.max(0, Math.min(100, parsed.score));
      }
    }

    // 如果没有解析到结果，从文本中提取关键信息
    if (issues.length === 0) {
      // 简单的启发式提取
      if (response.includes("开篇钩子") || response.includes("opening")) {
        issues.push({
          rule: "opening-hook",
          severity: response.includes("不足") ? "high" : "low",
          description: "开篇钩子需要改进",
        });
      }

      if (response.includes("AI 腔") || response.includes("AI tone")) {
        issues.push({
          rule: "deai-tone",
          severity: response.includes("明显") ? "high" : "medium",
          description: "检测到 AI 腔迹象",
        });
      }
    }

    return {
      form: profile.form,
      intensity: profile.intensity,
      issues,
      suggestions,
      score,
    };
  }
}
