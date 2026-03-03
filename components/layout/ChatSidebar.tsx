'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { PanelLeftClose, Send, Sparkles, RotateCcw } from 'lucide-react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUGGESTIONS = [
  'Who are my strongest connections?',
  'Find people in AI/tech',
  'Who mentioned partnerships?',
  'Show my top 10 leads',
];

export default function ChatSidebar() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;

    const userMsg: Message = { role: 'user', content: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMsg] }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Chat request failed');
      }

      const reader = res.body?.getReader();
      if (!reader) throw new Error('No response stream');

      const decoder = new TextDecoder();
      let assistantContent = '';
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                assistantContent += parsed.text;
                setMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { role: 'assistant', content: assistantContent };
                  return updated;
                });
              }
            } catch {
              // skip non-JSON lines
            }
          }
        }
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Something went wrong'}. Make sure your Anthropic API key is set in Settings.`
      }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    fetch('/api/chat', { method: 'DELETE' });
  };

  return (
    <>
      {/* Toggle button when closed */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed left-4 bottom-4 z-50 p-3 rounded-full bg-[var(--accent)] text-white shadow-lg hover:bg-[var(--accent-hover)] transition-all"
          title="Open AI Chat"
        >
          <Sparkles size={20} />
        </button>
      )}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-12 bottom-0 z-40 bg-[var(--bg-secondary)] border-r border-[var(--border)] flex flex-col transition-all duration-200 ${
          open ? 'w-[320px]' : 'w-0 overflow-hidden'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-[var(--accent)]" />
            <span className="text-sm font-medium">AI Assistant</span>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={clearChat} className="p-1.5 rounded hover:bg-[var(--bg-hover)]" title="Clear chat">
              <RotateCcw size={14} className="text-[var(--text-tertiary)]" />
            </button>
            <button onClick={() => setOpen(false)} className="p-1.5 rounded hover:bg-[var(--bg-hover)]" title="Close">
              <PanelLeftClose size={14} className="text-[var(--text-tertiary)]" />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.length === 0 && (
            <div className="space-y-3 mt-4">
              <p className="text-sm text-[var(--text-tertiary)] text-center">
                Ask me about your LinkedIn network
              </p>
              <div className="space-y-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => sendMessage(s)}
                    className="w-full text-left px-3 py-2 rounded-lg text-sm text-[var(--text-secondary)] bg-[var(--bg-tertiary)] hover:bg-[var(--bg-hover)] border border-[var(--border)] transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`text-sm rounded-lg p-3 ${
                msg.role === 'user'
                  ? 'bg-[var(--accent-muted)] text-[var(--text-primary)] ml-4'
                  : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)] mr-4'
              }`}
            >
              <div className="whitespace-pre-wrap break-words">{msg.content}</div>
            </div>
          ))}

          {loading && messages[messages.length - 1]?.role !== 'assistant' && (
            <div className="flex items-center gap-1 p-3">
              <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse-dot" />
              <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse-dot" style={{ animationDelay: '0.2s' }} />
              <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse-dot" style={{ animationDelay: '0.4s' }} />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-3 border-t border-[var(--border)]">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your network..."
              rows={1}
              className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-tertiary)] border border-[var(--border)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] resize-none focus:outline-none focus:border-[var(--accent)]"
              style={{ maxHeight: '80px' }}
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || loading}
              className="p-2 rounded-lg bg-[var(--accent)] text-white disabled:opacity-30 hover:bg-[var(--accent-hover)] transition-colors"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
