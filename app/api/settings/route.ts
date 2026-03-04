import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/supabase';
import { getUserId } from '@/lib/auth/getUserId';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await getUserId();
  if ('error' in auth) return auth.error;
  const userId = auth.userId;

  try {
    const supabase = getSupabase();
    const { data: rows } = await supabase
      .from('ns_settings')
      .select('key, value')
      .eq('user_id', userId);

    const settings: Record<string, string> = {};
    for (const row of rows || []) {
      if (row.key === 'anthropic_api_key' && row.value) {
        settings[row.key] = row.value.substring(0, 10) + '...' + row.value.substring(row.value.length - 4);
        settings['has_api_key'] = 'true';
      } else {
        settings[row.key] = row.value;
      }
    }
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json({});
  }
}

export async function PUT(req: NextRequest) {
  const auth = await getUserId();
  if ('error' in auth) return auth.error;
  const userId = auth.userId;

  try {
    const supabase = getSupabase();
    const body = await req.json();

    if (body.anthropic_api_key !== undefined) {
      await supabase
        .from('ns_settings')
        .upsert({ user_id: userId, key: 'anthropic_api_key', value: body.anthropic_api_key }, { onConflict: 'user_id,key' });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save settings' },
      { status: 500 }
    );
  }
}
