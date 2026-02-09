// ---------------------------------------------------------------------------
// CART Decision Tree with Gini Impurity
// Pure TypeScript — no external ML libraries
// ---------------------------------------------------------------------------

import type { TrainedModel } from '../types';

export interface DecisionTreeParams {
  maxDepth?: number; // default 8
  minSamplesSplit?: number; // default 5
  minSamplesLeaf?: number; // default 2
  seed?: number; // default 42
  /** If true, pick random thresholds instead of best split (used by ExtraTrees) */
  randomThresholds?: boolean;
}

// ---------------------------------------------------------------------------
// Tree node types
// ---------------------------------------------------------------------------

interface TreeLeaf {
  type: 'leaf';
  value: number; // probability of positive class
}

interface TreeSplit {
  type: 'split';
  featureIndex: number;
  threshold: number;
  left: TreeNode;
  right: TreeNode;
}

export type TreeNode = TreeLeaf | TreeSplit;

// ---------------------------------------------------------------------------
// Seeded PRNG
// ---------------------------------------------------------------------------

export function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

// ---------------------------------------------------------------------------
// Gini impurity
// ---------------------------------------------------------------------------

function giniImpurity(labels: number[]): number {
  if (labels.length === 0) return 0;
  let sumPositive = 0;
  for (let i = 0; i < labels.length; i++) {
    sumPositive += labels[i];
  }
  const p1 = sumPositive / labels.length;
  const p0 = 1 - p1;
  return 1 - p0 * p0 - p1 * p1;
}

// ---------------------------------------------------------------------------
// Build tree
// ---------------------------------------------------------------------------

function buildTree(
  X: number[][],
  y: number[],
  indices: number[],
  depth: number,
  params: Required<DecisionTreeParams>,
  rng: () => number
): TreeNode {
  const n = indices.length;

  // Compute leaf value (positive class proportion)
  let positiveCount = 0;
  for (let i = 0; i < n; i++) {
    positiveCount += y[indices[i]];
  }
  const leafValue = n > 0 ? positiveCount / n : 0;

  // Stopping conditions
  if (depth >= params.maxDepth) {
    return { type: 'leaf', value: leafValue };
  }
  if (n < params.minSamplesSplit) {
    return { type: 'leaf', value: leafValue };
  }
  // All same class
  if (positiveCount === 0 || positiveCount === n) {
    return { type: 'leaf', value: leafValue };
  }

  const nFeatures = X[0]?.length ?? 0;
  if (nFeatures === 0) {
    return { type: 'leaf', value: leafValue };
  }

  // Find the best split
  let bestGini = Infinity;
  let bestFeature = -1;
  let bestThreshold = 0;

  // Collect current labels for this node
  const currentLabels = indices.map((i) => y[i]);

  for (let f = 0; f < nFeatures; f++) {
    // Get values for this feature
    const featureValues = indices.map((i) => X[i][f]);

    let thresholds: number[];

    if (params.randomThresholds) {
      // ExtraTrees mode: pick a single random threshold between min and max
      let minVal = Infinity;
      let maxVal = -Infinity;
      for (const v of featureValues) {
        if (v < minVal) minVal = v;
        if (v > maxVal) maxVal = v;
      }
      if (minVal === maxVal) continue; // no variance, skip
      const randomThreshold = minVal + rng() * (maxVal - minVal);
      thresholds = [randomThreshold];
    } else {
      // Standard CART: try midpoints of sorted unique values
      const uniqueVals = Array.from(new Set(featureValues)).sort((a, b) => a - b);
      if (uniqueVals.length <= 1) continue; // no split possible

      // For speed: subsample to at most 20 threshold candidates
      if (uniqueVals.length <= 21) {
        thresholds = [];
        for (let i = 0; i < uniqueVals.length - 1; i++) {
          thresholds.push((uniqueVals[i] + uniqueVals[i + 1]) / 2);
        }
      } else {
        // Sample 20 random midpoints
        thresholds = [];
        for (let t = 0; t < 20; t++) {
          const idx = Math.floor(rng() * (uniqueVals.length - 1));
          thresholds.push((uniqueVals[idx] + uniqueVals[idx + 1]) / 2);
        }
      }
    }

    for (const threshold of thresholds) {
      const leftLabels: number[] = [];
      const rightLabels: number[] = [];

      for (let i = 0; i < n; i++) {
        if (featureValues[i] <= threshold) {
          leftLabels.push(currentLabels[i]);
        } else {
          rightLabels.push(currentLabels[i]);
        }
      }

      // Check minimum leaf size
      if (leftLabels.length < params.minSamplesLeaf || rightLabels.length < params.minSamplesLeaf) {
        continue;
      }

      // Weighted Gini
      const leftGini = giniImpurity(leftLabels);
      const rightGini = giniImpurity(rightLabels);
      const weightedGini = (leftLabels.length * leftGini + rightLabels.length * rightGini) / n;

      if (weightedGini < bestGini) {
        bestGini = weightedGini;
        bestFeature = f;
        bestThreshold = threshold;
      }
    }
  }

  // If no valid split found, return leaf
  if (bestFeature === -1) {
    return { type: 'leaf', value: leafValue };
  }

  // Split indices
  const leftIndices: number[] = [];
  const rightIndices: number[] = [];
  for (const idx of indices) {
    if (X[idx][bestFeature] <= bestThreshold) {
      leftIndices.push(idx);
    } else {
      rightIndices.push(idx);
    }
  }

  const left = buildTree(X, y, leftIndices, depth + 1, params, rng);
  const right = buildTree(X, y, rightIndices, depth + 1, params, rng);

  return {
    type: 'split',
    featureIndex: bestFeature,
    threshold: bestThreshold,
    left,
    right,
  };
}

// ---------------------------------------------------------------------------
// Predict
// ---------------------------------------------------------------------------

export function predictFromTree(node: TreeNode, features: number[]): number {
  if (node.type === 'leaf') {
    return node.value;
  }
  if (features[node.featureIndex] <= node.threshold) {
    return predictFromTree(node.left, features);
  }
  return predictFromTree(node.right, features);
}

// ---------------------------------------------------------------------------
// Serialize / Deserialize
// ---------------------------------------------------------------------------

function serializeTree(node: TreeNode): unknown {
  if (node.type === 'leaf') {
    return { type: 'leaf', value: node.value };
  }
  return {
    type: 'split',
    featureIndex: node.featureIndex,
    threshold: node.threshold,
    left: serializeTree(node.left),
    right: serializeTree(node.right),
  };
}

export function deserializeTree(data: unknown): TreeNode {
  const obj = data as Record<string, unknown>;
  if (obj.type === 'leaf') {
    return { type: 'leaf', value: obj.value as number };
  }
  return {
    type: 'split',
    featureIndex: obj.featureIndex as number,
    threshold: obj.threshold as number,
    left: deserializeTree(obj.left),
    right: deserializeTree(obj.right),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function trainDecisionTree(
  X: number[][],
  y: number[],
  params: DecisionTreeParams = {},
  featureNames?: string[]
): TrainedModel {
  const fullParams: Required<DecisionTreeParams> = {
    maxDepth: params.maxDepth ?? 8,
    minSamplesSplit: params.minSamplesSplit ?? 5,
    minSamplesLeaf: params.minSamplesLeaf ?? 2,
    seed: params.seed ?? 42,
    randomThresholds: params.randomThresholds ?? false,
  };

  const rng = seededRandom(fullParams.seed);
  const nSamples = X.length;

  // Edge case: no data
  if (nSamples === 0) {
    const leaf: TreeNode = { type: 'leaf', value: 0 };
    return buildModelFromTree(leaf, 'decision_tree', featureNames ?? []);
  }

  const indices = Array.from({ length: nSamples }, (_, i) => i);
  const root = buildTree(X, y, indices, 0, fullParams, rng);

  return buildModelFromTree(
    root,
    fullParams.randomThresholds ? 'extra_tree' : 'decision_tree',
    featureNames ?? []
  );
}

export function buildModelFromTree(
  root: TreeNode,
  algorithm: string,
  featureNames: string[]
): TrainedModel {
  const predict = (features: number[]): number => {
    return predictFromTree(root, features);
  };

  const predictBatch = (X: number[][]): number[] => {
    return X.map((row) => predictFromTree(root, row));
  };

  const serialize = (): string => {
    return JSON.stringify({
      algorithm,
      tree: serializeTree(root),
      featureNames,
    });
  };

  return {
    algorithm,
    predict,
    predictBatch,
    serialize,
    featureNames,
  };
}
