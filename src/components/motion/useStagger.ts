'use client';

import { useEffect, useRef, useState } from 'react';

interface UseStaggerOptions {
  delay?: number;
  threshold?: number;
}

export function useStagger(options: UseStaggerOptions = {}) {
  const { delay = 80, threshold = 0.1 } = options;
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(el);
        }
      },
      { threshold }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold]);

  return { containerRef, isVisible, staggerDelay: delay };
}
