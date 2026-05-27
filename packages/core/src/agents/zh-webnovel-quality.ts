/**
 * 中文网文写作质量配置与规则
 *
 * 支持三种形式：
 * - serial: 长篇连载（开篇钩子、章节末钩子、冲突推进、人设一致、伏笔回收、节奏密度）
 * - short: 短篇爆款（快速吸引、高潮密集、结尾反转）
 * - balanced: 平衡模式（两者结合）
 *
 * 三个强度等级：light / standard / strict
 */

import type { WritingQualityForm, WritingQualityIntensity, WritingQualityProfile } from "../models/book.js";

export interface QualityRule {
  name: string;
  description: string;
  prompt: string;
  enabled: boolean;
}

export interface QualityRuleSet {
  form: WritingQualityForm;
  intensity: WritingQualityIntensity;
  rules: Record<string, QualityRule>;
}

/**
 * 开篇钩子规则：第一章必须在前 500 字内建立读者期待
 */
export const OPENING_HOOK_RULE: QualityRule = {
  name: "opening-hook",
  description: "开篇钩子：前 500 字内建立读者期待",
  prompt: `你是中文网文质量审稿官。检查以下章节的开篇钩子：
- 前 500 字内是否有明确的悬念或冲突？
- 是否能吸引读者继续阅读？
- 避免冗长的背景交代。

如果不足，给出具体改进建议。`,
  enabled: true,
};

/**
 * 章节末钩子规则：每章结尾必须留下悬念，促进下一章阅读
 */
export const CHAPTER_END_HOOK_RULE: QualityRule = {
  name: "chapter-end-hook",
  description: "章节末钩子：结尾留下悬念促进下一章",
  prompt: `你是中文网文质量审稿官。检查以下章节的结尾钩子：
- 结尾是否有悬念或未解决的冲突？
- 是否能促进读者继续阅读下一章？
- 避免生硬的"待续"。

如果不足，给出具体改进建议。`,
  enabled: true,
};

/**
 * 冲突推进规则：每章必须推进主线冲突或支线冲突
 */
export const CONFLICT_PROGRESSION_RULE: QualityRule = {
  name: "conflict-progression",
  description: "冲突推进：每章推进主线或支线冲突",
  prompt: `你是中文网文质量审稿官。检查以下章节的冲突推进：
- 是否推进了主线冲突？
- 是否推进了任何支线冲突？
- 是否有"水章"（无进展的章节）？

如果冲突推进不足，给出具体改进建议。`,
  enabled: true,
};

/**
 * 人设一致规则：角色言行必须符合已建立的人设
 */
export const CHARACTER_CONSISTENCY_RULE: QualityRule = {
  name: "character-consistency",
  description: "人设一致：角色言行符合已建立人设",
  prompt: `你是中文网文质量审稿官。检查以下章节的人设一致性：
- 主角的言行是否符合已建立的人设？
- 配角的言行是否符合已建立的人设？
- 是否有突兀的性格转变？

如果有人设不一致，给出具体改进建议。`,
  enabled: true,
};

/**
 * 伏笔回收规则：已埋下的伏笔必须在合理的时间内回收
 */
export const FORESHADOWING_PAYOFF_RULE: QualityRule = {
  name: "foreshadowing-payoff",
  description: "伏笔回收：已埋伏笔在合理时间内回收",
  prompt: `你是中文网文质量审稿官。检查以下章节的伏笔回收：
- 是否有已埋下但未回收的伏笔？
- 是否有新埋下的伏笔？
- 伏笔回收的时间是否合理（不过早也不过晚）？

如果伏笔管理不当，给出具体改进建议。`,
  enabled: true,
};

/**
 * 节奏密度规则：根据形式调整节奏（连载较缓，短篇较快）
 */
export const PACING_DENSITY_RULE: QualityRule = {
  name: "pacing-density",
  description: "节奏密度：根据形式调整节奏",
  prompt: `你是中文网文质量审稿官。检查以下章节的节奏密度：
- 节奏是否适合目标形式（连载/短篇）？
- 是否有冗长的描写或对话？
- 是否有足够的动作或情感转折？

如果节奏不当，给出具体改进建议。`,
  enabled: true,
};

/**
 * 去 AI 腔规则：避免 AI 生成的常见套路和表达
 */
export const DEAI_TONE_RULE: QualityRule = {
  name: "deai-tone",
  description: "去 AI 腔：避免 AI 生成的常见套路",
  prompt: `你是中文网文质量审稿官。检查以下章节是否有 AI 腔：
- 是否有过度使用的成语或固定搭配？
- 是否有生硬的逻辑转折？
- 是否有重复的表达方式？
- 是否有不自然的对话？

如果有 AI 腔，给出具体改进建议。`,
  enabled: true,
};

/**
 * 根据形式和强度生成规则集
 */
export function buildQualityRuleSet(
  form: WritingQualityForm,
  intensity: WritingQualityIntensity,
): QualityRuleSet {
  const baseRules: Record<string, QualityRule> = {
    "opening-hook": OPENING_HOOK_RULE,
    "chapter-end-hook": CHAPTER_END_HOOK_RULE,
    "conflict-progression": CONFLICT_PROGRESSION_RULE,
    "character-consistency": CHARACTER_CONSISTENCY_RULE,
    "foreshadowing-payoff": FORESHADOWING_PAYOFF_RULE,
    "pacing-density": PACING_DENSITY_RULE,
    "deai-tone": DEAI_TONE_RULE,
  };

  // 根据强度调整规则启用状态
  if (intensity === "light") {
    // light: 只检查开篇钩子、章节末钩子、去 AI 腔
    Object.keys(baseRules).forEach((key) => {
      if (!["opening-hook", "chapter-end-hook", "deai-tone"].includes(key)) {
        baseRules[key].enabled = false;
      }
    });
  } else if (intensity === "standard") {
    // standard: 启用所有规则
    Object.keys(baseRules).forEach((key) => {
      baseRules[key].enabled = true;
    });
  } else if (intensity === "strict") {
    // strict: 启用所有规则，并加强检查
    Object.keys(baseRules).forEach((key) => {
      baseRules[key].enabled = true;
      baseRules[key].prompt += "\n\n严格模式：请特别关注细节，给出更详细的改进建议。";
    });
  }

  // 根据形式调整节奏密度规则
  if (form === "serial") {
    baseRules["pacing-density"].prompt = baseRules["pacing-density"].prompt.replace(
      "连载/短篇",
      "连载（较缓的节奏，允许更多细节描写）",
    );
  } else if (form === "short") {
    baseRules["pacing-density"].prompt = baseRules["pacing-density"].prompt.replace(
      "连载/短篇",
      "短篇（快速节奏，高潮密集）",
    );
  }

  return {
    form,
    intensity,
    rules: baseRules,
  };
}

/**
 * 生成质量审稿 prompt
 */
export function buildQualityAuditPrompt(
  profile: WritingQualityProfile,
  chapterContent: string,
): string {
  const ruleSet = buildQualityRuleSet(profile.form, profile.intensity);
  const enabledRules = Object.values(ruleSet.rules).filter((r) => r.enabled);

  const rulesText = enabledRules
    .map((r) => `## ${r.name}\n${r.description}\n\n${r.prompt}`)
    .join("\n\n");

  return `你是中文网文质量审稿官，专门审查网文质量。

**审稿配置：**
- 形式：${profile.form}（${profile.form === "serial" ? "长篇连载" : profile.form === "short" ? "短篇爆款" : "平衡模式"}）
- 强度：${profile.intensity}（${profile.intensity === "light" ? "轻度" : profile.intensity === "standard" ? "标准" : "严格"}）
- 平台：${profile.platform}

**审稿规则：**

${rulesText}

**待审稿章节：**

\`\`\`
${chapterContent}
\`\`\`

请按照上述规则逐一审稿，给出详细的改进建议。`;
}

/**
 * 质量审稿结果
 */
export interface QualityAuditResult {
  form: WritingQualityForm;
  intensity: WritingQualityIntensity;
  issues: QualityIssue[];
  suggestions: string[];
  score: number; // 0-100
}

export interface QualityIssue {
  rule: string;
  severity: "low" | "medium" | "high";
  description: string;
  location?: string; // 问题所在的段落或行号
}
