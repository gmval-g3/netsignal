import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/supabase';

export async function GET() {
  try {
    const supabase = getSupabase();
    const { data: rows } = await supabase
      .from('ns_settings')
      .select('key, value');

    const settings: Record<string, string> = {};
    for (const row of rows || []) {
      // Mask API key for display
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
  try {
    const supabase = getSupabase();
    const body = await req.json();

    if (body.anthropic_api_key !== undefined) {
      await supabase
        .from('ns_settings')
        .upsert({ key: 'anthropic_api_key', value: body.anthropic_api_key }, { onConflict: 'key' });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save settings' },
      { status: 500 }
    );
  }
}
