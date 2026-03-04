import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/supabase';
import { getUserId } from '@/lib/auth/getUserId';

// GET all tags
export async function GET() {
  const auth = await getUserId();
  if ('error' in auth) return auth.error;
  const userId = auth.userId;

  try {
    const supabase = getSupabase();
    const { data: tags } = await supabase
      .from('ns_tags')
      .select('*')
      .eq('user_id', userId)
      .order('name');

    return NextResponse.json(tags || []);
  } catch {
    return NextResponse.json([]);
  }
}

// POST create a new tag
export async function POST(req: NextRequest) {
  const auth = await getUserId();
  if ('error' in auth) return auth.error;
  const userId = auth.userId;

  try {
    const supabase = getSupabase();
    const { name, color } = await req.json();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const { data: tag, error } = await supabase
      .from('ns_tags')
      .insert({ user_id: userId, name: name.trim(), color: color || '#6366f1' })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Tag already exists' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json(tag);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}

// DELETE a tag
export async function DELETE(req: NextRequest) {
  const auth = await getUserId();
  if ('error' in auth) return auth.error;
  const userId = auth.userId;

  try {
    const supabase = getSupabase();
    const { id } = await req.json();

    await supabase.from('ns_contact_tags').delete().eq('user_id', userId).eq('tag_id', id);
    await supabase.from('ns_tags').delete().eq('user_id', userId).eq('id', id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
