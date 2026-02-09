// ---------------------------------------------------------------------------
// Extremely Randomized Trees (Extra-Trees)
// Like Random Forest but thresholds are random — faster, more diverse
// Pure TypeScript — no external ML libraries
// ---------------------------------------------------------------------------

import type { TrainedModel } from '../types';
import { trainDecisionTree, seededRandom, type DecisionTreeParams } from './decision-tree';

export interface ExtraTreesParams {
  nEstimators?: number; // default 20
  maxDepth?: number; // default 10
  seed?: number; // default 42
}

export function trainExtraTrees(
  X: number[][],
  y: number[],
  params: ExtraTreesParams = {},
  featureNames?: string[]
): TrainedModel {
  const nEstimators = params.nEstimators ?? 20;
  const maxDepth = params.maxDepth ?? 10;
  const seed = params.seed ?? 42;
  const nSamples = X.length;
  const nFeatures = nSamples > 0 ? X[0].length : 0;

  const maxFeaturesCount = Math.max(1, Math.round(Math.sqrt(nFeatures)));
  const rng = seededRandom(seed);
  const trees: TrainedModel[] = [];
  const featureSubsets: number[][] = [];

  for (let t = 0; t < nEstimators; t++) {
    // Bootstrap sample
    const bootstrapIndices: number[] = [];
    for (let i = 0; i < nSamples; i++) {
      bootstrapIndices.push(Math.floor(rng() * nSamples));
    }

    // Random feature subset
    const allFeatureIndices = Array.from({ length: nFeatures }, (_, i) => i);
    for (let i = allFeatureIndices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [allFeatureIndices[i], allFeatureIndices[j]] = [allFeatureIndices[j], allFeatureIndices[i]];
    }
    const selectedFeatures = allFeatureIndices.slice(0, maxFeaturesCount);
    featureSubsets.push(selectedFeatures);

    // Create subset
    const subX: number[][] = bootstrapIndices.map((idx) => selectedFeatures.map((f) => X[idx][f]));
    const subY: number[] = bootstrapIndices.map((idx) => y[idx]);

    const subFeatureNames = selectedFeatures.map((f) => (featureNames ?? [])[f] ?? `feature_${f}`);

    // Key difference: randomThresholds = true
    const treeParams: DecisionTreeParams = {
      maxDepth,
      minSamplesSplit: 5,
      minSamplesLeaf: 2,
      seed: seed + t + 1,
      randomThresholds: true,
    };

    const tree = trainDecisionTree(subX, subY, treeParams, subFeatureNames);
    trees.push(tree);
  }

  // Ensemble prediction
  const predict = (features: number[]): number => {
    if (trees.length === 0) return 0;
    let sum = 0;
    for (let t = 0; t < trees.length; t++) {
      const subFeatures = featureSubsets[t].map((f) => features[f] ?? 0);
      sum += trees[t].predict(subFeatures);
    }
    return sum / trees.length;
  };

  const predictBatch = (X: number[][]): number[] => {
    return X.map((row) => predict(row));
  };

  const serialize = (): string => {
    return JSON.stringify({
      algorithm: 'extra_trees',
      nEstimators,
      maxDepth,
      maxFeaturesCount,
      featureSubsets,
      trees: trees.map((tree) => JSON.parse(tree.serialize())),
      featureNames: featureNames ?? [],
    });
  };

  return {
    algorithm: 'extra_trees',
    predict,
    predictBatch,
    serialize,
    featureNames: featureNames ?? [],
  };
}
