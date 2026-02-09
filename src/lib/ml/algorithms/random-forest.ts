// ---------------------------------------------------------------------------
// Random Forest — Bagged ensemble of decision trees
// Pure TypeScript — no external ML libraries
// ---------------------------------------------------------------------------

import type { TrainedModel } from '../types';
import { trainDecisionTree, seededRandom, type DecisionTreeParams } from './decision-tree';

export interface RandomForestParams {
  nEstimators?: number; // default 20
  maxDepth?: number; // default 10
  maxFeatures?: number; // default sqrt(n_features), as fraction 0-1 or count
  seed?: number; // default 42
}

export function trainRandomForest(
  X: number[][],
  y: number[],
  params: RandomForestParams = {},
  featureNames?: string[]
): TrainedModel {
  const nEstimators = params.nEstimators ?? 20;
  const maxDepth = params.maxDepth ?? 10;
  const seed = params.seed ?? 42;
  const nSamples = X.length;
  const nFeatures = nSamples > 0 ? X[0].length : 0;

  // Determine max features per tree
  let maxFeaturesCount: number;
  if (params.maxFeatures !== undefined) {
    if (params.maxFeatures > 0 && params.maxFeatures <= 1) {
      // Fraction
      maxFeaturesCount = Math.max(1, Math.round(params.maxFeatures * nFeatures));
    } else {
      maxFeaturesCount = Math.min(Math.round(params.maxFeatures), nFeatures);
    }
  } else {
    // Default: sqrt(n_features)
    maxFeaturesCount = Math.max(1, Math.round(Math.sqrt(nFeatures)));
  }

  const rng = seededRandom(seed);
  const trees: TrainedModel[] = [];

  // Feature subset indices per tree (for consistent prediction)
  const featureSubsets: number[][] = [];

  for (let t = 0; t < nEstimators; t++) {
    // Bootstrap sample (sample with replacement)
    const bootstrapIndices: number[] = [];
    for (let i = 0; i < nSamples; i++) {
      bootstrapIndices.push(Math.floor(rng() * nSamples));
    }

    // Random feature subset
    const allFeatureIndices = Array.from({ length: nFeatures }, (_, i) => i);
    // Fisher-Yates shuffle with our seeded RNG
    for (let i = allFeatureIndices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [allFeatureIndices[i], allFeatureIndices[j]] = [allFeatureIndices[j], allFeatureIndices[i]];
    }
    const selectedFeatures = allFeatureIndices.slice(0, maxFeaturesCount);
    featureSubsets.push(selectedFeatures);

    // Create subset X with only selected features
    const subX: number[][] = bootstrapIndices.map((idx) => selectedFeatures.map((f) => X[idx][f]));
    const subY: number[] = bootstrapIndices.map((idx) => y[idx]);

    // Subset feature names
    const subFeatureNames = selectedFeatures.map((f) => (featureNames ?? [])[f] ?? `feature_${f}`);

    const treeParams: DecisionTreeParams = {
      maxDepth,
      minSamplesSplit: 5,
      minSamplesLeaf: 2,
      seed: seed + t + 1, // different seed per tree
    };

    const tree = trainDecisionTree(subX, subY, treeParams, subFeatureNames);
    trees.push(tree);
  }

  // Build ensemble model
  const predict = (features: number[]): number => {
    if (trees.length === 0) return 0;
    let sum = 0;
    for (let t = 0; t < trees.length; t++) {
      // Map full features to this tree's feature subset
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
      algorithm: 'random_forest',
      nEstimators,
      maxDepth,
      maxFeaturesCount,
      featureSubsets,
      trees: trees.map((tree) => JSON.parse(tree.serialize())),
      featureNames: featureNames ?? [],
    });
  };

  return {
    algorithm: 'random_forest',
    predict,
    predictBatch,
    serialize,
    featureNames: featureNames ?? [],
  };
}
