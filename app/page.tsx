'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    fetch('/api/stats')
      .then(res => res.json())
      .then(data => {
        if (data.totalContacts > 0) {
          router.replace('/dashboard');
        } else {
          router.replace('/import');
        }
      })
      .catch(() => {
        router.replace('/import');
      });
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-pulse-dot text-[var(--text-secondary)]">Loading...</div>
    </div>
  );
}
