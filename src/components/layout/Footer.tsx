import { Logo } from '@/components/brand/Logo';

export function Footer() {
  return (
    <footer className="border-t border-border bg-muted/50">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-8">
        <div className="flex items-center gap-3">
          <Logo width={80} height={22} />
          <span className="text-xs text-tint-500">Wire Anomaly Detection Demo</span>
        </div>
        <p className="text-xs text-tint-500">
          Internal tool — synthetic data only
        </p>
      </div>
    </footer>
  );
}
