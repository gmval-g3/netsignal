import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/supabase';

// GET all tags
export async function GET() {
  try {
    const supabase = getSupabase();
    const { data: tags } = await supabase
      .from('tags')
      .select('*')
      .order('name');

    return NextResponse.json(tags || []);
  } catch {
    return NextResponse.json([]);
  }
}

// POST create a new tag
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const { name, color } = await req.json();
    if (!name) return NextResponse.json({ error: 'Name required' }, { status: 400 });

    const { data: tag, error } = await supabase
      .from('tags')
      .insert({ name: name.trim(), color: color || '#6366f1' })
      .select()
      .single();

    if (error) {
      // Unique constraint violation = tag already exists
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
  try {
    const supabase = getSupabase();
    const { id } = await req.json();

    // Remove tag from all contacts first, then delete the tag
    await supabase.from('contact_tags').delete().eq('tag_id', id);
    await supabase.from('tags').delete().eq('id', id);

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
