import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/supabase';

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabase();
    const url = new URL(req.url);

    const tiers = url.searchParams.get('tiers'); // comma-separated: "hot,warm"
    const search = url.searchParams.get('search');
    const tag = url.searchParams.get('tag');
    const sort = url.searchParams.get('sort') || 'total_score';
    const order = url.searchParams.get('order') || 'desc';
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '50');
    const minMessages = url.searchParams.get('minMessages');
    const sinceDate = url.searchParams.get('sinceDate');
    const offset = (page - 1) * limit;

    const allowedSorts = ['total_score', 'total_messages', 'last_message_at', 'full_name', 'reciprocity_score', 'recency_score', 'frequency_score'];
    const sortCol = allowedSorts.includes(sort) ? sort : 'total_score';
    const ascending = order === 'asc';

    // We need to join lead_scores with contacts. Use lead_scores as base.
    // Supabase foreign-key join: lead_scores has contact_id -> contacts(id)
    let query = supabase
      .from('ns_lead_scores')
      .select(`
        contact_id,
        total_score, tier, reciprocity_score, frequency_score,
        depth_score, signal_score, recency_score,
        total_messages, user_messages, contact_messages,
        last_message_at, last_message_preview,
        ns_contacts!inner(id, full_name, company, position, email, linkedin_url)
      `);

    // Tier filter
    if (tiers && tiers !== 'all') {
      const tierList = tiers.split(',').filter(Boolean);
      if (tierList.length > 0) {
        query = query.in('tier', tierList);
      }
    }

    // Min messages filter
    if (minMessages) {
      query = query.gte('total_messages', parseInt(minMessages));
    }

    // Date range filter
    if (sinceDate) {
      query = query.gte('last_message_at', sinceDate);
    }

    // Search: name, company, position
    if (search) {
      // Use or() filter on the joined contacts table for name/company/position
      query = query.or(
        `full_name.ilike.%${search}%,company.ilike.%${search}%,position.ilike.%${search}%`,
        { referencedTable: 'ns_contacts' }
      );
    }

    // Tag filter: get contact IDs with this tag first, then filter
    let tagContactIds: number[] | null = null;
    if (tag) {
      const { data: tagMappings } = await supabase
        .from('ns_contact_tags')
        .select('contact_id')
        .eq('tag_id', parseInt(tag));
      tagContactIds = (tagMappings || []).map(t => t.contact_id);
      if (tagContactIds.length === 0) {
        return NextResponse.json({ leads: [], total: 0, page, totalPages: 0 });
      }
      query = query.in('contact_id', tagContactIds);
    }

    // Sort — for full_name we sort via the referenced table
    if (sortCol === 'full_name') {
      query = query.order('full_name', { referencedTable: 'ns_contacts', ascending });
    } else {
      query = query.order(sortCol, { ascending });
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data, error } = await query;
    if (error) throw error;

    // Also get total count with same filters
    let countQuery = supabase
      .from('ns_lead_scores')
      .select('contact_id, ns_contacts!inner(id, full_name, company, position)', { count: 'exact', head: true });

    if (tiers && tiers !== 'all') {
      const tierList = tiers.split(',').filter(Boolean);
      if (tierList.length > 0) {
        countQuery = countQuery.in('tier', tierList);
      }
    }
    if (minMessages) {
      countQuery = countQuery.gte('total_messages', parseInt(minMessages));
    }
    if (sinceDate) {
      countQuery = countQuery.gte('last_message_at', sinceDate);
    }
    if (search) {
      countQuery = countQuery.or(
        `full_name.ilike.%${search}%,company.ilike.%${search}%,position.ilike.%${search}%`,
        { referencedTable: 'ns_contacts' }
      );
    }
    if (tagContactIds) {
      countQuery = countQuery.in('contact_id', tagContactIds);
    }

    const { count: total } = await countQuery;

    // Flatten the joined shape to match existing API contract
    const contactIds = (data || []).map(row => {
      const contact = row.ns_contacts as unknown as { id: number };
      return contact.id;
    });

    // Fetch enrichment data for these contacts
    const enrichedMap = new Map<number, { current_title: string | null; current_company: string | null; headline: string | null }>();
    if (contactIds.length > 0) {
      const { data: enriched } = await supabase
        .from('ns_enriched_contacts')
        .select('contact_id, current_title, current_company, headline')
        .in('contact_id', contactIds);
      for (const e of enriched || []) {
        enrichedMap.set(e.contact_id, e);
      }
    }

    const leads = (data || []).map(row => {
      const contact = row.ns_contacts as unknown as {
        id: number; full_name: string; company: string;
        position: string; email: string; linkedin_url: string;
      };
      const enrichment = enrichedMap.get(contact.id);
      return {
        id: contact.id,
        full_name: contact.full_name,
        company: enrichment?.current_company || contact.company,
        position: enrichment?.current_title || contact.position,
        headline: enrichment?.headline || null,
        email: contact.email,
        linkedin_url: contact.linkedin_url,
        total_score: row.total_score,
        tier: row.tier,
        reciprocity_score: row.reciprocity_score,
        frequency_score: row.frequency_score,
        depth_score: row.depth_score,
        signal_score: row.signal_score,
        recency_score: row.recency_score,
        total_messages: row.total_messages,
        user_messages: row.user_messages,
        contact_messages: row.contact_messages,
        last_message_at: row.last_message_at,
        last_message_preview: row.last_message_preview,
        is_enriched: !!enrichment,
      };
    });

    return NextResponse.json({
      leads,
      total: total || 0,
      page,
      totalPages: Math.ceil((total || 0) / limit),
    });
  } catch (error) {
    console.error('Leads error:', error);
    return NextResponse.json({ leads: [], total: 0, page: 1, totalPages: 0 }, { status: 500 });
  }
}
