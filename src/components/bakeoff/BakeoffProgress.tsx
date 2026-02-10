'use client';

import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Clock, Cpu, BarChart3, CheckCircle2, Loader2 } from 'lucide-react';
import type { BakeoffStatus } from '@/lib/db/types';

const ALGORITHM_LABELS: Record<string, string> = {
  log_reg: 'Logistic Regression',
  decision_tree: 'Decision Tree',
  random_forest: 'Random Forest',
  extra_trees: 'Extra Trees',
  gradient_boosted: 'Gradient Boosted',
};

interface BakeoffProgressProps {
  status: BakeoffStatus;
  candidatesDone?: number;
  candidateCount?: number;
  currentAlgorithm?: string;
}

const STEPS = [
  { key: 'queued', label: 'Queued', icon: Clock, description: 'Preparing training pipeline...' },
  { key: 'running', label: 'Training', icon: Cpu, description: 'Training models...' },
  {
    key: 'evaluating',
    label: 'Evaluating',
    icon: BarChart3,
    description: 'Evaluating candidates...',
  },
  { key: 'completed', label: 'Completed', icon: CheckCircle2, description: 'Bake-off complete.' },
] as const;

function getStepIndex(
  status: BakeoffStatus,
  candidatesDone: number,
  candidateCount: number
): number {
  switch (status) {
    case 'queued':
      return 0;
    case 'running':
      // If all candidates are done, we're in the evaluating step
      return candidatesDone >= candidateCount && candidateCount > 0 ? 2 : 1;
    case 'completed':
      return 3;
    case 'failed':
      return -1;
    default:
      return 0;
  }
}

function getProgressValue(
  status: BakeoffStatus,
  candidatesDone: number,
  candidateCount: number
): number {
  if (status === 'completed') return 100;
  if (status === 'failed') return 0;
  if (status === 'queued') return 5;

  // Running: map candidatesDone to 10%-90%, finalize takes remaining 10%
  if (candidateCount === 0) return 10;
  const trainingProgress = candidatesDone / candidateCount;
  // 10% - 90% for training, 90% - 100% for finalize
  return Math.round(10 + trainingProgress * 80);
}

export function BakeoffProgress({
  status,
  candidatesDone = 0,
  candidateCount = 0,
  currentAlgorithm,
}: BakeoffProgressProps) {
  const activeStepIndex = getStepIndex(status, candidatesDone, candidateCount);
  const progressValue = getProgressValue(status, candidatesDone, candidateCount);

  const algoLabel = currentAlgorithm
    ? (ALGORITHM_LABELS[currentAlgorithm] ?? currentAlgorithm)
    : null;

  const statusLabel =
    status === 'running' && candidatesDone < candidateCount && algoLabel
      ? `Training ${algoLabel} (${candidatesDone + 1}/${candidateCount})...`
      : status === 'running' && candidatesDone >= candidateCount
        ? 'Finalizing results...'
        : status === 'queued'
          ? 'Building features...'
          : 'Complete';

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">{statusLabel}</span>
          <span className="text-foreground font-medium tabular-nums">
            {Math.round(progressValue)}%
          </span>
        </div>
        <Progress value={progressValue} className="h-2" />
      </div>

      {/* Step indicators */}
      <div className="grid grid-cols-4 gap-2">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isActive = index === activeStepIndex;
          const isCompleted = activeStepIndex > index;
          const isPending = activeStepIndex < index;

          return (
            <div
              key={step.key}
              className={cn(
                'flex flex-col items-center gap-2 rounded-lg p-3 text-center transition-all duration-300',
                {
                  'bg-crowe-indigo-dark/5': isActive,
                  'opacity-40': isPending,
                }
              )}
            >
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-full transition-all duration-300',
                  {
                    'bg-crowe-indigo-dark text-white': isActive,
                    'bg-crowe-teal/10 text-crowe-teal': isCompleted,
                    'bg-muted text-muted-foreground': isPending,
                  }
                )}
              >
                {isActive && status !== 'completed' ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : isCompleted ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Icon className="h-5 w-5" />
                )}
              </div>
              <div>
                <p
                  className={cn('text-xs font-medium', {
                    'text-crowe-indigo-dark': isActive,
                    'text-crowe-teal-dark': isCompleted,
                    'text-muted-foreground': isPending,
                  })}
                >
                  {step.label}
                </p>
                {isActive && (
                  <p className="text-muted-foreground mt-0.5 text-[10px]">
                    {step.key === 'running' && candidatesDone < candidateCount
                      ? `${candidatesDone}/${candidateCount} complete`
                      : step.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
