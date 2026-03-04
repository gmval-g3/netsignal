import { NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/db/server';

type AuthResult =
  | { userId: string }
  | { error: NextResponse };

export async function getUserId(): Promise<AuthResult> {
  const supabase = createServerSupabase();
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      error: NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      ),
    };
  }

  return { userId: user.id };
}
