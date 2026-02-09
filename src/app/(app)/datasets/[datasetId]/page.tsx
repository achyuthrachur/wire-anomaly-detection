'use client';

import { useEffect, useState, useCallback, use } from 'react';
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
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import type { Dataset, Run } from '@/lib/db/types';
import { formatDate, formatNumber } from '@/lib/utils/index';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  AlertTriangle,
  FileSpreadsheet,
  Tag,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Crown,
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { StartBakeoffDialog } from '@/components/bakeoff/StartBakeoffDialog';

type BakeoffStatus = 'queued' | 'running' | 'completed' | 'failed';

export default function DatasetDetailPage({ params }: { params: Promise<{ datasetId: string }> }) {
  const { datasetId } = use(params);
  const router = useRouter();
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [latestRun, setLatestRun] = useState<Run | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scoringLoading, setScoringLoading] = useState(false);
  const [models, setModels] = useState<
    Array<{ id: string; name: string; champion_version_id: string | null }>
  >([]);

  // Bake-off progress tracking
  const [activeBakeoffId, setActiveBakeoffId] = useState<string | null>(null);
  const [bakeoffStatus, setBakeoffStatus] = useState<BakeoffStatus | null>(null);
  const [bakeoffChampion, setBakeoffChampion] = useState<string | null>(null);

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

  // Fetch models for scoring action
  useEffect(() => {
    async function fetchModels() {
      try {
        const res = await fetch('/api/models/list');
        if (res.ok) {
          const data = await res.json();
          setModels(data.models ?? []);
        }
      } catch {
        // Non-critical
      }
    }
    fetchModels();
  }, []);

  // Poll bake-off status when one is active
  const pollBakeoff = useCallback(async () => {
    if (!activeBakeoffId) return;
    try {
      const res = await fetch(`/api/bakeoff/${activeBakeoffId}`);
      if (!res.ok) return;
      const data = await res.json();
      setBakeoffStatus(data.status);
      if (data.status === 'completed') {
        setBakeoffChampion(data.champion_version_id);
        // Refresh models list so "Score with Champion" button appears
        const modelsRes = await fetch('/api/models/list');
        if (modelsRes.ok) {
          const modelsData = await modelsRes.json();
          setModels(modelsData.models ?? []);
        }
      }
    } catch {
      // Non-critical
    }
  }, [activeBakeoffId]);

  useEffect(() => {
    if (!activeBakeoffId) return;
    if (bakeoffStatus === 'completed' || bakeoffStatus === 'failed') return;

    pollBakeoff();
    const interval = setInterval(pollBakeoff, 2500);
    return () => clearInterval(interval);
  }, [activeBakeoffId, bakeoffStatus, pollBakeoff]);

  const handleBakeoffStarted = (bakeoffId: string) => {
    setActiveBakeoffId(bakeoffId);
    setBakeoffStatus('queued');
    setBakeoffChampion(null);
  };

  const handleStartScoring = async () => {
    if (!dataset) return;
    const modelWithChampion = models.find((m) => m.champion_version_id);
    if (!modelWithChampion) return;

    setScoringLoading(true);
    try {
      const res = await fetch('/api/score/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetId: dataset.id,
          modelId: modelWithChampion.id,
          reviewRate: 0.005,
        }),
      });
      if (!res.ok) throw new Error('Failed to start scoring');
      const data = await res.json();
      router.push(`/runs/${data.runId}/findings`);
    } catch {
      setScoringLoading(false);
    }
  };

  const hasChampion = models.some((m) => m.champion_version_id);

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
                {/* Action buttons */}
                <div className="flex shrink-0 gap-2">
                  {/* Bake-off button for training datasets with labels */}
                  {dataset.dataset_role === 'training' && !activeBakeoffId && (
                    <StartBakeoffDialog
                      datasetId={dataset.id}
                      datasetName={dataset.name}
                      labelPresent={dataset.label_present}
                      onStarted={handleBakeoffStarted}
                    />
                  )}
                  {/* Score button for scoring datasets when champion exists */}
                  {dataset.dataset_role === 'scoring' && hasChampion && (
                    <Button
                      onClick={handleStartScoring}
                      disabled={scoringLoading}
                      className="bg-crowe-indigo-dark hover:bg-crowe-indigo gap-2 text-white"
                    >
                      <Play className="h-4 w-4" />
                      {scoringLoading ? 'Starting...' : 'Score with Champion'}
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Bake-off Progress Banner */}
            {activeBakeoffId && bakeoffStatus && (
              <FadeIn>
                <Card
                  className={cn(
                    'border-l-4',
                    bakeoffStatus === 'completed'
                      ? 'border-l-crowe-teal'
                      : bakeoffStatus === 'failed'
                        ? 'border-l-crowe-coral'
                        : 'border-l-crowe-indigo'
                  )}
                >
                  <CardContent className="py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        {(bakeoffStatus === 'queued' || bakeoffStatus === 'running') && (
                          <Loader2 className="text-crowe-indigo h-5 w-5 animate-spin" />
                        )}
                        {bakeoffStatus === 'completed' && (
                          <CheckCircle2 className="text-crowe-teal h-5 w-5" />
                        )}
                        {bakeoffStatus === 'failed' && (
                          <XCircle className="text-crowe-coral h-5 w-5" />
                        )}
                        <div>
                          <p className="text-foreground text-sm font-medium">
                            {bakeoffStatus === 'queued' && 'Bake-off queued — waiting to start...'}
                            {bakeoffStatus === 'running' &&
                              'Bake-off running — training all algorithms...'}
                            {bakeoffStatus === 'completed' &&
                              'Bake-off complete — champion selected!'}
                            {bakeoffStatus === 'failed' && 'Bake-off failed'}
                          </p>
                          {(bakeoffStatus === 'queued' || bakeoffStatus === 'running') && (
                            <p className="text-muted-foreground mt-0.5 text-xs">
                              This may take a minute for large datasets. You can leave this page.
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {bakeoffStatus === 'completed' && (
                          <>
                            <Link href={`/bakeoff/${activeBakeoffId}`}>
                              <Button variant="outline" size="sm" className="gap-1.5">
                                <Crown className="h-3.5 w-3.5" />
                                View Results
                              </Button>
                            </Link>
                            <Link href={`/models`}>
                              <Button variant="outline" size="sm" className="gap-1.5">
                                <ExternalLink className="h-3.5 w-3.5" />
                                Models
                              </Button>
                            </Link>
                          </>
                        )}
                        {(bakeoffStatus === 'queued' || bakeoffStatus === 'running') && (
                          <Link href={`/bakeoff/${activeBakeoffId}`}>
                            <Button variant="outline" size="sm" className="gap-1.5">
                              <ExternalLink className="h-3.5 w-3.5" />
                              Full Details
                            </Button>
                          </Link>
                        )}
                      </div>
                    </div>
                    {(bakeoffStatus === 'queued' || bakeoffStatus === 'running') && (
                      <Progress
                        value={bakeoffStatus === 'queued' ? 15 : 55}
                        className="mt-3 h-1.5"
                      />
                    )}
                  </CardContent>
                </Card>
              </FadeIn>
            )}

            {/* Tabs */}
            <Tabs defaultValue="preview" className="space-y-4">
              <TabsList>
                <TabsTrigger value="preview">Preview</TabsTrigger>
                <TabsTrigger value="schema">Schema</TabsTrigger>
                <TabsTrigger value="validation" disabled={!latestRun?.validation_json}>
                  Validation
                </TabsTrigger>
                <TabsTrigger value="profiling" disabled={!latestRun?.profiling_json}>
                  Profiling
                </TabsTrigger>
              </TabsList>

              <TabsContent value="preview">
                <DatasetPreviewTable datasetId={dataset.id} totalRows={dataset.row_count} />
              </TabsContent>

              <TabsContent value="schema">
                {dataset.schema_json && <SchemaTab schema={dataset.schema_json} />}
              </TabsContent>

              <TabsContent value="validation">
                {latestRun?.validation_json && (
                  <ValidationPanel validation={latestRun.validation_json} />
                )}
              </TabsContent>

              <TabsContent value="profiling">
                {latestRun?.profiling_json && (
                  <ProfilingCards profiling={latestRun.profiling_json} />
                )}
              </TabsContent>
            </Tabs>
          </div>
        </FadeIn>
      )}
    </PageContainer>
  );
}
