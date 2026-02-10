'use client';

import { useEffect, useState, useCallback, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/components/layout/PageContainer';
import { FadeIn } from '@/components/motion/FadeIn';
import { StaggerChildren } from '@/components/motion/StaggerChildren';
import { VersionCard } from '@/components/models/VersionCard';
import { StartBakeoffDialog } from '@/components/bakeoff/StartBakeoffDialog';
import { ScoreDataDialog } from '@/components/models/ScoreDataDialog';
import { DetailSkeleton } from '@/components/skeletons/DetailSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricsBar } from '@/components/models/MetricsBar';
import { ArrowLeft, AlertTriangle, Crown, Layers } from 'lucide-react';
import type { Model, ModelVersion } from '@/lib/db/types';
import { formatDate } from '@/lib/utils/index';

export default function ModelDetailPage({ params }: { params: Promise<{ modelId: string }> }) {
  const { modelId } = use(params);
  const router = useRouter();
  const [model, setModel] = useState<Model | null>(null);
  const [versions, setVersions] = useState<ModelVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingChampion, setSettingChampion] = useState(false);

  const fetchModel = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/models/${modelId}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('Model not found');
        throw new Error('Failed to fetch model');
      }
      const data = await res.json();
      setModel(data.model);
      setVersions(data.versions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load model');
    } finally {
      setLoading(false);
    }
  }, [modelId]);

  useEffect(() => {
    fetchModel();
  }, [fetchModel]);

  async function handleSetChampion(versionId: string) {
    setSettingChampion(true);
    try {
      const res = await fetch(`/api/models/${modelId}/set-champion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelVersionId: versionId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to set champion');
      }
      await fetchModel();
    } catch (err) {
      console.error('Failed to set champion:', err);
    } finally {
      setSettingChampion(false);
    }
  }

  function handleBakeoffStarted(bakeoffId: string) {
    router.push(`/bakeoff/${bakeoffId}`);
  }

  const champion = versions.find((v) => v.is_champion);

  return (
    <PageContainer>
      <div className="mb-6">
        <Link href="/models">
          <Button variant="ghost" size="sm" className="-ml-2 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Models
          </Button>
        </Link>
      </div>

      {loading && <DetailSkeleton />}

      {error && (
        <FadeIn>
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <AlertTriangle className="text-crowe-coral h-8 w-8" />
            <p className="text-muted-foreground text-sm">{error}</p>
            <Link href="/models">
              <Button variant="outline">Back to Models</Button>
            </Link>
          </div>
        </FadeIn>
      )}

      {!loading && !error && model && (
        <div className="space-y-8">
          {/* Header */}
          <FadeIn>
            <div>
              <h1 className="text-foreground text-2xl font-semibold">{model.name}</h1>
              {model.description && (
                <p className="text-muted-foreground mt-1 text-sm">{model.description}</p>
              )}
              <p className="text-muted-foreground mt-2 text-xs">
                Created {formatDate(model.created_at)}
              </p>
            </div>
          </FadeIn>

          {/* Champion Highlight */}
          {champion && (
            <FadeIn delay={100}>
              <Card className="border-crowe-amber/40 bg-crowe-amber/5">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Crown className="text-crowe-amber-dark h-5 w-5" />
                    <CardTitle className="text-base">Current Champion</CardTitle>
                    <Badge className="bg-crowe-amber text-crowe-indigo-dark border-crowe-amber gap-1 capitalize">
                      {champion.algorithm}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <MetricsBar label="PR-AUC" value={champion.metrics_json.prAuc} />
                    <MetricsBar
                      label="Recall @ RR"
                      value={champion.metrics_json.recallAtReviewRate}
                      color="#05AB8C"
                    />
                    <MetricsBar
                      label="Precision @ RR"
                      value={champion.metrics_json.precisionAtReviewRate}
                      color="#0075C9"
                    />
                    <MetricsBar label="F1 Score" value={champion.metrics_json.f1} color="#B14FC5" />
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          )}

          {/* Versions */}
          <FadeIn delay={200}>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Layers className="text-muted-foreground h-5 w-5" />
                  <h2 className="text-foreground text-lg font-semibold">Versions</h2>
                  <Badge variant="outline" className="ml-1">
                    {versions.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <StartBakeoffDialog
                    modelId={modelId}
                    modelName={model.name}
                    onStarted={handleBakeoffStarted}
                  />
                  {champion && (
                    <ScoreDataDialog
                      modelId={modelId}
                      modelName={model.name}
                      championVersionId={champion.id}
                    />
                  )}
                </div>
              </div>

              {versions.length === 0 ? (
                <div className="flex flex-col items-center gap-4 py-12 text-center">
                  <Layers className="text-tint-300 h-10 w-10" />
                  <div>
                    <p className="text-foreground font-medium">No versions yet</p>
                    <p className="text-muted-foreground mt-1 text-sm">
                      Run a bake-off to create model versions.
                    </p>
                  </div>
                </div>
              ) : (
                <StaggerChildren className="grid gap-4 sm:grid-cols-2">
                  {versions.map((version) => (
                    <VersionCard
                      key={version.id}
                      version={version}
                      onSetChampion={settingChampion ? undefined : handleSetChampion}
                    />
                  ))}
                </StaggerChildren>
              )}
            </div>
          </FadeIn>
        </div>
      )}
    </PageContainer>
  );
}
