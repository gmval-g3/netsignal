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
        await supabase
          .from('ns_contact_tags')
          .delete()
          .eq('user_id', userId)
          .eq('contact_id', cid)
          .eq('tag_id', tagId);
      }
    } else {
      const rows = ids.map(cid => ({ user_id: userId, contact_id: cid, tag_id: tagId }));
      await supabase
        .from('ns_contact_tags')
        .upsert(rows, { onConflict: 'user_id,contact_id,tag_id', ignoreDuplicates: true });
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
