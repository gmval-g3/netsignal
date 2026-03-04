'use client';

import { useState } from 'react';
import { Search, Info, X, Flame, Sun, Snowflake } from 'lucide-react';

interface FilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  activeTiers: string[];
  onTiersChange: (tiers: string[]) => void;
  sort: string;
  onSortChange: (value: string) => void;
  total: number;
  dateFilter: string;
  onDateFilterChange: (value: string) => void;
  minMessages: string;
  onMinMessagesChange: (value: string) => void;
}

const DATE_FILTERS = [
  { value: '', label: 'Any time' },
  { value: 'last7d', label: 'Last 7 days' },
  { value: 'last30d', label: 'Last 30 days' },
  { value: 'last90d', label: 'Last 3 months' },
  { value: 'last6m', label: 'Last 6 months' },
  { value: 'over6m', label: 'Over 6 months ago' },
  { value: 'over1y', label: 'Over 1 year ago' },
];

const TIERS = [
  { value: 'hot', label: 'Hot', icon: Flame, activeClass: 'bg-red-500/20 text-red-400 border-red-500/40' },
  { value: 'warm', label: 'Warm', icon: Sun, activeClass: 'bg-amber-500/20 text-amber-400 border-amber-500/40' },
  { value: 'cold', label: 'Cold', icon: Snowflake, activeClass: 'bg-gray-500/20 text-gray-400 border-gray-500/40' },
];

const SORTS = [
  { value: 'total_score', label: 'Score' },
  { value: 'total_messages', label: 'Messages' },
  { value: 'last_message_at', label: 'Last Active' },
  { value: 'reciprocity_score', label: 'Reciprocity' },
  { value: 'recency_score', label: 'Recency' },
];

function MethodologyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl p-6 max-w-lg w-full mx-4 space-y-5 animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Scoring Methodology</h2>
          <button onClick={onClose} className="p-1 rounded hover:bg-[var(--bg-hover)]">
            <X size={18} className="text-[var(--text-tertiary)]" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-[var(--text-secondary)]">Lead Tiers</h3>
            <div className="space-y-2">
              <div className="flex items-center gap-3 p-3 rounded-lg tier-bg-hot border">
                <Flame size={18} className="tier-hot" />
                <div>
                  <p className="font-medium tier-hot">Hot (Score 55+)</p>
                  <p className="text-xs text-[var(--text-secondary)]">Strong bidirectional relationships with recent activity, frequent messaging, and signal words like &quot;meeting&quot; or &quot;partnership&quot;.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg tier-bg-warm border">
                <Sun size={18} className="tier-warm" />
                <div>
                  <p className="font-medium tier-warm">Warm (Score 30–54)</p>
                  <p className="text-xs text-[var(--text-secondary)]">Active connections with some back-and-forth, but may lack recency or depth. Worth re-engaging.</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-lg tier-bg-cold border">
                <Snowflake size={18} className="tier-cold" />
                <div>
                  <p className="font-medium tier-cold">Cold (Score &lt;30)</p>
                  <p className="text-xs text-[var(--text-secondary)]">Minimal or stale engagement. May be old connections with little messaging history.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-sm font-medium text-[var(--text-secondary)]">Score Components</h3>
            <div className="space-y-1.5 text-sm">
              {[
                { label: 'Reciprocity', weight: '30%', desc: 'Both sides messaging with balanced turn-taking' },
                { label: 'Recency', weight: '25%', desc: 'How recently the last message was sent' },
                { label: 'Frequency', weight: '20%', desc: 'Message volume + consistency across months' },
                { label: 'Signal Words', weight: '15%', desc: '"call", "meeting", "partnership", "collaborate", etc.' },
                { label: 'Depth', weight: '10%', desc: 'Average message length, substantive content ratio' },
              ].map(s => (
                <div key={s.label} className="flex items-start gap-2">
                  <span className="font-mono text-[var(--accent)] w-10 text-right flex-shrink-0">{s.weight}</span>
                  <div>
                    <span className="text-[var(--text-primary)]">{s.label}</span>
                    <span className="text-[var(--text-tertiary)]"> — {s.desc}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-[var(--text-tertiary)] border-t border-[var(--border)] pt-3">
            <strong>Excluded:</strong> One-way messages (spam/unreplied), group chats, and LinkedIn system messages are filtered out before scoring.
          </div>
        </div>
      </div>
    </div>
  );
}

const MESSAGE_FILTERS = [
  { value: '', label: 'Any count' },
  { value: '2', label: '2+ messages' },
  { value: '5', label: '5+ messages' },
  { value: '10', label: '10+ messages' },
  { value: '25', label: '25+ messages' },
  { value: '50', label: '50+ messages' },
];

export default function FilterBar({ search, onSearchChange, activeTiers, onTiersChange, sort, onSortChange, total, dateFilter, onDateFilterChange, minMessages, onMinMessagesChange }: FilterBarProps) {
  const [showMethodology, setShowMethodology] = useState(false);

  const toggleTier = (tier: string) => {
    if (activeTiers.includes(tier)) {
      // Don't allow deselecting all
      if (activeTiers.length === 1) return;
      onTiersChange(activeTiers.filter(t => t !== tier));
    } else {
      onTiersChange([...activeTiers, tier]);
    }
  };

  const allSelected = activeTiers.length === 3;

  return (
    <>
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 w-full sm:max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-tertiary)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search name, company, messages..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] text-sm focus:outline-none focus:border-[var(--accent)]"
          />
        </div>

        <div className="flex items-center gap-2">
          {/* All button */}
          <button
            onClick={() => onTiersChange(['hot', 'warm', 'cold'])}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              allSelected
                ? 'bg-[var(--accent)] text-white border-[var(--accent)]'
                : 'bg-[var(--bg-secondary)] text-[var(--text-secondary)] border-[var(--border)] hover:bg-[var(--bg-tertiary)]'
            }`}
          >
            All
          </button>

          {/* Tier toggle buttons */}
          {TIERS.map((t) => {
            const active = activeTiers.includes(t.value);
            return (
              <button
                key={t.value}
                onClick={() => toggleTier(t.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-colors ${
                  active
                    ? t.activeClass
                    : 'bg-[var(--bg-secondary)] text-[var(--text-tertiary)] border-[var(--border)] hover:bg-[var(--bg-tertiary)]'
                }`}
              >
                <t.icon size={14} />
                {t.label}
              </button>
            );
          })}
        </div>

        <select
          value={sort}
          onChange={(e) => onSortChange(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-secondary)] text-sm focus:outline-none cursor-pointer"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>

        <select
          value={dateFilter}
          onChange={(e) => onDateFilterChange(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-secondary)] text-sm focus:outline-none cursor-pointer"
        >
          {DATE_FILTERS.map((d) => (
            <option key={d.value} value={d.value}>{d.label}</option>
          ))}
        </select>

        <select
          value={minMessages}
          onChange={(e) => onMinMessagesChange(e.target.value)}
          className="px-3 py-1.5 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-[var(--text-secondary)] text-sm focus:outline-none cursor-pointer"
        >
          {MESSAGE_FILTERS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>

        <button
          onClick={() => setShowMethodology(true)}
          className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)] text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
          title="Scoring methodology"
        >
          <Info size={18} />
        </button>

        <span className="text-sm text-[var(--text-tertiary)] ml-auto">
          {total.toLocaleString()} leads
        </span>
      </div>

      {showMethodology && <MethodologyModal onClose={() => setShowMethodology(false)} />}
    </>
  );
}
