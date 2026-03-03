'use client';

import { useRouter } from 'next/navigation';
import { ExternalLink, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';

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
  total_score: number;
  tier: string;
  total_messages: number;
  user_messages: number;
  contact_messages: number;
  last_message_at: string | null;
  linkedin_url: string | null;
  is_enriched?: boolean;
}

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

  return (
    <div className="rounded-lg border border-[var(--border)] overflow-hidden">
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
              <th className="px-4 py-3 font-medium">Score</th>
              <th className="px-4 py-3 font-medium">Tier</th>
              <th className="px-4 py-3 font-medium">Tags</th>
              <th className="px-4 py-3 font-medium text-right">Messages</th>
              <th className="px-4 py-3 font-medium text-right">Last Active</th>
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
                    {lead.company || '—'}
                  </td>
                  <td className="px-4 py-3" onClick={() => router.push(`/dashboard/${lead.id}`)}>
                    <ScoreBar score={lead.total_score} />
                  </td>
                  <td className="px-4 py-3" onClick={() => router.push(`/dashboard/${lead.id}`)}>
                    <TierBadge tier={lead.tier} />
                  </td>
                  <td className="px-4 py-3" onClick={() => router.push(`/dashboard/${lead.id}`)}>
                    <div className="flex flex-wrap gap-1">
                      {contactTags.map(tag => (
                        <span
                          key={tag.tag_id}
                          className="px-1.5 py-0.5 rounded text-xs"
                          style={{ backgroundColor: tag.color + '20', color: tag.color, border: `1px solid ${tag.color}40` }}
                        >
                          {tag.name}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right text-sm" onClick={() => router.push(`/dashboard/${lead.id}`)}>
                    <span className="text-[var(--text-primary)]">{lead.total_messages}</span>
                    <span className="text-[var(--text-tertiary)] ml-1 text-xs">
                      ({lead.user_messages}↑ {lead.contact_messages}↓)
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-[var(--text-secondary)]" onClick={() => router.push(`/dashboard/${lead.id}`)}>
                    {formatDate(lead.last_message_at)}
                  </td>
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
