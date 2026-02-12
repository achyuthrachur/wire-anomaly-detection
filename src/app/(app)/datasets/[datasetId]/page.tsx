'use client';

import { useEffect, useState, use } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { FadeIn } from '@/components/motion/FadeIn';
import { DetailSkeleton } from '@/components/skeletons/DetailSkeleton';
import { DatasetRoleChip } from '@/components/datasets/DatasetRoleChip';
import { DatasetPreviewTable } from '@/components/datasets/DatasetPreviewTable';
import { SchemaTab } from '@/components/datasets/SchemaTab';
import { ValidationPanel } from '@/components/validation/ValidationPanel';
import { ProfilingCards } from '@/components/profiling/ProfilingCards';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Dataset, Run } from '@/lib/db/types';
import { formatDate, formatNumber } from '@/lib/utils/index';
import { ArrowLeft, AlertTriangle, FileSpreadsheet, Tag } from 'lucide-react';
import Link from 'next/link';

export default function DatasetDetailPage({ params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = use(params);
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [latestRun, setLatestRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchDataset() {
      try {
        const res = await fetch(`/api/datasets/${datasetId}`);
        if (!res.ok) throw new Error('Dataset not found');
        const data = await res.json();
        setDataset(data.dataset);
        setLatestRun(data.latestRun);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load dataset');
      } finally {
        setLoading(false);
      }
    }
    fetchDataset();
  }, [datasetId]);

  return (
    <PageContainer>
      {/* Back button */}
      <div className="mb-6">
        <Link href="/datasets">
          <Button variant="ghost" size="sm" className="-ml-2 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Datasets
          </Button>
        </Link>
      </div>

      {/* Loading */}
      {loading && <DetailSkeleton />}

      {/* Error */}
      {error && (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <AlertTriangle className="text-crowe-coral h-8 w-8" />
          <p className="text-muted-foreground text-sm">{error}</p>
          <Link href="/datasets">
            <Button variant="outline">Back to Datasets</Button>
          </Link>
        </div>
      )}

      {/* Content */}
      {!loading && !error && dataset && (
        <FadeIn>
          <div className="space-y-6">
            {/* Header */}
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="text-crowe-indigo h-6 w-6 shrink-0" />
                    <h1 className="text-foreground text-2xl font-semibold break-all">
                      {dataset.name}
                    </h1>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <DatasetRoleChip role={dataset.dataset_role} />
                    <Badge variant="outline" className="text-[10px]">
                      {dataset.source_format.toUpperCase()}
                    </Badge>
                    <span className="text-muted-foreground text-sm">
                      {formatNumber(dataset.row_count, 0)} rows
                    </span>
                    <span className="text-tint-300">|</span>
                    <span className="text-muted-foreground text-sm">
                      {formatDate(dataset.created_at)}
                    </span>
                    {dataset.label_present && (
                      <>
                        <span className="text-tint-300">|</span>
                        <Badge
                          variant="outline"
                          className="bg-crowe-teal/10 text-crowe-teal-dark border-crowe-teal/20 gap-1 text-[10px] font-medium"
                        >
                          <Tag className="h-3 w-3" />
                          Labels Available
                        </Badge>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="preview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="schema">Schema</TabsTrigger>
                {latestRun?.validation_json?.requiredColumns && (
                  <TabsTrigger value="validation">Validation</TabsTrigger>
                )}
                {latestRun?.profiling_json?.rowCount != null && (
                  <TabsTrigger value="profiling">Profiling</TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="preview">
                <DatasetPreviewTable datasetId={dataset.id} totalRows={dataset.row_count} />
              </TabsContent>

              <TabsContent value="schema">
                {dataset.schema_json && <SchemaTab schema={dataset.schema_json} />}
              </TabsContent>

              {latestRun?.validation_json?.requiredColumns && (
                <TabsContent value="validation">
                  <ValidationPanel validation={latestRun.validation_json} />
                </TabsContent>
              )}

              {latestRun?.profiling_json?.rowCount != null && (
                <TabsContent value="profiling">
                  <ProfilingCards profiling={latestRun.profiling_json} />
                </TabsContent>
              )}
            </Tabs>
          </div>
        </FadeIn>
      )}
    </PageContainer>
  );
}
