'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ExternalLink, Mail, Building2, Briefcase, Calendar, Loader2, Sparkles, MapPin, Users, UserPlus } from 'lucide-react';

interface Contact {
  id: number;
  full_name: string;
  first_name: string;
  last_name: string;
  linkedin_url: string;
  email: string;
  company: string;
  position: string;
  connected_on: string;
  total_score: number;
  tier: string;
  reciprocity_score: number;
  frequency_score: number;
  depth_score: number;
  signal_score: number;
  recency_score: number;
  total_messages: number;
  user_messages: number;
  contact_messages: number;
  last_message_at: string;
}

interface Message {
  sender_name: string;
  content: string;
  sent_at: string;
  is_from_user: number;
  has_signal_words: number;
  signal_words_found: string | null;
}

interface Enrichment {
  headline: string | null;
  bio: string | null;
  current_title: string | null;
  current_company: string | null;
  company_url: string | null;
  profile_picture_url: string | null;
  location: string | null;
  connections: number | null;
  followers: number | null;
  enriched_at: string | null;
}

const SCORE_LABELS = [
  { key: 'reciprocity_score', label: 'Reciprocity', weight: '30%', color: '#6366f1' },
  { key: 'recency_score', label: 'Recency', weight: '25%', color: '#8b5cf6' },
  { key: 'frequency_score', label: 'Frequency', weight: '20%', color: '#a855f7' },
  { key: 'signal_score', label: 'Signals', weight: '15%', color: '#d946ef' },
  { key: 'depth_score', label: 'Depth', weight: '10%', color: '#ec4899' },
];

function ScoreBreakdown({ contact }: { contact: Contact }) {
  return (
    <div className="space-y-3">
      {SCORE_LABELS.map((s) => {
        const value = contact[s.key as keyof Contact] as number;
        return (
          <div key={s.key} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-[var(--text-secondary)]">{s.label} <span className="text-[var(--text-tertiary)]">({s.weight})</span></span>
              <span className="font-mono">{value}</span>
            </div>
            <div className="w-full h-2 rounded-full bg-[var(--bg-hover)] overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${value}%`, backgroundColor: s.color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit',
  });
}

export default function ContactDetailPage({ params }: { params: { contactId: string } }) {
  const { contactId } = params;
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [enrichment, setEnrichment] = useState<Enrichment | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/contacts/${contactId}`)
      .then(res => res.json())
      .then(data => {
        setContact(data.contact);
        setMessages(data.messages || []);
        setEnrichment(data.enrichment || null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [contactId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-48px)]">
        <Loader2 className="animate-spin text-[var(--accent)]" size={24} />
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="p-6 text-center text-[var(--text-tertiary)]">Contact not found</div>
    );
  }

  const tierColor = contact.tier === 'hot' ? 'tier-hot' : contact.tier === 'warm' ? 'tier-warm' : 'tier-cold';
  const tierBg = contact.tier === 'hot' ? 'tier-bg-hot' : contact.tier === 'warm' ? 'tier-bg-warm' : 'tier-bg-cold';

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6 animate-fade-in">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-2 text-sm text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
      >
        <ArrowLeft size={16} />
        Back to Leads
      </button>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{contact.full_name}</h1>
            <span className={`px-2.5 py-0.5 rounded-full text-sm font-medium border ${tierBg} ${tierColor}`}>
              {contact.tier}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-2 text-sm text-[var(--text-secondary)]">
            {contact.position && (
              <span className="flex items-center gap-1"><Briefcase size={14} /> {contact.position}</span>
            )}
            {contact.company && (
              <span className="flex items-center gap-1"><Building2 size={14} /> {contact.company}</span>
            )}
            {contact.connected_on && (
              <span className="flex items-center gap-1"><Calendar size={14} /> Connected {contact.connected_on}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {contact.email && (
            <a href={`mailto:${contact.email}`} className="p-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] hover:border-[var(--border-light)] text-[var(--text-secondary)] transition-colors">
              <Mail size={16} />
            </a>
          )}
          {contact.linkedin_url && (
            <a href={contact.linkedin_url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] hover:border-[var(--border-light)] text-[var(--text-secondary)] transition-colors">
              <ExternalLink size={16} />
            </a>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Score card */}
        <div className="lg:col-span-1 space-y-4">
          <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]">
            <div className="text-center mb-4">
              <p className="text-4xl font-bold">{contact.total_score}</p>
              <p className="text-sm text-[var(--text-tertiary)]">Total Score</p>
            </div>
            <ScoreBreakdown contact={contact} />
          </div>

          <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]">
            <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">Message Stats</h3>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div>
                <p className="text-lg font-bold">{contact.total_messages}</p>
                <p className="text-xs text-[var(--text-tertiary)]">Total</p>
              </div>
              <div>
                <p className="text-lg font-bold">{contact.user_messages}</p>
                <p className="text-xs text-[var(--text-tertiary)]">Sent</p>
              </div>
              <div>
                <p className="text-lg font-bold">{contact.contact_messages}</p>
                <p className="text-xs text-[var(--text-tertiary)]">Received</p>
              </div>
            </div>
          </div>

          {enrichment && (
            <div className="p-4 rounded-lg bg-[var(--bg-secondary)] border border-[var(--accent)]/20 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles size={14} className="text-[var(--accent)]" />
                <h3 className="text-sm font-medium text-[var(--text-secondary)]">Enriched Profile</h3>
              </div>

              {enrichment.headline && (
                <p className="text-sm text-[var(--text-primary)]">{enrichment.headline}</p>
              )}

              {enrichment.current_title && enrichment.current_company && (
                <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                  <Briefcase size={13} />
                  <span>{enrichment.current_title} at {enrichment.current_company}</span>
                </div>
              )}

              {enrichment.location && (
                <div className="flex items-center gap-1.5 text-sm text-[var(--text-secondary)]">
                  <MapPin size={13} />
                  <span>{enrichment.location}</span>
                </div>
              )}

              <div className="flex gap-4 text-sm">
                {enrichment.connections != null && (
                  <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                    <Users size={13} />
                    <span>{enrichment.connections.toLocaleString()} connections</span>
                  </div>
                )}
                {enrichment.followers != null && (
                  <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                    <UserPlus size={13} />
                    <span>{enrichment.followers.toLocaleString()} followers</span>
                  </div>
                )}
              </div>

              {enrichment.bio && (
                <div className="pt-2 border-t border-[var(--border)]">
                  <p className="text-xs text-[var(--text-tertiary)] line-clamp-4">{enrichment.bio}</p>
                </div>
              )}

              {enrichment.company_url && (
                <a
                  href={enrichment.company_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-[var(--accent)] hover:underline"
                >
                  <Building2 size={12} />
                  Company Page
                </a>
              )}
            </div>
          )}
        </div>

        {/* Message thread */}
        <div className="lg:col-span-2">
          <div className="rounded-lg bg-[var(--bg-secondary)] border border-[var(--border)]">
            <div className="px-4 py-3 border-b border-[var(--border)]">
              <h3 className="text-sm font-medium text-[var(--text-secondary)]">
                Conversation ({messages.length} messages)
              </h3>
            </div>
            <div className="max-h-[600px] overflow-y-auto p-4 space-y-3">
              {[...messages].reverse().map((msg, i) => (
                <div
                  key={i}
                  className={`flex flex-col ${msg.is_from_user ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-lg p-3 text-sm ${
                      msg.is_from_user
                        ? 'bg-[var(--accent-muted)] text-[var(--text-primary)]'
                        : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'
                    } ${msg.has_signal_words ? 'border border-amber-500/30' : ''}`}
                  >
                    <p className="text-xs text-[var(--text-tertiary)] mb-1">
                      {msg.sender_name} &middot; {formatTime(msg.sent_at)}
                    </p>
                    <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    {msg.signal_words_found && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {msg.signal_words_found.split(',').map((w, j) => (
                          <span key={j} className="px-1.5 py-0.5 rounded text-xs bg-amber-500/15 text-amber-400">
                            {w}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {messages.length === 0 && (
                <p className="text-center text-[var(--text-tertiary)] py-8">No messages found</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
