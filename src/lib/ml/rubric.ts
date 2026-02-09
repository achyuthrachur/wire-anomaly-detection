// ---------------------------------------------------------------------------
// Rubric — rank candidates, select champion, generate narrative
// ---------------------------------------------------------------------------

import type { CandidateResult } from './types';
import type { RubricConfig } from '@/lib/db/types';

// ---------------------------------------------------------------------------
// Apply rubric to rank candidates and select champion
// ---------------------------------------------------------------------------

export function applyRubric(
  candidates: CandidateResult[],
  config: RubricConfig
): { rankedCandidates: CandidateResult[]; championIndex: number } {
  if (candidates.length === 0) {
    return { rankedCandidates: [], championIndex: -1 };
  }

  const { constraints, weights } = config;

  // Track original indices
  const indexed = candidates.map((c, i) => ({ candidate: c, originalIndex: i }));

  // 1. Filter candidates that meet constraints
  const passing = indexed.filter(({ candidate }) => {
    const m = candidate.metrics;
    return (
      m.recallAtReviewRate >= constraints.minRecallAtReviewRate &&
      m.precisionAtReviewRate >= constraints.minPrecisionAtReviewRate
    );
  });

  // 2. Score remaining candidates
  const scoreCandidateEntry = (entry: { candidate: CandidateResult; originalIndex: number }) => {
    const m = entry.candidate.metrics;
    return (
      weights.recallAtReviewRate * m.recallAtReviewRate +
      weights.prAuc * m.prAuc +
      weights.precisionAtReviewRate * m.precisionAtReviewRate +
      weights.stability * m.stability +
      weights.explainability * m.explainability
    );
  };

  if (passing.length > 0) {
    // Sort by weighted score descending
    passing.sort((a, b) => scoreCandidateEntry(b) - scoreCandidateEntry(a));

    const rankedCandidates = passing.map((p) => p.candidate);
    const championIndex = passing[0].originalIndex;

    return { rankedCandidates, championIndex };
  }

  // 3. No candidates passed constraints — pick the one with highest recall
  const sortedByRecall = [...indexed].sort(
    (a, b) => b.candidate.metrics.recallAtReviewRate - a.candidate.metrics.recallAtReviewRate
  );

  const rankedCandidates = sortedByRecall.map((s) => s.candidate);
  const championIndex = sortedByRecall[0].originalIndex;

  return { rankedCandidates, championIndex };
}

// ---------------------------------------------------------------------------
// Generate narrative text for the bake-off results
// ---------------------------------------------------------------------------

/** Format algorithm name for display */
function formatAlgorithm(algo: string): string {
  const map: Record<string, string> = {
    log_reg: 'Logistic Regression',
    decision_tree: 'Decision Tree',
    random_forest: 'Random Forest',
    extra_trees: 'Extra-Trees',
    gradient_boosted: 'Gradient Boosted Trees',
  };
  return map[algo] ?? algo;
}

/** Format a number to a percentage string */
function pct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function generateNarrative(
  candidates: CandidateResult[],
  championIndex: number,
  config: RubricConfig
): { narrativeShort: string; narrativeLong: string } {
  if (candidates.length === 0 || championIndex < 0) {
    return {
      narrativeShort: 'No candidates were evaluated.',
      narrativeLong: 'The bake-off produced no candidate results to evaluate.',
    };
  }

  const champion = candidates[championIndex];
  const algoName = formatAlgorithm(champion.algorithm);
  const m = champion.metrics;

  // Short narrative
  const narrativeShort = `Selected ${algoName} as Champion \u2014 highest recall (${pct(m.recallAtReviewRate)}) at review capacity with PR-AUC of ${pct(m.prAuc)}.`;

  // Long narrative: bullet list with evidence
  const lines: string[] = [];
  lines.push(`## Bake-off Summary`);
  lines.push('');
  lines.push(
    `**Champion:** ${algoName} (index ${championIndex} of ${candidates.length} candidates)`
  );
  lines.push('');
  lines.push('### Champion Metrics');
  lines.push(`- **PR-AUC:** ${pct(m.prAuc)}`);
  lines.push(`- **Recall @ Review Rate:** ${pct(m.recallAtReviewRate)}`);
  lines.push(`- **Precision @ Review Rate:** ${pct(m.precisionAtReviewRate)}`);
  lines.push(`- **F1 Score:** ${pct(m.f1)}`);
  lines.push(`- **Stability:** ${pct(m.stability)}`);
  lines.push(`- **Explainability:** ${pct(m.explainability)}`);
  lines.push('');

  // Constraint check
  const passedRecall = m.recallAtReviewRate >= config.constraints.minRecallAtReviewRate;
  const passedPrecision = m.precisionAtReviewRate >= config.constraints.minPrecisionAtReviewRate;
  lines.push('### Constraint Check');
  lines.push(
    `- Min Recall (${pct(config.constraints.minRecallAtReviewRate)}): ${passedRecall ? 'PASSED' : 'FAILED'} (${pct(m.recallAtReviewRate)})`
  );
  lines.push(
    `- Min Precision (${pct(config.constraints.minPrecisionAtReviewRate)}): ${passedPrecision ? 'PASSED' : 'FAILED'} (${pct(m.precisionAtReviewRate)})`
  );
  lines.push('');

  // All candidates comparison
  lines.push('### All Candidates');
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    const isChamp = i === championIndex ? ' **(Champion)**' : '';
    lines.push(
      `- **${formatAlgorithm(c.algorithm)}**${isChamp}: PR-AUC=${pct(c.metrics.prAuc)}, Recall=${pct(c.metrics.recallAtReviewRate)}, Precision=${pct(c.metrics.precisionAtReviewRate)}, F1=${pct(c.metrics.f1)}`
    );
  }

  // Top feature importance for champion
  const importanceEntries = Object.entries(champion.importance)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);
  if (importanceEntries.length > 0) {
    lines.push('');
    lines.push('### Top Feature Importance (Champion)');
    for (const [name, value] of importanceEntries) {
      lines.push(`- **${name}:** ${(value * 100).toFixed(2)}%`);
    }
  }

  // Rubric weights used
  lines.push('');
  lines.push('### Rubric Weights');
  lines.push(
    `- Recall @ RR: ${config.weights.recallAtReviewRate}, PR-AUC: ${config.weights.prAuc}, Precision @ RR: ${config.weights.precisionAtReviewRate}, Stability: ${config.weights.stability}, Explainability: ${config.weights.explainability}`
  );

  const narrativeLong = lines.join('\n');

  return { narrativeShort, narrativeLong };
}
