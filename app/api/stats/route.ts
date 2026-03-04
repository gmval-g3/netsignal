import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/supabase';
import { getUserId } from '@/lib/auth/getUserId';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await getUserId();
  if ('error' in auth) return auth.error;
  const userId = auth.userId;

  try {
    const supabase = getSupabase();

    const [
      { count: totalContacts },
      { count: totalMessages },
      { count: totalConversations },
      { data: tierData },
      { data: topLeads },
      { data: messagesPerMonthRaw },
    ] = await Promise.all([
      supabase.from('ns_contacts').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('ns_messages').select('*', { count: 'exact', head: true }).eq('user_id', userId),
      supabase.from('ns_conversations').select('*', { count: 'exact', head: true }).eq('user_id', userId).eq('is_group', false),
      supabase.from('ns_lead_scores').select('tier').eq('user_id', userId),
      supabase
        .from('ns_lead_scores')
        .select('total_score, tier, total_messages, last_message_at, contact_id, ns_contacts(full_name, company, position)')
        .eq('user_id', userId)
        .order('total_score', { ascending: false })
        .limit(10),
      supabase
        .from('ns_messages')
        .select('sent_at')
        .eq('user_id', userId)
        .not('sent_at', 'is', null),
    ]);

    const tiers: Record<string, number> = { hot: 0, warm: 0, cold: 0 };
    if (tierData) {
      for (const row of tierData) {
        if (row.tier in tiers) tiers[row.tier]++;
      }
    }

    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const { count: recentMessages } = await supabase
      .from('ns_messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('sent_at', twoYearsAgo.toISOString());

    const formattedTopLeads = (topLeads || []).map((lead) => {
      const contact = lead.ns_contacts as unknown as { full_name: string; company: string; position: string } | null;
      return {
        full_name: contact?.full_name || '',
        company: contact?.company || '',
        position: contact?.position || '',
        total_score: lead.total_score,
        tier: lead.tier,
        total_messages: lead.total_messages,
        last_message_at: lead.last_message_at,
      };
    });

    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const cutoff = twelveMonthsAgo.toISOString().substring(0, 7);

    const monthCounts = new Map<string, number>();
    if (messagesPerMonthRaw) {
      for (const row of messagesPerMonthRaw) {
        if (!row.sent_at) continue;
        const month = row.sent_at.substring(0, 7);
        if (month >= cutoff) {
          monthCounts.set(month, (monthCounts.get(month) || 0) + 1);
        }
      }
    }
    const messagesPerMonth = Array.from(monthCounts.entries())
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return NextResponse.json({
      totalContacts: totalContacts || 0,
      totalMessages: totalMessages || 0,
      totalConversations: totalConversations || 0,
      tiers,
      recentMessages: recentMessages || 0,
      topLeads: formattedTopLeads,
      messagesPerMonth,
    });
  } catch {
    return NextResponse.json({ totalContacts: 0, totalMessages: 0, totalConversations: 0, tiers: {}, recentMessages: 0, topLeads: [], messagesPerMonth: [] });
  }
}
