import { NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/supabase';

export async function GET() {
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
      supabase.from('contacts').select('*', { count: 'exact', head: true }),
      supabase.from('messages').select('*', { count: 'exact', head: true }),
      supabase.from('conversations').select('*', { count: 'exact', head: true }).eq('is_group', false),
      supabase.from('lead_scores').select('tier'),
      supabase
        .from('lead_scores')
        .select('total_score, tier, total_messages, last_message_at, contact_id, contacts(full_name, company, position)')
        .order('total_score', { ascending: false })
        .limit(10),
      supabase
        .from('messages')
        .select('sent_at')
        .not('sent_at', 'is', null),
    ]);

    // Count tiers in JS
    const tiers: Record<string, number> = { hot: 0, warm: 0, cold: 0 };
    if (tierData) {
      for (const row of tierData) {
        if (row.tier in tiers) tiers[row.tier]++;
      }
    }

    // Calculate recent messages (last 2 years)
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
    const { count: recentMessages } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .gte('sent_at', twoYearsAgo.toISOString());

    // Format top leads to match existing shape
    const formattedTopLeads = (topLeads || []).map((lead) => {
      const contact = lead.contacts as unknown as { full_name: string; company: string; position: string } | null;
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

    // Aggregate messages per month in JS (last 12 months)
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const cutoff = twelveMonthsAgo.toISOString().substring(0, 7); // "YYYY-MM"

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
