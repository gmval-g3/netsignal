'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Database } from 'lucide-react';
import DropZone from '@/components/import/DropZone';
import ImportProgress from '@/components/import/ImportProgress';

type ImportStatus = 'idle' | 'uploading' | 'processing' | 'scoring' | 'complete' | 'error';

export default function ImportPage() {
  const router = useRouter();
  const [messagesFile, setMessagesFile] = useState<File | null>(null);
  const [connectionsFile, setConnectionsFile] = useState<File | null>(null);
  const [userName, setUserName] = useState('');
  const [userUrl, setUserUrl] = useState('');
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [stats, setStats] = useState<{ connections: number; messages: number; conversations: number } | undefined>();
  const [scoreStats, setScoreStats] = useState<{ hot: number; warm: number; cold: number } | undefined>();
  const [error, setError] = useState<string | undefined>();

  const handleImport = async () => {
    if (!messagesFile || !userName || !userUrl) return;

    setStatus('uploading');
    setError(undefined);

    try {
      const formData = new FormData();
      formData.append('messages', messagesFile);
      if (connectionsFile) formData.append('connections', connectionsFile);
      formData.append('userName', userName);
      formData.append('userUrl', userUrl);

      setStatus('processing');

      const res = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Import failed');
      }

      const data = await res.json();
      setStats(data.stats);

      // Trigger scoring
      setStatus('scoring');
      const scoreRes = await fetch('/api/import?action=score', { method: 'PUT' });
      if (scoreRes.ok) {
        const scoreData = await scoreRes.json();
        setScoreStats(scoreData.tiers);
      }

      setStatus('complete');
    } catch (err) {
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Import failed');
    }
  };

  const isReady = messagesFile && userName && userUrl;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-xl space-y-8">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--accent-muted)] text-[var(--accent)] text-sm mb-4">
            <Database size={14} />
            Local Analysis
          </div>
          <h1 className="text-3xl font-bold text-[var(--text-primary)]">NetSignal</h1>
          <p className="text-[var(--text-secondary)]">
            Import your LinkedIn data export to score relationships and find strong leads.
          </p>
        </div>

        {status === 'idle' || status === 'error' ? (
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="block text-sm font-medium text-[var(--text-secondary)]">Your Name (as it appears on LinkedIn)</label>
              <input
                type="text"
                value={userName}
                onChange={e => setUserName(e.target.value)}
                placeholder="McVal Osborne"
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-medium text-[var(--text-secondary)]">Your LinkedIn Profile URL</label>
              <input
                type="text"
                value={userUrl}
                onChange={e => setUserUrl(e.target.value)}
                placeholder="https://www.linkedin.com/in/mcval"
                className="w-full px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:border-[var(--accent)]"
              />
            </div>

            <div className="space-y-4">
              <DropZone
                label="messages.csv"
                accept=".csv"
                file={messagesFile}
                onFile={setMessagesFile}
                required
              />
              <DropZone
                label="Connections.csv (optional, adds company/position data)"
                accept=".csv"
                file={connectionsFile}
                onFile={setConnectionsFile}
              />
            </div>

            <button
              onClick={handleImport}
              disabled={!isReady}
              className={`w-full py-3 rounded-lg font-medium flex items-center justify-center gap-2 transition-all
                ${isReady
                  ? 'bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white cursor-pointer'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-tertiary)] cursor-not-allowed'}`}
            >
              Import & Analyze
              <ArrowRight size={18} />
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <ImportProgress
              status={status}
              stats={stats}
              scoreStats={scoreStats}
              error={error}
            />

            {status === 'complete' && (
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full py-3 rounded-lg font-medium bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white flex items-center justify-center gap-2 transition-all"
              >
                View Dashboard
                <ArrowRight size={18} />
              </button>
            )}
          </div>
        )}

        <p className="text-center text-xs text-[var(--text-tertiary)]">
          All data stays on your machine. Nothing is uploaded to any server.
        </p>
      </div>
    </div>
  );
}
