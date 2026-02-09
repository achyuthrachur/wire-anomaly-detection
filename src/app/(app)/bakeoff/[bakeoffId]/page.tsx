'use client';

import { useEffect, useState, useCallback, useRef, use } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/layout/PageContainer';
import { FadeIn } from '@/components/motion/FadeIn';
import { BakeoffProgress } from '@/components/bakeoff/BakeoffProgress';
import { ChampionRevealCard } from '@/components/bakeoff/ChampionRevealCard';
import { CandidateComparisonTable } from '@/components/bakeoff/CandidateComparisonTable';
import { NarrativePanel } from '@/components/bakeoff/NarrativePanel';
import { DetailSkeleton } from '@/components/skeletons/DetailSkeleton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, AlertTriangle, FlaskConical, Database, Clock, XCircle } from 'lucide-react';
import type { BakeoffWithCandidates, BakeoffStatus } from '@/lib/db/types';
import { formatDate } from '@/lib/utils/index';

const FAST_POLL_MS = 1500;
const SLOW_POLL_MS = 5000;
const BACKOFF_THRESHOLD_MS = 30_000;

function isPollingStatus(status: BakeoffStatus): boolean {
  return status === 'queued' || status === 'running';
}

export default function BakeoffDetailPage({ params }: { params: Promise<{ bakeoffId: string }> }) {
  const { bakeoffId } = use(params);
  const [bakeoff, setBakeoff] = useState<BakeoffWithCandidates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingChampion, setSettingChampion] = useState(false);
  const pollStartRef = useRef<number>(Date.now());

  const fetchBakeoff = useCallback(
    async (retryCount = 0) => {
      try {
        const res = await fetch(`/api/bakeoff/${bakeoffId}`);
        if (!res.ok) {
          if (res.status === 404 && retryCount < 2) {
            setTimeout(() => fetchBakeoff(retryCount + 1), 1500);
            return;
          }
          if (res.status === 404) throw new Error('Bake-off not found');
          throw new Error('Failed to fetch bake-off');
        }
        const data: BakeoffWithCandidates = await res.json();
        setBakeoff(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load bake-off');
      } finally {
        setLoading(false);
      }
    },
    [bakeoffId]
  );

  // Initial fetch
  useEffect(() => {
    fetchBakeoff();
    pollStartRef.current = Date.now();
  }, [fetchBakeoff]);

  // Polling while queued/running
  useEffect(() => {
    if (!bakeoff || !isPollingStatus(bakeoff.status)) return;

    const elapsed = Date.now() - pollStartRef.current;
    const interval = elapsed > BACKOFF_THRESHOLD_MS ? SLOW_POLL_MS : FAST_POLL_MS;

    const timer = setTimeout(() => {
      fetchBakeoff();
    }, interval);

    return () => clearTimeout(timer);
  }, [bakeoff, fetchBakeoff]);

  async function handleSetChampion(versionId: string) {
    if (!bakeoff) return;
    setSettingChampion(true);
    try {
      const res = await fetch(`/api/bakeoff/${bakeoffId}/select-champion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelVersionId: versionId }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to set champion');
      }
      // Refetch to get updated state
      await fetchBakeoff();
    } catch (err) {
      console.error('Failed to set champion:', err);
    } finally {
      setSettingChampion(false);
    }
  }

  // Determine champion candidate
  const championCandidate = bakeoff?.candidates.find((c) => c.id === bakeoff.champion_version_id);

  return (
    <PageContainer>
      {/* Back button */}
      <div className="mb-6">
        <Link href="/models">
          <Button variant="ghost" size="sm" className="-ml-2 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Models
          </Button>
        </Link>
      </div>

      {/* Loading */}
      {loading && <DetailSkeleton />}

      {/* Error state */}
      {error && !loading && (
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

      {/* Main content */}
      {!loading && !error && bakeoff && (
        <div className="space-y-8">
          {/* Header */}
          <FadeIn>
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <FlaskConical className="text-crowe-indigo h-6 w-6 shrink-0" />
                <h1 className="text-foreground text-2xl font-semibold">Bake-off Results</h1>
                <StatusBadge status={bakeoff.status} />
              </div>
              <div className="text-muted-foreground flex flex-wrap items-center gap-3 text-sm">
                <span className="flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5" />
                  {bakeoff.dataset_name}
                </span>
                <span className="text-tint-300">|</span>
                <span>Model: {bakeoff.model_name}</span>
                <span className="text-tint-300">|</span>
                <span className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  {formatDate(bakeoff.created_at)}
                </span>
                {bakeoff.rubric_json?.weights && (
                  <>
                    <span className="text-tint-300">|</span>
                    <span>
                      Review Rate:{' '}
                      {(
                        (bakeoff.rubric_json.constraints?.minRecallAtReviewRate ?? 0.65) * 100
                      ).toFixed(1)}
                      % min recall
                    </span>
                  </>
                )}
              </div>
            </div>
          </FadeIn>

          {/* Queued / Running State */}
          {isPollingStatus(bakeoff.status) && (
            <FadeIn delay={100}>
              <Card>
                <CardContent className="py-8">
                  <div className="mx-auto max-w-xl space-y-6">
                    <div className="text-center">
                      <h2 className="text-foreground text-lg font-semibold">
                        Training in progress...
                      </h2>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {bakeoff.candidates.length > 0
                          ? `${bakeoff.candidates.length} candidates training`
                          : 'Preparing the training pipeline'}
                      </p>
                    </div>
                    <BakeoffProgress status={bakeoff.status} />
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          )}

          {/* Failed State */}
          {bakeoff.status === 'failed' && (
            <FadeIn delay={100}>
              <Card className="border-crowe-coral/30">
                <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                  <div className="bg-crowe-coral/10 flex h-12 w-12 items-center justify-center rounded-full">
                    <XCircle className="text-crowe-coral h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-foreground font-semibold">Bake-off Failed</h2>
                    <p className="text-muted-foreground mt-1 max-w-md text-sm">
                      {bakeoff.error_json?.message
                        ? String(bakeoff.error_json.message)
                        : 'An unexpected error occurred during training. Please try again with different parameters.'}
                    </p>
                  </div>
                  <Link href="/datasets">
                    <Button variant="outline">Back to Datasets</Button>
                  </Link>
                </CardContent>
              </Card>
            </FadeIn>
          )}

          {/* Completed State */}
          {bakeoff.status === 'completed' && (
            <>
              {/* Champion Reveal */}
              {championCandidate && (
                <FadeIn delay={100}>
                  <ChampionRevealCard
                    champion={championCandidate}
                    narrativeShort={bakeoff.narrative_short ?? ''}
                    narrativeLong={bakeoff.narrative_long ?? ''}
                    onSetChampion={() => handleSetChampion(championCandidate.id)}
                    isSettingChampion={settingChampion}
                    alreadyChampion={championCandidate.is_champion}
                  />
                </FadeIn>
              )}

              {/* Candidate Comparison Table */}
              {bakeoff.candidates.length > 0 && (
                <FadeIn delay={200}>
                  <div className="space-y-3">
                    <h2 className="text-foreground text-lg font-semibold">Candidate Comparison</h2>
                    <CandidateComparisonTable
                      candidates={bakeoff.candidates}
                      championVersionId={bakeoff.champion_version_id}
                    />
                  </div>
                </FadeIn>
              )}

              {/* Narrative */}
              {bakeoff.narrative_short && (
                <FadeIn delay={300}>
                  <div className="space-y-3">
                    <h2 className="text-foreground text-lg font-semibold">Analysis Summary</h2>
                    <NarrativePanel
                      narrativeShort={bakeoff.narrative_short}
                      narrativeLong={bakeoff.narrative_long ?? ''}
                    />
                  </div>
                </FadeIn>
              )}
            </>
          )}
        </div>
      )}
    </PageContainer>
  );
}

// ---------------------------------------------------------------------------
// Helper: StatusBadge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: BakeoffStatus }) {
  const config: Record<BakeoffStatus, { label: string; className: string }> = {
    queued: {
      label: 'Queued',
      className: 'bg-crowe-cyan/10 text-crowe-cyan-dark border-crowe-cyan/20',
    },
    running: {
      label: 'Running',
      className: 'bg-crowe-blue/10 text-crowe-blue-dark border-crowe-blue/20',
    },
    completed: {
      label: 'Completed',
      className: 'bg-crowe-teal/10 text-crowe-teal-dark border-crowe-teal/20',
    },
    failed: {
      label: 'Failed',
      className: 'bg-crowe-coral/10 text-crowe-coral-dark border-crowe-coral/20',
    },
  };

  const { label, className } = config[status];

  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  );
}
