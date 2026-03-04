'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, ChevronLeft, ChevronRight, Sparkles, Columns3 } from 'lucide-react';

interface Tag {
  tag_id: number;
  name: string;
  color: string;
  contact_id: number;
}

interface Lead {
  id: number;
  full_name: string;
  company: string | null;
  position: string | null;
  company_url: string | null;
  location: string | null;
  total_score: number;
  tier: string;
  total_messages: number;
  user_messages: number;
  contact_messages: number;
  last_message_at: string | null;
  linkedin_url: string | null;
  is_enriched?: boolean;
  revenue_estimate: string | null;
  employee_estimate: string | null;
  industry: string | null;
  revenue_confidence: string | null;
  headline: string | null;
  email: string | null;
  reciprocity_score: number;
  frequency_score: number;
  depth_score: number;
  signal_score: number;
  recency_score: number;
}

type ColumnKey = 'location' | 'revenue' | 'employees' | 'industry' | 'headline' | 'email' | 'score' | 'tier' | 'tags' | 'messages' | 'lastActive' | 'reciprocity' | 'frequency' | 'depth' | 'signal' | 'recency';

const ALL_COLUMNS: { key: ColumnKey; label: string; default: boolean }[] = [
  { key: 'location', label: 'Location', default: true },
  { key: 'revenue', label: 'Revenue', default: true },
  { key: 'employees', label: 'Employees', default: true },
  { key: 'industry', label: 'Industry', default: false },
  { key: 'headline', label: 'Headline', default: false },
  { key: 'email', label: 'Email', default: false },
  { key: 'score', label: 'Score', default: true },
  { key: 'tier', label: 'Tier', default: true },
  { key: 'tags', label: 'Tags', default: true },
  { key: 'messages', label: 'Messages', default: true },
  { key: 'lastActive', label: 'Last Active', default: true },
  { key: 'reciprocity', label: 'Reciprocity', default: false },
  { key: 'frequency', label: 'Frequency', default: false },
  { key: 'depth', label: 'Depth', default: false },
  { key: 'signal', label: 'Signal', default: false },
  { key: 'recency', label: 'Recency', default: false },
];

interface LeadsTableProps {
  leads: Lead[];
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  selectedIds: Set<number>;
  onToggleSelect: (id: number) => void;
  onToggleAll: () => void;
  tagMap: Map<number, Tag[]>;
}

function TierBadge({ tier }: { tier: string }) {
  const cls = tier === 'hot' ? 'tier-bg-hot tier-hot' :
              tier === 'warm' ? 'tier-bg-warm tier-warm' : 'tier-bg-cold tier-cold';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${cls}`}>
      {tier}
    </span>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 55 ? 'bg-red-500' : score >= 30 ? 'bg-amber-500' : 'bg-gray-500';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-[var(--bg-hover)] overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-sm font-mono">{score}</span>
    </div>
  );
}

function RevenueBadge({ estimate, confidence }: { estimate: string | null; confidence: string | null }) {
  if (!estimate) return <span className="text-[var(--text-tertiary)]">—</span>;
  const colorMap: Record<string, string> = {
    '<$1M': 'bg-gray-500/20 text-gray-400',
    '$1-10M': 'bg-blue-500/20 text-blue-400',
    '$10-50M': 'bg-cyan-500/20 text-cyan-400',
    '$50-100M': 'bg-green-500/20 text-green-400',
    '$100-500M': 'bg-amber-500/20 text-amber-400',
    '$500M-1B': 'bg-orange-500/20 text-orange-400',
    '$1B+': 'bg-red-500/20 text-red-400',
  };
  const cls = colorMap[estimate] || 'bg-gray-500/20 text-gray-400';
  const suffix = confidence === 'low' ? '~' : '';
  return (
    <span className={`px-1.5 py-0.5 rounded text-xs font-medium whitespace-nowrap ${cls}`}>
      {estimate}{suffix}
    </span>
  );
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;
  if (diffDays < 365) return `${Math.floor(diffDays / 30)}mo ago`;
  return `${Math.floor(diffDays / 365)}y ago`;
}

export default function LeadsTable({ leads, page, totalPages, onPageChange, selectedIds, onToggleSelect, onToggleAll, tagMap }: LeadsTableProps) {
  const router = useRouter();
  const allOnPageSelected = leads.length > 0 && leads.every(l => selectedIds.has(l.id));
  const [visibleCols, setVisibleCols] = useState<Set<ColumnKey>>(
    () => new Set(ALL_COLUMNS.filter(c => c.default).map(c => c.key))
  );
  const [showColMenu, setShowColMenu] = useState(false);

  const toggleCol = (key: ColumnKey) => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const has = (key: ColumnKey) => visibleCols.has(key);

  const renderCell = (lead: Lead, key: ColumnKey, contactTags: Tag[]) => {
    const click = () => router.push(`/dashboard/${lead.id}`);
    switch (key) {
      case 'location': return <td key={key} className="px-4 py-3 text-sm text-[var(--text-tertiary)]" onClick={click}>{lead.location ? <span className="truncate block max-w-[120px]" title={lead.location}>{lead.location}</span> : '—'}</td>;
      case 'revenue': return <td key={key} className="px-4 py-3" onClick={click}><RevenueBadge estimate={lead.revenue_estimate} confidence={lead.revenue_confidence} /></td>;
      case 'employees': return <td key={key} className="px-4 py-3 text-sm text-[var(--text-secondary)]" onClick={click}>{lead.employee_estimate || '—'}</td>;
      case 'industry': return <td key={key} className="px-4 py-3 text-sm text-[var(--text-secondary)]" onClick={click}>{lead.industry || '—'}</td>;
      case 'headline': return <td key={key} className="px-4 py-3 text-sm text-[var(--text-tertiary)]" onClick={click}><span className="truncate block max-w-[200px]" title={lead.headline || ''}>{lead.headline || '—'}</span></td>;
      case 'email': return <td key={key} className="px-4 py-3 text-sm text-[var(--text-secondary)]" onClick={click}>{lead.email || '—'}</td>;
      case 'score': return <td key={key} className="px-4 py-3" onClick={click}><ScoreBar score={lead.total_score} /></td>;
      case 'tier': return <td key={key} className="px-4 py-3" onClick={click}><TierBadge tier={lead.tier} /></td>;
      case 'tags': return <td key={key} className="px-4 py-3" onClick={click}><div className="flex flex-wrap gap-1">{contactTags.map(tag => <span key={tag.tag_id} className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: tag.color + '20', color: tag.color, border: `1px solid ${tag.color}40` }}>{tag.name}</span>)}</div></td>;
      case 'messages': return <td key={key} className="px-4 py-3 text-right text-sm" onClick={click}><span className="text-[var(--text-primary)]">{lead.total_messages}</span><span className="text-[var(--text-tertiary)] ml-1 text-xs">({lead.user_messages}↑ {lead.contact_messages}↓)</span></td>;
      case 'lastActive': return <td key={key} className="px-4 py-3 text-right text-sm text-[var(--text-secondary)]" onClick={click}>{formatDate(lead.last_message_at)}</td>;
      case 'reciprocity': return <td key={key} className="px-4 py-3 text-sm text-center font-mono" onClick={click}>{lead.reciprocity_score}</td>;
      case 'frequency': return <td key={key} className="px-4 py-3 text-sm text-center font-mono" onClick={click}>{lead.frequency_score}</td>;
      case 'depth': return <td key={key} className="px-4 py-3 text-sm text-center font-mono" onClick={click}>{lead.depth_score}</td>;
      case 'signal': return <td key={key} className="px-4 py-3 text-sm text-center font-mono" onClick={click}>{lead.signal_score}</td>;
      case 'recency': return <td key={key} className="px-4 py-3 text-sm text-center font-mono" onClick={click}>{lead.recency_score}</td>;
    }
  };

  const visibleKeys = ALL_COLUMNS.filter(c => has(c.key));

  return (
    <div className="rounded-lg border border-[var(--border)] overflow-hidden">
      {/* Column toggle */}
      <div className="flex items-center justify-end px-4 py-2 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
        <div className="relative">
          <button
            onClick={() => setShowColMenu(!showColMenu)}
            className="flex items-center gap-1.5 px-2 py-1 rounded text-xs text-[var(--text-tertiary)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            <Columns3 size={14} />
            Columns
          </button>
          {showColMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 z-20 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] shadow-xl p-2 space-y-0.5 animate-fade-in">
              {ALL_COLUMNS.map(col => (
                <label key={col.key} className="flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-[var(--bg-hover)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={has(col.key)}
                    onChange={() => toggleCol(col.key)}
                    className="rounded border-[var(--border)] accent-[var(--accent)]"
                  />
                  <span className="text-[var(--text-secondary)]">{col.label}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-[var(--bg-secondary)] text-left text-sm text-[var(--text-tertiary)]">
              <th className="px-3 py-3 w-10">
                <input
                  type="checkbox"
                  checked={allOnPageSelected}
                  onChange={onToggleAll}
                  className="rounded border-[var(--border)] cursor-pointer accent-[var(--accent)]"
                />
              </th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Company</th>
              {visibleKeys.map(col => (
                <th key={col.key} className={`px-4 py-3 font-medium ${['messages', 'lastActive'].includes(col.key) ? 'text-right' : ''} ${['reciprocity', 'frequency', 'depth', 'signal', 'recency'].includes(col.key) ? 'text-center' : ''}`}>
                  {col.label}
                </th>
              ))}
              <th className="px-4 py-3 font-medium w-10"></th>
            </tr>
          </thead>
          <tbody>
            {leads.map((lead) => {
              const isSelected = selectedIds.has(lead.id);
              const contactTags = tagMap.get(lead.id) || [];
              return (
                <tr
                  key={lead.id}
                  className={`border-t border-[var(--border)] hover:bg-[var(--bg-hover)] cursor-pointer transition-colors ${
                    isSelected ? 'bg-[var(--accent-muted)]' : ''
                  }`}
                >
                  <td className="px-3 py-3" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleSelect(lead.id)}
                      className="rounded border-[var(--border)] cursor-pointer accent-[var(--accent)]"
                    />
                  </td>
                  <td className="px-4 py-3" onClick={() => router.push(`/dashboard/${lead.id}`)}>
                    <div>
                      <p className="font-medium text-[var(--text-primary)] flex items-center gap-1.5">
                        {lead.full_name}
                        {lead.is_enriched && (
                          <Sparkles size={12} className="text-[var(--accent)] flex-shrink-0" />
                        )}
                      </p>
                      {lead.position && (
                        <p className="text-xs text-[var(--text-tertiary)] mt-0.5 truncate max-w-[200px]">{lead.position}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-[var(--text-secondary)]" onClick={() => router.push(`/dashboard/${lead.id}`)}>
                    {lead.company_url ? (
                      <a
                        href={lead.company_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[var(--accent)] hover:underline"
                      >
                        {lead.company}
                      </a>
                    ) : (
                      lead.company || '—'
                    )}
                  </td>
                  {visibleKeys.map(col => renderCell(lead, col.key, contactTags))}
                  <td className="px-4 py-3">
                    {lead.linkedin_url && (
                      <a
                        href={lead.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-[var(--text-tertiary)] hover:text-[var(--accent)] transition-colors"
                      >
                        <ExternalLink size={14} />
                      </a>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border)] bg-[var(--bg-secondary)]">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="flex items-center gap-1 px-3 py-1 rounded text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={14} /> Previous
          </button>
          <span className="text-sm text-[var(--text-tertiary)]">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="flex items-center gap-1 px-3 py-1 rounded text-sm text-[var(--text-secondary)] hover:bg-[var(--bg-hover)] disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Next <ChevronRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
}
