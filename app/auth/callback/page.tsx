'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/db/client';

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const supabase = createBrowserSupabase();

    const handleCallback = async () => {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          console.error('Auth callback error:', error.message);
          router.replace('/login?error=auth_failed');
          return;
        }
      }

      // Check session (handles both PKCE code exchange and implicit hash flow)
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        router.replace('/');
      } else {
        router.replace('/login?error=auth_failed');
      }
    };

    handleCallback();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen"
         style={{ background: 'var(--bg-primary)' }}>
      <div className="text-[var(--text-secondary)] animate-pulse">Signing in...</div>
    </div>
  );
}
