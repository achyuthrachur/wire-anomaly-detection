'use client';

import type {
  RunWithDataset,
  ValidationResult,
  ProfilingResult,
  InferredSchema,
  ScoringsSummary,
} from '@/lib/db/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SummaryTab } from './SummaryTab';
import { ValidationPanel } from '@/components/validation/ValidationPanel';
import { ProfilingCards } from '@/components/profiling/ProfilingCards';
import { RawJsonTab } from './RawJsonTab';
import { ExportButton } from './ExportButton';
import { StatusChip } from '@/components/tables/StatusChip';
import { formatDate } from '@/lib/utils/index';
import Link from 'next/link';
import { Download, ExternalLink } from 'lucide-react';

interface RunDetailProps {
  run: RunWithDataset & { blob_url: string; schema_json: InferredSchema };
}

export function RunDetail({ run }: RunDetailProps) {
  const rawValidation = run.validation_json as ValidationResult | null;
  const rawProfiling = run.profiling_json as ProfilingResult | null;
  // DB default is '{}' (empty object) — treat as null if missing required fields
  const validation = rawValidation?.requiredColumns ? rawValidation : null;
  const profiling = rawProfiling?.rowCount != null ? rawProfiling : null;
  const summary = (run.summary_json ?? null) as ScoringsSummary | null;

  const defaultTab = run.status === 'scored' ? 'scoring-results' : 'summary';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-foreground text-2xl font-semibold">{run.dataset_name}</h1>
          <div className="mt-2 flex items-center gap-3">
            <StatusChip status={run.status} />
            <span className="text-muted-foreground text-sm">{formatDate(run.created_at)}</span>
            <span className="text-muted-foreground text-sm">
              {run.row_count.toLocaleString()} rows
            </span>
          </div>
        </div>
        <ExportButton
          validation={validation}
          profiling={profiling}
          summary={summary}
          datasetName={run.dataset_name}
        />
      </div>

      {/* Tabs */}
      <Tabs defaultValue={defaultTab}>
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          {run.status === 'scored' && (
            <TabsTrigger value="scoring-results">Scoring Results</TabsTrigger>
          )}
          <TabsTrigger value="validation">Validation</TabsTrigger>
          <TabsTrigger value="profiling">Profiling</TabsTrigger>
          <TabsTrigger value="json">Raw JSON</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-6">
          <SummaryTab run={run} />
        </TabsContent>

        {run.status === 'scored' && (
          <TabsContent value="scoring-results" className="mt-6">
            <ScoringResultsPanel run={run} summary={summary} />
          </TabsContent>
        )}

        <TabsContent value="validation" className="mt-6">
          {run.status !== 'created' && validation ? (
            <ValidationPanel validation={validation} />
          ) : (
            <p className="text-muted-foreground text-sm">Validation has not been run yet.</p>
          )}
        </TabsContent>

        <TabsContent value="profiling" className="mt-6">
          {run.status === 'validated' && profiling ? (
            <ProfilingCards profiling={profiling} />
          ) : (
            <p className="text-muted-foreground text-sm">Profiling data not available.</p>
          )}
        </TabsContent>

        <TabsContent value="json" className="mt-6">
          <RawJsonTab validation={validation} profiling={profiling} summary={summary} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Scoring Results panel (inline sub-component)                      */
/* ------------------------------------------------------------------ */

function ScoringResultsPanel({
  run,
  summary,
}: {
  run: RunWithDataset;
  summary: ScoringsSummary | null;
}) {
  if (!summary) {
    return <p className="text-muted-foreground text-sm">Scoring summary is not available yet.</p>;
  }

  const metrics = summary.metricsIfLabelsPresent;

  const kpis: Array<{ label: string; value: string }> = [];

  if (summary.flaggedCount != null) {
    kpis.push({
      label: 'Flagged Count',
      value: summary.flaggedCount.toLocaleString(),
    });
  }
  if (summary.rowCount != null) {
    kpis.push({
      label: 'Total Rows',
      value: summary.rowCount.toLocaleString(),
    });
  }
  if (summary.reviewRate != null) {
    kpis.push({
      label: 'Review Rate',
      value: `${(summary.reviewRate * 100).toFixed(2)}%`,
    });
  }
  if (summary.thresholdUsed != null) {
    kpis.push({
      label: 'Threshold',
      value: summary.thresholdUsed.toFixed(4),
    });
  }
  if (metrics) {
    kpis.push({ label: 'Precision', value: metrics.precision.toFixed(3) });
    kpis.push({ label: 'Recall', value: metrics.recall.toFixed(3) });
    kpis.push({ label: 'F1 Score', value: metrics.f1.toFixed(3) });
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="border-border bg-card rounded-lg border p-4 shadow-sm">
            <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
              {kpi.label}
            </p>
            <p className="text-foreground mt-1 text-xl font-semibold">{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Links */}
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href={`/runs/${run.id}/findings`}
          className="inline-flex items-center gap-2 rounded-md bg-[var(--crowe-indigo-dark,#011E41)] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[var(--crowe-indigo-core,#002E62)]"
        >
          <ExternalLink className="h-4 w-4" />
          View Findings
        </Link>
        {run.outputs_blob_url && (
          <a
            href={run.outputs_blob_url}
            download
            className="border-border bg-card text-foreground hover:bg-muted inline-flex items-center gap-2 rounded-md border px-4 py-2 text-sm font-medium transition-colors"
          >
            <Download className="h-4 w-4" />
            Download Scored CSV
          </a>
        )}
      </div>
    </div>
  );
}
