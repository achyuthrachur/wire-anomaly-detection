'use client';

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface MotionContextValue {
  prefersReducedMotion: boolean;
}

const MotionContext = createContext<MotionContextValue>({
  prefersReducedMotion: false,
});

export function useMotion() {
  return useContext(MotionContext);
}

export function MotionProvider({ children }: { children: ReactNode }) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(
    () =>
      typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return (
    <MotionContext.Provider value={{ prefersReducedMotion }}>{children}</MotionContext.Provider>
  );
}
