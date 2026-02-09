interface DuplicatesListProps {
  duplicates: Record<string, number>;
}

export function DuplicatesList({ duplicates }: DuplicatesListProps) {
  return (
    <div className="space-y-2">
      {Object.entries(duplicates).map(([col, count]) => (
        <div key={col} className="flex items-center justify-between text-sm">
          <span className="font-medium">{col}</span>
          <span className="text-crowe-coral">{count} duplicate{count !== 1 ? 's' : ''}</span>
        </div>
      ))}
    </div>
  );
}
