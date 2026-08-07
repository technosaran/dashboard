import { INDIA_TAX_RULES, type TaxRuleVersion } from "./india-tax-engine";
import { parseBudgetOrTaxAnnouncementWithGemini, type GeminiParsedTaxRules } from "@/lib/gemini";

// In-memory dynamic rule registry (can be backed by Supabase public.tax_rules table)
const dynamicRuleRegistry: Map<number, TaxRuleVersion> = new Map();

/**
 * Initialize default rules
 */
INDIA_TAX_RULES.forEach((rule) => {
  dynamicRuleRegistry.set(rule.fyStartYear, rule);
});

/**
 * Get tax rule for a given financial year (with fallback to closest year)
 */
export function getTaxRuleForYear(fyStartYear: number): TaxRuleVersion {
  if (dynamicRuleRegistry.has(fyStartYear)) {
    return dynamicRuleRegistry.get(fyStartYear)!;
  }
  const staticRule = INDIA_TAX_RULES.find((r) => r.fyStartYear === fyStartYear);
  if (staticRule) return staticRule;
  return INDIA_TAX_RULES[INDIA_TAX_RULES.length - 1];
}

/**
 * Register or update tax rule for a financial year dynamically
 */
export function registerTaxRule(rule: TaxRuleVersion): void {
  dynamicRuleRegistry.set(rule.fyStartYear, rule);
}

/**
 * Get all registered tax rule versions
 */
export function getAllRegisteredTaxRules(): TaxRuleVersion[] {
  return Array.from(dynamicRuleRegistry.values()).sort((a, b) => b.fyStartYear - a.fyStartYear);
}

/**
 * Automatically fetch, parse with Gemini AI, and register new tax laws from Union Budget text/announcement
 */
export async function autoSyncTaxRulesFromAnnouncement(
  budgetText: string,
  apiKey: string
): Promise<{ success: boolean; rule?: TaxRuleVersion; summary?: string; error?: string }> {
  const result: GeminiParsedTaxRules = await parseBudgetOrTaxAnnouncementWithGemini(budgetText, apiKey);

  if (!result.success) {
    return { success: false, error: result.error || "Failed to parse tax announcement" };
  }

  const newRule: TaxRuleVersion = {
    version: result.version,
    fyStartYear: result.fyStartYear,
    standardDeductionOld: result.standardDeductionOld,
    standardDeductionNew: result.standardDeductionNew,
    cessRate: result.cessRate,
    oldRegimeSlabs: result.oldRegimeSlabs,
    newRegimeSlabs: result.newRegimeSlabs,
    deductionLimits: result.deductionLimits,
  };

  registerTaxRule(newRule);

  return {
    success: true,
    rule: newRule,
    summary: result.summary,
  };
}
