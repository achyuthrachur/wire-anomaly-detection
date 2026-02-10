// ---------------------------------------------------------------------------
// Bake-off Runner — orchestrates dataset loading, feature engineering,
// model training, evaluation, and champion selection.
// Pure TypeScript — no external ML libraries.
// ---------------------------------------------------------------------------

import type { CandidateConfig, BakeoffResult, CandidateResult, TrainedModel } from './types';
import type { RubricConfig } from '@/lib/db/types';
import { buildFeatureMatrix } from './features';
import { trainLogisticRegression } from './algorithms/logistic-regression';
import { trainDecisionTree } from './algorithms/decision-tree';
import { trainRandomForest } from './algorithms/random-forest';
import { trainExtraTrees } from './algorithms/extra-trees';
import { trainGradientBoosted } from './algorithms/gradient-boosted';
import { computeAllMetrics } from './metrics';
import { applyRubric, generateNarrative } from './rubric';
import { computePermutationImportance } from './explainability';
import { downloadDatasetFile } from '@/lib/blob/client';
import { parseFile } from '@/lib/schema/parsers';
import { getDatasetById } from '@/lib/db/queries';

// ---------------------------------------------------------------------------
// Algorithm dispatcher
// ---------------------------------------------------------------------------

export function trainAlgorithm(
  algorithm: string,
  X: number[][],
  y: number[],
  hyperparams: Record<string, unknown>,
  featureNames: string[]
): TrainedModel {
  switch (algorithm) {
    case 'log_reg':
      return trainLogisticRegression(
        X,
        y,
        {
          learningRate: (hyperparams.learningRate as number) ?? undefined,
          epochs: (hyperparams.epochs as number) ?? undefined,
          C: (hyperparams.C as number) ?? undefined,
        },
        featureNames
      );

    case 'decision_tree':
      return trainDecisionTree(
        X,
        y,
        {
          maxDepth: (hyperparams.maxDepth as number) ?? undefined,
          minSamplesSplit: (hyperparams.minSamplesSplit as number) ?? undefined,
          minSamplesLeaf: (hyperparams.minSamplesLeaf as number) ?? undefined,
          seed: (hyperparams.seed as number) ?? 42,
        },
        featureNames
      );

    case 'random_forest':
      return trainRandomForest(
        X,
        y,
        {
          nEstimators: (hyperparams.nEstimators as number) ?? undefined,
          maxDepth: (hyperparams.maxDepth as number) ?? undefined,
          maxFeatures: (hyperparams.maxFeatures as number) ?? undefined,
          seed: (hyperparams.seed as number) ?? 42,
        },
        featureNames
      );

    case 'extra_trees':
      return trainExtraTrees(
        X,
        y,
        {
          nEstimators: (hyperparams.nEstimators as number) ?? undefined,
          maxDepth: (hyperparams.maxDepth as number) ?? undefined,
          seed: (hyperparams.seed as number) ?? 42,
        },
        featureNames
      );

    case 'gradient_boosted':
      return trainGradientBoosted(
        X,
        y,
        {
          nEstimators: (hyperparams.nEstimators as number) ?? undefined,
          learningRate: (hyperparams.learningRate as number) ?? undefined,
          maxDepth: (hyperparams.maxDepth as number) ?? undefined,
          seed: (hyperparams.seed as number) ?? 42,
        },
        featureNames
      );

    default:
      throw new Error(`Unknown algorithm: ${algorithm}`);
  }
}

// ---------------------------------------------------------------------------
// Train a single candidate — used by the sequential /train-candidate API
// ---------------------------------------------------------------------------

export interface SingleCandidateResult {
  algorithm: string;
  hyperparams: Record<string, unknown>;
  metrics: import('./types').MetricsResult;
  importance: Record<string, number>;
  serializedArtifact: string;
  failed: boolean;
}

export function trainSingleCandidate(
  config: CandidateConfig,
  X: number[][],
  y: number[],
  featureNames: string[],
  reviewRate: number
): SingleCandidateResult {
  try {
    const model = trainAlgorithm(config.algorithm, X, y, config.hyperparams ?? {}, featureNames);
    const scores = model.predictBatch(X);
    const metrics = computeAllMetrics(y, scores, reviewRate, config.algorithm);
    const importance = computePermutationImportance(model, X, y, featureNames);
    const serializedArtifact = model.serialize();

    return {
      algorithm: config.algorithm,
      hyperparams: config.hyperparams ?? {},
      metrics,
      importance,
      serializedArtifact,
      failed: false,
    };
  } catch (err) {
    console.error(
      `[ML Runner] Candidate ${config.algorithm} failed:`,
      err instanceof Error ? err.message : err
    );
    return {
      algorithm: config.algorithm,
      hyperparams: config.hyperparams ?? {},
      metrics: {
        prAuc: 0,
        recallAtReviewRate: 0,
        precisionAtReviewRate: 0,
        f1: 0,
        stability: 0,
        explainability: 0,
      },
      importance: Object.fromEntries(featureNames.map((n) => [n, 0])),
      serializedArtifact: JSON.stringify({ algorithm: config.algorithm, error: 'training_failed' }),
      failed: true,
    };
  }
}

// ---------------------------------------------------------------------------
// Main bake-off runner
// ---------------------------------------------------------------------------

export async function runBakeoff(
  datasetId: string,
  candidates: CandidateConfig[],
  rubricConfig: RubricConfig,
  labelColumn: string,
  reviewRate: number
): Promise<BakeoffResult> {
  // ---- 1. Fetch and parse dataset ----
  const dataset = await getDatasetById(datasetId);
  if (!dataset) {
    throw new Error(`Dataset not found: ${datasetId}`);
  }

  const arrayBuffer = await downloadDatasetFile(dataset.blob_url);
  const buffer = Buffer.from(arrayBuffer);
  const parsed = parseFile(buffer, dataset.source_format);

  if (parsed.rows.length === 0) {
    throw new Error('Dataset has no rows');
  }

  // ---- 2. Build feature matrix ----
  const schema = dataset.schema_json;
  const { X, y, featureNames, normContext } = buildFeatureMatrix(parsed.rows, schema, labelColumn);

  if (X.length === 0 || featureNames.length === 0) {
    throw new Error('Feature matrix is empty — check that the dataset has usable columns');
  }

  // Validate that we have both classes
  const positiveCount = y.reduce((sum, v) => sum + v, 0);
  const negativeCount = y.length - positiveCount;

  if (positiveCount === 0) {
    throw new Error(
      `Label column "${labelColumn}" has no positive (1) labels. Cannot train a binary classifier.`
    );
  }
  if (negativeCount === 0) {
    throw new Error(
      `Label column "${labelColumn}" has no negative (0) labels. Cannot train a binary classifier.`
    );
  }

  // ---- 3. Train each candidate ----
  const candidateResults: CandidateResult[] = [];

  for (const config of candidates) {
    try {
      const model = trainAlgorithm(config.algorithm, X, y, config.hyperparams ?? {}, featureNames);

      // ---- 4. Predict on full data and compute metrics ----
      const scores = model.predictBatch(X);
      const metrics = computeAllMetrics(y, scores, reviewRate, config.algorithm);

      // ---- 5. Compute permutation importance ----
      const importance = computePermutationImportance(model, X, y, featureNames);

      // ---- 6. Serialize model artifact (embed normContext for scoring) ----
      const rawArtifact = model.serialize();
      const artifactObj = JSON.parse(rawArtifact) as Record<string, unknown>;
      artifactObj.normContext = normContext;
      const serializedArtifact = JSON.stringify(artifactObj);

      candidateResults.push({
        algorithm: config.algorithm,
        hyperparams: config.hyperparams ?? {},
        model,
        metrics,
        importance,
        serializedArtifact,
      });
    } catch (err) {
      // If a single candidate fails, log and continue with others
      console.error(
        `[ML Runner] Candidate ${config.algorithm} failed:`,
        err instanceof Error ? err.message : err
      );
      // Push a zeroed-out result so the rubric can still work
      const emptyModel: TrainedModel = {
        algorithm: config.algorithm,
        predict: () => 0,
        predictBatch: (X) => X.map(() => 0),
        serialize: () => JSON.stringify({ algorithm: config.algorithm, error: 'training_failed' }),
        featureNames,
      };
      candidateResults.push({
        algorithm: config.algorithm,
        hyperparams: config.hyperparams ?? {},
        model: emptyModel,
        metrics: {
          prAuc: 0,
          recallAtReviewRate: 0,
          precisionAtReviewRate: 0,
          f1: 0,
          stability: 0,
          explainability: 0,
        },
        importance: Object.fromEntries(featureNames.map((n) => [n, 0])),
        serializedArtifact: emptyModel.serialize(),
      });
    }
  }

  if (candidateResults.length === 0) {
    throw new Error('All candidates failed to train');
  }

  // ---- 7. Apply rubric ----
  const { championIndex } = applyRubric(candidateResults, rubricConfig);

  // ---- 8. Generate narrative ----
  const { narrativeShort, narrativeLong } = generateNarrative(
    candidateResults,
    championIndex,
    rubricConfig
  );

  return {
    candidates: candidateResults,
    recommendedChampionIndex: championIndex,
    narrativeShort,
    narrativeLong,
  };
}
