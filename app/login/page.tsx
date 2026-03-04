'use client';

import { useState } from 'react';
import { createBrowserSupabase } from '@/lib/db/client';
import { BarChart3, Mail, ArrowRight, CheckCircle } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const supabase = createBrowserSupabase();
    const { error: authError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    setLoading(false);
    if (authError) {
      setError(authError.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
         style={{ background: 'var(--bg-primary)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <BarChart3 size={28} style={{ color: 'var(--accent)' }} />
          <span className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
            NetSignal
          </span>
        </div>

        {sent ? (
          <div className="rounded-lg p-6 text-center animate-fade-in"
               style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <CheckCircle size={40} className="mx-auto mb-3" style={{ color: 'var(--success)' }} />
            <h2 className="text-lg font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
              Check your email
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              We sent a magic link to <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>.
              Click the link to sign in.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}
                className="rounded-lg p-6"
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
            <h2 className="text-lg font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              Sign in
            </h2>
            <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
              Enter your email to receive a magic link.
            </p>

            {error && (
              <div className="text-sm mb-4 px-3 py-2 rounded"
                   style={{ color: 'var(--danger)', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                {error}
              </div>
            )}

            <label className="block mb-4">
              <span className="text-xs font-medium mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                Email address
              </span>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2"
                      style={{ color: 'var(--text-tertiary)' }} />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-9 pr-3 py-2 rounded text-sm outline-none transition-colors"
                  style={{
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={(e) => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
            </label>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2 rounded text-sm font-medium transition-colors disabled:opacity-50"
              style={{
                background: 'var(--accent)',
                color: '#fff',
              }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.background = 'var(--accent-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--accent)')}
            >
              {loading ? 'Sending...' : (
                <>Send Magic Link <ArrowRight size={14} /></>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
