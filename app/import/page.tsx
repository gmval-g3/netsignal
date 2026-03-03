'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Database } from 'lucide-react';
import DropZone from '@/components/import/DropZone';
import ImportProgress from '@/components/import/ImportProgress';
import { parseMessages, detectSignalWords } from '@/lib/parsers/messages';
import { parseConnections } from '@/lib/parsers/connections';

type ImportStatus = 'idle' | 'uploading' | 'processing' | 'scoring' | 'complete' | 'error';

export default function ImportPage() {
  const router = useRouter();
  const [messagesFile, setMessagesFile] = useState<File | null>(null);
  const [connectionsFile, setConnectionsFile] = useState<File | null>(null);
  const [userName, setUserName] = useState('');
  const [userUrl, setUserUrl] = useState('');
  const [status, setStatus] = useState<ImportStatus>('idle');
  const [progress, setProgress] = useState('');
  const [stats, setStats] = useState<{ connections: number; messages: number; conversations: number } | undefined>();
  const [scoreStats, setScoreStats] = useState<{ hot: number; warm: number; cold: number } | undefined>();
  const [error, setError] = useState<string | undefined>();

  const handleImport = useCallback(async () => {
    if (!messagesFile || !userName || !userUrl) return;

    setStatus('uploading');
    setError(undefined);
    setProgress('Parsing CSV files...');

    try {
      // --- Step 1: Parse CSVs client-side ---
      const msgText = await messagesFile.text();
      const messages = parseMessages(msgText);

      let connectionCount = 0;
      let contactRows: Array<{
        full_name: string; first_name: string | null; last_name: string | null;
        linkedin_url: string | null; email: string | null;
        company: string | null; position: string | null; connected_on: string | null;
      }> = [];

      if (connectionsFile) {
        const connText = await connectionsFile.text();
        const connections = parseConnections(connText);
        connectionCount = connections.length;
        contactRows = connections.map(c => ({
          full_name: `${c.firstName} ${c.lastName}`.trim(),
          first_name: c.firstName || null,
          last_name: c.lastName || null,
          linkedin_url: c.url || null,
          email: c.email || null,
          company: c.company || null,
          position: c.position || null,
          connected_on: c.connectedOn || null,
        }));
      }

      setStatus('processing');

      // --- Step 2: Clear existing data + save settings ---
      setProgress('Clearing existing data...');
      const clearRes = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear', userName, userUrl }),
      });
      if (!clearRes.ok) throw new Error((await clearRes.json()).error || 'Clear failed');

      // --- Step 3: Upload contacts in batches ---
      if (contactRows.length > 0) {
        const batchSize = 500;
        for (let i = 0; i < contactRows.length; i += batchSize) {
          const batch = contactRows.slice(i, i + batchSize);
          setProgress(`Importing contacts... ${Math.min(i + batchSize, contactRows.length)}/${contactRows.length}`);
          const res = await fetch('/api/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'contacts', batch }),
          });
          if (!res.ok) throw new Error((await res.json()).error || 'Contact import failed');
        }
      }

      // --- Step 4: Group messages by conversation ---
      setProgress('Processing conversations...');
      const userUrlNorm = userUrl.replace(/\/$/, '').toLowerCase();
      const userNameNorm = userName.toLowerCase();

      const isFromUser = (msg: { from: string; senderProfileUrl: string }): boolean => {
        if (userUrlNorm && msg.senderProfileUrl.toLowerCase().replace(/\/$/, '') === userUrlNorm) return true;
        if (userNameNorm && msg.from.toLowerCase() === userNameNorm) return true;
        return false;
      };

      const conversationMap = new Map<string, typeof messages>();
      for (const msg of messages) {
        const existing = conversationMap.get(msg.conversationId) || [];
        existing.push(msg);
        conversationMap.set(msg.conversationId, existing);
      }

      // Also collect unique contact URLs from messages to upsert
      const msgContactUrls = new Map<string, string>(); // url → name
      for (const [, msgs] of conversationMap) {
        for (const m of msgs) {
          if (!isFromUser(m) && m.senderProfileUrl) {
            msgContactUrls.set(m.senderProfileUrl, m.from);
          }
        }
      }

      // Upsert message-sourced contacts
      const msgContacts = Array.from(msgContactUrls.entries()).map(([url, name]) => ({
        full_name: name,
        first_name: null,
        last_name: null,
        linkedin_url: url,
        email: null,
        company: null,
        position: null,
        connected_on: null,
      }));

      if (msgContacts.length > 0) {
        for (let i = 0; i < msgContacts.length; i += 500) {
          const batch = msgContacts.slice(i, i + 500);
          setProgress(`Importing message contacts... ${Math.min(i + 500, msgContacts.length)}/${msgContacts.length}`);
          const res = await fetch('/api/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'contacts', batch }),
          });
          if (!res.ok) throw new Error((await res.json()).error || 'Contact import failed');
        }
      }

      // --- Step 5: Fetch contact ID map ---
      setProgress('Resolving contacts...');
      const lookupRes = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lookup' }),
      });
      if (!lookupRes.ok) throw new Error('Contact lookup failed');
      const contactIdMap: Record<string, number> = await lookupRes.json();

      // --- Step 6: Prepare and send conversations in batches ---
      const convEntries = Array.from(conversationMap.entries());
      const convBatchSize = 30;
      let messageCount = 0;
      let conversationCount = 0;

      for (let i = 0; i < convEntries.length; i += convBatchSize) {
        const slice = convEntries.slice(i, i + convBatchSize);
        setProgress(`Importing conversations... ${Math.min(i + convBatchSize, convEntries.length)}/${convEntries.length}`);

        const batch = slice.map(([convId, msgs]) => {
          const sorted = msgs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

          // Detect group conversation
          const participants = new Set<string>();
          for (const m of sorted) {
            if (!isFromUser(m)) {
              participants.add(m.senderProfileUrl || m.from);
            }
            const recipients = m.recipientProfileUrls.split(',').filter(Boolean);
            for (const r of recipients) {
              if (r.trim().toLowerCase().replace(/\/$/, '') !== userUrlNorm) {
                participants.add(r.trim());
              }
            }
          }
          const isGroup = participants.size > 1;

          // Find contact
          let contactId: number | null = null;
          for (const m of sorted) {
            if (!isFromUser(m) && m.senderProfileUrl && contactIdMap[m.senderProfileUrl]) {
              contactId = contactIdMap[m.senderProfileUrl];
              break;
            }
          }

          const messageRows = sorted.map(msg => {
            const signals = detectSignalWords(msg.content);
            return {
              sender_name: msg.from,
              sender_url: msg.senderProfileUrl,
              content: msg.content,
              sent_at: msg.date,
              is_from_user: isFromUser(msg),
              has_signal_words: signals.length > 0,
              signal_words_found: signals.length > 0 ? signals.join(',') : null,
            };
          });

          messageCount += sorted.length;
          conversationCount++;

          return {
            id: convId,
            contact_id: contactId,
            is_group: isGroup,
            message_count: sorted.length,
            first_message_at: sorted[0]?.date || null,
            last_message_at: sorted[sorted.length - 1]?.date || null,
            messages: messageRows,
          };
        });

        const res = await fetch('/api/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'conversations', batch }),
        });
        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || 'Conversation import failed');
        }
      }

      setStats({ connections: connectionCount, messages: messageCount, conversations: conversationCount });

      // --- Step 7: Trigger scoring ---
      setStatus('scoring');
      setProgress('Scoring relationships...');
      const scoreRes = await fetch('/api/import', { method: 'PUT' });
      if (scoreRes.ok) {
        const scoreData = await scoreRes.json();
        setScoreStats(scoreData.tiers);
      }

      setStatus('complete');
    } catch (err) {
      console.error('Import error:', err);
      setStatus('error');
      setError(err instanceof Error ? err.message : 'Import failed');
    }
  }, [messagesFile, connectionsFile, userName, userUrl]);

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

            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                {error}
              </div>
            )}

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
              progress={progress}
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
