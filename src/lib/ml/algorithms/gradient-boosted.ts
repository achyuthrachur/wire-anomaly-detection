// ---------------------------------------------------------------------------
// Gradient Boosted Trees (GBT)
// Binary classification with log-loss, shallow regression stumps
// Pure TypeScript — no external ML libraries
// ---------------------------------------------------------------------------

import type { TrainedModel } from '../types';
import { seededRandom } from './decision-tree';

export interface GBTParams {
  nEstimators?: number; // default 50
  learningRate?: number; // default 0.1
  maxDepth?: number; // default 3
  seed?: number; // default 42
}

// ---------------------------------------------------------------------------
// Regression tree node (fits residuals, not classes)
// ---------------------------------------------------------------------------

interface RegressionLeaf {
  type: 'leaf';
  value: number; // mean residual
}

interface RegressionSplit {
  type: 'split';
  featureIndex: number;
  threshold: number;
  left: RegressionNode;
  right: RegressionNode;
}

type RegressionNode = RegressionLeaf | RegressionSplit;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sigmoid(z: number): number {
  if (z > 500) return 1;
  if (z < -500) return 0;
  return 1 / (1 + Math.exp(-z));
}

function meanArray(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
  }
  return sum / values.length;
}

/** Variance reduction (MSE) for regression splits */
function mse(values: number[]): number {
  if (values.length === 0) return 0;
  const avg = meanArray(values);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    const diff = values[i] - avg;
    sum += diff * diff;
  }
  return sum / values.length;
}

// ---------------------------------------------------------------------------
// Build regression tree (for residuals)
// ---------------------------------------------------------------------------

function buildRegressionTree(
  X: number[][],
  residuals: number[],
  indices: number[],
  depth: number,
  maxDepth: number,
  rng: () => number
): RegressionNode {
  const n = indices.length;
  const leafValue = meanArray(indices.map((i) => residuals[i]));

  // Stopping conditions
  if (depth >= maxDepth || n < 5) {
    return { type: 'leaf', value: leafValue };
  }

  const nFeatures = X[0]?.length ?? 0;
  if (nFeatures === 0) {
    return { type: 'leaf', value: leafValue };
  }

  let bestMSE = Infinity;
  let bestFeature = -1;
  let bestThreshold = 0;

  for (let f = 0; f < nFeatures; f++) {
    const featureValues = indices.map((i) => X[i][f]);
    const residualValues = indices.map((i) => residuals[i]);

    // Get unique values
    const uniqueVals = Array.from(new Set(featureValues)).sort((a, b) => a - b);
    if (uniqueVals.length <= 1) continue;

    // Try up to 20 random thresholds for speed
    let thresholds: number[];
    if (uniqueVals.length <= 21) {
      thresholds = [];
      for (let i = 0; i < uniqueVals.length - 1; i++) {
        thresholds.push((uniqueVals[i] + uniqueVals[i + 1]) / 2);
      }
    } else {
      thresholds = [];
      for (let t = 0; t < 20; t++) {
        const idx = Math.floor(rng() * (uniqueVals.length - 1));
        thresholds.push((uniqueVals[idx] + uniqueVals[idx + 1]) / 2);
      }
    }

    for (const threshold of thresholds) {
      const leftResiduals: number[] = [];
      const rightResiduals: number[] = [];

      for (let i = 0; i < n; i++) {
        if (featureValues[i] <= threshold) {
          leftResiduals.push(residualValues[i]);
        } else {
          rightResiduals.push(residualValues[i]);
        }
      }

      if (leftResiduals.length < 2 || rightResiduals.length < 2) continue;

      const weightedMSE =
        (leftResiduals.length * mse(leftResiduals) + rightResiduals.length * mse(rightResiduals)) /
        n;

      if (weightedMSE < bestMSE) {
        bestMSE = weightedMSE;
        bestFeature = f;
        bestThreshold = threshold;
      }
    }
  }

  if (bestFeature === -1) {
    return { type: 'leaf', value: leafValue };
  }

  const leftIndices: number[] = [];
  const rightIndices: number[] = [];
  for (const idx of indices) {
    if (X[idx][bestFeature] <= bestThreshold) {
      leftIndices.push(idx);
    } else {
      rightIndices.push(idx);
    }
  }

  return {
    type: 'split',
    featureIndex: bestFeature,
    threshold: bestThreshold,
    left: buildRegressionTree(X, residuals, leftIndices, depth + 1, maxDepth, rng),
    right: buildRegressionTree(X, residuals, rightIndices, depth + 1, maxDepth, rng),
  };
}

function predictRegressionTree(node: RegressionNode, features: number[]): number {
  if (node.type === 'leaf') {
    return node.value;
  }
  if (features[node.featureIndex] <= node.threshold) {
    return predictRegressionTree(node.left, features);
  }
  return predictRegressionTree(node.right, features);
}

function serializeRegressionTree(node: RegressionNode): unknown {
  if (node.type === 'leaf') {
    return { type: 'leaf', value: node.value };
  }
  return {
    type: 'split',
    featureIndex: node.featureIndex,
    threshold: node.threshold,
    left: serializeRegressionTree(node.left),
    right: serializeRegressionTree(node.right),
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export function trainGradientBoosted(
  X: number[][],
  y: number[],
  params: GBTParams = {},
  featureNames?: string[]
): TrainedModel {
  const nEstimators = params.nEstimators ?? 50;
  const lr = params.learningRate ?? 0.1;
  const maxDepth = params.maxDepth ?? 3;
  const seed = params.seed ?? 42;
  const nSamples = X.length;

  const rng = seededRandom(seed);

  // Edge case: no data
  if (nSamples === 0) {
    const emptyPredict = (): number => 0.5;
    return {
      algorithm: 'gradient_boosted',
      predict: emptyPredict,
      predictBatch: (X: number[][]) => X.map(() => 0.5),
      serialize: () =>
        JSON.stringify({
          algorithm: 'gradient_boosted',
          basePrediction: 0,
          trees: [],
          learningRate: lr,
          featureNames: featureNames ?? [],
        }),
      featureNames: featureNames ?? [],
    };
  }

  // Initialize predictions to log-odds of the base rate
  let positiveCount = 0;
  for (let i = 0; i < nSamples; i++) {
    positiveCount += y[i];
  }
  const baseRate = positiveCount / nSamples;
  // Clamp base rate to avoid log(0) or log(Inf)
  const clampedRate = Math.max(1e-7, Math.min(1 - 1e-7, baseRate));
  const basePrediction = Math.log(clampedRate / (1 - clampedRate));

  // Current raw scores (log-odds space)
  const rawScores = new Array(nSamples).fill(basePrediction);
  const trees: RegressionNode[] = [];

  for (let round = 0; round < nEstimators; round++) {
    // Compute current probabilities
    const currentProba = rawScores.map((s) => sigmoid(s));

    // Compute residuals: y - p (negative gradient of log-loss)
    const residuals = new Array(nSamples);
    for (let i = 0; i < nSamples; i++) {
      residuals[i] = y[i] - currentProba[i];
    }

    // Fit regression tree to residuals
    const indices = Array.from({ length: nSamples }, (_, i) => i);
    const tree = buildRegressionTree(X, residuals, indices, 0, maxDepth, rng);

    // Update raw scores
    for (let i = 0; i < nSamples; i++) {
      rawScores[i] += lr * predictRegressionTree(tree, X[i]);
    }

    trees.push(tree);
  }

  // Build model
  const predict = (features: number[]): number => {
    let score = basePrediction;
    for (const tree of trees) {
      score += lr * predictRegressionTree(tree, features);
    }
    return sigmoid(score);
  };

  const predictBatch = (X: number[][]): number[] => {
    return X.map((row) => predict(row));
  };

  const serialize = (): string => {
    return JSON.stringify({
      algorithm: 'gradient_boosted',
      basePrediction,
      learningRate: lr,
      trees: trees.map((tree) => serializeRegressionTree(tree)),
      featureNames: featureNames ?? [],
    });
  };

  return {
    algorithm: 'gradient_boosted',
    predict,
    predictBatch,
    serialize,
    featureNames: featureNames ?? [],
  };
}
