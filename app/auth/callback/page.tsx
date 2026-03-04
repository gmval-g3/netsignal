'use client';

import { useEffect } from 'react';
import { createBrowserSupabase } from '@/lib/db/client';

export default function AuthCallback() {
  useEffect(() => {
    const supabase = createBrowserSupabase();

    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error('Auth callback error:', error.message);
          window.location.href = '/login?error=auth_failed';
          return;
        }
      }

      // Check session (handles both PKCE code exchange and implicit hash flow)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Full page navigation to ensure auth cookies are sent to middleware
        window.location.href = '/';
      } else {
        window.location.href = '/login?error=auth_failed';
      }
    };

    handleCallback();
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen"
         style={{ background: 'var(--bg-primary)' }}>
      <div className="text-[var(--text-secondary)] animate-pulse">Signing in...</div>
    </div>
  );
}
