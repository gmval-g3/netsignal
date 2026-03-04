import { NextRequest, NextResponse } from 'next/server';
import { getSupabase } from '@/lib/db/supabase';
import { getUserId } from '@/lib/auth/getUserId';

export const dynamic = 'force-dynamic';

const RAPIDAPI_HOST = process.env.RAPIDAPI_HOST || 'fresh-linkedin-profile-data.p.rapidapi.com';
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';

interface LinkedInProfileResponse {
  data?: {
    headline?: string;
    summary?: string;
    position?: Array<{
      title?: string;
      companyName?: string;
      companyURL?: string;
    }>;
    profilePicture?: string;
    geo?: { full?: string };
  };
  connection?: number;
  follower?: number;
}

async function enrichContact(linkedinUrl: string): Promise<{
  headline: string | null;
  bio: string | null;
  current_title: string | null;
  current_company: string | null;
  company_url: string | null;
  profile_picture_url: string | null;
  location: string | null;
  connections: number | null;
  followers: number | null;
} | null> {
  const match = linkedinUrl.match(/linkedin\.com\/in\/([^/?]+)/);
  if (!match) return null;
  const username = match[1];

  const url = `https://${RAPIDAPI_HOST}/data-connection-count?username=${encodeURIComponent(username)}`;
  const res = await fetch(url, {
    headers: {
      'X-RapidAPI-Key': RAPIDAPI_KEY,
      'X-RapidAPI-Host': RAPIDAPI_HOST,
    },
  });

  if (!res.ok) return null;

  const json: LinkedInProfileResponse = await res.json();
  if (!json.data) return null;

  const firstPosition = json.data.position?.[0];

  return {
    headline: json.data.headline || null,
    bio: json.data.summary || null,
    current_title: firstPosition?.title || null,
    current_company: firstPosition?.companyName || null,
    company_url: firstPosition?.companyURL || null,
    profile_picture_url: json.data.profilePicture || null,
    location: json.data.geo?.full || null,
    connections: json.connection ?? null,
    followers: json.follower ?? null,
  };
}

// POST: Enrich selected contacts
export async function POST(req: NextRequest) {
  const auth = await getUserId();
  if ('error' in auth) return auth.error;
  const userId = auth.userId;

  try {
    if (!RAPIDAPI_KEY) {
      return NextResponse.json(
        { error: 'RAPIDAPI_KEY not configured. Set it in environment variables.' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const { contactIds } = await req.json();

    if (!Array.isArray(contactIds) || contactIds.length === 0) {
      return NextResponse.json({ error: 'No contact IDs provided' }, { status: 400 });
    }

    const ids = contactIds.slice(0, 25);

    const { data: contacts } = await supabase
      .from('ns_contacts')
      .select('id, linkedin_url')
      .eq('user_id', userId)
      .in('id', ids)
      .not('linkedin_url', 'is', null);

    if (!contacts || contacts.length === 0) {
      return NextResponse.json({ error: 'No contacts with LinkedIn URLs found' }, { status: 404 });
    }

    const results: { success: number; failed: number; skipped: number } = {
      success: 0, failed: 0, skipped: 0,
    };

    for (const contact of contacts) {
      if (!contact.linkedin_url) {
        results.skipped++;
        continue;
      }

      try {
        const enrichData = await enrichContact(contact.linkedin_url);
        if (enrichData) {
          await supabase
            .from('ns_enriched_contacts')
            .upsert({
              contact_id: contact.id,
              user_id: userId,
              ...enrichData,
              enriched_at: new Date().toISOString(),
            }, { onConflict: 'user_id,contact_id' });
          results.success++;
        } else {
          results.failed++;
        }
      } catch {
        results.failed++;
      }
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('Enrich error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Enrichment failed' },
      { status: 500 }
    );
  }
}

// GET: Get enrichment status for contacts
export async function GET(req: NextRequest) {
  const auth = await getUserId();
  if ('error' in auth) return auth.error;
  const userId = auth.userId;

  try {
    const supabase = getSupabase();
    const url = new URL(req.url);
    const idsParam = url.searchParams.get('ids');

    if (idsParam) {
      const ids = idsParam.split(',').map(Number).filter(Boolean);
      const { data } = await supabase
        .from('ns_enriched_contacts')
        .select('*')
        .eq('user_id', userId)
        .in('contact_id', ids);
      return NextResponse.json(data || []);
    }

    const { data } = await supabase
      .from('ns_enriched_contacts')
      .select('contact_id, enriched_at')
      .eq('user_id', userId);
    return NextResponse.json(data || []);
  } catch {
    return NextResponse.json([]);
  }
}
