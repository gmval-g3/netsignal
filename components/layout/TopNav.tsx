'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Settings, Upload } from 'lucide-react';

export default function TopNav() {
  const pathname = usePathname();

  return (
    <header className="h-12 border-b border-[var(--border)] bg-[var(--bg-secondary)] flex items-center px-4 gap-6">
      <Link href="/dashboard" className="flex items-center gap-2 text-[var(--text-primary)] font-semibold text-sm">
        <BarChart3 size={18} className="text-[var(--accent)]" />
        NetSignal
      </Link>

      <nav className="flex items-center gap-1 ml-4">
        <Link
          href="/dashboard"
          className={`px-3 py-1.5 rounded text-sm transition-colors ${
            pathname === '/dashboard' ? 'bg-[var(--accent-muted)] text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          Leads
        </Link>
        <Link
          href="/import"
          className={`px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1.5 ${
            pathname === '/import' ? 'bg-[var(--accent-muted)] text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Upload size={14} />
          Import
        </Link>
        <Link
          href="/settings"
          className={`px-3 py-1.5 rounded text-sm transition-colors flex items-center gap-1.5 ${
            pathname === '/settings' ? 'bg-[var(--accent-muted)] text-[var(--accent)]' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
          }`}
        >
          <Settings size={14} />
          Settings
        </Link>
      </nav>
    </header>
  );
}
