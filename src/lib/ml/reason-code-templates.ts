// ---------------------------------------------------------------------------
// Reason Code Templates — centralized mapping from feature names to codes
// ---------------------------------------------------------------------------

export interface ReasonCodeTemplate {
  code: string;
  description: string;
  /** Regex patterns that match feature names */
  featurePatterns: RegExp[];
  /** Minimum absolute SHAP value to trigger this code */
  minAbsShap?: number;
  /** Minimum feature value to trigger (for binary flags) */
  minFeatureValue?: number;
}

export const REASON_CODE_TEMPLATES: ReasonCodeTemplate[] = [
  {
    code: 'HighAmountVsBaseline',
    description: 'Transaction amount significantly above baseline',
    featurePatterns: [/amount.*zscore/i, /amount.*log/i, /^amount$/i, /amt.*zscore/i],
    minAbsShap: 0.01,
  },
  {
    code: 'OutOfHours',
    description: 'Wire initiated outside normal business hours',
    featurePatterns: [/isoutofhours/i, /out.?of.?hours/i],
    minFeatureValue: 1,
  },
  {
    code: 'WeekendTransaction',
    description: 'Transaction occurred on a weekend',
    featurePatterns: [/isweekend/i, /weekend/i],
    minFeatureValue: 1,
  },
  {
    code: 'RiskCorridor',
    description: 'Destination corridor associated with elevated risk',
    featurePatterns: [/country.*risk/i, /destination.*risk/i, /riskcorridor/i, /highriskcountry/i],
    minFeatureValue: 1,
  },
  {
    code: 'CallbackBypass',
    description: 'Callback verification was not completed',
    featurePatterns: [/callback.*verified/i, /callbackverified/i, /callback.*bypass/i],
    minFeatureValue: 0, // 0 means callback=false
  },
  {
    code: 'SODException',
    description: 'Segregation of duties exception — initiator and reviewer are the same',
    featurePatterns: [/initiator.*reviewer/i, /sod.*exception/i, /same.*person/i],
    minFeatureValue: 1,
  },
  {
    code: 'BurstActivity',
    description: 'Multiple wires from same customer in rapid sequence',
    featurePatterns: [/burst/i, /rapid.*sequence/i, /frequency/i],
    minAbsShap: 0.01,
  },
  {
    code: 'IrregularApproval',
    description: 'Approval level inconsistent with transaction characteristics',
    featurePatterns: [/approval.*level/i, /approvallevel/i],
    minAbsShap: 0.01,
  },
];

/**
 * Match a feature name against templates and return matching reason codes.
 * Uses SHAP values for ranking when available.
 */
export function matchReasonCodes(
  featureNames: string[],
  features: number[],
  shapValues?: number[],
  importance?: Record<string, number>,
  maxCodes: number = 5
): Array<{ code: string; description: string; contribution: 'high' | 'medium' | 'low' }> {
  const matched = new Map<string, { code: string; description: string; absContribution: number }>();

  for (let i = 0; i < featureNames.length; i++) {
    const fname = featureNames[i];
    const fval = features[i];
    const shapVal = shapValues?.[i] ?? 0;
    const impVal = importance?.[fname] ?? 0;

    for (const template of REASON_CODE_TEMPLATES) {
      if (matched.has(template.code)) continue;

      const patternMatch = template.featurePatterns.some((p) => p.test(fname));
      if (!patternMatch) continue;

      // Check thresholds
      let triggered = false;

      if (template.minFeatureValue !== undefined) {
        // For callback bypass, check for 0 (false)
        if (template.code === 'CallbackBypass') {
          triggered = fval === 0 || fval < 0.5;
        } else {
          triggered = fval >= template.minFeatureValue;
        }
      }

      if (template.minAbsShap !== undefined) {
        triggered = triggered || Math.abs(shapVal) >= template.minAbsShap;
      }

      // Also trigger if importance is high
      if (!triggered && impVal > 0.05) {
        triggered = true;
      }

      if (triggered) {
        matched.set(template.code, {
          code: template.code,
          description: template.description,
          absContribution: Math.abs(shapVal) || impVal,
        });
      }
    }
  }

  // Sort by contribution and take top N
  const sorted = Array.from(matched.values())
    .sort((a, b) => b.absContribution - a.absContribution)
    .slice(0, maxCodes);

  return sorted.map((m) => ({
    code: m.code,
    description: m.description,
    contribution: m.absContribution > 0.1 ? 'high' : m.absContribution > 0.03 ? 'medium' : 'low',
  }));
}
