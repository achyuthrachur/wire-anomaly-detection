import { cn } from '@/lib/utils';

interface PageContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function PageContainer({ children, className }: PageContainerProps) {
  return (
    <main className={cn('mx-auto max-w-[1200px] px-6 pt-24 pb-16', className)}>
      {children}
    </main>
  );
}
