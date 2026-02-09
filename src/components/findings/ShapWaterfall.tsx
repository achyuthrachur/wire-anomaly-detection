'use client';

import { cn } from '@/lib/utils';

interface ShapFeature {
  name: string;
  value: number;
}

interface ShapWaterfallProps {
  features: ShapFeature[];
  className?: string;
}

export function ShapWaterfall({ features, className }: ShapWaterfallProps) {
  const displayed = features.slice(0, 8);

  if (displayed.length === 0) {
    return <p className="text-tint-500 text-sm">No feature contributions available.</p>;
  }

  const maxAbsValue = Math.max(...displayed.map((f) => Math.abs(f.value)), 0.001);

  return (
    <div className={cn('space-y-2', className)}>
      {displayed.map((feature) => {
        const isPositive = feature.value >= 0;
        const barWidthPct = (Math.abs(feature.value) / maxAbsValue) * 50;

        return (
          <div key={feature.name} className="flex items-center gap-3">
            {/* Feature name */}
            <span className="text-tint-700 w-36 shrink-0 truncate text-right text-xs font-medium">
              {feature.name}
            </span>

            {/* Bar area: centered axis */}
            <div className="relative flex h-6 flex-1 items-center">
              {/* Center axis line */}
              <div className="bg-tint-300 absolute top-0 bottom-0 left-1/2 w-px" />

              {/* Bar */}
              {isPositive ? (
                <div
                  className="bg-crowe-coral/80 absolute left-1/2 h-5 rounded-r-sm transition-all duration-500"
                  style={{ width: `${barWidthPct}%` }}
                >
                  <span className="absolute top-1/2 right-1 -translate-y-1/2 text-[10px] font-semibold whitespace-nowrap text-white">
                    +{feature.value.toFixed(3)}
                  </span>
                </div>
              ) : (
                <div
                  className="bg-crowe-blue/80 absolute right-1/2 h-5 rounded-l-sm transition-all duration-500"
                  style={{ width: `${barWidthPct}%` }}
                >
                  <span className="absolute top-1/2 left-1 -translate-y-1/2 text-[10px] font-semibold whitespace-nowrap text-white">
                    {feature.value.toFixed(3)}
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Legend */}
      <div className="text-tint-500 flex items-center justify-center gap-6 pt-2 text-[10px]">
        <span className="flex items-center gap-1">
          <span className="bg-crowe-blue/80 inline-block h-2.5 w-2.5 rounded-sm" />
          Decreases risk score
        </span>
        <span className="flex items-center gap-1">
          <span className="bg-crowe-coral/80 inline-block h-2.5 w-2.5 rounded-sm" />
          Increases risk score
        </span>
      </div>
    </div>
  );
}
