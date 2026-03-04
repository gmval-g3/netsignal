'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { BarChart3, Settings, Upload, LogOut } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createBrowserSupabase } from '@/lib/db/client';

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null);
    });
  }, []);

  async function handleLogout() {
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.push('/login');
  }

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

      <div className="ml-auto flex items-center gap-3">
        {email && (
          <span className="text-xs text-[var(--text-tertiary)]">{email}</span>
        )}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-hover)] transition-colors"
          title="Sign out"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </header>
  );
}
