// ---------------------------------------------------------------------------
// ML Metrics — PR-AUC, Recall@RR, Precision@RR, F1, Stability, Explainability
// Pure TypeScript — no external ML libraries
// ---------------------------------------------------------------------------

import { standardDeviation } from '@/lib/profiling/stats';
import type { MetricsResult } from './types';

// ---------------------------------------------------------------------------
// PR-AUC (Precision-Recall Area Under Curve)
// ---------------------------------------------------------------------------

export function computePrAuc(yTrue: number[], scores: number[]): number {
  const n = yTrue.length;
  if (n === 0) return 0;

  // Total positives
  let totalPositives = 0;
  for (let i = 0; i < n; i++) {
    totalPositives += yTrue[i];
  }
  if (totalPositives === 0) return 0;

  // Create (score, label) pairs sorted by score descending
  const pairs: Array<{ score: number; label: number }> = [];
  for (let i = 0; i < n; i++) {
    pairs.push({ score: scores[i], label: yTrue[i] });
  }
  pairs.sort((a, b) => b.score - a.score);

  // Walk through sorted predictions, compute precision/recall at each threshold
  let tp = 0;
  let fp = 0;
  const precisions: number[] = [];
  const recalls: number[] = [];

  // Add starting point (recall=0, precision=1)
  precisions.push(1.0);
  recalls.push(0.0);

  for (let i = 0; i < pairs.length; i++) {
    if (pairs[i].label === 1) {
      tp++;
    } else {
      fp++;
    }

    const precision = tp / (tp + fp);
    const recall = tp / totalPositives;

    precisions.push(precision);
    recalls.push(recall);
  }

  // Trapezoidal integration of precision-recall curve
  let auc = 0;
  for (let i = 1; i < recalls.length; i++) {
    const deltaRecall = recalls[i] - recalls[i - 1];
    if (deltaRecall > 0) {
      // Trapezoidal rule: average of two precisions * delta recall
      auc += ((precisions[i] + precisions[i - 1]) / 2) * deltaRecall;
    }
  }

  return Math.max(0, Math.min(1, auc));
}

// ---------------------------------------------------------------------------
// Recall at Review Rate
// ---------------------------------------------------------------------------

export function computeRecallAtReviewRate(
  yTrue: number[],
  scores: number[],
  reviewRate: number
): number {
  const n = yTrue.length;
  if (n === 0) return 0;

  let totalPositives = 0;
  for (let i = 0; i < n; i++) {
    totalPositives += yTrue[i];
  }
  if (totalPositives === 0) return 0;

  // Sort indices by score descending
  const indices = Array.from({ length: n }, (_, i) => i);
  indices.sort((a, b) => scores[b] - scores[a]);

  // Flag top reviewRate fraction
  const nFlagged = Math.max(1, Math.round(reviewRate * n));

  let flaggedPositives = 0;
  for (let i = 0; i < Math.min(nFlagged, n); i++) {
    flaggedPositives += yTrue[indices[i]];
  }

  return flaggedPositives / totalPositives;
}

// ---------------------------------------------------------------------------
// Precision at Review Rate
// ---------------------------------------------------------------------------

export function computePrecisionAtReviewRate(
  yTrue: number[],
  scores: number[],
  reviewRate: number
): number {
  const n = yTrue.length;
  if (n === 0) return 0;

  // Sort indices by score descending
  const indices = Array.from({ length: n }, (_, i) => i);
  indices.sort((a, b) => scores[b] - scores[a]);

  // Flag top reviewRate fraction
  const nFlagged = Math.max(1, Math.round(reviewRate * n));

  let flaggedPositives = 0;
  for (let i = 0; i < Math.min(nFlagged, n); i++) {
    flaggedPositives += yTrue[indices[i]];
  }

  return flaggedPositives / Math.min(nFlagged, n);
}

// ---------------------------------------------------------------------------
// F1 Score
// ---------------------------------------------------------------------------

export function computeF1(precision: number, recall: number): number {
  if (precision + recall === 0) return 0;
  return (2 * precision * recall) / (precision + recall);
}

// ---------------------------------------------------------------------------
// Stability (1 - stddev of recall across folds)
// ---------------------------------------------------------------------------

export function computeStability(recallValues: number[]): number {
  if (recallValues.length < 2) return 1.0;
  const std = standardDeviation(recallValues);
  return Math.max(0, Math.min(1, 1 - std));
}

// ---------------------------------------------------------------------------
// Explainability Score (heuristic per algorithm)
// ---------------------------------------------------------------------------

export function computeExplainabilityScore(algorithm: string): number {
  switch (algorithm) {
    case 'log_reg':
      return 1.0;
    case 'decision_tree':
      return 1.0;
    case 'random_forest':
      return 0.8;
    case 'extra_trees':
      return 0.8;
    case 'gradient_boosted':
      return 0.9;
    default:
      return 0.5;
  }
}

// ---------------------------------------------------------------------------
// Combined metrics computation
// ---------------------------------------------------------------------------

/**
 * Compute all metrics for a model's predictions.
 *
 * Stability is approximated via 3-fold cross-validation of recall@RR.
 */
export function computeAllMetrics(
  yTrue: number[],
  scores: number[],
  reviewRate: number,
  algorithm: string
): MetricsResult {
  const n = yTrue.length;

  // Core metrics
  const prAuc = computePrAuc(yTrue, scores);
  const recallAtReviewRate = computeRecallAtReviewRate(yTrue, scores, reviewRate);
  const precisionAtReviewRate = computePrecisionAtReviewRate(yTrue, scores, reviewRate);
  const f1 = computeF1(precisionAtReviewRate, recallAtReviewRate);
  const explainability = computeExplainabilityScore(algorithm);

  // Stability: 3-fold cross-validation approximation
  const foldSize = Math.floor(n / 3);
  const recallValues: number[] = [];

  if (foldSize > 0 && n >= 3) {
    for (let fold = 0; fold < 3; fold++) {
      const foldStart = fold * foldSize;
      const foldEnd = fold === 2 ? n : (fold + 1) * foldSize;

      const foldY: number[] = [];
      const foldScores: number[] = [];
      for (let i = foldStart; i < foldEnd; i++) {
        foldY.push(yTrue[i]);
        foldScores.push(scores[i]);
      }

      // Only compute if fold has positives
      const foldPositives = foldY.reduce((sum, v) => sum + v, 0);
      if (foldPositives > 0) {
        recallValues.push(computeRecallAtReviewRate(foldY, foldScores, reviewRate));
      }
    }
  }

  const stability = recallValues.length >= 2 ? computeStability(recallValues) : 1.0;

  return {
    prAuc,
    recallAtReviewRate,
    precisionAtReviewRate,
    f1,
    stability,
    explainability,
  };
}
