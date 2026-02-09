'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/utils/index';
import { Box, Crown, Layers } from 'lucide-react';
import type { ModelWithChampion } from '@/lib/db/types';

interface ModelCardProps {
  model: ModelWithChampion;
}

export function ModelCard({ model }: ModelCardProps) {
  return (
    <Link href={`/models/${model.id}`}>
      <Card className="cursor-pointer transition-shadow duration-200 hover:shadow-md">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <Box className="text-crowe-indigo-dark h-5 w-5" />
              <CardTitle className="text-base">{model.name}</CardTitle>
            </div>
            {model.champion_algorithm && (
              <Badge className="bg-crowe-amber text-crowe-indigo-dark border-crowe-amber gap-1">
                <Crown className="h-3 w-3" />
                {model.champion_algorithm}
              </Badge>
            )}
          </div>
          {model.description && (
            <CardDescription className="line-clamp-2">{model.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between text-sm">
            <div className="text-muted-foreground flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" />
              <span>
                {model.version_count} {model.version_count === 1 ? 'version' : 'versions'}
              </span>
            </div>
            <span className="text-muted-foreground text-xs">{formatDate(model.created_at)}</span>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
