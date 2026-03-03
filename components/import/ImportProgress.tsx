'use client';

import { CheckCircle, Loader2, AlertCircle } from 'lucide-react';

interface ImportProgressProps {
  status: 'idle' | 'uploading' | 'processing' | 'scoring' | 'complete' | 'error';
  stats?: {
    connections: number;
    messages: number;
    conversations: number;
  };
  scoreStats?: {
    hot: number;
    warm: number;
    cold: number;
  };
  error?: string;
}

const STEPS = [
  { key: 'uploading', label: 'Uploading files' },
  { key: 'processing', label: 'Processing CSV data' },
  { key: 'scoring', label: 'Scoring relationships' },
  { key: 'complete', label: 'Import complete' },
];

const stepOrder = ['uploading', 'processing', 'scoring', 'complete'];

export default function ImportProgress({ status, stats, scoreStats, error }: ImportProgressProps) {
  if (status === 'idle') return null;

  const currentIdx = stepOrder.indexOf(status);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="space-y-3">
        {STEPS.map((step, idx) => {
          const isActive = step.key === status;
          const isDone = currentIdx > idx || status === 'complete';
          const isPending = currentIdx < idx && status !== 'error';

          return (
            <div key={step.key} className="flex items-center gap-3">
              {isDone ? (
                <CheckCircle size={18} className="text-[var(--success)] flex-shrink-0" />
              ) : isActive && status !== 'error' ? (
                <Loader2 size={18} className="text-[var(--accent)] animate-spin flex-shrink-0" />
              ) : status === 'error' && isActive ? (
                <AlertCircle size={18} className="text-[var(--danger)] flex-shrink-0" />
              ) : (
                <div className={`w-[18px] h-[18px] rounded-full border-2 flex-shrink-0 ${isPending ? 'border-[var(--border)]' : 'border-[var(--danger)]'}`} />
              )}
              <span className={isDone || isActive ? 'text-[var(--text-primary)]' : 'text-[var(--text-tertiary)]'}>
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {status === 'complete' && stats && (
        <div className="p-4 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] space-y-2">
          <p className="text-[var(--text-primary)] font-medium">Import Summary</p>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-[var(--text-tertiary)]">Connections</p>
              <p className="text-lg font-semibold">{stats.connections.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[var(--text-tertiary)]">Messages</p>
              <p className="text-lg font-semibold">{stats.messages.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-[var(--text-tertiary)]">Conversations</p>
              <p className="text-lg font-semibold">{stats.conversations.toLocaleString()}</p>
            </div>
          </div>
          {scoreStats && (
            <div className="grid grid-cols-3 gap-4 text-sm mt-3 pt-3 border-t border-[var(--border)]">
              <div>
                <p className="text-[var(--text-tertiary)]">Hot leads</p>
                <p className="text-lg font-semibold tier-hot">{scoreStats.hot}</p>
              </div>
              <div>
                <p className="text-[var(--text-tertiary)]">Warm</p>
                <p className="text-lg font-semibold tier-warm">{scoreStats.warm}</p>
              </div>
              <div>
                <p className="text-[var(--text-tertiary)]">Cold</p>
                <p className="text-lg font-semibold tier-cold">{scoreStats.cold}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
