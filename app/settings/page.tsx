'use client';

import { useState, useEffect } from 'react';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => setSettings(data));
  }, []);

  return (
    <div className="min-h-screen">
      <header className="h-12 border-b border-[var(--border)] bg-[var(--bg-secondary)] flex items-center px-4">
        <Link href="/dashboard" className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
          <ArrowLeft size={16} />
          Back to Dashboard
        </Link>
      </header>

      <div className="max-w-lg mx-auto p-6 space-y-8">
        <h1 className="text-2xl font-bold">Settings</h1>

        {/* Data Info */}
        <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] space-y-3">
          <h2 className="font-medium">Import Info</h2>
          <div className="space-y-1 text-sm text-[var(--text-secondary)]">
            {settings.user_name && <p>User: {settings.user_name}</p>}
            {settings.user_url && <p>Profile: {settings.user_url}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
