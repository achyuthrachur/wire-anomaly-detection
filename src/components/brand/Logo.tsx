import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  variant?: 'light' | 'dark';
  className?: string;
  width?: number;
  height?: number;
}

export function Logo({ variant = 'light', className, width = 120, height = 34 }: LogoProps) {
  const src = variant === 'dark' ? '/logos/crowe-logo-white.svg' : '/logos/crowe-logo.svg';

  return (
    <Image
      src={src}
      alt="Crowe"
      width={width}
      height={height}
      className={cn('h-auto', className)}
      priority
    />
  );
}
