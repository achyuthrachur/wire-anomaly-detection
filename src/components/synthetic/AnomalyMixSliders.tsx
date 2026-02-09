'use client';

import { useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnomalyMixSlidersProps {
  value: Record<string, number>;
  onChange: (value: Record<string, number>) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ANOMALY_LABELS: Record<string, { label: string; description: string; color: string }> = {
  highAmount: {
    label: 'High Amount',
    description: 'Abnormally large wire transfers',
    color: 'bg-crowe-coral',
  },
  burst: {
    label: 'Burst',
    description: 'Rapid-fire transactions in a short window',
    color: 'bg-crowe-amber',
  },
  outOfHoursIrregular: {
    label: 'Out-of-Hours / Irregular',
    description: 'Transactions outside normal business hours',
    color: 'bg-crowe-violet',
  },
  riskCorridorCallbackBypass: {
    label: 'Risk Corridor / Callback Bypass',
    description: 'High-risk corridors or callback circumvention',
    color: 'bg-crowe-blue',
  },
  sodException: {
    label: 'SoD Exception',
    description: 'Segregation of duties violations',
    color: 'bg-crowe-teal',
  },
};

const KEYS = Object.keys(ANOMALY_LABELS);

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AnomalyMixSliders({ value, onChange }: AnomalyMixSlidersProps) {
  const total = KEYS.reduce((sum, k) => sum + (value[k] ?? 0), 0);
  const totalPct = Math.round(total * 100);

  const handleSliderChange = useCallback(
    (key: string, rawPct: number) => {
      const newVal = rawPct / 100;
      const oldVal = value[key] ?? 0;
      const delta = newVal - oldVal;

      if (Math.abs(delta) < 0.001) return;

      // Get the other keys that still have room to adjust
      const otherKeys = KEYS.filter((k) => k !== key);
      const othersSum = otherKeys.reduce((s, k) => s + (value[k] ?? 0), 0);

      const next: Record<string, number> = { ...value, [key]: newVal };

      if (othersSum > 0) {
        // Proportionally redistribute the delta among other sliders
        for (const ok of otherKeys) {
          const proportion = (value[ok] ?? 0) / othersSum;
          const adjusted = (value[ok] ?? 0) - delta * proportion;
          next[ok] = Math.max(0, Math.min(1, adjusted));
        }
      } else if (delta < 0) {
        // Others are all zero; distribute the freed amount evenly
        const freed = -delta;
        const share = freed / otherKeys.length;
        for (const ok of otherKeys) {
          next[ok] = share;
        }
      }

      // Normalize so sum is exactly 1.0
      const rawSum = KEYS.reduce((s, k) => s + next[k], 0);
      if (rawSum > 0) {
        for (const k of KEYS) {
          next[k] = next[k] / rawSum;
        }
      }

      // Round to 3 decimal places to avoid floating-point noise
      for (const k of KEYS) {
        next[k] = Math.round(next[k] * 1000) / 1000;
      }

      // Fix rounding to ensure exactly 1.0
      const roundedSum = KEYS.reduce((s, k) => s + next[k], 0);
      const diff = 1.0 - roundedSum;
      if (Math.abs(diff) > 0.0001) {
        next[key] = Math.round((next[key] + diff) * 1000) / 1000;
      }

      onChange(next);
    },
    [value, onChange]
  );

  return (
    <div className="space-y-5">
      {/* Summary bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground font-medium">Distribution Preview</span>
          <span
            className={cn(
              'font-mono text-xs font-semibold',
              totalPct === 100 ? 'text-crowe-teal' : 'text-crowe-coral'
            )}
          >
            {totalPct}%
          </span>
        </div>
        <div className="bg-tint-100 flex h-3 w-full overflow-hidden rounded-full">
          {KEYS.map((key) => {
            const pct = (value[key] ?? 0) * 100;
            if (pct < 0.5) return null;
            return (
              <div
                key={key}
                className={cn(
                  'h-full transition-all duration-300 first:rounded-l-full last:rounded-r-full',
                  ANOMALY_LABELS[key].color
                )}
                style={{ width: `${pct}%` }}
                title={`${ANOMALY_LABELS[key].label}: ${Math.round(pct)}%`}
              />
            );
          })}
        </div>
      </div>

      {/* Individual sliders */}
      {KEYS.map((key) => {
        const meta = ANOMALY_LABELS[key];
        const pct = Math.round((value[key] ?? 0) * 100);

        return (
          <div key={key} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={cn('h-2.5 w-2.5 rounded-full', meta.color)} />
                <Label className="text-sm font-medium">{meta.label}</Label>
              </div>
              <span className="bg-muted text-foreground min-w-[3rem] rounded px-2 py-0.5 text-center font-mono text-xs font-semibold">
                {pct}%
              </span>
            </div>
            <p className="text-muted-foreground mb-1 text-xs">{meta.description}</p>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={pct}
              onChange={(e) => handleSliderChange(key, Number(e.target.value))}
              className={cn(
                'anomaly-slider bg-tint-100 h-2 w-full cursor-pointer appearance-none rounded-full',
                'focus-visible:ring-ring/50 focus:outline-none focus-visible:ring-2'
              )}
              style={
                {
                  '--slider-color': getComputedColor(key),
                } as React.CSSProperties
              }
            />
          </div>
        );
      })}

      {/* Inline style for slider thumb/track coloring */}
      <style>{`
        .anomaly-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--slider-color, #002E62);
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          cursor: pointer;
          transition: transform 150ms ease;
        }
        .anomaly-slider::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }
        .anomaly-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: var(--slider-color, #002E62);
          border: 2px solid white;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          cursor: pointer;
        }
        .anomaly-slider::-webkit-slider-runnable-track {
          height: 8px;
          border-radius: 4px;
        }
        .anomaly-slider::-moz-range-track {
          height: 8px;
          border-radius: 4px;
          background: #E0E0E0;
        }
      `}</style>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getComputedColor(key: string): string {
  const colorMap: Record<string, string> = {
    highAmount: '#E5376B', // crowe-coral
    burst: '#F5A800', // crowe-amber
    outOfHoursIrregular: '#B14FC5', // crowe-violet
    riskCorridorCallbackBypass: '#0075C9', // crowe-blue
    sodException: '#05AB8C', // crowe-teal
  };
  return colorMap[key] ?? '#002E62';
}
