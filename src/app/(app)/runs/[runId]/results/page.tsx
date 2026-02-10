'use client';

import { useEffect, useState, useMemo, use } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/layout/PageContainer';
import { FadeIn } from '@/components/motion/FadeIn';
import { ScoreBadge } from '@/components/findings/ScoreBadge';
import { ReasonCodeChips } from '@/components/findings/ReasonCodeChips';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatNumber } from '@/lib/utils/index';
import {
  ArrowLeft,
  BarChart3,
  Target,
  ShieldAlert,
  TrendingUp,
  Activity,
  Layers,
  Eye,
  CheckCircle2,
  XCircle,
  Download,
  Printer,
} from 'lucide-react';

/* ─────────────────────────────────────────────────────────────────
   Types
   ───────────────────────────────────────────────────────────────── */

interface ReasonCodeEntry {
  code: string;
  description: string;
  contribution: 'high' | 'medium' | 'low';
}

interface FindingRow {
  wireId: string;
  rank: number;
  score: number;
  predictedLabel: boolean;
  reasonCodes: ReasonCodeEntry[];
}

interface ShapFeature {
  feature: string;
  meanAbsShap: number;
}

interface ScoringsSummary {
  reviewRate?: number;
  thresholdUsed?: number;
  flaggedCount?: number;
  rowCount?: number;
  metricsIfLabelsPresent?: {
    precision: number;
    recall: number;
    f1: number;
  } | null;
  globalShapTopFeatures?: ShapFeature[];
}

interface RunData {
  id: string;
  dataset_id: string;
  status: string;
  summary_json: ScoringsSummary;
  model_version_id?: string;
  outputs_blob_url?: string | null;
}

/* ─────────────────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────────────────── */

function getStatusVariant(status: string): 'default' | 'secondary' | 'outline' | 'destructive' {
  switch (status) {
    case 'scored':
    case 'completed':
      return 'default';
    case 'running':
    case 'scoring':
      return 'secondary';
    case 'failed':
      return 'destructive';
    default:
      return 'outline';
  }
}

function getMetricColor(value: number): string {
  if (value > 0.5) return 'text-emerald-700';
  if (value > 0.2) return 'text-crowe-amber-dark';
  return 'text-crowe-coral';
}

function getMetricBgColor(value: number): string {
  if (value > 0.5) return 'bg-emerald-50 border-emerald-200';
  if (value > 0.2) return 'bg-amber-50 border-amber-200';
  return 'bg-red-50 border-red-200';
}

/** Build 10-bucket histogram from scores */
function buildScoreDistribution(scores: number[]): number[] {
  const buckets = new Array(10).fill(0);
  for (const s of scores) {
    const idx = Math.min(Math.floor(s * 10), 9);
    buckets[idx]++;
  }
  return buckets;
}

/* ─────────────────────────────────────────────────────────────────
   Page Component
   ───────────────────────────────────────────────────────────────── */

export default function ResultsPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = use(params);

  const [run, setRun] = useState<RunData | null>(null);
  const [allFindings, setAllFindings] = useState<FindingRow[]>([]);
  const [topFindings, setTopFindings] = useState<FindingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch run data
  useEffect(() => {
    async function fetchRun() {
      try {
        const res = await fetch(`/api/runs/${runId}`);
        if (!res.ok) throw new Error('Run not found');
        const data = await res.json();
        setRun(data.run);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load run');
      }
    }
    fetchRun();
  }, [runId]);

  // Fetch findings for distribution chart (up to 500) and top 10 preview
  useEffect(() => {
    async function fetchFindings() {
      try {
        const res = await fetch(`/api/runs/${runId}/findings?offset=0&limit=500`);
        if (!res.ok) throw new Error('Failed to load findings');
        const data = await res.json();
        const findings: FindingRow[] = data.findings ?? [];
        setAllFindings(findings);
        setTopFindings(findings.slice(0, 10));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load findings');
      } finally {
        setLoading(false);
      }
    }
    fetchFindings();
  }, [runId]);

  const summary = run?.summary_json ?? {};
  const hasLabels = !!summary.metricsIfLabelsPresent;
  const metrics = summary.metricsIfLabelsPresent;
  const shapFeatures = (summary.globalShapTopFeatures ?? []).slice(0, 10);
  const maxShap = shapFeatures.length > 0 ? Math.max(...shapFeatures.map((f) => f.meanAbsShap)) : 1;

  // Compute score distribution
  const scores = useMemo(() => allFindings.map((f) => f.score), [allFindings]);
  const distribution = useMemo(() => buildScoreDistribution(scores), [scores]);
  const maxBucket = Math.max(...distribution, 1);

  // Compute confusion matrix (if labels present)
  const confusionMatrix = useMemo(() => {
    if (!metrics || !summary.flaggedCount || !summary.rowCount) return null;
    const flagged = summary.flaggedCount;
    const total = summary.rowCount;
    const tp = Math.round(metrics.precision * flagged);
    const fp = flagged - tp;
    const fn = metrics.recall > 0 ? Math.round(tp / metrics.recall - tp) : 0;
    const tn = total - tp - fp - fn;
    return { tp, fp, fn, tn };
  }, [metrics, summary.flaggedCount, summary.rowCount]);

  // Threshold bucket index for the chart marker
  const thresholdBucketIdx = summary.thresholdUsed
    ? Math.min(Math.floor(summary.thresholdUsed * 10), 9)
    : -1;

  /* ───────────────── Loading State ───────────────── */

  if (loading) {
    return (
      <PageContainer>
        <div className="mb-6">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-12 w-96" />
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </PageContainer>
    );
  }

  /* ───────────────── Error State ───────────────── */

  if (error) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <ShieldAlert className="text-crowe-coral h-8 w-8" />
          <p className="text-muted-foreground text-sm">{error}</p>
          <Link href={`/runs/${runId}`}>
            <Button variant="outline">Back to Run</Button>
          </Link>
        </div>
      </PageContainer>
    );
  }

  /* ───────────────── Main Render ───────────────── */

  return (
    <PageContainer>
      {/* Back link */}
      <div className="mb-6">
        <Link href={`/runs/${runId}`}>
          <Button variant="ghost" size="sm" className="-ml-2 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Run
          </Button>
        </Link>
      </div>

      {/* ═══════════ Section 1: Header ═══════════ */}
      <FadeIn>
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-crowe-indigo-dark text-2xl font-bold">
                Model Performance Report
              </h1>
              {run && (
                <Badge variant={getStatusVariant(run.status)} className="capitalize">
                  {run.status}
                </Badge>
              )}
            </div>
            <p className="text-tint-500 mt-1 text-sm">
              Run <span className="font-mono text-xs">{runId}</span>
              {run?.model_version_id && (
                <>
                  {' '}
                  &middot; Model <span className="font-mono text-xs">{run.model_version_id}</span>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {run?.outputs_blob_url && (
              <a href={run.outputs_blob_url} download>
                <Button variant="outline" className="gap-2">
                  <Download className="h-4 w-4" />
                  Download Scored CSV
                </Button>
              </a>
            )}
            <Button variant="outline" className="gap-2" onClick={() => window.print()}>
              <Printer className="h-4 w-4" />
              Print Report
            </Button>
            <Link href={`/runs/${runId}/findings`}>
              <Button variant="outline" className="gap-2">
                <Eye className="h-4 w-4" />
                View All Findings
              </Button>
            </Link>
          </div>
        </div>
      </FadeIn>

      {/* ═══════════ Section 2: Summary Metrics Cards ═══════════ */}
      <FadeIn delay={100}>
        <div className="mb-8">
          <h2 className="text-crowe-indigo-dark mb-4 flex items-center gap-2 text-lg font-semibold">
            <Activity className="h-5 w-5" />
            Summary Metrics
          </h2>
          <div
            className={cn(
              'grid gap-4',
              hasLabels ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-2 sm:grid-cols-4'
            )}
          >
            {/* Total Rows Scored */}
            <Card className="border-border">
              <CardContent className="p-4">
                <p className="text-tint-500 text-xs font-medium">Total Rows Scored</p>
                <p className="text-crowe-indigo-dark mt-1 text-2xl font-semibold tabular-nums">
                  {summary.rowCount != null ? formatNumber(summary.rowCount, 0) : '--'}
                </p>
              </CardContent>
            </Card>

            {/* Flagged Count */}
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-tint-500 text-xs font-medium">Flagged Count</p>
                    <p className="text-crowe-indigo-dark mt-1 text-2xl font-semibold tabular-nums">
                      {summary.flaggedCount != null ? formatNumber(summary.flaggedCount, 0) : '--'}
                    </p>
                  </div>
                  <ShieldAlert className="text-crowe-coral/60 h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            {/* Review Rate */}
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-tint-500 text-xs font-medium">Review Rate</p>
                    <p className="text-crowe-indigo-dark mt-1 text-2xl font-semibold tabular-nums">
                      {summary.reviewRate != null
                        ? `${(summary.reviewRate * 100).toFixed(2)}%`
                        : '--'}
                    </p>
                  </div>
                  <Target className="text-crowe-amber/60 h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            {/* Threshold Used */}
            <Card className="border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-tint-500 text-xs font-medium">Threshold Used</p>
                    <p className="text-crowe-indigo-dark mt-1 text-2xl font-semibold tabular-nums">
                      {summary.thresholdUsed != null ? summary.thresholdUsed.toFixed(4) : '--'}
                    </p>
                  </div>
                  <Layers className="text-crowe-indigo/40 h-5 w-5" />
                </div>
              </CardContent>
            </Card>

            {/* Precision (if labels present) */}
            {hasLabels && metrics && (
              <Card className={cn('border', getMetricBgColor(metrics.precision))}>
                <CardContent className="p-4">
                  <p className="text-tint-500 text-xs font-medium">Precision</p>
                  <p
                    className={cn(
                      'mt-1 text-2xl font-semibold tabular-nums',
                      getMetricColor(metrics.precision)
                    )}
                  >
                    {(metrics.precision * 100).toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
            )}

            {/* Recall (if labels present) */}
            {hasLabels && metrics && (
              <Card className={cn('border', getMetricBgColor(metrics.recall))}>
                <CardContent className="p-4">
                  <p className="text-tint-500 text-xs font-medium">Recall</p>
                  <p
                    className={cn(
                      'mt-1 text-2xl font-semibold tabular-nums',
                      getMetricColor(metrics.recall)
                    )}
                  >
                    {(metrics.recall * 100).toFixed(1)}%
                  </p>
                </CardContent>
              </Card>
            )}

            {/* F1 Score (if labels present) */}
            {hasLabels && metrics && (
              <Card className={cn('border', getMetricBgColor(metrics.f1))}>
                <CardContent className="p-4">
                  <p className="text-tint-500 text-xs font-medium">F1 Score</p>
                  <p
                    className={cn(
                      'mt-1 text-2xl font-semibold tabular-nums',
                      getMetricColor(metrics.f1)
                    )}
                  >
                    {metrics.f1.toFixed(3)}
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </FadeIn>

      {/* ═══════════ Section 3: Score Distribution Chart ═══════════ */}
      <FadeIn delay={200}>
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-crowe-indigo-dark flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5" />
              Score Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {allFindings.length === 0 ? (
              <p className="text-tint-500 py-8 text-center text-sm">
                No scored findings to display.
              </p>
            ) : (
              <div className="relative">
                {/* Y-axis label */}
                <div className="text-tint-500 mb-2 text-xs font-medium">Count</div>

                {/* Chart area */}
                <div className="relative flex items-end gap-1.5" style={{ height: 200 }}>
                  {distribution.map((count, idx) => {
                    const heightPct = maxBucket > 0 ? (count / maxBucket) * 100 : 0;
                    const isAboveThreshold =
                      summary.thresholdUsed != null && idx >= thresholdBucketIdx;

                    return (
                      <div
                        key={idx}
                        className="group relative flex flex-1 flex-col items-center justify-end"
                        style={{ height: '100%' }}
                      >
                        {/* Tooltip on hover */}
                        <div className="bg-crowe-indigo-dark pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 rounded px-2 py-0.5 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                          {count}
                        </div>

                        {/* Bar */}
                        <div
                          className={cn(
                            'w-full rounded-t transition-all duration-500',
                            isAboveThreshold
                              ? 'bg-crowe-coral hover:bg-crowe-coral-dark'
                              : 'bg-crowe-indigo/20 hover:bg-crowe-indigo/35'
                          )}
                          style={{
                            height: `${heightPct}%`,
                            minHeight: count > 0 ? 4 : 0,
                          }}
                        />
                      </div>
                    );
                  })}

                  {/* Threshold dashed line */}
                  {summary.thresholdUsed != null && thresholdBucketIdx >= 0 && (
                    <div
                      className="border-crowe-coral pointer-events-none absolute top-0 bottom-0 z-10 border-l-2 border-dashed"
                      style={{
                        left: `${(thresholdBucketIdx / 10) * 100}%`,
                      }}
                    >
                      <span className="text-crowe-coral absolute -top-5 left-1 text-[10px] font-semibold whitespace-nowrap">
                        Threshold ({summary.thresholdUsed.toFixed(2)})
                      </span>
                    </div>
                  )}
                </div>

                {/* X-axis labels */}
                <div className="mt-2 flex gap-1.5">
                  {distribution.map((_, idx) => (
                    <div key={idx} className="flex-1 text-center">
                      <span className="text-tint-500 text-[10px]">{(idx / 10).toFixed(1)}</span>
                    </div>
                  ))}
                </div>
                <div className="text-tint-500 mt-1 text-center text-xs font-medium">
                  Anomaly Score Range
                </div>

                {/* Legend */}
                <div className="mt-3 flex items-center justify-center gap-6 text-xs">
                  <div className="flex items-center gap-1.5">
                    <div className="bg-crowe-indigo/20 h-3 w-3 rounded-sm" />
                    <span className="text-tint-500">Below threshold</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="bg-crowe-coral h-3 w-3 rounded-sm" />
                    <span className="text-tint-500">Above threshold (flagged)</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* ═══════════ Section 4: Global Feature Importance ═══════════ */}
      {shapFeatures.length > 0 && (
        <FadeIn delay={300}>
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-crowe-indigo-dark flex items-center gap-2 text-lg">
                <TrendingUp className="h-5 w-5" />
                Global Feature Importance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {shapFeatures.map((feat, idx) => {
                  const widthPct = maxShap > 0 ? (feat.meanAbsShap / maxShap) * 100 : 0;
                  return (
                    <div key={feat.feature} className="flex items-center gap-3">
                      <span className="text-tint-700 w-48 shrink-0 truncate text-right text-sm font-medium">
                        {feat.feature}
                      </span>
                      <div className="relative h-6 flex-1 overflow-hidden rounded bg-gray-100">
                        <div
                          className="bg-crowe-indigo absolute inset-y-0 left-0 rounded transition-all duration-700"
                          style={{
                            width: `${widthPct}%`,
                            transitionDelay: `${idx * 60}ms`,
                          }}
                        />
                      </div>
                      <span className="text-tint-500 w-16 shrink-0 text-right font-mono text-xs tabular-nums">
                        {feat.meanAbsShap.toFixed(4)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* ═══════════ Section 5: Top Flagged Wires Preview ═══════════ */}
      <FadeIn delay={400}>
        <Card className="mb-8">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-crowe-indigo-dark flex items-center gap-2 text-lg">
              <ShieldAlert className="h-5 w-5" />
              Top Flagged Wires
            </CardTitle>
            <Link href={`/runs/${runId}/findings`}>
              <Button variant="outline" size="sm" className="gap-2">
                <Eye className="h-4 w-4" />
                View All Findings
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {topFindings.length === 0 ? (
              <p className="text-tint-500 py-8 text-center text-sm">
                No flagged wires found for this run.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="w-16">Rank</TableHead>
                    <TableHead>Wire ID</TableHead>
                    <TableHead className="w-48">Score</TableHead>
                    <TableHead>Reason Codes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topFindings.map((finding) => (
                    <TableRow key={finding.wireId} className="group">
                      <TableCell className="text-tint-500 font-mono text-xs">
                        #{finding.rank}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/runs/${runId}/findings/${finding.wireId}`}
                          className="text-crowe-indigo hover:text-crowe-amber-dark font-medium underline-offset-2 transition-colors hover:underline"
                        >
                          {finding.wireId}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <ScoreBadge score={finding.score} />
                      </TableCell>
                      <TableCell>
                        <ReasonCodeChips codes={finding.reasonCodes ?? []} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </FadeIn>

      {/* ═══════════ Section 6: Confusion Matrix ═══════════ */}
      {hasLabels && confusionMatrix && (
        <FadeIn delay={500}>
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-crowe-indigo-dark flex items-center gap-2 text-lg">
                <Target className="h-5 w-5" />
                Confusion Matrix
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center">
                {/* Axis labels */}
                <div className="text-tint-500 mb-2 text-xs font-semibold tracking-wider uppercase">
                  Predicted
                </div>

                <div className="flex items-center gap-4">
                  {/* Y-axis label */}
                  <div className="flex items-center">
                    <span
                      className="text-tint-500 text-xs font-semibold tracking-wider uppercase"
                      style={{
                        writingMode: 'vertical-lr',
                        transform: 'rotate(180deg)',
                      }}
                    >
                      Actual
                    </span>
                  </div>

                  {/* 2x2 Grid */}
                  <div className="grid grid-cols-2 gap-2">
                    {/* Column headers */}
                    <div className="text-tint-500 pb-1 text-center text-xs font-medium">
                      Positive
                    </div>
                    <div className="text-tint-500 pb-1 text-center text-xs font-medium">
                      Negative
                    </div>

                    {/* TP - True Positive */}
                    <div className="flex flex-col items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50 p-5">
                      <CheckCircle2 className="mb-1 h-5 w-5 text-emerald-600" />
                      <span className="text-[10px] font-medium tracking-wider text-emerald-700 uppercase">
                        True Positive
                      </span>
                      <span className="mt-1 text-2xl font-bold text-emerald-800 tabular-nums">
                        {formatNumber(confusionMatrix.tp, 0)}
                      </span>
                    </div>

                    {/* FP - False Positive */}
                    <div className="flex flex-col items-center justify-center rounded-lg border border-red-200 bg-red-50 p-5">
                      <XCircle className="mb-1 h-5 w-5 text-red-500" />
                      <span className="text-[10px] font-medium tracking-wider text-red-700 uppercase">
                        False Positive
                      </span>
                      <span className="mt-1 text-2xl font-bold text-red-800 tabular-nums">
                        {formatNumber(confusionMatrix.fp, 0)}
                      </span>
                    </div>

                    {/* FN - False Negative */}
                    <div className="flex flex-col items-center justify-center rounded-lg border border-amber-200 bg-amber-50 p-5">
                      <XCircle className="mb-1 h-5 w-5 text-amber-500" />
                      <span className="text-[10px] font-medium tracking-wider text-amber-700 uppercase">
                        False Negative
                      </span>
                      <span className="mt-1 text-2xl font-bold text-amber-800 tabular-nums">
                        {formatNumber(confusionMatrix.fn, 0)}
                      </span>
                    </div>

                    {/* TN - True Negative */}
                    <div className="flex flex-col items-center justify-center rounded-lg border border-gray-200 bg-gray-50 p-5">
                      <CheckCircle2 className="mb-1 h-5 w-5 text-gray-500" />
                      <span className="text-[10px] font-medium tracking-wider text-gray-600 uppercase">
                        True Negative
                      </span>
                      <span className="mt-1 text-2xl font-bold text-gray-700 tabular-nums">
                        {formatNumber(confusionMatrix.tn, 0)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Matrix legend */}
                <div className="mt-4 text-center">
                  <p className="text-tint-500 text-xs">
                    Derived from precision ({metrics?.precision.toFixed(3)}), recall (
                    {metrics?.recall.toFixed(3)}), flagged count (
                    {formatNumber(summary.flaggedCount ?? 0, 0)}), and total rows (
                    {formatNumber(summary.rowCount ?? 0, 0)})
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}
    </PageContainer>
  );
}
