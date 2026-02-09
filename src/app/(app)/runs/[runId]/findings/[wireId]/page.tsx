'use client';

import { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { PageContainer } from '@/components/layout/PageContainer';
import { FadeIn } from '@/components/motion/FadeIn';
import { ScoreBadge } from '@/components/findings/ScoreBadge';
import { ReasonCodeChips } from '@/components/findings/ReasonCodeChips';
import { ShapWaterfall } from '@/components/findings/ShapWaterfall';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, AlertTriangle, ShieldAlert, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDate } from '@/lib/utils/index';

interface ReasonCodeEntry {
  code: string;
  description: string;
  contribution: 'high' | 'medium' | 'low';
}

interface FindingDetail {
  wireId: string;
  rank: number;
  score: number;
  predictedLabel: boolean;
  reasonCodes: ReasonCodeEntry[];
  localExplainBlobUrl: string | null;
}

interface ShapFeature {
  name: string;
  value: number;
}

const contributionLevelBadge: Record<
  ReasonCodeEntry['contribution'],
  { label: string; className: string }
> = {
  high: {
    label: 'High',
    className: 'bg-red-100 text-red-800 border-red-200',
  },
  medium: {
    label: 'Medium',
    className: 'bg-amber-100 text-amber-800 border-amber-200',
  },
  low: {
    label: 'Low',
    className: 'bg-gray-100 text-tint-700 border-gray-200',
  },
};

export default function WireDrilldownPage({
  params,
}: {
  params: Promise<{ runId: string; wireId: string }>;
}) {
  const { runId, wireId } = use(params);

  const [finding, setFinding] = useState<FindingDetail | null>(null);
  const [wireData, setWireData] = useState<Record<string, string> | null>(null);
  const [shapFeatures, setShapFeatures] = useState<ShapFeature[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        const res = await fetch(`/api/runs/${runId}/findings/${wireId}`);
        if (!res.ok) throw new Error('Finding not found');
        const data = await res.json();
        setFinding(data.finding);
        setWireData(data.wireData ?? null);

        // If there's a local explain blob URL, fetch SHAP features
        if (data.finding.localExplainBlobUrl) {
          try {
            const explainRes = await fetch(data.finding.localExplainBlobUrl);
            if (explainRes.ok) {
              const explainData = await explainRes.json();
              // Expect array of {name, value} sorted by |value| desc
              setShapFeatures(Array.isArray(explainData) ? explainData : []);
            }
          } catch {
            // Silently fail -- feature contributions will just not render
          }
        }

        // If no local explain blob, derive approximate features from reason codes
        if (!data.finding.localExplainBlobUrl && data.finding.reasonCodes?.length) {
          const approx: ShapFeature[] = data.finding.reasonCodes.map(
            (rc: ReasonCodeEntry, i: number) => ({
              name: rc.code,
              value:
                rc.contribution === 'high'
                  ? 0.15 - i * 0.01
                  : rc.contribution === 'medium'
                    ? 0.08 - i * 0.005
                    : 0.03 - i * 0.002,
            })
          );
          setShapFeatures(approx);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load finding');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [runId, wireId]);

  if (loading) {
    return (
      <PageContainer>
        <div className="mb-6">
          <Skeleton className="h-8 w-48" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageContainer>
    );
  }

  if (error || !finding) {
    return (
      <PageContainer>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <AlertTriangle className="text-crowe-coral h-8 w-8" />
          <p className="text-muted-foreground text-sm">{error ?? 'Finding not found'}</p>
          <Link href={`/runs/${runId}/findings`}>
            <Button variant="outline">Back to Findings</Button>
          </Link>
        </div>
      </PageContainer>
    );
  }

  const isFlagged = finding.predictedLabel;

  return (
    <PageContainer>
      {/* Back link */}
      <div className="mb-6">
        <Link href={`/runs/${runId}/findings`}>
          <Button variant="ghost" size="sm" className="-ml-2 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Findings
          </Button>
        </Link>
      </div>

      {/* Hero section */}
      <FadeIn>
        <div className="border-border bg-card mb-8 rounded-xl border p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-tint-500 text-xs font-medium tracking-wider uppercase">
                Wire Transfer
              </p>
              <h1 className="text-crowe-indigo-dark mt-1 text-2xl font-bold">{finding.wireId}</h1>
              <p className="text-tint-500 mt-1 text-sm">Rank #{finding.rank}</p>
            </div>

            <div className="flex items-center gap-4">
              {/* Anomaly Score */}
              <div className="text-center">
                <p className="text-tint-500 mb-1 text-xs font-medium">Anomaly Score</p>
                <p
                  className={cn(
                    'text-4xl font-bold tabular-nums',
                    finding.score > 0.7
                      ? 'text-crowe-coral'
                      : finding.score > 0.3
                        ? 'text-crowe-amber-dark'
                        : 'text-emerald-600'
                  )}
                >
                  {finding.score.toFixed(3)}
                </p>
              </div>

              {/* Label chip */}
              <Badge
                className={cn(
                  'h-8 gap-1.5 px-3 text-sm font-medium',
                  isFlagged
                    ? 'border-red-200 bg-red-100 text-red-800'
                    : 'border-emerald-200 bg-emerald-100 text-emerald-800'
                )}
                variant="outline"
              >
                {isFlagged ? (
                  <ShieldAlert className="h-4 w-4" />
                ) : (
                  <ShieldCheck className="h-4 w-4" />
                )}
                {isFlagged ? 'Flagged' : 'Clear'}
              </Badge>
            </div>
          </div>
        </div>
      </FadeIn>

      {/* Transaction Overview */}
      {wireData && (
        <FadeIn delay={100}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Transaction Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {Object.entries(wireData).map(([key, value]) => (
                  <div key={key} className="border-border bg-muted/30 rounded-lg border px-4 py-3">
                    <p className="text-tint-500 text-xs font-medium">{key}</p>
                    <p className="text-crowe-indigo-dark mt-0.5 truncate text-sm font-medium">
                      {value || '--'}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Reason Codes */}
      {finding.reasonCodes && finding.reasonCodes.length > 0 && (
        <FadeIn delay={200}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Reason Codes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {finding.reasonCodes.map((rc) => (
                  <div key={rc.code} className="border-border bg-card rounded-lg border px-4 py-3">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="text-crowe-indigo-dark text-sm font-semibold">
                        {rc.code}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          'px-1.5 py-0.5 text-[10px]',
                          contributionLevelBadge[rc.contribution].className
                        )}
                      >
                        {contributionLevelBadge[rc.contribution].label}
                      </Badge>
                    </div>
                    <p className="text-tint-700 text-xs">{rc.description}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </FadeIn>
      )}

      {/* Feature Contributions (SHAP-style) */}
      {shapFeatures.length > 0 && (
        <FadeIn delay={300}>
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Feature Contributions</CardTitle>
            </CardHeader>
            <CardContent>
              <ShapWaterfall features={shapFeatures} />
            </CardContent>
          </Card>
        </FadeIn>
      )}
    </PageContainer>
  );
}
