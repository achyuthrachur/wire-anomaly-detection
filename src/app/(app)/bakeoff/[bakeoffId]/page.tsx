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
import {
  ArrowLeft,
  AlertTriangle,
  FlaskConical,
  Database,
  Clock,
  XCircle,
  RotateCcw,
} from 'lucide-react';
import type {
  BakeoffWithCandidates,
  BakeoffStatus,
  BakeoffProgress as BakeoffProgressType,
} from '@/lib/db/types';
import { formatDate } from '@/lib/utils/index';

export default function BakeoffDetailPage({ params }: { params: Promise<{ bakeoffId: string }> }) {
  const { bakeoffId } = use(params);
  const [bakeoff, setBakeoff] = useState<BakeoffWithCandidates | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [settingChampion, setSettingChampion] = useState(false);

  // Orchestration state
  const [candidatesDone, setCandidatesDone] = useState(0);
  const [candidateCount, setCandidateCount] = useState(0);
  const [currentAlgorithm, setCurrentAlgorithm] = useState<string | undefined>(undefined);
  const [orchestrating, setOrchestrating] = useState(false);
  const [orchestrationError, setOrchestrationError] = useState<string | null>(null);
  const abortRef = useRef(false);

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
        return data;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load bake-off');
        return null;
      } finally {
        setLoading(false);
      }
    },
    [bakeoffId]
  );

  // Run the orchestration loop: train remaining candidates, then finalize
  const runOrchestration = useCallback(
    async (bakeoffData: BakeoffWithCandidates) => {
      const progress = (bakeoffData.error_json as { progress?: BakeoffProgressType } | null)
        ?.progress;
      if (!progress) return;

      const { candidateConfigs } = progress;
      const totalCandidates = candidateConfigs.length;
      let done = bakeoffData.candidate_version_ids.length;

      setCandidateCount(totalCandidates);
      setCandidatesDone(done);
      setOrchestrating(true);
      setOrchestrationError(null);

      // Train remaining candidates
      while (done < totalCandidates) {
        if (abortRef.current) return;

        const config = candidateConfigs[done];
        setCurrentAlgorithm(config.algorithm);

        try {
          const res = await fetch(`/api/bakeoff/${bakeoffData.id}/train-candidate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ candidateIndex: done }),
          });

          if (!res.ok) {
            const data = await res.json();
            // 409 with candidatesDone means we're out of sync — resync
            if (res.status === 409 && data.candidatesDone !== undefined) {
              done = data.candidatesDone;
              setCandidatesDone(done);
              continue;
            }
            throw new Error(data.error || 'Failed to train candidate');
          }

          const result = await res.json();
          done = result.candidatesDone;
          setCandidatesDone(done);
        } catch (err) {
          setOrchestrationError(err instanceof Error ? err.message : 'Training failed');
          setOrchestrating(false);
          return;
        }
      }

      if (abortRef.current) return;

      // Finalize
      setCurrentAlgorithm(undefined);
      try {
        const res = await fetch(`/api/bakeoff/${bakeoffData.id}/finalize`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error || 'Failed to finalize bake-off');
        }

        // Refetch to get final state
        await fetchBakeoff();
      } catch (err) {
        setOrchestrationError(err instanceof Error ? err.message : 'Finalization failed');
      } finally {
        setOrchestrating(false);
      }
    },
    [bakeoffId, fetchBakeoff]
  );

  // Initial fetch + start orchestration if needed
  useEffect(() => {
    abortRef.current = false;

    async function init() {
      const data = await fetchBakeoff();
      if (!data) return;

      // If bakeoff is running and has progress, start/resume orchestration
      if (data.status === 'running' && data.error_json) {
        const progress = (data.error_json as { progress?: BakeoffProgressType })?.progress;
        if (progress) {
          runOrchestration(data);
        }
      }
    }

    init();

    return () => {
      abortRef.current = true;
    };
  }, [fetchBakeoff, runOrchestration]);

  async function handleRetry() {
    setOrchestrationError(null);
    const data = await fetchBakeoff();
    if (data && data.status === 'running') {
      runOrchestration(data);
    }
  }

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
      await fetchBakeoff();
    } catch (err) {
      console.error('Failed to set champion:', err);
    } finally {
      setSettingChampion(false);
    }
  }

  // Determine champion candidate
  const championCandidate = bakeoff?.candidates.find((c) => c.id === bakeoff.champion_version_id);

  // Determine effective status for display
  const displayStatus: BakeoffStatus =
    orchestrating || (bakeoff?.status === 'running' && !orchestrationError)
      ? 'running'
      : (bakeoff?.status ?? 'queued');

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
                <StatusBadge status={displayStatus} />
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

          {/* Running / Orchestrating State */}
          {displayStatus === 'running' && !orchestrationError && (
            <FadeIn delay={100}>
              <Card>
                <CardContent className="py-8">
                  <div className="mx-auto max-w-xl space-y-6">
                    <div className="text-center">
                      <h2 className="text-foreground text-lg font-semibold">
                        Training in progress...
                      </h2>
                      <p className="text-muted-foreground mt-1 text-sm">
                        {candidateCount > 0
                          ? `${candidatesDone} of ${candidateCount} algorithms trained`
                          : 'Preparing the training pipeline'}
                      </p>
                    </div>
                    <BakeoffProgress
                      status="running"
                      candidatesDone={candidatesDone}
                      candidateCount={candidateCount}
                      currentAlgorithm={currentAlgorithm}
                    />
                  </div>
                </CardContent>
              </Card>
            </FadeIn>
          )}

          {/* Orchestration Error State */}
          {orchestrationError && bakeoff.status === 'running' && (
            <FadeIn delay={100}>
              <Card className="border-crowe-coral/30">
                <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
                  <div className="bg-crowe-coral/10 flex h-12 w-12 items-center justify-center rounded-full">
                    <XCircle className="text-crowe-coral h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-foreground font-semibold">Training Error</h2>
                    <p className="text-muted-foreground mt-1 max-w-md text-sm">
                      {orchestrationError}
                    </p>
                    {candidatesDone > 0 && (
                      <p className="text-muted-foreground mt-1 text-xs">
                        {candidatesDone}/{candidateCount} candidates completed — progress is saved.
                      </p>
                    )}
                  </div>
                  <Button onClick={handleRetry} variant="outline" className="gap-2">
                    <RotateCcw className="h-4 w-4" />
                    Retry
                  </Button>
                </CardContent>
              </Card>
            </FadeIn>
          )}

          {/* Failed State (from DB) */}
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
                  <Link href={`/models/${bakeoff.model_id}`}>
                    <Button variant="outline">Back to Model</Button>
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

              {/* Model Registry link */}
              <FadeIn delay={400}>
                <div className="flex justify-center pt-4">
                  <Link href={`/models/${bakeoff.model_id}`}>
                    <Button className="bg-crowe-indigo-dark hover:bg-crowe-indigo gap-2 text-white">
                      View in Model Registry
                    </Button>
                  </Link>
                </div>
              </FadeIn>
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
