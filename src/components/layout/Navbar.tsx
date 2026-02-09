'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Logo } from '@/components/brand/Logo';
import { cn } from '@/lib/utils';
import { Upload, List, Info } from 'lucide-react';

const NAV_ITEMS = [
  { href: '/upload', label: 'Upload', icon: Upload },
  { href: '/runs', label: 'Runs', icon: List },
  { href: '/dashboard', label: 'Dashboard', icon: Info },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed top-0 right-0 left-0 z-50 transition-all duration-300',
        scrolled
          ? 'h-14 border-b border-border bg-white/80 shadow-sm backdrop-blur-xl'
          : 'h-16 bg-white/60 backdrop-blur-md'
      )}
    >
      <nav className="mx-auto flex h-full max-w-[1200px] items-center justify-between px-6">
        <Link href="/" className="flex items-center gap-3">
          <Logo width={100} height={28} />
          <span className="hidden text-sm font-medium text-tint-500 sm:inline">
            Wire Anomaly Demo
          </span>
        </Link>

        <div className="flex items-center gap-1">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const isActive = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-crowe-indigo-dark text-white'
                    : 'text-tint-700 hover:bg-muted hover:text-crowe-indigo-dark'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </header>
  );
}
