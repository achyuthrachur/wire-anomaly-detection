import { Badge } from '@/components/ui/badge';

interface TypeMismatchListProps {
  mismatches: Array<{
    column: string;
    expected: string;
    inferred: string;
  }>;
}

export function TypeMismatchList({ mismatches }: TypeMismatchListProps) {
  return (
    <div className="space-y-2">
      {mismatches.map((m) => (
        <div key={m.column} className="flex items-center gap-3 text-sm">
          <span className="font-medium min-w-[120px]">{m.column}</span>
          <Badge variant="outline" className="text-xs">{m.inferred}</Badge>
          <span className="text-tint-500">expected</span>
          <Badge className="text-xs bg-crowe-indigo-dark">{m.expected}</Badge>
        </div>
      ))}
    </div>
  );
}
