interface MetricTileProps {
  label: string;
  value: string;
  detail?: string;
}

export function MetricTile({ label, value, detail }: MetricTileProps) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-foreground">{value}</p>
      {detail && <p className="mt-0.5 text-xs text-tint-500">{detail}</p>}
    </div>
  );
}
