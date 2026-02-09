'use client';

import type { RunWithDataset, ValidationResult, ProfilingResult, InferredSchema } from '@/lib/db/types';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SummaryTab } from './SummaryTab';
import { ValidationPanel } from '@/components/validation/ValidationPanel';
import { ProfilingCards } from '@/components/profiling/ProfilingCards';
import { RawJsonTab } from './RawJsonTab';
import { ExportButton } from './ExportButton';
import { StatusChip } from '@/components/tables/StatusChip';
import { formatDate } from '@/lib/utils/index';

interface RunDetailProps {
  run: RunWithDataset & { blob_url: string; schema_json: InferredSchema };
}

export function RunDetail({ run }: RunDetailProps) {
  const validation = run.validation_json as ValidationResult;
  const profiling = run.profiling_json as ProfilingResult;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">{run.dataset_name}</h1>
          <div className="mt-2 flex items-center gap-3">
            <StatusChip status={run.status} />
            <span className="text-sm text-muted-foreground">{formatDate(run.created_at)}</span>
            <span className="text-sm text-muted-foreground">
              {run.row_count.toLocaleString()} rows
            </span>
          </div>
        </div>
        <ExportButton validation={validation} profiling={profiling} datasetName={run.dataset_name} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="summary">
        <TabsList>
          <TabsTrigger value="summary">Summary</TabsTrigger>
          <TabsTrigger value="validation">Validation</TabsTrigger>
          <TabsTrigger value="profiling">Profiling</TabsTrigger>
          <TabsTrigger value="json">Raw JSON</TabsTrigger>
        </TabsList>

        <TabsContent value="summary" className="mt-6">
          <SummaryTab run={run} />
        </TabsContent>

        <TabsContent value="validation" className="mt-6">
          {run.status !== 'created' ? (
            <ValidationPanel validation={validation} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Validation has not been run yet.
            </p>
          )}
        </TabsContent>

        <TabsContent value="profiling" className="mt-6">
          {run.status === 'validated' ? (
            <ProfilingCards profiling={profiling} />
          ) : (
            <p className="text-sm text-muted-foreground">
              Profiling data not available.
            </p>
          )}
        </TabsContent>

        <TabsContent value="json" className="mt-6">
          <RawJsonTab validation={validation} profiling={profiling} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
