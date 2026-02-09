'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ChevronLeft, ChevronRight, Search, Eye, EyeOff } from 'lucide-react';
import { formatNumber } from '@/lib/utils/index';

interface DatasetPreviewTableProps {
  datasetId: string;
  totalRows: number;
  hideLabelsByDefault?: boolean;
}

const PAGE_SIZE = 200;

const LABEL_COLUMNS = new Set(['isanomaly', 'is_anomaly', 'label', 'target', 'fraud', 'flag']);

export function DatasetPreviewTable({
  datasetId,
  totalRows,
  hideLabelsByDefault = false,
}: DatasetPreviewTableProps) {
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [showLabels, setShowLabels] = useState(!hideLabelsByDefault);
  const [hiddenColumns, setHiddenColumns] = useState<Set<string>>(new Set());

  const fetchPage = useCallback(
    async (pageOffset: number) => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/datasets/${datasetId}/preview?offset=${pageOffset}&limit=${PAGE_SIZE}`
        );
        if (!res.ok) throw new Error('Failed to load preview');
        const data = await res.json();
        setColumns(data.columns);
        setRows(data.rows);
        setOffset(pageOffset);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load preview');
      } finally {
        setLoading(false);
      }
    },
    [datasetId]
  );

  useEffect(() => {
    fetchPage(0);
  }, [fetchPage]);

  // Compute visible columns (respecting label hiding and hidden columns)
  const visibleColumnIndices = useMemo(() => {
    return columns
      .map((col, idx) => ({ col, idx }))
      .filter(({ col }) => {
        if (hiddenColumns.has(col)) return false;
        if (!showLabels && LABEL_COLUMNS.has(col.toLowerCase())) return false;
        return true;
      })
      .map(({ idx }) => idx);
  }, [columns, showLabels, hiddenColumns]);

  const visibleColumns = useMemo(
    () => visibleColumnIndices.map((i) => columns[i]),
    [visibleColumnIndices, columns]
  );

  const filteredRows = useMemo(() => {
    const baseRows = rows.map((row) => visibleColumnIndices.map((i) => row[i]));
    if (!search.trim()) return baseRows;
    const term = search.toLowerCase();
    return baseRows.filter((row) => row.some((cell) => cell.toLowerCase().includes(term)));
  }, [rows, search, visibleColumnIndices]);

  const hasLabelColumn = columns.some((c) => LABEL_COLUMNS.has(c.toLowerCase()));

  const canPrev = offset > 0;
  const canNext = offset + PAGE_SIZE < totalRows;
  const rangeStart = offset + 1;
  const rangeEnd = Math.min(offset + rows.length, totalRows);

  return (
    <div className="space-y-4">
      {/* Search and pagination controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="text-tint-500 absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search current page..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-border bg-background placeholder:text-tint-500 focus:ring-crowe-indigo/20 focus:border-crowe-indigo h-9 w-full rounded-lg border pr-3 pl-9 text-sm focus:ring-2 focus:outline-none"
          />
        </div>

        <div className="flex shrink-0 items-center gap-3">
          {hasLabelColumn && hideLabelsByDefault && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLabels(!showLabels)}
              className="gap-1.5 text-xs"
            >
              {showLabels ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              {showLabels ? 'Hide Labels' : 'Show Labels (Demo)'}
            </Button>
          )}
          <span className="text-muted-foreground text-sm">
            Showing {formatNumber(rangeStart, 0)}&ndash;{formatNumber(rangeEnd, 0)} of{' '}
            {formatNumber(totalRows, 0)}
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={!canPrev || loading}
              onClick={() => fetchPage(Math.max(0, offset - PAGE_SIZE))}
              className="h-8 w-8 p-0"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canNext || loading}
              onClick={() => fetchPage(offset + PAGE_SIZE)}
              className="h-8 w-8 p-0"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="border-crowe-coral/20 bg-crowe-coral/5 text-crowe-coral-dark rounded-lg border p-4 text-sm">
          {error}
        </div>
      )}

      {/* Table container */}
      <div className="border-border overflow-hidden rounded-xl border">
        <div className="max-h-[600px] overflow-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                {loading && visibleColumns.length === 0
                  ? Array.from({ length: 5 }).map((_, i) => (
                      <TableHead key={i}>
                        <Skeleton className="h-4 w-20" />
                      </TableHead>
                    ))
                  : visibleColumns.map((col) => (
                      <TableHead
                        key={col}
                        className="bg-muted/95 text-tint-500 sticky top-0 z-10 text-xs font-semibold tracking-wider uppercase backdrop-blur-sm"
                      >
                        {col}
                      </TableHead>
                    ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: visibleColumns.length || 5 }).map((_, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : filteredRows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={visibleColumns.length}
                    className="text-muted-foreground h-24 text-center"
                  >
                    {search ? 'No matching rows found.' : 'No data available.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredRows.map((row, i) => (
                  <TableRow key={`${offset}-${i}`}>
                    {row.map((cell, j) => (
                      <TableCell key={j} className="max-w-[300px] truncate font-mono text-sm">
                        {cell}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
