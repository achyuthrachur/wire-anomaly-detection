// ---------------------------------------------------------------------------
// Model Deserialization — reconstruct TrainedModel from serialized JSON
// Pure TypeScript — dispatches to algorithm-specific reconstructors
// ---------------------------------------------------------------------------

import type { TrainedModel } from './types';
import {
  deserializeTree,
  predictFromTree,
  buildModelFromTree,
  type TreeNode,
} from './algorithms/decision-tree';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sigmoid(z: number): number {
  if (z > 500) return 1;
  if (z < -500) return 0;
  return 1 / (1 + Math.exp(-z));
}

function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

// ---------------------------------------------------------------------------
// Algorithm-specific deserializers
// ---------------------------------------------------------------------------

function deserializeLogReg(artifact: Record<string, unknown>): TrainedModel {
  const weights = artifact.weights as number[];
  const bias = artifact.bias as number;
  const featureNames = artifact.featureNames as string[];

  const predict = (features: number[]): number => {
    const z = dot(features, weights) + bias;
    return sigmoid(z);
  };

  const predictBatch = (X: number[][]): number[] => {
    return X.map((row) => predict(row));
  };

  const serialize = (): string => {
    return JSON.stringify({ algorithm: 'log_reg', weights, bias, featureNames });
  };

  return { algorithm: 'log_reg', predict, predictBatch, serialize, featureNames };
}

function deserializeDecisionTree(artifact: Record<string, unknown>): TrainedModel {
  const tree = deserializeTree(artifact.tree);
  const featureNames = artifact.featureNames as string[];
  const algorithm = (artifact.algorithm as string) || 'decision_tree';
  return buildModelFromTree(tree, algorithm, featureNames);
}

function deserializeEnsemble(artifact: Record<string, unknown>): TrainedModel {
  const algorithm = artifact.algorithm as string;
  const featureSubsets = artifact.featureSubsets as number[][];
  const featureNames = artifact.featureNames as string[];
  const serializedTrees = artifact.trees as Array<Record<string, unknown>>;

  const trees: Array<{ root: TreeNode; subFeatureNames: string[] }> = [];
  for (const serialized of serializedTrees) {
    const root = deserializeTree(serialized.tree);
    const subFeatureNames = serialized.featureNames as string[];
    trees.push({ root, subFeatureNames });
  }

  const predict = (features: number[]): number => {
    if (trees.length === 0) return 0;
    let sum = 0;
    for (let t = 0; t < trees.length; t++) {
      const subFeatures = featureSubsets[t].map((f) => features[f] ?? 0);
      sum += predictFromTree(trees[t].root, subFeatures);
    }
    return sum / trees.length;
  };

  const predictBatch = (X: number[][]): number[] => {
    return X.map((row) => predict(row));
  };

  const serialize = (): string => {
    return JSON.stringify(artifact);
  };

  return { algorithm, predict, predictBatch, serialize, featureNames };
}

interface RegressionNode {
  type: 'leaf' | 'split';
  value?: number;
  featureIndex?: number;
  threshold?: number;
  left?: RegressionNode;
  right?: RegressionNode;
}

function deserializeRegressionNode(data: unknown): RegressionNode {
  const obj = data as Record<string, unknown>;
  if (obj.type === 'leaf') {
    return { type: 'leaf', value: obj.value as number };
  }
  return {
    type: 'split',
    featureIndex: obj.featureIndex as number,
    threshold: obj.threshold as number,
    left: deserializeRegressionNode(obj.left),
    right: deserializeRegressionNode(obj.right),
  };
}

function predictRegressionNode(node: RegressionNode, features: number[]): number {
  if (node.type === 'leaf') {
    return node.value ?? 0;
  }
  if (features[node.featureIndex!] <= node.threshold!) {
    return predictRegressionNode(node.left!, features);
  }
  return predictRegressionNode(node.right!, features);
}

function deserializeGradientBoosted(artifact: Record<string, unknown>): TrainedModel {
  const basePrediction = artifact.basePrediction as number;
  const learningRate = artifact.learningRate as number;
  const featureNames = artifact.featureNames as string[];
  const serializedTrees = artifact.trees as unknown[];

  const trees: RegressionNode[] = serializedTrees.map((t) => deserializeRegressionNode(t));

  const predict = (features: number[]): number => {
    let score = basePrediction;
    for (const tree of trees) {
      score += learningRate * predictRegressionNode(tree, features);
    }
    return sigmoid(score);
  };

  const predictBatch = (X: number[][]): number[] => {
    return X.map((row) => predict(row));
  };

  const serialize = (): string => {
    return JSON.stringify(artifact);
  };

  return { algorithm: 'gradient_boosted', predict, predictBatch, serialize, featureNames };
}

// ---------------------------------------------------------------------------
// Public API — unified dispatcher
// ---------------------------------------------------------------------------

export function deserializeModel(jsonStr: string): TrainedModel {
  const artifact = JSON.parse(jsonStr) as Record<string, unknown>;
  const algorithm = artifact.algorithm as string;

  switch (algorithm) {
    case 'log_reg':
      return deserializeLogReg(artifact);

    case 'decision_tree':
    case 'extra_tree':
      return deserializeDecisionTree(artifact);

    case 'random_forest':
      return deserializeEnsemble(artifact);

    case 'extra_trees':
      return deserializeEnsemble(artifact);

    case 'gradient_boosted':
      return deserializeGradientBoosted(artifact);

    default:
      throw new Error(`Cannot deserialize unknown algorithm: ${algorithm}`);
  }
}
