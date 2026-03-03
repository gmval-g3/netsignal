import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/supabase';

// GET: export all matching filters
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const tiers = url.searchParams.get('tiers');

  return buildCsv(tiers ? { tiers } : {}, `linkedin-leads-${tiers || 'all'}`);
}

// POST: export specific IDs
export async function POST(req: NextRequest) {
  const { ids } = await req.json();

  if (!ids?.length) {
    return NextResponse.json({ error: 'No IDs provided' }, { status: 400 });
  }

  return buildCsv({ ids }, 'linkedin-leads-selected');
}

async function buildCsv(
  filters: { tiers?: string; ids?: number[] },
  filenamePrefix: string
) {
  try {
    const supabase = getSupabase();

    let query = supabase
      .from('ns_lead_scores')
      .select(`
        total_score, tier, reciprocity_score, frequency_score,
        depth_score, signal_score, recency_score,
        total_messages, user_messages, contact_messages,
        last_message_at, last_message_preview,
        ns_contacts!inner(id, full_name, first_name, last_name, email, company, position, linkedin_url, connected_on)
      `)
      .order('total_score', { ascending: false });

    if (filters.ids) {
      query = query.in('contact_id', filters.ids);
    } else if (filters.tiers && filters.tiers !== 'all') {
      const tierList = filters.tiers.split(',').filter(Boolean);
      if (tierList.length > 0) {
        query = query.in('tier', tierList);
      }
    }

    const { data, error } = await query;
    if (error) throw error;

    if (!data || data.length === 0) {
      return NextResponse.json({ error: 'No leads to export' }, { status: 404 });
    }

    // Fetch all contact-tag mappings for these contacts
    const contactIds = data.map(row => {
      const contact = row.ns_contacts as unknown as { id: number };
      return contact.id;
    });

    const { data: tagMappings } = await supabase
      .from('ns_contact_tags')
      .select('contact_id, ns_tags(name)')
      .in('contact_id', contactIds);

    // Build tag lookup: contact_id -> "tag1; tag2"
    const tagsByContact = new Map<number, string>();
    if (tagMappings) {
      for (const mapping of tagMappings) {
        const tag = mapping.ns_tags as unknown as { name: string } | null;
        if (!tag) continue;
        const existing = tagsByContact.get(mapping.contact_id) || '';
        tagsByContact.set(mapping.contact_id, existing ? `${existing}; ${tag.name}` : tag.name);
      }
    }

    const headers = [
      'Full Name', 'First Name', 'Last Name', 'Email', 'Company', 'Position',
      'LinkedIn URL', 'Connected On',
      'Total Score', 'Tier', 'Reciprocity', 'Frequency', 'Depth', 'Signals', 'Recency',
      'Total Messages', 'Sent', 'Received', 'Last Message Date', 'Last Message Preview', 'Tags',
    ];

    const escapeCSV = (val: unknown): string => {
      const str = val == null ? '' : String(val);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    const rows = data.map(row => {
      const c = row.ns_contacts as unknown as {
        id: number; full_name: string; first_name: string; last_name: string;
        email: string; company: string; position: string; linkedin_url: string; connected_on: string;
      };
      const tags = tagsByContact.get(c.id) || '';

      return [
        c.full_name, c.first_name, c.last_name, c.email, c.company, c.position,
        c.linkedin_url, c.connected_on,
        row.total_score, row.tier, row.reciprocity_score, row.frequency_score,
        row.depth_score, row.signal_score, row.recency_score,
        row.total_messages, row.user_messages, row.contact_messages,
        row.last_message_at, row.last_message_preview, tags,
      ].map(escapeCSV).join(',');
    });

    const csv = [headers.join(','), ...rows].join('\n');

    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filenamePrefix}-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
