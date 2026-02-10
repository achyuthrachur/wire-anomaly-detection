'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { FlaskConical, AlertCircle } from 'lucide-react';
import type { Dataset } from '@/lib/db/types';

interface StartBakeoffDialogProps {
  modelId: string;
  modelName: string;
  onStarted: (bakeoffId: string) => void;
}

const ALGORITHMS = [
  { key: 'log_reg', label: 'Logistic Regression' },
  { key: 'decision_tree', label: 'Decision Tree' },
  { key: 'random_forest', label: 'Random Forest' },
  { key: 'extra_trees', label: 'Extra Trees' },
  { key: 'gradient_boosted', label: 'Gradient Boosted' },
] as const;

export function StartBakeoffDialog({ modelId, modelName, onStarted }: StartBakeoffDialogProps) {
  const [open, setOpen] = useState(false);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasetId, setSelectedDatasetId] = useState('');
  const [labelColumn, setLabelColumn] = useState('IsAnomaly');
  const [reviewRate, setReviewRate] = useState('0.005');
  const [selectedAlgorithms, setSelectedAlgorithms] = useState<string[]>(
    ALGORITHMS.map((a) => a.key)
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingDatasets, setLoadingDatasets] = useState(false);

  // Fetch training datasets with labels when dialog opens
  useEffect(() => {
    if (!open) return;
    setLoadingDatasets(true);
    async function fetchDatasets() {
      try {
        const res = await fetch('/api/datasets/list?role=training');
        if (res.ok) {
          const data = await res.json();
          const eligible = (data.datasets ?? []).filter((d: Dataset) => d.label_present);
          setDatasets(eligible);
          if (eligible.length > 0 && !selectedDatasetId) {
            setSelectedDatasetId(eligible[0].id);
          }
        }
      } catch {
        // Non-critical
      } finally {
        setLoadingDatasets(false);
      }
    }
    fetchDatasets();
  }, [open, selectedDatasetId]);

  function toggleAlgorithm(key: string) {
    setSelectedAlgorithms((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedDatasetId) {
      setError('Select a training dataset.');
      return;
    }

    if (selectedAlgorithms.length === 0) {
      setError('Select at least one algorithm.');
      return;
    }

    const rr = parseFloat(reviewRate);
    if (isNaN(rr) || rr <= 0 || rr > 1) {
      setError('Review rate must be between 0 and 1.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/bakeoff/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasetId: selectedDatasetId,
          modelId,
          labelColumn: labelColumn.trim(),
          reviewRate: rr,
          candidates: selectedAlgorithms.map((algorithm) => ({
            algorithm,
            hyperparams: {},
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to start bake-off');
      }

      const data = await res.json();
      setOpen(false);
      onStarted(data.bakeoffId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start bake-off');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-crowe-indigo-dark hover:bg-crowe-indigo gap-2 text-white">
          <FlaskConical className="h-4 w-4" />
          Start Bake-off
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Start Model Bake-off</DialogTitle>
          <DialogDescription>
            Train and compare multiple algorithms for{' '}
            <span className="text-foreground font-medium">{modelName}</span>.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Dataset picker */}
          <div className="space-y-2">
            <label htmlFor="bakeoff-dataset" className="text-foreground text-sm font-medium">
              Training Dataset <span className="text-crowe-coral">*</span>
            </label>
            {loadingDatasets ? (
              <div className="text-muted-foreground text-sm">Loading datasets...</div>
            ) : datasets.length === 0 ? (
              <div className="bg-crowe-amber/5 border-crowe-amber/20 rounded-md border p-3 text-sm">
                <p className="text-foreground font-medium">No training datasets available</p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Upload a dataset with labels and set its role to &ldquo;training&rdquo; first.
                </p>
              </div>
            ) : (
              <select
                id="bakeoff-dataset"
                value={selectedDatasetId}
                onChange={(e) => setSelectedDatasetId(e.target.value)}
                className="border-input bg-background text-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
              >
                {datasets.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.row_count.toLocaleString()} rows)
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Label column */}
          <div className="space-y-2">
            <label htmlFor="bakeoff-label" className="text-foreground text-sm font-medium">
              Label Column
            </label>
            <input
              id="bakeoff-label"
              type="text"
              value={labelColumn}
              onChange={(e) => setLabelColumn(e.target.value)}
              placeholder="IsAnomaly"
              className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
            />
          </div>

          {/* Review rate */}
          <div className="space-y-2">
            <label htmlFor="bakeoff-review-rate" className="text-foreground text-sm font-medium">
              Review Rate
            </label>
            <input
              id="bakeoff-review-rate"
              type="number"
              step="0.001"
              min="0.0001"
              max="1"
              value={reviewRate}
              onChange={(e) => setReviewRate(e.target.value)}
              className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 text-sm shadow-xs transition-colors focus-visible:ring-2 focus-visible:outline-none"
            />
            <p className="text-muted-foreground text-xs">
              Fraction of transactions reviewed (default: 0.5%).
            </p>
          </div>

          {/* Algorithm checkboxes */}
          <div className="space-y-2">
            <label className="text-foreground text-sm font-medium">Algorithms</label>
            <div className="grid grid-cols-2 gap-2">
              {ALGORITHMS.map((algo) => {
                const isSelected = selectedAlgorithms.includes(algo.key);
                return (
                  <label
                    key={algo.key}
                    className="border-input hover:bg-muted/50 flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleAlgorithm(algo.key)}
                      className="border-input text-crowe-indigo-dark focus:ring-crowe-indigo accent-crowe-indigo-dark h-4 w-4 rounded"
                    />
                    <span className="text-foreground text-sm">{algo.label}</span>
                  </label>
                );
              })}
            </div>
            <p className="text-muted-foreground text-xs">
              {selectedAlgorithms.length} of {ALGORITHMS.length} selected.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-crowe-coral/5 text-crowe-coral flex items-center gap-2 rounded-md px-3 py-2 text-sm">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={submitting || selectedAlgorithms.length === 0 || !selectedDatasetId}
              className="bg-crowe-indigo-dark hover:bg-crowe-indigo gap-2 text-white"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Building features...
                </>
              ) : (
                <>
                  <FlaskConical className="h-4 w-4" />
                  Start Bake-off
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
