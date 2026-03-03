import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/supabase';
import { parseMessages, detectSignalWords } from '@/lib/parsers/messages';
import { parseConnections } from '@/lib/parsers/connections';
import { runScoring, ConversationRow, MessageRow } from '@/lib/scoring';

export async function PUT() {
  try {
    const supabase = getSupabase();

    // Fetch all conversations with contact info
    const { data: conversations, error: convError } = await supabase
      .from('conversations')
      .select('id, contact_id, is_group, first_message_at, last_message_at, message_count')
      .not('contact_id', 'is', null);

    if (convError) throw convError;

    // Map to scoring interface
    const convRows: ConversationRow[] = (conversations || []).map(c => ({
      conversation_id: c.id,
      contact_id: c.contact_id,
      is_group: c.is_group,
      first_message_at: c.first_message_at,
      last_message_at: c.last_message_at,
      message_count: c.message_count,
    }));

    // Fetch all messages for these conversations
    const convIds = convRows.map(c => c.conversation_id);

    // Supabase has a URL length limit, so batch if many conversations
    let allMessages: MessageRow[] = [];
    const batchSize = 200;
    for (let i = 0; i < convIds.length; i += batchSize) {
      const batch = convIds.slice(i, i + batchSize);
      const { data: msgs, error: msgError } = await supabase
        .from('messages')
        .select('conversation_id, content, is_from_user, sent_at, has_signal_words, signal_words_found')
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

    // Run pure scoring
    const { scores, tiers } = runScoring(convRows, allMessages);

    // Clear existing scores
    await supabase.from('lead_scores').delete().neq('contact_id', -1);

    // Upsert scores in batches
    for (let i = 0; i < scores.length; i += 500) {
      const batch = scores.slice(i, i + 500);
      const { error: upsertError } = await supabase
        .from('lead_scores')
        .upsert(batch, { onConflict: 'contact_id' });
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

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const messagesFile = formData.get('messages') as File | null;
    const connectionsFile = formData.get('connections') as File | null;
    const userName = (formData.get('userName') as string) || '';
    const userUrl = (formData.get('userUrl') as string) || '';

    if (!messagesFile) {
      return NextResponse.json({ error: 'messages.csv is required' }, { status: 400 });
    }

    const supabase = getSupabase();

    // Clear all existing data (order matters for foreign keys)
    await supabase.from('messages').delete().neq('id', -1);
    await supabase.from('lead_scores').delete().neq('contact_id', -1);
    await supabase.from('conversations').delete().neq('id', '');
    await supabase.from('contact_tags').delete().neq('contact_id', -1);
    await supabase.from('contacts').delete().neq('id', -1);
    await supabase.from('chat_history').delete().neq('id', -1);

    // Save user identity
    await supabase.from('settings').upsert([
      { key: 'user_name', value: userName },
      { key: 'user_url', value: userUrl },
    ], { onConflict: 'key' });

    // --- Parse connections first ---
    let connectionCount = 0;
    if (connectionsFile) {
      const connText = await connectionsFile.text();
      const connections = parseConnections(connText);

      // Batch upsert contacts from connections
      const contactRows = connections.map(c => ({
        full_name: `${c.firstName} ${c.lastName}`.trim(),
        first_name: c.firstName || null,
        last_name: c.lastName || null,
        linkedin_url: c.url || null,
        email: c.email || null,
        company: c.company || null,
        position: c.position || null,
        connected_on: c.connectedOn || null,
      }));

      // Insert in batches (Supabase recommends <=1000 rows per request)
      for (let i = 0; i < contactRows.length; i += 500) {
        const batch = contactRows.slice(i, i + 500);
        const { error } = await supabase
          .from('contacts')
          .upsert(batch, { onConflict: 'linkedin_url', ignoreDuplicates: true });
        if (error) throw error;
      }

      connectionCount = connections.length;
    }

    // --- Parse messages ---
    const msgText = await messagesFile.text();
    const messages = parseMessages(msgText);

    // Group messages by conversation
    const conversationMap = new Map<string, typeof messages>();
    for (const msg of messages) {
      const existing = conversationMap.get(msg.conversationId) || [];
      existing.push(msg);
      conversationMap.set(msg.conversationId, existing);
    }

    // Determine user identity from settings or most frequent sender
    const userUrlNorm = userUrl.replace(/\/$/, '').toLowerCase();
    const userNameNorm = userName.toLowerCase();

    const isFromUser = (msg: { from: string; senderProfileUrl: string }): boolean => {
      if (userUrlNorm && msg.senderProfileUrl.toLowerCase().replace(/\/$/, '') === userUrlNorm) return true;
      if (userNameNorm && msg.from.toLowerCase() === userNameNorm) return true;
      return false;
    };

    // Detect group conversations (multiple unique non-user participants)
    const isGroupConversation = (msgs: typeof messages): boolean => {
      const participants = new Set<string>();
      for (const m of msgs) {
        if (!isFromUser(m)) {
          participants.add(m.senderProfileUrl || m.from);
        }
        const recipients = m.recipientProfileUrls.split(',').filter(Boolean);
        for (const r of recipients) {
          if (r.trim().toLowerCase().replace(/\/$/, '') !== userUrlNorm) {
            participants.add(r.trim());
          }
        }
      }
      return participants.size > 1;
    };

    let messageCount = 0;
    let conversationCount = 0;

    for (const [convId, msgs] of conversationMap) {
      const isGroup = isGroupConversation(msgs);
      const sorted = msgs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      // Find the main contact (non-user participant)
      let contactUrl = '';
      let contactName = '';
      for (const m of sorted) {
        if (!isFromUser(m) && m.senderProfileUrl) {
          contactUrl = m.senderProfileUrl;
          contactName = m.from;
          break;
        }
      }

      // Create contact if not exists, then look up ID
      let contactId: number | null = null;
      if (contactUrl) {
        // Upsert the contact (may already exist from connections)
        await supabase
          .from('contacts')
          .upsert(
            { full_name: contactName, linkedin_url: contactUrl },
            { onConflict: 'linkedin_url', ignoreDuplicates: true }
          );

        const { data: contactRow } = await supabase
          .from('contacts')
          .select('id')
          .eq('linkedin_url', contactUrl)
          .single();

        contactId = contactRow?.id || null;
      }

      // Insert conversation
      const { error: convError } = await supabase
        .from('conversations')
        .insert({
          id: convId,
          contact_id: contactId,
          is_group: isGroup,
          message_count: sorted.length,
          first_message_at: sorted[0]?.date || null,
          last_message_at: sorted[sorted.length - 1]?.date || null,
        });
      if (convError) {
        // Skip duplicate conversations
        if (!convError.message.includes('duplicate')) throw convError;
        continue;
      }

      // Batch insert messages for this conversation
      const messageRows = sorted.map(msg => {
        const signals = detectSignalWords(msg.content);
        return {
          conversation_id: convId,
          sender_name: msg.from,
          sender_url: msg.senderProfileUrl,
          content: msg.content,
          sent_at: msg.date,
          is_from_user: isFromUser(msg),
          has_signal_words: signals.length > 0,
          signal_words_found: signals.length > 0 ? signals.join(',') : null,
        };
      });

      // Insert messages in batches
      for (let i = 0; i < messageRows.length; i += 500) {
        const batch = messageRows.slice(i, i + 500);
        const { error: msgError } = await supabase.from('messages').insert(batch);
        if (msgError) throw msgError;
      }

      messageCount += sorted.length;
      conversationCount++;
    }

    return NextResponse.json({
      success: true,
      stats: {
        connections: connectionCount,
        messages: messageCount,
        conversations: conversationCount,
      }
    });
  } catch (error) {
    console.error('Import error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Import failed' },
      { status: 500 }
    );
  }
}
