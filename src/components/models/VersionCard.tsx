'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MetricsBar } from './MetricsBar';
import { formatDate } from '@/lib/utils/index';
import { Crown, Trophy } from 'lucide-react';
import type { ModelVersion } from '@/lib/db/types';

interface VersionCardProps {
  version: ModelVersion;
  onSetChampion?: (versionId: string) => void;
}

export function VersionCard({ version, onSetChampion }: VersionCardProps) {
  const metrics = version.metrics_json;

  return (
    <Card className="relative">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base capitalize">{version.algorithm}</CardTitle>
            {version.is_champion && (
              <Badge className="bg-crowe-amber text-crowe-indigo-dark border-crowe-amber gap-1">
                <Crown className="h-3 w-3" />
                Champion
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          <MetricsBar label="PR-AUC" value={metrics.prAuc} max={1.0} />
          <MetricsBar
            label="Recall @ Review Rate"
            value={metrics.recallAtReviewRate}
            max={1.0}
            color="#05AB8C"
          />
          <MetricsBar
            label="Precision @ Review Rate"
            value={metrics.precisionAtReviewRate}
            max={1.0}
            color="#0075C9"
          />
          <MetricsBar label="F1 Score" value={metrics.f1} max={1.0} color="#B14FC5" />
        </div>

        <div className="flex items-center justify-between border-t pt-4">
          <span className="text-muted-foreground text-xs">
            Created {formatDate(version.created_at)}
          </span>

          {!version.is_champion && onSetChampion && (
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => onSetChampion(version.id)}
            >
              <Trophy className="h-3.5 w-3.5" />
              Set as Champion
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
