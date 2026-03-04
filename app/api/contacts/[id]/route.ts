import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/supabase';
import { getUserId } from '@/lib/auth/getUserId';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const auth = await getUserId();
  if ('error' in auth) return auth.error;
  const userId = auth.userId;

  try {
    const { id } = params;
    const supabase = getSupabase();
    const contactId = parseInt(id);

    const { data: contactData, error: contactError } = await supabase
      .from('ns_contacts')
      .select(`
        *,
        ns_lead_scores(
          total_score, tier, reciprocity_score, frequency_score,
          depth_score, signal_score, recency_score,
          total_messages, user_messages, contact_messages, last_message_at
        )
      `)
      .eq('id', contactId)
      .eq('user_id', userId)
      .single();

    if (contactError || !contactData) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 });
    }

    const leadScore = Array.isArray(contactData.ns_lead_scores)
      ? contactData.ns_lead_scores[0]
      : contactData.ns_lead_scores;

    const contact = {
      ...contactData,
      total_score: leadScore?.total_score ?? null,
      tier: leadScore?.tier ?? null,
      reciprocity_score: leadScore?.reciprocity_score ?? null,
      frequency_score: leadScore?.frequency_score ?? null,
      depth_score: leadScore?.depth_score ?? null,
      signal_score: leadScore?.signal_score ?? null,
      recency_score: leadScore?.recency_score ?? null,
      total_messages: leadScore?.total_messages ?? null,
      user_messages: leadScore?.user_messages ?? null,
      contact_messages: leadScore?.contact_messages ?? null,
      last_message_at: leadScore?.last_message_at ?? null,
    };
    delete (contact as Record<string, unknown>).ns_lead_scores;

    const { data: conversations } = await supabase
      .from('ns_conversations')
      .select('id, message_count, first_message_at, last_message_at, is_group')
      .eq('user_id', userId)
      .eq('contact_id', contactId)
      .order('last_message_at', { ascending: false });

    const convIds = (conversations || []).map(c => c.id);
    let messages: unknown[] = [];

    if (convIds.length > 0) {
      const { data: msgData } = await supabase
        .from('ns_messages')
        .select('sender_name, content, sent_at, is_from_user, has_signal_words, signal_words_found')
        .eq('user_id', userId)
        .in('conversation_id', convIds)
        .order('sent_at', { ascending: false })
        .limit(100);

      messages = msgData || [];
    }

    const { data: enrichmentData } = await supabase
      .from('ns_enriched_contacts')
      .select('*')
      .eq('user_id', userId)
      .eq('contact_id', contactId)
      .single();

    return NextResponse.json({
      contact,
      conversations: conversations || [],
      messages,
      enrichment: enrichmentData || null,
    });
  } catch (error) {
    console.error('Contact detail error:', error);
    return NextResponse.json({ error: 'Failed to load contact' }, { status: 500 });
  }
}
