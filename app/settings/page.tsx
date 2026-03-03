'use client';

import { useState, useEffect } from 'react';
import { Save, Key, CheckCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function SettingsPage() {
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [settings, setSettings] = useState<Record<string, string>>({});

  useEffect(() => {
    fetch('/api/settings')
      .then(res => res.json())
      .then(data => {
        setSettings(data);
        setHasKey(data.has_api_key === 'true');
      });
  }, []);

  const handleSave = async () => {
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ anthropic_api_key: apiKey }),
    });
    if (res.ok) {
      setSaved(true);
      setHasKey(true);
      setApiKey('');
      setTimeout(() => setSaved(false), 3000);
    }
  };

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

        {/* API Key */}
        <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] space-y-4">
          <div className="flex items-center gap-2">
            <Key size={18} className="text-[var(--accent)]" />
            <h2 className="font-medium">Anthropic API Key</h2>
          </div>
          <p className="text-sm text-[var(--text-tertiary)]">
            Required for the AI chatbot. Your key is stored locally in the SQLite database.
          </p>

          {hasKey && (
            <div className="flex items-center gap-2 text-sm text-green-400">
              <CheckCircle size={14} />
              API key is configured
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasKey ? 'Enter new key to update...' : 'sk-ant-...'}
              className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] text-sm focus:outline-none focus:border-[var(--accent)]"
            />
            <button
              onClick={handleSave}
              disabled={!apiKey}
              className="px-4 py-2 rounded-lg bg-[var(--accent)] text-white text-sm font-medium disabled:opacity-30 hover:bg-[var(--accent-hover)] transition-colors flex items-center gap-2"
            >
              <Save size={14} />
              Save
            </button>
          </div>

          {saved && (
            <p className="text-sm text-green-400 animate-fade-in">API key saved successfully.</p>
          )}
        </div>

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
