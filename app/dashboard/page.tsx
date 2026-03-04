'use client';

import { useState, useEffect, useCallback } from 'react';
import MetricsRow from '@/components/dashboard/MetricsRow';
import FilterBar from '@/components/dashboard/FilterBar';
import LeadsTable from '@/components/dashboard/LeadsTable';
import { Loader2, Download, Tag, X, Plus, Sparkles, Building2 } from 'lucide-react';

interface Stats {
  totalContacts: number;
  totalMessages: number;
  totalConversations: number;
  tiers: { hot: number; warm: number; cold: number };
  recentMessages: number;
}

interface TagData {
  id: number;
  name: string;
  color: string;
}

interface TagMapping {
  contact_id: number;
  tag_id: number;
  name: string;
  color: string;
}

const TAG_COLORS = ['#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [leads, setLeads] = useState<{ id: number; [key: string]: unknown }[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [activeTiers, setActiveTiers] = useState<string[]>(['hot', 'warm', 'cold']);
  const [sort, setSort] = useState('total_score');
  const [dateFilter, setDateFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Enrichment
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<{ success: number; failed: number } | null>(null);

  // Company enrichment
  const [enrichingCompanies, setEnrichingCompanies] = useState(false);
  const [companyEnrichResult, setCompanyEnrichResult] = useState<{ enriched: number } | null>(null);

  // Tags
  const [allTags, setAllTags] = useState<TagData[]>([]);
  const [tagMap, setTagMap] = useState<Map<number, TagMapping[]>>(new Map());
  const [showTagMenu, setShowTagMenu] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  useEffect(() => {
    fetch('/api/stats').then(r => r.json()).then(setStats).catch(console.error);
    fetchTags();
    fetchTagMappings();
  }, []);

  const fetchTags = async () => {
    const res = await fetch('/api/tags');
    setAllTags(await res.json());
  };

  const fetchTagMappings = async () => {
    const res = await fetch('/api/contacts/tags');
    const mappings: TagMapping[] = await res.json();
    const map = new Map<number, TagMapping[]>();
    for (const m of mappings) {
      const existing = map.get(m.contact_id) || [];
      existing.push(m);
      map.set(m.contact_id, existing);
    }
    setTagMap(map);
  };

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        tiers: activeTiers.join(','),
        sort,
        search,
      });

      // Convert dateFilter preset to sinceDate/untilDate
      const now = new Date();
      if (dateFilter === 'last7d') {
        params.set('sinceDate', new Date(now.getTime() - 7 * 86400000).toISOString());
      } else if (dateFilter === 'last30d') {
        params.set('sinceDate', new Date(now.getTime() - 30 * 86400000).toISOString());
      } else if (dateFilter === 'last90d') {
        params.set('sinceDate', new Date(now.getTime() - 90 * 86400000).toISOString());
      } else if (dateFilter === 'last6m') {
        params.set('sinceDate', new Date(now.getTime() - 180 * 86400000).toISOString());
      } else if (dateFilter === 'over6m') {
        params.set('untilDate', new Date(now.getTime() - 180 * 86400000).toISOString());
      } else if (dateFilter === 'over1y') {
        params.set('untilDate', new Date(now.getTime() - 365 * 86400000).toISOString());
      }

      const res = await fetch(`/api/leads?${params}`);
      const data = await res.json();
      setLeads(data.leads || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 1);
    } catch (err) {
      console.error('Failed to fetch leads:', err);
    } finally {
      setLoading(false);
    }
  }, [page, activeTiers, sort, search, dateFilter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Debounce search
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimeout) clearTimeout(searchTimeout);
    setSearchTimeout(setTimeout(() => setPage(1), 300));
  };

  const handleTiersChange = (tiers: string[]) => {
    setActiveTiers(tiers);
    setPage(1);
  };

  const handleSortChange = (value: string) => {
    setSort(value);
    setPage(1);
  };

  const handleDateFilterChange = (value: string) => {
    setDateFilter(value);
    setPage(1);
  };

  // Selection handlers
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    const allOnPage = leads.map(l => l.id);
    const allSelected = allOnPage.every(id => selectedIds.has(id));
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (allSelected) {
        allOnPage.forEach(id => next.delete(id));
      } else {
        allOnPage.forEach(id => next.add(id));
      }
      return next;
    });
  };

  // Export selected
  const exportSelected = async () => {
    if (selectedIds.size === 0) return;
    const res = await fetch('/api/leads/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedIds) }),
    });
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `linkedin-leads-selected-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Tag operations
  const createTag = async () => {
    if (!newTagName.trim()) return;
    await fetch('/api/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newTagName.trim(), color: newTagColor }),
    });
    setNewTagName('');
    fetchTags();
  };

  const applyTag = async (tagId: number) => {
    if (selectedIds.size === 0) return;
    await fetch('/api/contacts/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactIds: Array.from(selectedIds), tagId, action: 'add' }),
    });
    fetchTagMappings();
    setShowTagMenu(false);
  };

  const removeTag = async (tagId: number) => {
    if (selectedIds.size === 0) return;
    await fetch('/api/contacts/tags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contactIds: Array.from(selectedIds), tagId, action: 'remove' }),
    });
    fetchTagMappings();
  };

  // Enrich selected contacts
  const enrichSelected = async () => {
    if (selectedIds.size === 0 || enriching) return;
    setEnriching(true);
    setEnrichResult(null);
    try {
      const ids = Array.from(selectedIds);
      // Process in batches of 25
      let totalSuccess = 0;
      let totalFailed = 0;
      for (let i = 0; i < ids.length; i += 25) {
        const batch = ids.slice(i, i + 25);
        const res = await fetch('/api/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contactIds: batch }),
        });
        if (res.ok) {
          const data = await res.json();
          totalSuccess += data.success || 0;
          totalFailed += data.failed || 0;
        }
      }
      setEnrichResult({ success: totalSuccess, failed: totalFailed });
      // Auto-trigger company enrichment for newly enriched contacts
      if (totalSuccess > 0) {
        const enrichedLeads = leads.filter(l => ids.includes(l.id));
        const companyNames = [...new Set(
          enrichedLeads.map(l => (l.company as string) || '').filter(Boolean)
        )];
        if (companyNames.length > 0) {
          fetch('/api/enrich-company', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ companyNames }),
          }).catch(console.error);
        }
      }
      fetchLeads();
      setTimeout(() => setEnrichResult(null), 5000);
    } catch (err) {
      console.error('Enrichment failed:', err);
    } finally {
      setEnriching(false);
    }
  };

  // Enrich company revenue data
  const enrichCompanies = async () => {
    if (enrichingCompanies) return;
    setEnrichingCompanies(true);
    setCompanyEnrichResult(null);
    try {
      const companyNames = [...new Set(
        leads
          .map(l => (l.company as string) || '')
          .filter(Boolean)
      )];
      if (companyNames.length === 0) return;
      const res = await fetch('/api/enrich-company', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ companyNames }),
      });
      if (res.ok) {
        const data = await res.json();
        setCompanyEnrichResult({ enriched: data.enriched || 0 });
        fetchLeads();
        setTimeout(() => setCompanyEnrichResult(null), 5000);
      }
    } catch (err) {
      console.error('Company enrichment failed:', err);
    } finally {
      setEnrichingCompanies(false);
    }
  };

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-48px)]">
        <Loader2 className="animate-spin text-[var(--accent)]" size={24} />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <MetricsRow stats={stats} />

      <div className="flex items-start gap-3">
        <div className="flex-1">
          <FilterBar
            search={search}
            onSearchChange={handleSearchChange}
            activeTiers={activeTiers}
            onTiersChange={handleTiersChange}
            sort={sort}
            onSortChange={handleSortChange}
            total={total}
            dateFilter={dateFilter}
            onDateFilterChange={handleDateFilterChange}
          />
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={enrichCompanies}
            disabled={enrichingCompanies || leads.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:border-[var(--border-light)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap disabled:opacity-50"
          >
            {enrichingCompanies ? <Loader2 size={14} className="animate-spin" /> : <Building2 size={14} />}
            {enrichingCompanies ? 'Enriching...' : 'Enrich Companies'}
          </button>
          {companyEnrichResult && (
            <span className="text-xs text-green-400 animate-fade-in whitespace-nowrap">
              {companyEnrichResult.enriched} enriched
            </span>
          )}
          <a
            href={`/api/leads/export?tiers=${activeTiers.join(',')}`}
            download
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:border-[var(--border-light)] hover:text-[var(--text-primary)] transition-colors whitespace-nowrap"
          >
            <Download size={14} />
            Export All
          </a>
        </div>
      </div>

      {/* Selection action bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-[var(--accent-muted)] border border-[var(--accent)]/30 animate-fade-in">
          <span className="text-sm font-medium">
            {selectedIds.size} selected
          </span>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
          >
            Clear
          </button>
          <div className="h-4 w-px bg-[var(--border)]" />

          <button
            onClick={exportSelected}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <Download size={14} />
            Download Selected
          </button>

          <button
            onClick={enrichSelected}
            disabled={enriching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--accent-muted)] border border-[var(--accent)]/30 text-sm text-[var(--accent)] hover:bg-[var(--accent)]/20 transition-colors disabled:opacity-50"
          >
            {enriching ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {enriching ? 'Enriching...' : 'Enrich Selected'}
          </button>

          {enrichResult && (
            <span className="text-xs text-green-400 animate-fade-in">
              {enrichResult.success} enriched{enrichResult.failed > 0 ? `, ${enrichResult.failed} failed` : ''}
            </span>
          )}

          <div className="relative">
            <button
              onClick={() => setShowTagMenu(!showTagMenu)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <Tag size={14} />
              Tag
            </button>

            {showTagMenu && (
              <div className="absolute top-full left-0 mt-1 w-64 z-20 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] shadow-xl p-2 space-y-1 animate-fade-in">
                <div className="flex items-center justify-between px-2 py-1">
                  <span className="text-xs text-[var(--text-tertiary)]">Apply tag to selected</span>
                  <button onClick={() => setShowTagMenu(false)}>
                    <X size={14} className="text-[var(--text-tertiary)]" />
                  </button>
                </div>

                {allTags.map(tag => {
                  // Check if any selected contacts have this tag
                  const someHaveTag = Array.from(selectedIds).some(id =>
                    tagMap.get(id)?.some(t => t.tag_id === tag.id)
                  );
                  return (
                    <div key={tag.id} className="flex items-center justify-between">
                      <button
                        onClick={() => applyTag(tag.id)}
                        className="flex-1 flex items-center gap-2 px-2 py-1.5 rounded text-sm hover:bg-[var(--bg-hover)] text-left"
                      >
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: tag.color }} />
                        {tag.name}
                      </button>
                      {someHaveTag && (
                        <button
                          onClick={() => removeTag(tag.id)}
                          className="px-1.5 py-0.5 rounded text-xs text-[var(--text-tertiary)] hover:text-[var(--danger)] hover:bg-[var(--bg-hover)]"
                        >
                          remove
                        </button>
                      )}
                    </div>
                  );
                })}

                <div className="border-t border-[var(--border)] pt-2 mt-1">
                  <div className="flex items-center gap-2">
                    <div className="flex gap-1">
                      {TAG_COLORS.map(c => (
                        <button
                          key={c}
                          onClick={() => setNewTagColor(c)}
                          className={`w-4 h-4 rounded-full transition-transform ${newTagColor === c ? 'ring-2 ring-white/50 scale-110' : ''}`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <input
                      type="text"
                      value={newTagName}
                      onChange={e => setNewTagName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && createTag()}
                      placeholder="New tag name..."
                      className="flex-1 px-2 py-1 rounded bg-[var(--bg-tertiary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none"
                    />
                    <button
                      onClick={createTag}
                      disabled={!newTagName.trim()}
                      className="p-1 rounded bg-[var(--accent)] text-white disabled:opacity-30"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="animate-spin text-[var(--accent)]" size={24} />
        </div>
      ) : leads.length === 0 ? (
        <div className="text-center py-12 text-[var(--text-tertiary)]">
          No leads found. Try adjusting your filters.
        </div>
      ) : (
        <LeadsTable
          leads={leads as never}
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleAll={toggleAll}
          tagMap={tagMap}
        />
      )}
    </div>
  );
}
