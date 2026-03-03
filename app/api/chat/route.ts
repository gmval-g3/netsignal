import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabase } from '@/lib/db/supabase';
import { SYSTEM_PROMPT, TOOLS } from '@/lib/chatbot/prompt';

async function getApiKey(): Promise<string | null> {
  try {
    const supabase = getSupabase();
    const { data } = await supabase
      .from('ns_settings')
      .select('value')
      .eq('key', 'anthropic_api_key')
      .single();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data as any)?.value || process.env.ANTHROPIC_API_KEY || null;
  } catch {
    return process.env.ANTHROPIC_API_KEY || null;
  }
}

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
  const supabase = getSupabase();

  switch (name) {
    case 'search_contacts': {
      const query = input.query as string || '';
      const tier = input.tier as string || 'all';
      const limit = (input.limit as number) || 10;

      let q = supabase
        .from('ns_lead_scores')
        .select(`
          contact_id,
          total_score, tier, total_messages, user_messages, contact_messages,
          last_message_at, reciprocity_score, recency_score,
          ns_contacts!inner(id, full_name, company, position, email)
        `)
        .order('total_score', { ascending: false })
        .limit(limit);

      if (query) {
        q = q.or(
          `full_name.ilike.%${query}%,company.ilike.%${query}%,position.ilike.%${query}%`,
          { referencedTable: 'ns_contacts' }
        );
      }
      if (tier && tier !== 'all') {
        q = q.eq('tier', tier);
      }

      const { data } = await q;

      // Flatten for the LLM
      const results = (data || []).map(row => {
        const c = row.ns_contacts as unknown as {
          id: number; full_name: string; company: string; position: string; email: string;
        };
        return {
          id: c.id,
          full_name: c.full_name,
          company: c.company,
          position: c.position,
          email: c.email,
          total_score: row.total_score,
          tier: row.tier,
          total_messages: row.total_messages,
          user_messages: row.user_messages,
          contact_messages: row.contact_messages,
          last_message_at: row.last_message_at,
          reciprocity_score: row.reciprocity_score,
          recency_score: row.recency_score,
        };
      });

      return JSON.stringify(results);
    }

    case 'search_messages': {
      const query = input.query as string;
      const limit = (input.limit as number) || 20;

      // Use Postgres full-text search via textSearch
      const { data } = await supabase
        .from('ns_messages')
        .select(`
          content, sender_name, sent_at, is_from_user,
          ns_conversations!inner(contact_id, ns_contacts(full_name, company))
        `)
        .textSearch('content', query, { type: 'websearch' })
        .limit(limit);

      // Flatten
      const results = (data || []).map(row => {
        const conv = row.ns_conversations as unknown as {
          contact_id: number;
          ns_contacts: { full_name: string; company: string } | null;
        };
        return {
          content: row.content,
          sender_name: row.sender_name,
          sent_at: row.sent_at,
          is_from_user: row.is_from_user,
          contact_name: conv?.ns_contacts?.full_name || null,
          company: conv?.ns_contacts?.company || null,
        };
      });

      return JSON.stringify(results);
    }

    case 'get_contact_detail': {
      const contactId = input.contact_id as number;
      const name = input.name as string;

      let contactData: Record<string, unknown> | null = null;

      if (contactId) {
        const { data } = await supabase
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
          .single();
        contactData = data;
      } else if (name) {
        const { data } = await supabase
          .from('ns_contacts')
          .select(`
            *,
            ns_lead_scores(
              total_score, tier, reciprocity_score, frequency_score,
              depth_score, signal_score, recency_score,
              total_messages, user_messages, contact_messages, last_message_at
            )
          `)
          .ilike('full_name', `%${name}%`)
          .limit(1)
          .single();
        contactData = data;
      }

      if (!contactData) return JSON.stringify({ error: 'Contact not found' });

      // Flatten lead_scores into contact
      const ls = Array.isArray(contactData.ns_lead_scores)
        ? (contactData.ns_lead_scores as Record<string, unknown>[])[0]
        : contactData.ns_lead_scores as Record<string, unknown> | null;

      const contact = { ...contactData, ...ls };
      delete contact.ns_lead_scores;

      // Get recent messages
      const { data: convs } = await supabase
        .from('ns_conversations')
        .select('id')
        .eq('contact_id', contact.id as number);

      const convIds = (convs || []).map(c => c.id);
      let recentMessages: unknown[] = [];

      if (convIds.length > 0) {
        const { data: msgs } = await supabase
          .from('ns_messages')
          .select('content, sender_name, sent_at, is_from_user')
          .in('conversation_id', convIds)
          .order('sent_at', { ascending: false })
          .limit(5);
        recentMessages = msgs || [];
      }

      return JSON.stringify({ contact, recentMessages });
    }

    case 'get_aggregate_stats': {
      const metric = input.metric as string;

      switch (metric) {
        case 'overview': {
          const [
            { count: totalContacts },
            { count: totalMessages },
            { data: tierData },
          ] = await Promise.all([
            supabase.from('ns_contacts').select('*', { count: 'exact', head: true }),
            supabase.from('ns_messages').select('*', { count: 'exact', head: true }),
            supabase.from('ns_lead_scores').select('tier, total_score'),
          ]);

          const tiers: Record<string, number> = {};
          let totalScore = 0;
          const scoreCount = (tierData || []).length;
          for (const row of tierData || []) {
            tiers[row.tier] = (tiers[row.tier] || 0) + 1;
            totalScore += row.total_score || 0;
          }

          return JSON.stringify({
            totalContacts: totalContacts || 0,
            totalMessages: totalMessages || 0,
            tiers,
            avgScore: scoreCount > 0 ? Math.round(totalScore / scoreCount) : 0,
          });
        }
        case 'top_leads': {
          const { data } = await supabase
            .from('ns_lead_scores')
            .select('total_score, tier, total_messages, ns_contacts!inner(full_name, company, position)')
            .order('total_score', { ascending: false })
            .limit(20);

          const leads = (data || []).map(row => {
            const c = row.ns_contacts as unknown as { full_name: string; company: string; position: string };
            return {
              full_name: c.full_name,
              company: c.company,
              position: c.position,
              total_score: row.total_score,
              tier: row.tier,
              total_messages: row.total_messages,
            };
          });

          return JSON.stringify(leads);
        }
        case 'companies': {
          const { data } = await supabase
            .from('ns_lead_scores')
            .select('total_score, ns_contacts!inner(company)')
            .not('ns_contacts.company', 'is', null)
            .not('ns_contacts.company', 'eq', '');

          // Aggregate in JS
          const companyMap = new Map<string, { count: number; totalScore: number; topScore: number }>();
          for (const row of data || []) {
            const c = row.ns_contacts as unknown as { company: string };
            const company = c.company;
            const existing = companyMap.get(company) || { count: 0, totalScore: 0, topScore: 0 };
            existing.count++;
            existing.totalScore += row.total_score || 0;
            existing.topScore = Math.max(existing.topScore, row.total_score || 0);
            companyMap.set(company, existing);
          }

          const companies = Array.from(companyMap.entries())
            .map(([company, stats]) => ({
              company,
              lead_count: stats.count,
              avg_score: Math.round(stats.totalScore / stats.count),
              top_score: stats.topScore,
            }))
            .sort((a, b) => b.avg_score - a.avg_score)
            .slice(0, 20);

          return JSON.stringify(companies);
        }
        case 'recent_activity': {
          const { data } = await supabase
            .from('ns_messages')
            .select('content, sent_at, is_from_user, ns_conversations!inner(ns_contacts(full_name, company))')
            .order('sent_at', { ascending: false })
            .limit(20);

          const recent = (data || []).map(row => {
            const conv = row.ns_conversations as unknown as {
              ns_contacts: { full_name: string; company: string } | null;
            };
            return {
              full_name: conv?.ns_contacts?.full_name || '',
              company: conv?.ns_contacts?.company || '',
              content: row.content,
              sent_at: row.sent_at,
              is_from_user: row.is_from_user,
            };
          });

          return JSON.stringify(recent);
        }
        case 'signal_summary': {
          const { data } = await supabase
            .from('ns_messages')
            .select('signal_words_found, content, sent_at, ns_conversations!inner(ns_contacts(full_name, company))')
            .eq('has_signal_words', true)
            .order('sent_at', { ascending: false })
            .limit(30);

          const signals = (data || []).map(row => {
            const conv = row.ns_conversations as unknown as {
              ns_contacts: { full_name: string; company: string } | null;
            };
            return {
              full_name: conv?.ns_contacts?.full_name || '',
              company: conv?.ns_contacts?.company || '',
              signal_words_found: row.signal_words_found,
              content: row.content,
              sent_at: row.sent_at,
            };
          });

          return JSON.stringify(signals);
        }
        default:
          return JSON.stringify({ error: 'Unknown metric' });
      }
    }

    default:
      return JSON.stringify({ error: 'Unknown tool' });
  }
}

export async function POST(req: NextRequest) {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return NextResponse.json(
      { error: 'No API key configured. Set your Anthropic API key in Settings.' },
      { status: 400 }
    );
  }

  try {
    const { messages } = await req.json();
    const client = new Anthropic({ apiKey });

    // Convert to Anthropic message format
    const anthropicMessages: Anthropic.MessageParam[] = messages.map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }));

    // Create a streaming response with tool use loop
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let currentMessages = [...anthropicMessages];
        let continueLoop = true;

        while (continueLoop) {
          const response = await client.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            system: SYSTEM_PROMPT,
            tools: TOOLS,
            messages: currentMessages,
          });

          if (response.stop_reason === 'tool_use') {
            // Process tool calls
            const toolUseBlocks = response.content.filter(
              (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
            );

            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const block of toolUseBlocks) {
              const result = await executeTool(block.name, block.input as Record<string, unknown>);
              toolResults.push({
                type: 'tool_result' as const,
                tool_use_id: block.id,
                content: result,
              });
            }

            currentMessages = [
              ...currentMessages,
              { role: 'assistant', content: response.content },
              { role: 'user', content: toolResults },
            ];
          } else {
            // Extract text and stream it
            for (const block of response.content) {
              if (block.type === 'text') {
                const chunk = `data: ${JSON.stringify({ text: block.text })}\n\n`;
                controller.enqueue(encoder.encode(chunk));
              }
            }
            controller.enqueue(encoder.encode('data: [DONE]\n\n'));
            continueLoop = false;
          }
        }

        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('Chat error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat failed' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const supabase = getSupabase();
    await supabase.from('ns_chat_history').delete().neq('id', -1);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ success: true });
  }
}
