'use client';

import { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MetricsBar } from '@/components/models/MetricsBar';
import { Crown, ChevronDown, ChevronUp, Trophy } from 'lucide-react';
import type { ModelVersion } from '@/lib/db/types';
import { renderMarkdownBlock } from '@/lib/utils/markdown-light';

interface ChampionRevealCardProps {
  champion: ModelVersion;
  narrativeShort: string;
  narrativeLong: string;
  onSetChampion: () => void;
  isSettingChampion?: boolean;
  alreadyChampion?: boolean;
}

function getAlgorithmDisplayName(algorithm: string): string {
  const names: Record<string, string> = {
    log_reg: 'Logistic Regression',
    decision_tree: 'Decision Tree',
    random_forest: 'Random Forest',
    extra_trees: 'Extra Trees',
    gradient_boosted: 'Gradient Boosted',
  };
  return names[algorithm] ?? algorithm;
}

export function ChampionRevealCard({
  champion,
  narrativeShort,
  narrativeLong,
  onSetChampion,
  isSettingChampion = false,
  alreadyChampion = false,
}: ChampionRevealCardProps) {
  const [showDetails, setShowDetails] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Entrance animation: scale from 0.98 to 1.0
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const timer = setTimeout(
      () => {
        setIsRevealed(true);
      },
      prefersReducedMotion ? 0 : 100
    );

    return () => clearTimeout(timer);
  }, []);

  return (
    <div
      ref={cardRef}
      style={{
        transform: isRevealed ? 'scale(1)' : 'scale(0.98)',
        opacity: isRevealed ? 1 : 0,
        transition:
          'transform 500ms cubic-bezier(0.16, 1, 0.3, 1), opacity 500ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <Card className="border-crowe-amber/50 shadow-[0_0_20px_rgba(245,168,0,0.15)]">
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-crowe-amber/10 flex h-10 w-10 items-center justify-center rounded-full">
                <Crown className="text-crowe-amber-dark h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Recommended Champion</CardTitle>
                <p className="text-muted-foreground mt-0.5 text-sm">{narrativeShort}</p>
              </div>
            </div>
            <Badge className="bg-crowe-amber text-crowe-indigo-dark border-crowe-amber gap-1 px-3 py-1 text-sm capitalize">
              <Trophy className="h-3.5 w-3.5" />
              {getAlgorithmDisplayName(champion.algorithm)}
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Metrics summary */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <MetricsBar label="PR-AUC" value={champion.metrics_json.prAuc} />
            <MetricsBar
              label="Recall @ Review Rate"
              value={champion.metrics_json.recallAtReviewRate}
              color="#05AB8C"
            />
            <MetricsBar
              label="Precision @ Review Rate"
              value={champion.metrics_json.precisionAtReviewRate}
              color="#0075C9"
            />
            <MetricsBar label="F1 Score" value={champion.metrics_json.f1} color="#B14FC5" />
            <MetricsBar label="Stability" value={champion.metrics_json.stability} color="#54C0E8" />
            <MetricsBar
              label="Explainability"
              value={champion.metrics_json.explainability}
              color="#16D9BC"
            />
          </div>

          {/* Expandable narrative */}
          {narrativeLong && (
            <div>
              <button
                onClick={() => setShowDetails(!showDetails)}
                className="text-crowe-indigo hover:text-crowe-indigo-dark flex items-center gap-1 text-sm font-medium transition-colors"
              >
                {showDetails ? 'Hide Details' : 'Show Details'}
                {showDetails ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
              {showDetails && (
                <div className="bg-muted/50 text-foreground mt-3 rounded-lg p-4 text-sm leading-relaxed">
                  {renderMarkdownBlock(narrativeLong)}
                </div>
              )}
            </div>
          )}

          {/* Set as Champion CTA */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={onSetChampion}
              disabled={isSettingChampion || alreadyChampion}
              className={cn(
                'gap-2',
                alreadyChampion
                  ? 'bg-crowe-teal hover:bg-crowe-teal-dark text-white'
                  : 'bg-crowe-amber hover:bg-crowe-amber-dark text-crowe-indigo-dark font-semibold'
              )}
            >
              <Crown className="h-4 w-4" />
              {alreadyChampion
                ? 'Current Champion'
                : isSettingChampion
                  ? 'Setting Champion...'
                  : 'Set as Champion'}
            </Button>
            {!alreadyChampion && (
              <p className="text-muted-foreground text-xs">
                This will promote this version to the active champion for the model.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
