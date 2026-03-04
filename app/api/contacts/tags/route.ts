import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/supabase';
import { getUserId } from '@/lib/auth/getUserId';

// POST toggle tag on a contact (or batch of contacts)
export async function POST(req: NextRequest) {
  const auth = await getUserId();
  if ('error' in auth) return auth.error;
  const userId = auth.userId;

  try {
    const supabase = getSupabase();
    const { contactIds, tagId, action } = await req.json();

    if (!contactIds?.length || !tagId) {
      return NextResponse.json({ error: 'contactIds and tagId required' }, { status: 400 });
    }

    const ids: number[] = Array.isArray(contactIds) ? contactIds : [contactIds];

    if (action === 'remove') {
      for (const cid of ids) {
        const { error } = await supabase
          .from('ns_contact_tags')
          .delete()
          .eq('user_id', userId)
          .eq('contact_id', cid)
          .eq('tag_id', tagId);
        if (error) {
          console.error('Tag remove error:', error);
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
    } else {
      for (const cid of ids) {
        const { error } = await supabase
          .from('ns_contact_tags')
          .insert({ user_id: userId, contact_id: cid, tag_id: tagId });
        if (error) {
          // Ignore duplicate key errors (already tagged)
          if (error.code === '23505') continue;
          console.error('Tag apply error:', { error, userId, contactId: cid, tagId });
          return NextResponse.json({ error: error.message }, { status: 500 });
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Failed' }, { status: 500 });
  }
}

// GET tags for specific contact(s)
export async function GET(req: NextRequest) {
  const auth = await getUserId();
  if ('error' in auth) return auth.error;
  const userId = auth.userId;

  try {
    const supabase = getSupabase();
    const url = new URL(req.url);
    const contactId = url.searchParams.get('contactId');

    if (contactId) {
      const { data: mappings } = await supabase
        .from('ns_contact_tags')
        .select('tag_id, ns_tags(*)')
        .eq('user_id', userId)
        .eq('contact_id', parseInt(contactId));

      const tags = (mappings || []).map(m => m.ns_tags).filter(Boolean);
      return NextResponse.json(tags);
    }

    const { data: mappings } = await supabase
      .from('ns_contact_tags')
      .select('contact_id, tag_id, ns_tags(name, color)')
      .eq('user_id', userId);

    const result = (mappings || []).map(m => {
      const tag = m.ns_tags as unknown as { name: string; color: string } | null;
      return {
        contact_id: m.contact_id,
        tag_id: m.tag_id,
        name: tag?.name || '',
        color: tag?.color || '',
      };
    });

    return NextResponse.json(result);
  } catch {
    return NextResponse.json([]);
  }
}
