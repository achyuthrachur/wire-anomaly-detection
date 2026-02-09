'use client';

import { cn } from '@/lib/utils';
import { useStagger } from './useStagger';
import { Children, isValidElement, type ReactNode } from 'react';

interface StaggerChildrenProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  duration?: number;
}

export function StaggerChildren({
  children,
  className,
  delay = 80,
  duration = 500,
}: StaggerChildrenProps) {
  const { containerRef, isVisible, staggerDelay } = useStagger({ delay });

  return (
    <div ref={containerRef} className={cn(className)}>
      {Children.map(children, (child, index) => {
        if (!isValidElement(child)) return child;
        return (
          <div
            style={{
              opacity: isVisible ? 1 : 0,
              transform: isVisible ? 'none' : 'translateY(12px)',
              transition: `opacity ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${index * staggerDelay}ms, transform ${duration}ms cubic-bezier(0.16, 1, 0.3, 1) ${index * staggerDelay}ms`,
            }}
          >
            {child}
          </div>
        );
      })}
    </div>
  );
}
