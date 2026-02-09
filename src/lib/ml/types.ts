// ---------------------------------------------------------------------------
// ML Engine Types — Pure TypeScript ML pipeline
// ---------------------------------------------------------------------------

export interface FeatureMatrix {
  /** n_samples x n_features matrix */
  X: number[][];
  /** n_samples label vector (0 or 1) */
  y: number[];
  /** ordered feature names matching columns of X */
  featureNames: string[];
  /** name of the original label column */
  labelColumn: string;
}

export interface TrainedModel {
  algorithm: string;
  /** Returns probability [0, 1] for a single sample */
  predict: (features: number[]) => number;
  /** Returns probabilities for a batch of samples */
  predictBatch: (X: number[][]) => number[];
  /** Serializes the model to a JSON string for artifact storage */
  serialize: () => string;
  /** Feature names the model was trained on */
  featureNames: string[];
}

export interface CandidateConfig {
  algorithm: string;
  hyperparams: Record<string, unknown>;
}

export interface CandidateResult {
  algorithm: string;
  hyperparams: Record<string, unknown>;
  model: TrainedModel;
  metrics: MetricsResult;
  importance: Record<string, number>;
  serializedArtifact: string;
}

export interface MetricsResult {
  prAuc: number;
  recallAtReviewRate: number;
  precisionAtReviewRate: number;
  f1: number;
  stability: number;
  explainability: number;
}

export interface BakeoffResult {
  candidates: CandidateResult[];
  recommendedChampionIndex: number;
  narrativeShort: string;
  narrativeLong: string;
}

// ---------------------------------------------------------------------------
// Stage 3: Normalization Context (for scoring with training-time stats)
// ---------------------------------------------------------------------------

export interface NormalizationContext {
  numericStats: Record<string, { mean: number; std: number }>;
  categoricalMappings: Record<string, string[]>;
}

export interface FeatureMatrixWithNorm extends FeatureMatrix {
  normContext: NormalizationContext;
}

// ---------------------------------------------------------------------------
// Stage 3: SHAP types
// ---------------------------------------------------------------------------

export interface ShapValues {
  values: number[];
  baseValue: number;
  featureNames: string[];
}

export interface GlobalShapSummary {
  meanAbsShap: Record<string, number>;
  topFeatures: Array<{ feature: string; meanAbsShap: number }>;
}
