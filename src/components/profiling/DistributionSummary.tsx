import type { NumericProfile } from '@/lib/db/types';

interface DistributionSummaryProps {
  name: string;
  profile: NumericProfile;
}

export function DistributionSummary({ name, profile }: DistributionSummaryProps) {
  const fmt = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 });

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground mb-3">{name}</p>
      <div className="grid grid-cols-4 gap-2 text-center">
        {[
          { label: 'Min', value: fmt(profile.min) },
          { label: 'Mean', value: fmt(profile.mean) },
          { label: 'P95', value: fmt(profile.p95) },
          { label: 'Max', value: fmt(profile.max) },
        ].map((stat) => (
          <div key={stat.label}>
            <p className="text-[10px] uppercase tracking-wider text-tint-500">{stat.label}</p>
            <p className="text-sm font-semibold font-mono text-foreground">{stat.value}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-tint-500">
        <span>Std: {fmt(profile.std)}</span>
        <span>P50: {fmt(profile.p50)} &middot; P99: {fmt(profile.p99)}</span>
      </div>
    </div>
  );
}
