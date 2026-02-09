// ---------------------------------------------------------------------------
// Explainability — Permutation importance & reason code generation
// Pure TypeScript — no external ML libraries
// ---------------------------------------------------------------------------

import type { TrainedModel } from './types';
import { computePrAuc } from './metrics';
import { seededRandom } from './algorithms/decision-tree';

// ---------------------------------------------------------------------------
// Permutation Importance
// ---------------------------------------------------------------------------

/**
 * Compute permutation importance for each feature.
 *
 * For each feature: shuffle that column, compute the drop in PR-AUC,
 * average over nRepeats. Returns normalized importance (sums to 1).
 */
export function computePermutationImportance(
  model: TrainedModel,
  X: number[][],
  y: number[],
  featureNames: string[],
  nRepeats: number = 3
): Record<string, number> {
  const n = X.length;
  const nFeatures = n > 0 ? X[0].length : 0;

  if (n === 0 || nFeatures === 0) {
    const result: Record<string, number> = {};
    for (const name of featureNames) {
      result[name] = 0;
    }
    return result;
  }

  // Baseline PR-AUC
  const baselineScores = model.predictBatch(X);
  const baselinePrAuc = computePrAuc(y, baselineScores);

  const rng = seededRandom(42);
  const rawImportance = new Array(nFeatures).fill(0);

  for (let f = 0; f < nFeatures; f++) {
    let totalDrop = 0;

    for (let rep = 0; rep < nRepeats; rep++) {
      // Create a copy of X with column f shuffled
      const shuffledX = X.map((row) => [...row]);

      // Fisher-Yates shuffle of column f
      for (let i = shuffledX.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        const temp = shuffledX[i][f];
        shuffledX[i][f] = shuffledX[j][f];
        shuffledX[j][f] = temp;
      }

      const shuffledScores = model.predictBatch(shuffledX);
      const shuffledPrAuc = computePrAuc(y, shuffledScores);

      // Drop in metric (higher drop = more important)
      totalDrop += Math.max(0, baselinePrAuc - shuffledPrAuc);
    }

    rawImportance[f] = totalDrop / nRepeats;
  }

  // Normalize to sum to 1
  const totalImportance = rawImportance.reduce((sum, v) => sum + v, 0);

  const result: Record<string, number> = {};
  for (let f = 0; f < nFeatures; f++) {
    const name = featureNames[f] ?? `feature_${f}`;
    result[name] = totalImportance > 0 ? rawImportance[f] / totalImportance : 1 / nFeatures;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Reason Codes
// ---------------------------------------------------------------------------

export interface ReasonCode {
  code: string;
  description: string;
  contribution: 'high' | 'medium' | 'low';
}

/**
 * Generate human-readable reason codes for why a transaction was flagged.
 *
 * Uses template-based matching on feature names and importance scores,
 * plus generic reason codes for top-importance features without templates.
 */
export function generateReasonCodes(
  features: number[],
  featureNames: string[],
  importance: Record<string, number>
): ReasonCode[] {
  const codes: ReasonCode[] = [];
  const usedFeatures = new Set<string>();

  // Template 1: Amount-related features with high z-score
  for (let i = 0; i < featureNames.length; i++) {
    const name = featureNames[i];
    const lower = name.toLowerCase();
    if (
      (lower.includes('amount') || lower.includes('amt')) &&
      (lower.includes('zscore') ||
        lower.includes('z_score') ||
        lower === 'amount' ||
        lower === 'amt')
    ) {
      if (features[i] > 2) {
        codes.push({
          code: 'Amount_high_vs_baseline',
          description: 'Transaction amount significantly above baseline',
          contribution: 'high',
        });
        usedFeatures.add(name);
      } else if (features[i] > 1) {
        codes.push({
          code: 'Amount_elevated_vs_baseline',
          description: 'Transaction amount elevated above baseline',
          contribution: 'medium',
        });
        usedFeatures.add(name);
      }
    }
  }

  // Template 2: Out-of-hours features
  for (let i = 0; i < featureNames.length; i++) {
    const name = featureNames[i];
    const lower = name.toLowerCase();
    if (
      (lower.includes('outofhours') ||
        lower.includes('out_of_hours') ||
        lower.includes('isoutofhours')) &&
      features[i] === 1
    ) {
      codes.push({
        code: 'Out_of_hours',
        description: 'Transaction occurred outside business hours',
        contribution: 'medium',
      });
      usedFeatures.add(name);
    }
  }

  // Template 3: Weekend transactions
  for (let i = 0; i < featureNames.length; i++) {
    const name = featureNames[i];
    const lower = name.toLowerCase();
    if (lower.includes('weekend') && features[i] === 1) {
      codes.push({
        code: 'Weekend_transaction',
        description: 'Transaction occurred on a weekend',
        contribution: 'medium',
      });
      usedFeatures.add(name);
    }
  }

  // Template 4: Country/risk corridor features with high importance
  for (let i = 0; i < featureNames.length; i++) {
    const name = featureNames[i];
    const lower = name.toLowerCase();
    if (
      (lower.includes('country') || lower.includes('risk') || lower.includes('corridor')) &&
      features[i] === 1
    ) {
      const imp = importance[name] ?? 0;
      if (imp > 0.05) {
        codes.push({
          code: 'High_risk_corridor',
          description: 'Transaction involves high-risk corridor',
          contribution: 'medium',
        });
        usedFeatures.add(name);
      }
    }
  }

  // Template 5: Log amount (unusually high)
  for (let i = 0; i < featureNames.length; i++) {
    const name = featureNames[i];
    const lower = name.toLowerCase();
    if (lower.includes('log') && lower.includes('amount') && features[i] > 10) {
      if (!usedFeatures.has(name)) {
        codes.push({
          code: 'Large_transaction_value',
          description: 'Transaction value is unusually large (log-scale)',
          contribution: 'high',
        });
        usedFeatures.add(name);
      }
    }
  }

  // Generic: top 3 important features not yet assigned
  const sortedImportance = Object.entries(importance)
    .filter(([name]) => !usedFeatures.has(name))
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  for (const [name, imp] of sortedImportance) {
    const idx = featureNames.indexOf(name);
    if (idx === -1) continue;

    const contribution: ReasonCode['contribution'] =
      imp > 0.15 ? 'high' : imp > 0.05 ? 'medium' : 'low';

    codes.push({
      code: `Feature_${name}_anomalous`,
      description: `Feature "${name}" contributed to anomaly score (value: ${features[idx]?.toFixed(3) ?? 'N/A'}, importance: ${(imp * 100).toFixed(1)}%)`,
      contribution,
    });
  }

  return codes;
}
