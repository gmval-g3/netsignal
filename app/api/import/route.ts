import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/supabase';
import { runScoring, ConversationRow, MessageRow } from '@/lib/scoring';
import { getUserId } from '@/lib/auth/getUserId';

// PUT: Run scoring on all imported data
export async function PUT() {
  const auth = await getUserId();
  if ('error' in auth) return auth.error;
  const userId = auth.userId;

  try {
    const supabase = getSupabase();

    const { data: conversations, error: convError } = await supabase
      .from('ns_conversations')
      .select('id, contact_id, is_group, first_message_at, last_message_at, message_count')
      .eq('user_id', userId)
      .not('contact_id', 'is', null);

    if (convError) throw convError;

    const convRows: ConversationRow[] = (conversations || []).map(c => ({
      conversation_id: c.id,
      contact_id: c.contact_id,
      is_group: c.is_group,
      first_message_at: c.first_message_at,
      last_message_at: c.last_message_at,
      message_count: c.message_count,
    }));

    const convIds = convRows.map(c => c.conversation_id);

    let allMessages: MessageRow[] = [];
    const batchSize = 200;
    for (let i = 0; i < convIds.length; i += batchSize) {
      const batch = convIds.slice(i, i + batchSize);
      const { data: msgs, error: msgError } = await supabase
        .from('ns_messages')
        .select('conversation_id, content, is_from_user, sent_at, has_signal_words, signal_words_found')
        .eq('user_id', userId)
        .in('conversation_id', batch)
        .order('sent_at', { ascending: true });

      if (msgError) throw msgError;

      const msgRows: MessageRow[] = (msgs || []).map(m => ({
        conversation_id: m.conversation_id,
        content: m.content,
        is_from_user: m.is_from_user,
        sent_at: m.sent_at,
        has_signal_words: m.has_signal_words,
        signal_words_found: m.signal_words_found,
      }));
      allMessages = allMessages.concat(msgRows);
    }

    const { scores, tiers } = runScoring(convRows, allMessages);

    await supabase.from('ns_lead_scores').delete().eq('user_id', userId);

    const scoredRows = scores.map(s => ({ ...s, user_id: userId }));
    for (let i = 0; i < scoredRows.length; i += 500) {
      const batch = scoredRows.slice(i, i + 500);
      const { error: upsertError } = await supabase
        .from('ns_lead_scores')
        .upsert(batch, { onConflict: 'user_id,contact_id' });
      if (upsertError) throw upsertError;
    }

    return NextResponse.json({ success: true, tiers });
  } catch (error) {
    console.error('Scoring error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Scoring failed' },
      { status: 500 }
    );
  }
}

// POST: Batched import operations (called multiple times from client)
export async function POST(req: NextRequest) {
  const auth = await getUserId();
  if ('error' in auth) return auth.error;
  const userId = auth.userId;

  try {
    const supabase = getSupabase();
    const body = await req.json();

    switch (body.action) {
      case 'clear': {
        // Full wipe: clear all data for this user
        await supabase.from('ns_messages').delete().eq('user_id', userId);
        await supabase.from('ns_lead_scores').delete().eq('user_id', userId);
        await supabase.from('ns_conversations').delete().eq('user_id', userId);
        await supabase.from('ns_contact_tags').delete().eq('user_id', userId);
        await supabase.from('ns_enriched_contacts').delete().eq('user_id', userId);
        await supabase.from('ns_contacts').delete().eq('user_id', userId);
        await supabase.from('ns_chat_history').delete().eq('user_id', userId);

        if (body.userName || body.userUrl) {
          await supabase.from('ns_settings').upsert([
            { user_id: userId, key: 'user_name', value: body.userName || '' },
            { user_id: userId, key: 'user_url', value: body.userUrl || '' },
          ], { onConflict: 'user_id,key' });
        }

        return NextResponse.json({ success: true });
      }

      case 'refresh': {
        // Incremental: save settings, keep enrichment/tags intact
        if (body.userName || body.userUrl) {
          await supabase.from('ns_settings').upsert([
            { user_id: userId, key: 'user_name', value: body.userName || '' },
            { user_id: userId, key: 'user_url', value: body.userUrl || '' },
          ], { onConflict: 'user_id,key' });
        }
        return NextResponse.json({ success: true });
      }

      case 'contacts': {
        const rows = body.batch as Array<{
          full_name: string; first_name: string | null; last_name: string | null;
          linkedin_url: string | null; email: string | null;
          company: string | null; position: string | null; connected_on: string | null;
        }>;

        if (rows.length > 0) {
          const rowsWithUser = rows.map(r => ({ ...r, user_id: userId }));
          // ignoreDuplicates=false in refresh mode so contact info gets updated
          const ignoreDuplicates = body.mode !== 'refresh';
          const { error } = await supabase
            .from('ns_contacts')
            .upsert(rowsWithUser, { onConflict: 'user_id,linkedin_url', ignoreDuplicates });
          if (error) throw error;
        }

        return NextResponse.json({ success: true, count: rows.length });
      }

      case 'lookup': {
        const { data, error } = await supabase
          .from('ns_contacts')
          .select('id, linkedin_url')
          .eq('user_id', userId)
          .not('linkedin_url', 'is', null);
        if (error) throw error;

        const map: Record<string, number> = {};
        for (const row of data || []) {
          if (row.linkedin_url) map[row.linkedin_url] = row.id;
        }
        return NextResponse.json(map);
      }

      case 'conversations': {
        const items = body.batch as Array<{
          id: string;
          contact_id: number | null;
          is_group: boolean;
          message_count: number;
          first_message_at: string | null;
          last_message_at: string | null;
          messages: Array<{
            sender_name: string; sender_url: string; content: string;
            sent_at: string; is_from_user: boolean;
            has_signal_words: boolean; signal_words_found: string | null;
          }>;
        }>;

        const isRefresh = body.mode === 'refresh';
        const convIds = items.map(c => c.id);

        if (isRefresh) {
          // Delete old messages for these conversations so we can re-insert fresh data
          for (let i = 0; i < convIds.length; i += 200) {
            const batch = convIds.slice(i, i + 200);
            await supabase
              .from('ns_messages')
              .delete()
              .eq('user_id', userId)
              .in('conversation_id', batch);
          }
        }

        // Upsert conversations (update metadata in refresh mode)
        const convRows = items.map(conv => ({
          id: conv.id,
          user_id: userId,
          contact_id: conv.contact_id,
          is_group: conv.is_group,
          message_count: conv.message_count,
          first_message_at: conv.first_message_at,
          last_message_at: conv.last_message_at,
        }));

        const { error: convError } = await supabase
          .from('ns_conversations')
          .upsert(convRows, { onConflict: 'user_id,id', ignoreDuplicates: !isRefresh });
        if (convError) throw convError;

        // Insert all messages
        const allMsgRows: Array<Record<string, unknown>> = [];
        for (const conv of items) {
          for (const m of conv.messages) {
            allMsgRows.push({ conversation_id: conv.id, user_id: userId, ...m });
          }
        }

        for (let i = 0; i < allMsgRows.length; i += 1000) {
          const batch = allMsgRows.slice(i, i + 1000);
          const { error: msgError } = await supabase.from('ns_messages').insert(batch);
          if (msgError) throw msgError;
        }

        return NextResponse.json({ success: true, count: items.length });
      }

      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    );
  }
}
