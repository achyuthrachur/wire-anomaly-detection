'use client';

import { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';
import { Clock, Cpu, BarChart3, CheckCircle2, Loader2 } from 'lucide-react';
import type { BakeoffStatus } from '@/lib/db/types';

interface BakeoffProgressProps {
  status: BakeoffStatus;
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

function getStepIndex(status: BakeoffStatus): number {
  switch (status) {
    case 'queued':
      return 0;
    case 'running':
      return 1;
    case 'completed':
      return 3;
    case 'failed':
      return -1;
    default:
      return 0;
  }
}

function getProgressValue(status: BakeoffStatus, elapsed: number): number {
  switch (status) {
    case 'queued':
      return Math.min(10, elapsed * 2);
    case 'running':
      // Simulate progress from 15% to 85% over time
      return Math.min(85, 15 + elapsed * 0.5);
    case 'completed':
      return 100;
    case 'failed':
      return 0;
    default:
      return 0;
  }
}

export function BakeoffProgress({ status }: BakeoffProgressProps) {
  const [elapsed, setElapsed] = useState(0);
  const activeStepIndex = getStepIndex(status);
  const progressValue = getProgressValue(status, elapsed);

  useEffect(() => {
    if (status === 'completed' || status === 'failed') return;

    let seconds = 0;
    const interval = setInterval(() => {
      seconds += 1;
      setElapsed(seconds);
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {status === 'running'
              ? 'Training models...'
              : status === 'queued'
                ? 'Preparing...'
                : 'Complete'}
          </span>
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
                  <p className="text-muted-foreground mt-0.5 text-[10px]">{step.description}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
