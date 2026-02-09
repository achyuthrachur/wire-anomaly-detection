'use client';

import { useEffect, useState, useCallback } from 'react';
import { PageContainer } from '@/components/layout/PageContainer';
import { FadeIn } from '@/components/motion/FadeIn';
import { StaggerChildren } from '@/components/motion/StaggerChildren';
import { CreateModelDialog } from '@/components/models/CreateModelDialog';
import { ModelCard } from '@/components/models/ModelCard';
import { CardSkeleton } from '@/components/skeletons/CardSkeleton';
import { AlertTriangle, Box } from 'lucide-react';
import type { ModelWithChampion } from '@/lib/db/types';

export default function ModelsPage() {
  const [models, setModels] = useState<ModelWithChampion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModels = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/models/list');
      if (!res.ok) throw new Error('Failed to fetch models');
      const data = await res.json();
      setModels(data.models);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load models');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchModels();
  }, [fetchModels]);

  function handleModelCreated() {
    fetchModels();
  }

  return (
    <PageContainer>
      <div className="space-y-6">
        <FadeIn>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-foreground text-2xl font-semibold">Model Registry</h1>
              <p className="text-muted-foreground mt-1 text-sm">
                Manage anomaly detection models, versions, and champion selections.
              </p>
            </div>
            <CreateModelDialog onCreated={handleModelCreated} />
          </div>
        </FadeIn>

        {loading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        )}

        {error && (
          <FadeIn>
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <AlertTriangle className="text-crowe-coral h-8 w-8" />
              <p className="text-muted-foreground text-sm">{error}</p>
            </div>
          </FadeIn>
        )}

        {!loading && !error && models.length === 0 && (
          <FadeIn>
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <Box className="text-tint-300 h-12 w-12" />
              <div>
                <p className="text-foreground font-medium">No models yet</p>
                <p className="text-muted-foreground mt-1 text-sm">
                  Create your first model to get started with the model registry.
                </p>
              </div>
            </div>
          </FadeIn>
        )}

        {!loading && !error && models.length > 0 && (
          <StaggerChildren className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {models.map((model) => (
              <ModelCard key={model.id} model={model} />
            ))}
          </StaggerChildren>
        )}
      </div>
    </PageContainer>
  );
}
