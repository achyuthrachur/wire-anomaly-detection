'use client';

import type { ProfilingResult } from '@/lib/db/types';
import { MetricTile } from './MetricTile';
import { DistributionSummary } from './DistributionSummary';
import { CardinalityBadge } from './CardinalityBadge';
import { StaggerChildren } from '@/components/motion/StaggerChildren';
import { BarChart3 } from 'lucide-react';

interface ProfilingCardsProps {
  profiling: ProfilingResult;
}

export function ProfilingCards({ profiling }: ProfilingCardsProps) {
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-foreground flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-crowe-indigo" />
        Distribution &amp; Volume Signals
      </h3>

      {/* Top-level metrics */}
      <StaggerChildren className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4" delay={60}>
        <MetricTile label="Total Rows" value={profiling.rowCount.toLocaleString()} />
        <MetricTile label="Columns" value={profiling.columnCount.toString()} />
        <MetricTile
          label="Numeric Fields"
          value={Object.keys(profiling.numeric).length.toString()}
        />
        <MetricTile
          label="Categorical Fields"
          value={Object.keys(profiling.categorical).length.toString()}
        />
      </StaggerChildren>

      {/* Numeric distributions */}
      {Object.keys(profiling.numeric).length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">Numeric Distributions</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(profiling.numeric).map(([name, profile]) => (
              <DistributionSummary key={name} name={name} profile={profile} />
            ))}
          </div>
        </div>
      )}

      {/* Categorical cardinalities */}
      {Object.keys(profiling.categorical).length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">Categorical Fields</h4>
          <div className="flex flex-wrap gap-3">
            {Object.entries(profiling.categorical).map(([name, profile]) => (
              <CardinalityBadge key={name} name={name} profile={profile} />
            ))}
          </div>
        </div>
      )}

      {/* Date ranges */}
      {Object.keys(profiling.date).length > 0 && (
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground">Date Ranges</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            {Object.entries(profiling.date).map(([name, profile]) => (
              <div key={name} className="rounded-xl border border-border bg-card p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">{name}</p>
                <div className="flex items-center gap-3 text-sm">
                  <span className="font-mono">{profile.min}</span>
                  <span className="text-tint-500">to</span>
                  <span className="font-mono">{profile.max}</span>
                </div>
                <p className="text-xs text-tint-500 mt-1">
                  {profile.range_days} days &middot; {profile.count.toLocaleString()} values
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
