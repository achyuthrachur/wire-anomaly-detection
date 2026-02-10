import {
  BookOpen,
  ArrowRight,
  Database,
  Cpu,
  Trophy,
  BarChart3,
  Shield,
  Zap,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

export const metadata = {
  title: 'How It Works | Wire Anomaly Detection',
};

const PIPELINE_STEPS = [
  { icon: Database, label: 'Upload', description: 'Ingest wire-transfer CSV or synthetic dataset' },
  {
    icon: Cpu,
    label: 'Feature Engineering',
    description: 'Z-score normalization, one-hot encoding, temporal & derived features',
  },
  {
    icon: BarChart3,
    label: 'Bake-off',
    description: 'Train 5 algorithms, evaluate with weighted rubric',
  },
  {
    icon: Trophy,
    label: 'Champion',
    description: 'Select best model via constraint checking + composite score',
  },
  {
    icon: Shield,
    label: 'Score',
    description: 'Apply champion to new data using training-time normContext',
  },
  {
    icon: AlertTriangle,
    label: 'Findings',
    description: 'Rank flagged wires with SHAP-based reason codes',
  },
];

const ALGORITHMS = [
  {
    name: 'Logistic Regression',
    key: 'log_reg',
    description:
      'Linear model with L2 regularization. Fast, interpretable, good baseline. Learns a weighted sum of features passed through a sigmoid.',
  },
  {
    name: 'Decision Tree',
    key: 'decision_tree',
    description:
      'Single tree with Gini impurity splits. Highly interpretable but prone to overfitting. Constrained by maxDepth and minSamplesLeaf.',
  },
  {
    name: 'Random Forest',
    key: 'random_forest',
    description:
      'Ensemble of bagged decision trees with random feature subsets. Reduces variance, improves stability. Averages predictions across estimators.',
  },
  {
    name: 'Extra Trees',
    key: 'extra_trees',
    description:
      'Like Random Forest but with fully random splits (not optimized). Trades slight accuracy for much faster training and lower variance.',
  },
  {
    name: 'Gradient Boosted Trees',
    key: 'gradient_boosted',
    description:
      "Sequential ensemble — each tree corrects the previous tree's residuals. Typically highest accuracy, but slower to train and less interpretable.",
  },
];

const METRICS = [
  {
    name: 'PR-AUC',
    fullName: 'Precision-Recall Area Under Curve',
    description:
      'Summarizes the precision-recall tradeoff across all thresholds. Unlike ROC-AUC, PR-AUC is not inflated by the large number of true negatives in imbalanced datasets. Higher is better.',
  },
  {
    name: 'Recall @ RR',
    fullName: 'Recall at Review Rate',
    description:
      'Of all true anomalies, what fraction did the model flag within the top reviewRate% of scores? This is the primary effectiveness metric — a model that misses anomalies is useless regardless of precision.',
  },
  {
    name: 'Precision @ RR',
    fullName: 'Precision at Review Rate',
    description:
      'Of the wires flagged within the review rate, what fraction are actually anomalous? Low precision means investigator time wasted on false positives.',
  },
  {
    name: 'F1',
    fullName: 'F1 Score at Review Rate',
    description:
      'Harmonic mean of precision and recall at the review rate threshold. Balances the two — useful when you care about both false positives and false negatives equally.',
  },
  {
    name: 'Stability',
    fullName: 'Cross-Validation Stability',
    description:
      'Measured via 3-fold cross-validation. A model with high training metrics but low stability is overfitting. Computed as 1 - coefficient_of_variation(fold_PR_AUCs).',
  },
  {
    name: 'Explainability',
    fullName: 'Explainability Score',
    description:
      'Algorithmic bonus: logistic regression and decision trees score higher because their decisions are inherently transparent. Ensemble methods score lower but compensate with SHAP explanations.',
  },
  {
    name: 'Review Rate',
    fullName: 'Target Review Rate',
    description:
      'The percentage of total wires that investigators can realistically review (default: 0.5%). The threshold is set so that approximately this fraction of wires are flagged.',
  },
  {
    name: 'Threshold',
    fullName: 'Decision Threshold',
    description:
      'The anomaly score cutoff above which a wire is flagged. Determined by the review rate: the score at the reviewRate percentile becomes the threshold. Not a fixed 0.5.',
  },
];

export default function MethodologyPage() {
  return (
    <div className="mx-auto max-w-4xl space-y-10 py-8">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="bg-crowe-indigo-dark/10 flex h-10 w-10 items-center justify-center rounded-lg">
            <BookOpen className="text-crowe-indigo-dark h-5 w-5" />
          </div>
          <div>
            <h1 className="text-crowe-indigo-dark text-2xl font-bold">How It Works</h1>
            <p className="text-muted-foreground text-sm">
              Technical methodology behind the Wire Anomaly Detection pipeline
            </p>
          </div>
        </div>
      </div>

      {/* 1. Pipeline Overview */}
      <section className="space-y-4">
        <h2 className="text-crowe-indigo-dark border-crowe-amber/40 border-b pb-2 text-lg font-bold">
          1. Pipeline Overview
        </h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {PIPELINE_STEPS.map((step, i) => (
            <Card key={step.label} className="relative">
              <CardContent className="flex items-start gap-3 pt-4">
                <div className="bg-crowe-indigo-dark/5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md">
                  <step.icon className="text-crowe-indigo h-4 w-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold">
                    <span className="text-crowe-amber-dark mr-1">{i + 1}.</span>
                    {step.label}
                  </p>
                  <p className="text-muted-foreground mt-0.5 text-xs">{step.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 2. Feature Engineering */}
      <section className="space-y-4">
        <h2 className="text-crowe-indigo-dark border-crowe-amber/40 border-b pb-2 text-lg font-bold">
          2. Feature Engineering
        </h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <p>
            Raw CSV columns are transformed into a numeric feature matrix suitable for machine
            learning. The process runs in two modes:
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Training Mode</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground space-y-1 text-xs">
                <p>Computes normalization statistics (mean, std) from the training data.</p>
                <p>Determines top-10 categories for one-hot encoding.</p>
                <p>
                  Saves these as{' '}
                  <code className="bg-muted rounded px-1 font-mono">normContext</code> — the bridge
                  between training and scoring.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Scoring Mode</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground space-y-1 text-xs">
                <p>Reuses the saved normContext to apply identical z-score normalization.</p>
                <p>Uses training-time category mappings (unseen categories get 0).</p>
                <p>
                  Without normContext, scores become binary 0/1 — this is the critical bug this
                  pipeline fixes.
                </p>
              </CardContent>
            </Card>
          </div>

          <h3 className="text-crowe-indigo mt-4 text-sm font-semibold">Feature Types</h3>
          <ul className="text-muted-foreground ml-4 list-disc space-y-1 text-xs">
            <li>
              <strong>Numeric</strong> — z-score normalized: (value - mean) / std
            </li>
            <li>
              <strong>Amount-derived</strong> — additional z-score and log(amount+1) features for
              currency columns
            </li>
            <li>
              <strong>Categorical</strong> — one-hot encoded (top 10 values per column)
            </li>
            <li>
              <strong>Temporal</strong> — extracted from date columns: hourOfDay, dayOfWeek,
              isWeekend, isOutOfHours
            </li>
            <li>
              <strong>Boolean</strong> — mapped to 0/1
            </li>
          </ul>
        </div>
      </section>

      {/* 3. Algorithms */}
      <section className="space-y-4">
        <h2 className="text-crowe-indigo-dark border-crowe-amber/40 border-b pb-2 text-lg font-bold">
          3. Algorithms
        </h2>
        <div className="space-y-2">
          {ALGORITHMS.map((alg) => (
            <Card key={alg.key}>
              <CardContent className="flex items-start gap-3 pt-4">
                <Zap className="text-crowe-amber-dark mt-0.5 h-4 w-4 shrink-0" />
                <div>
                  <p className="text-sm font-semibold">{alg.name}</p>
                  <p className="text-muted-foreground mt-0.5 text-xs">{alg.description}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-muted-foreground text-xs">
          All algorithms are implemented in pure TypeScript — no Python or external ML libraries.
          Training and inference run server-side in Node.js.
        </p>
      </section>

      {/* 4. Metrics Glossary */}
      <section className="space-y-4">
        <h2 className="text-crowe-indigo-dark border-crowe-amber/40 border-b pb-2 text-lg font-bold">
          4. Metrics Glossary
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {METRICS.map((metric) => (
            <Card key={metric.name}>
              <CardContent className="pt-4">
                <p className="text-sm font-semibold">{metric.name}</p>
                <p className="text-muted-foreground text-[11px] italic">{metric.fullName}</p>
                <p className="text-muted-foreground mt-1 text-xs">{metric.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* 5. Bake-off & Rubric */}
      <section className="space-y-4">
        <h2 className="text-crowe-indigo-dark border-crowe-amber/40 border-b pb-2 text-lg font-bold">
          5. Bake-off & Rubric
        </h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <p>
            A bake-off trains all selected candidates on the same feature matrix, then selects a
            champion using a two-phase evaluation:
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Phase 1: Constraint Check</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground space-y-1 text-xs">
                <p>Candidates must meet minimum thresholds:</p>
                <ul className="ml-3 list-disc space-y-0.5">
                  <li>Recall @ Review Rate &ge; 0.65</li>
                  <li>Precision @ Review Rate &ge; 0.08</li>
                </ul>
                <p>Candidates failing constraints are eliminated.</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Phase 2: Weighted Score</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground space-y-1 text-xs">
                <p>Surviving candidates are scored:</p>
                <ul className="ml-3 list-disc space-y-0.5">
                  <li>Recall @ RR: 40%</li>
                  <li>PR-AUC: 25%</li>
                  <li>Precision @ RR: 15%</li>
                  <li>Stability: 10%</li>
                  <li>Explainability: 10%</li>
                </ul>
                <p>Highest composite score wins.</p>
              </CardContent>
            </Card>
          </div>
          <p className="text-muted-foreground text-xs">
            If all candidates fail constraints, the system falls back to the candidate with the
            highest recall, noting that constraints were relaxed.
          </p>
        </div>
      </section>

      {/* 6. SHAP & Explainability */}
      <section className="space-y-4">
        <h2 className="text-crowe-indigo-dark border-crowe-amber/40 border-b pb-2 text-lg font-bold">
          6. SHAP & Explainability
        </h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Local SHAP</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground space-y-1 text-xs">
                <p>
                  Computed per-wire during scoring. Shows how each feature pushed the score up or
                  down relative to the baseline (average prediction).
                </p>
                <p>
                  Uses a path-based TreeSHAP approximation for tree ensembles and direct weight
                  decomposition for logistic regression.
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Global SHAP</CardTitle>
              </CardHeader>
              <CardContent className="text-muted-foreground space-y-1 text-xs">
                <p>
                  Aggregated across all rows: mean absolute SHAP value per feature. Reveals which
                  features the model relies on overall.
                </p>
                <p>Displayed as a ranked bar chart on the scoring results page.</p>
              </CardContent>
            </Card>
          </div>
          <p className="text-muted-foreground text-xs">
            SHAP values power the human-readable <strong>reason codes</strong> attached to each
            finding — e.g., &quot;Amount is 4.2 standard deviations above the mean&quot;.
          </p>
        </div>
      </section>

      {/* 7. Scoring Pipeline */}
      <section className="space-y-4">
        <h2 className="text-crowe-indigo-dark border-crowe-amber/40 border-b pb-2 text-lg font-bold">
          7. Scoring Pipeline
        </h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <p>When you click &quot;Score Dataset&quot;, the following happens:</p>
          <ol className="text-muted-foreground ml-4 list-decimal space-y-1 text-xs">
            <li>
              The champion model artifact (including{' '}
              <code className="bg-muted rounded px-1 font-mono">normContext</code>) is downloaded
              from blob storage.
            </li>
            <li>
              The scoring dataset is parsed and its features are built using the{' '}
              <em>training-time</em> normContext — ensuring identical normalization.
            </li>
            <li>The model produces a score (0-1) for every row.</li>
            <li>
              The threshold is determined from the review rate: the score at the top-N percentile.
            </li>
            <li>Rows scoring above the threshold are flagged as findings.</li>
            <li>Local SHAP + reason codes are generated for each finding.</li>
            <li>A scored CSV (with AnomalyScore and PredictedLabel columns) is produced.</li>
          </ol>
        </div>
      </section>

      {/* 8. Anomaly Detection vs Classification */}
      <section className="space-y-4">
        <h2 className="text-crowe-indigo-dark border-crowe-amber/40 border-b pb-2 text-lg font-bold">
          8. Why PR-AUC, Not Accuracy
        </h2>
        <div className="space-y-3 text-sm leading-relaxed">
          <p>
            Wire fraud is rare — typically 0.1-1% of transactions. In this class-imbalanced setting:
          </p>
          <ul className="text-muted-foreground ml-4 list-disc space-y-1 text-xs">
            <li>
              <strong>Accuracy is misleading</strong> — a model that predicts &quot;normal&quot; for
              every wire achieves 99%+ accuracy but catches zero fraud.
            </li>
            <li>
              <strong>ROC-AUC is inflated</strong> — the massive number of true negatives makes even
              poor models look good on ROC curves.
            </li>
            <li>
              <strong>PR-AUC is honest</strong> — it measures performance only among the positive
              class, which is what we actually care about.
            </li>
          </ul>
          <p className="text-muted-foreground text-xs">
            This is why the bake-off rubric weights Recall @ Review Rate (40%) and PR-AUC (25%) as
            the two heaviest factors — together they represent 65% of the champion selection score.
          </p>
        </div>
      </section>

      {/* Footer */}
      <div className="border-border text-muted-foreground border-t pt-6 text-center text-xs">
        <p>
          All ML algorithms are implemented in pure TypeScript. No external Python dependencies, no
          API calls to third-party services. Training and inference run entirely within the Node.js
          server process.
        </p>
      </div>
    </div>
  );
}
