// ---------------------------------------------------------------------------
// SHAP Explainability Engine — TreeSHAP approximation + Linear SHAP
// Pure TypeScript — no external dependencies
// ---------------------------------------------------------------------------

import type { TrainedModel, ShapValues, GlobalShapSummary } from './types';
import type { TreeNode } from './algorithms/decision-tree';
import { predictFromTree, deserializeTree, seededRandom } from './algorithms/decision-tree';

// ---------------------------------------------------------------------------
// TreeSHAP Approximation (path-based)
// ---------------------------------------------------------------------------

/**
 * Compute local SHAP values for a single tree.
 * Path-based approximation: for each split on feature f in the path from root
 * to leaf, contribution of f = score change at that node.
 */
export function computeTreeShapLocal(
  tree: TreeNode,
  features: number[],
  featureNames: string[]
): ShapValues {
  const contributions = new Array(featureNames.length).fill(0);

  // Get base value from root (average over all leaves)
  const baseValue = getTreeBaseValue(tree);

  // Walk the tree and accumulate contributions
  walkTree(tree, features, contributions, baseValue);

  return {
    values: contributions,
    baseValue,
    featureNames,
  };
}

function getTreeBaseValue(node: TreeNode): number {
  if (node.type === 'leaf') {
    return node.value;
  }
  // Average of both sides (unweighted approximation)
  const leftBase = getTreeBaseValue(node.left);
  const rightBase = getTreeBaseValue(node.right);
  return (leftBase + rightBase) / 2;
}

function walkTree(
  node: TreeNode,
  features: number[],
  contributions: number[],
  parentValue: number
): void {
  if (node.type === 'leaf') {
    return;
  }

  // Determine which branch we take
  const goLeft = features[node.featureIndex] <= node.threshold;
  const childNode = goLeft ? node.left : node.right;

  // Get the value at this child node
  const childValue =
    childNode.type === 'leaf' ? childNode.value : getSubtreeExpectedValue(childNode, features);

  // Contribution of this feature = change in expected value
  const contribution = childValue - parentValue;
  if (node.featureIndex < contributions.length) {
    contributions[node.featureIndex] += contribution;
  }

  // Continue walking
  walkTree(childNode, features, contributions, childValue);
}

function getSubtreeExpectedValue(node: TreeNode, features: number[]): number {
  // Follow the path determined by features
  return predictFromTree(node, features);
}

// ---------------------------------------------------------------------------
// Linear SHAP (exact for logistic regression)
// ---------------------------------------------------------------------------

/**
 * Compute exact SHAP values for a linear model.
 * For each feature: shap[f] = weight[f] * (x[f] - mean_f)
 */
export function computeLinearShapLocal(
  weights: number[],
  bias: number,
  features: number[],
  featureMeans: number[],
  featureNames: string[]
): ShapValues {
  const values = new Array(featureNames.length).fill(0);

  // Base value = bias + sum(weight[f] * mean_f)
  let baseValue = bias;
  for (let f = 0; f < weights.length; f++) {
    baseValue += weights[f] * (featureMeans[f] ?? 0);
  }

  // SHAP value for each feature
  for (let f = 0; f < weights.length && f < features.length; f++) {
    values[f] = weights[f] * (features[f] - (featureMeans[f] ?? 0));
  }

  return { values, baseValue, featureNames };
}

// ---------------------------------------------------------------------------
// Unified Local SHAP dispatcher
// ---------------------------------------------------------------------------

/**
 * Compute local SHAP for any algorithm by dispatching to the right method.
 */
export function computeLocalShap(
  model: TrainedModel,
  artifactJson: string,
  features: number[],
  featureNames: string[],
  featureMeans?: number[]
): ShapValues {
  const artifact = JSON.parse(artifactJson) as Record<string, unknown>;
  const algorithm = artifact.algorithm as string;

  switch (algorithm) {
    case 'log_reg': {
      const weights = artifact.weights as number[];
      const bias = artifact.bias as number;
      const means = featureMeans ?? new Array(weights.length).fill(0);
      return computeLinearShapLocal(weights, bias, features, means, featureNames);
    }

    case 'decision_tree':
    case 'extra_tree': {
      const tree = deserializeTree(artifact.tree) as TreeNode;
      return computeTreeShapLocal(tree, features, featureNames);
    }

    case 'random_forest':
    case 'extra_trees': {
      const trees = artifact.trees as Array<Record<string, unknown>>;
      const featureSubsets = artifact.featureSubsets as number[][];

      const combinedValues = new Array(featureNames.length).fill(0);
      let combinedBase = 0;

      for (let t = 0; t < trees.length; t++) {
        const tree = deserializeTree(trees[t].tree) as TreeNode;
        const subFeatures = featureSubsets[t].map((f) => features[f] ?? 0);
        const subFeatureNames = (trees[t].featureNames as string[]) ?? [];

        const shapResult = computeTreeShapLocal(tree, subFeatures, subFeatureNames);
        combinedBase += shapResult.baseValue;

        // Map sub-tree SHAP values back to full feature space
        for (let sf = 0; sf < featureSubsets[t].length; sf++) {
          const fullIdx = featureSubsets[t][sf];
          if (fullIdx < combinedValues.length) {
            combinedValues[fullIdx] += shapResult.values[sf] ?? 0;
          }
        }
      }

      // Average across trees
      const nTrees = trees.length || 1;
      for (let i = 0; i < combinedValues.length; i++) {
        combinedValues[i] /= nTrees;
      }
      combinedBase /= nTrees;

      return { values: combinedValues, baseValue: combinedBase, featureNames };
    }

    case 'gradient_boosted': {
      const gbtTrees = artifact.trees as unknown[];
      const lr = artifact.learningRate as number;
      const basePrediction = artifact.basePrediction as number;

      const combinedValues = new Array(featureNames.length).fill(0);

      for (const serializedTree of gbtTrees) {
        // GBT trees are regression trees — walk them similarly
        const tree = deserializeRegressionTreeForShap(serializedTree);
        const rContributions = computeRegressionTreeShap(tree, features, featureNames.length);
        for (let f = 0; f < rContributions.length; f++) {
          combinedValues[f] += lr * rContributions[f];
        }
      }

      return { values: combinedValues, baseValue: basePrediction, featureNames };
    }

    default:
      // Fallback: zero SHAP values
      return {
        values: new Array(featureNames.length).fill(0),
        baseValue: model.predict(features),
        featureNames,
      };
  }
}

// ---------------------------------------------------------------------------
// GBT regression tree SHAP helpers
// ---------------------------------------------------------------------------

interface RegressionNodeShap {
  type: 'leaf' | 'split';
  value?: number;
  featureIndex?: number;
  threshold?: number;
  left?: RegressionNodeShap;
  right?: RegressionNodeShap;
}

function deserializeRegressionTreeForShap(data: unknown): RegressionNodeShap {
  const obj = data as Record<string, unknown>;
  if (obj.type === 'leaf') {
    return { type: 'leaf', value: obj.value as number };
  }
  return {
    type: 'split',
    featureIndex: obj.featureIndex as number,
    threshold: obj.threshold as number,
    left: deserializeRegressionTreeForShap(obj.left),
    right: deserializeRegressionTreeForShap(obj.right),
  };
}

function predictRegressionNodeShap(node: RegressionNodeShap, features: number[]): number {
  if (node.type === 'leaf') return node.value ?? 0;
  if (features[node.featureIndex!] <= node.threshold!) {
    return predictRegressionNodeShap(node.left!, features);
  }
  return predictRegressionNodeShap(node.right!, features);
}

function getRegressionBaseValue(node: RegressionNodeShap): number {
  if (node.type === 'leaf') return node.value ?? 0;
  return (getRegressionBaseValue(node.left!) + getRegressionBaseValue(node.right!)) / 2;
}

function computeRegressionTreeShap(
  node: RegressionNodeShap,
  features: number[],
  nFeatures: number
): number[] {
  const contributions = new Array(nFeatures).fill(0);
  const baseValue = getRegressionBaseValue(node);
  walkRegressionTree(node, features, contributions, baseValue);
  return contributions;
}

function walkRegressionTree(
  node: RegressionNodeShap,
  features: number[],
  contributions: number[],
  parentValue: number
): void {
  if (node.type === 'leaf') return;

  const goLeft = features[node.featureIndex!] <= node.threshold!;
  const childNode = goLeft ? node.left! : node.right!;
  const childValue = predictRegressionNodeShap(childNode, features);

  const contribution = childValue - parentValue;
  if (node.featureIndex! < contributions.length) {
    contributions[node.featureIndex!] += contribution;
  }

  walkRegressionTree(childNode, features, contributions, childValue);
}

// ---------------------------------------------------------------------------
// Global SHAP (sample-based)
// ---------------------------------------------------------------------------

/**
 * Compute global SHAP summary by averaging |local SHAP| across samples.
 */
export function computeGlobalShap(
  model: TrainedModel,
  artifactJson: string,
  X: number[][],
  featureNames: string[],
  sampleSize: number = 10000
): GlobalShapSummary {
  const n = X.length;
  const rng = seededRandom(42);

  // Sample indices
  const sampleIndices: number[] = [];
  if (n <= sampleSize) {
    for (let i = 0; i < n; i++) sampleIndices.push(i);
  } else {
    const indexSet = new Set<number>();
    while (indexSet.size < sampleSize) {
      indexSet.add(Math.floor(rng() * n));
    }
    sampleIndices.push(...indexSet);
  }

  // Compute feature means for linear SHAP
  const featureMeans = new Array(featureNames.length).fill(0);
  for (let i = 0; i < n; i++) {
    for (let f = 0; f < featureNames.length && f < X[i].length; f++) {
      featureMeans[f] += X[i][f];
    }
  }
  for (let f = 0; f < featureMeans.length; f++) {
    featureMeans[f] /= n || 1;
  }

  // Accumulate absolute SHAP values
  const sumAbsShap = new Array(featureNames.length).fill(0);

  for (const idx of sampleIndices) {
    const shap = computeLocalShap(model, artifactJson, X[idx], featureNames, featureMeans);
    for (let f = 0; f < shap.values.length; f++) {
      sumAbsShap[f] += Math.abs(shap.values[f]);
    }
  }

  const nSampled = sampleIndices.length || 1;
  const meanAbsShap: Record<string, number> = {};
  for (let f = 0; f < featureNames.length; f++) {
    meanAbsShap[featureNames[f]] = sumAbsShap[f] / nSampled;
  }

  // Sort by importance
  const topFeatures = Object.entries(meanAbsShap)
    .map(([feature, value]) => ({ feature, meanAbsShap: value }))
    .sort((a, b) => b.meanAbsShap - a.meanAbsShap);

  return { meanAbsShap, topFeatures };
}
