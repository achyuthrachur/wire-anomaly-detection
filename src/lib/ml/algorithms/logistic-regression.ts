// ---------------------------------------------------------------------------
// Binary Logistic Regression via Gradient Descent (L2 regularization)
// Pure TypeScript — no external ML libraries
// ---------------------------------------------------------------------------

import type { TrainedModel } from '../types';

export interface LogRegParams {
  learningRate?: number; // default 0.01
  epochs?: number; // default 200
  C?: number; // regularization strength, default 1.0
}

/** Sigmoid activation: sigma(z) = 1 / (1 + exp(-z)) */
function sigmoid(z: number): number {
  // Clamp to avoid overflow
  if (z > 500) return 1;
  if (z < -500) return 0;
  return 1 / (1 + Math.exp(-z));
}

/** Dot product of two vectors */
function dot(a: number[], b: number[]): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    sum += a[i] * b[i];
  }
  return sum;
}

export function trainLogisticRegression(
  X: number[][],
  y: number[],
  params: LogRegParams = {},
  featureNames?: string[]
): TrainedModel {
  const learningRate = params.learningRate ?? 0.01;
  const epochs = params.epochs ?? 200;
  const C = params.C ?? 1.0;
  const lambda = 1.0 / C; // L2 regularization coefficient

  const nSamples = X.length;
  const nFeatures = nSamples > 0 ? X[0].length : 0;

  // Initialize weights to zeros
  const weights = new Array(nFeatures).fill(0);
  let bias = 0;

  // Edge case: no data
  if (nSamples === 0) {
    return buildModel(weights, bias, featureNames ?? []);
  }

  // Gradient descent
  for (let epoch = 0; epoch < epochs; epoch++) {
    // Compute predictions for all samples
    const predictions = new Array(nSamples);
    for (let i = 0; i < nSamples; i++) {
      const z = dot(X[i], weights) + bias;
      predictions[i] = sigmoid(z);
    }

    // Compute gradients
    const gradWeights = new Array(nFeatures).fill(0);
    let gradBias = 0;

    for (let i = 0; i < nSamples; i++) {
      const error = predictions[i] - y[i];
      for (let j = 0; j < nFeatures; j++) {
        gradWeights[j] += error * X[i][j];
      }
      gradBias += error;
    }

    // Average gradients and apply L2 regularization
    for (let j = 0; j < nFeatures; j++) {
      gradWeights[j] = gradWeights[j] / nSamples + lambda * weights[j];
    }
    gradBias /= nSamples;

    // Update weights and bias
    for (let j = 0; j < nFeatures; j++) {
      weights[j] -= learningRate * gradWeights[j];
    }
    bias -= learningRate * gradBias;
  }

  return buildModel(weights, bias, featureNames ?? []);
}

function buildModel(weights: number[], bias: number, featureNames: string[]): TrainedModel {
  const predict = (features: number[]): number => {
    const z = dot(features, weights) + bias;
    return sigmoid(z);
  };

  const predictBatch = (X: number[][]): number[] => {
    return X.map((row) => predict(row));
  };

  const serialize = (): string => {
    return JSON.stringify({
      algorithm: 'log_reg',
      weights,
      bias,
      featureNames,
    });
  };

  return {
    algorithm: 'log_reg',
    predict,
    predictBatch,
    serialize,
    featureNames,
  };
}
