// ---------------------------------------------------------------------------
// Scoring Pipeline — score a dataset with a trained model
// Pure TypeScript
// ---------------------------------------------------------------------------

import type { TrainedModel, NormalizationContext, ShapValues } from './types';
import type { ScoringsSummary, ReasonCodeEntry } from '@/lib/db/types';
import { buildFeatureMatrix } from './features';
import { deserializeModel } from './deserialize';
import { downloadDatasetFile } from '@/lib/blob/client';
import { parseFile } from '@/lib/schema/parsers';
import { getDatasetById, getModelVersionById } from '@/lib/db/queries';
import { computeLocalShap, computeGlobalShap } from './shap';
import { generateReasonCodes } from './explainability';
import Papa from 'papaparse';

export interface ScoringResult {
  scoredCsvBuffer: Buffer;
  findings: Array<{
    wire_id: string;
    rank: number;
    score: number;
    predicted_label: boolean;
    reason_codes_json: ReasonCodeEntry[];
    local_explain_blob_url: string | null;
  }>;
  summary: ScoringsSummary;
  globalShapTopFeatures: Array<{ feature: string; meanAbsShap: number }>;
}

export async function runScoringPipeline(
  datasetId: string,
  modelVersionId: string,
  reviewRate: number,
  threshold?: number | null,
  topN: number = 200
): Promise<ScoringResult> {
  // ---- 1. Load dataset and model ----
  const dataset = await getDatasetById(datasetId);
  if (!dataset) throw new Error(`Dataset not found: ${datasetId}`);

  const modelVersion = await getModelVersionById(modelVersionId);
  if (!modelVersion) throw new Error(`Model version not found: ${modelVersionId}`);

  // Download files
  const [datasetBuffer, modelArtifactBuffer] = await Promise.all([
    downloadDatasetFile(dataset.blob_url),
    downloadDatasetFile(modelVersion.artifact_blob_url),
  ]);

  // ---- 2. Deserialize model ----
  const artifactJson = Buffer.from(modelArtifactBuffer).toString('utf-8');
  const model = deserializeModel(artifactJson);

  // ---- 3. Parse dataset ----
  const parsed = parseFile(Buffer.from(datasetBuffer), dataset.source_format);
  if (parsed.rows.length === 0) {
    throw new Error('Dataset has no rows');
  }

  // ---- 4. Load NormalizationContext from artifact ----
  const artifactObj = JSON.parse(artifactJson) as Record<string, unknown>;
  const normContext = (artifactObj.normContext as NormalizationContext | undefined) ?? undefined;

  // ---- 5. Build feature matrix (scoring mode) ----
  // Find the label column (if present)
  const labelColumn = findLabelColumn(parsed.headers);
  const schema = dataset.schema_json;
  const featureResult = buildFeatureMatrix(parsed.rows, schema, labelColumn, normContext);
  const scoringFeatureNames = featureResult.featureNames;

  if (featureResult.X.length === 0 || scoringFeatureNames.length === 0) {
    throw new Error('Feature matrix is empty — check dataset columns');
  }

  // ---- 5b. Align scoring features to training feature order ----
  // The model uses feature indices from training. If the scoring dataset has
  // a different schema (e.g. column type differences), the feature columns
  // may be in a different order or have different names. We must reindex
  // scoring features to match the training feature names stored in the artifact.
  const trainingFeatureNames =
    (artifactObj.featureNames as string[] | undefined) ?? scoringFeatureNames;
  let X: number[][];
  let featureNames: string[];

  if (
    trainingFeatureNames.length === scoringFeatureNames.length &&
    trainingFeatureNames.every((n, i) => n === scoringFeatureNames[i])
  ) {
    // Features already aligned — no reindexing needed
    X = featureResult.X;
    featureNames = scoringFeatureNames;
  } else {
    // Build lookup: scoring feature name → index
    const scoringIdx = new Map<string, number>();
    scoringFeatureNames.forEach((name, i) => scoringIdx.set(name, i));

    // For each training feature, find corresponding scoring column (or fill with 0)
    const nSamples = featureResult.X.length;
    featureNames = trainingFeatureNames;
    X = new Array(nSamples);

    for (let i = 0; i < nSamples; i++) {
      X[i] = new Array(trainingFeatureNames.length);
      for (let j = 0; j < trainingFeatureNames.length; j++) {
        const srcIdx = scoringIdx.get(trainingFeatureNames[j]);
        X[i][j] = srcIdx !== undefined ? featureResult.X[i][srcIdx] : 0;
      }
    }
  }

  // ---- 6. Predict scores for all rows ----
  const scores = model.predictBatch(X);

  // ---- 7. Determine threshold ----
  let effectiveThreshold: number;
  if (threshold !== undefined && threshold !== null) {
    effectiveThreshold = threshold;
  } else {
    // Quantile-based threshold: top (reviewRate * N) rows
    const sortedScores = [...scores].sort((a, b) => b - a);
    const cutoffIdx = Math.max(0, Math.floor(reviewRate * scores.length) - 1);
    effectiveThreshold = sortedScores[cutoffIdx] ?? 0.5;
  }

  // ---- 8. Generate scored CSV ----
  const scoredRows = parsed.rows.map((row, i) => ({
    ...row,
    AnomalyScore: scores[i].toFixed(6),
    PredictedLabel: scores[i] >= effectiveThreshold ? '1' : '0',
  }));

  const scoredCsv = Papa.unparse(scoredRows);
  const scoredCsvBuffer = Buffer.from(scoredCsv, 'utf-8');

  // ---- 9. Identify flagged rows and generate findings ----
  // Rank all rows by score descending
  const indexed = scores.map((s, i) => ({ score: s, index: i }));
  indexed.sort((a, b) => b.score - a.score);

  const flaggedIndices = indexed.filter((item) => item.score >= effectiveThreshold);
  const flaggedCount = flaggedIndices.length;

  // Compute feature means for SHAP
  const featureMeans = new Array(featureNames.length).fill(0);
  for (let i = 0; i < X.length; i++) {
    for (let f = 0; f < featureNames.length && f < X[i].length; f++) {
      featureMeans[f] += X[i][f];
    }
  }
  for (let f = 0; f < featureMeans.length; f++) {
    featureMeans[f] /= X.length || 1;
  }

  // Compute importance from model version metadata
  const importance = (modelVersion.global_importance_json ?? {}) as Record<string, number>;

  // Generate findings for top-N
  const findingsCount = Math.min(topN, flaggedIndices.length);
  const findings: ScoringResult['findings'] = [];

  for (let rank = 0; rank < findingsCount; rank++) {
    const { score, index } = flaggedIndices[rank];
    const row = parsed.rows[index];
    const wireId = row['WireID'] ?? row['wire_id'] ?? row['wireId'] ?? `row-${index}`;

    // Compute local SHAP for this row
    let shapValues: ShapValues | undefined;
    try {
      shapValues = computeLocalShap(model, artifactJson, X[index], featureNames, featureMeans);
    } catch {
      // SHAP computation failed, proceed without it
    }

    // Generate reason codes (with SHAP if available)
    const reasonCodes = generateReasonCodes(X[index], featureNames, importance, shapValues);

    findings.push({
      wire_id: wireId,
      rank: rank + 1,
      score,
      predicted_label: score >= effectiveThreshold,
      reason_codes_json: reasonCodes,
      local_explain_blob_url: null,
    });
  }

  // ---- 10. Compute metrics if labels present ----
  let metricsIfLabelsPresent: ScoringsSummary['metricsIfLabelsPresent'] = null;

  if (dataset.label_present && labelColumn) {
    const trueLabels = parsed.rows.map((row) => {
      const v = String(row[labelColumn] ?? '')
        .trim()
        .toLowerCase();
      return v === '1' || v === 'true' || v === 'yes' ? 1 : 0;
    });

    const predictedLabels = scores.map((s) => (s >= effectiveThreshold ? 1 : 0));

    let tp = 0,
      fp = 0,
      fn = 0;
    for (let i = 0; i < trueLabels.length; i++) {
      if (predictedLabels[i] === 1 && trueLabels[i] === 1) tp++;
      if (predictedLabels[i] === 1 && trueLabels[i] === 0) fp++;
      if (predictedLabels[i] === 0 && trueLabels[i] === 1) fn++;
    }

    const precision = tp + fp > 0 ? tp / (tp + fp) : 0;
    const recall = tp + fn > 0 ? tp / (tp + fn) : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;

    metricsIfLabelsPresent = {
      precision: Math.round(precision * 10000) / 10000,
      recall: Math.round(recall * 10000) / 10000,
      f1: Math.round(f1 * 10000) / 10000,
    };
  }

  // ---- 11. Compute global SHAP ----
  let globalShapTopFeatures: Array<{ feature: string; meanAbsShap: number }> = [];
  try {
    const globalShap = computeGlobalShap(model, artifactJson, X, featureNames, 10000);
    globalShapTopFeatures = globalShap.topFeatures.slice(0, 15);
  } catch {
    // Global SHAP failed, proceed without it
  }

  const summary: ScoringsSummary = {
    reviewRate,
    thresholdUsed: Math.round(effectiveThreshold * 10000) / 10000,
    flaggedCount,
    rowCount: parsed.rows.length,
    metricsIfLabelsPresent,
    globalShapTopFeatures,
  };

  return {
    scoredCsvBuffer,
    findings,
    summary,
    globalShapTopFeatures,
  };
}

/**
 * Find the label column name from headers (case-insensitive search).
 */
function findLabelColumn(headers: string[]): string {
  const candidates = ['IsAnomaly', 'isanomaly', 'is_anomaly', 'Label', 'label', 'target'];
  for (const candidate of candidates) {
    const match = headers.find((h) => h.toLowerCase() === candidate.toLowerCase());
    if (match) return match;
  }
  // Fallback to first column that looks like a label
  const labelish = headers.find((h) => /^(is_?anomal|label|target|fraud|flag)/i.test(h));
  return labelish ?? 'IsAnomaly';
}
