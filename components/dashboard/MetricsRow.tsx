'use client';

import { Users, MessageSquare, Flame, TrendingUp } from 'lucide-react';

interface MetricsRowProps {
  stats: {
    totalContacts: number;
    totalMessages: number;
    totalConversations: number;
    tiers: { hot: number; warm: number; cold: number };
    recentMessages: number;
  };
}

export default function MetricsRow({ stats }: MetricsRowProps) {
  const metrics = [
    {
      label: 'Hot Leads',
      value: stats.tiers.hot || 0,
      icon: Flame,
      color: 'text-red-400',
      bgColor: 'bg-red-500/10',
    },
    {
      label: 'Total Conversations',
      value: stats.totalConversations,
      icon: MessageSquare,
      color: 'text-[var(--accent)]',
      bgColor: 'bg-[var(--accent-muted)]',
    },
    {
      label: 'Contacts',
      value: stats.totalContacts,
      icon: Users,
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
    },
    {
      label: 'Recent Messages (2yr)',
      value: stats.recentMessages,
      icon: TrendingUp,
      color: 'text-purple-400',
      bgColor: 'bg-purple-500/10',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((m) => (
        <div
          key={m.label}
          className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)] hover:border-[var(--border-light)] transition-colors"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className={`p-2 rounded-md ${m.bgColor}`}>
              <m.icon size={16} className={m.color} />
            </div>
            <span className="text-sm text-[var(--text-secondary)]">{m.label}</span>
          </div>
          <p className="text-2xl font-bold">{m.value.toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}
