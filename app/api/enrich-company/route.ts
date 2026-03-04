import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabase } from '@/lib/db/supabase';

export const dynamic = 'force-dynamic';

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

interface CompanyEstimate {
  company_name: string;
  revenue_estimate: string;
  employee_estimate: string;
  industry: string;
  description: string;
  confidence: string;
}

export async function POST(req: NextRequest) {
  try {
    const apiKey = await getApiKey();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'No Anthropic API key configured. Add one in Settings or set ANTHROPIC_API_KEY.' },
        { status: 400 }
      );
    }

    const supabase = getSupabase();
    const { companyNames } = await req.json();

    if (!Array.isArray(companyNames) || companyNames.length === 0) {
      return NextResponse.json({ error: 'No company names provided' }, { status: 400 });
    }

    // Deduplicate and normalize
    const unique = [...new Set(companyNames.map((n: string) => n.trim()).filter(Boolean))];
    const normalized = unique.map(n => n.toLowerCase());

    // Check which already exist
    const { data: existing } = await supabase
      .from('ns_company_enrichment')
      .select('company_name')
      .in('company_name', normalized);

    const existingSet = new Set((existing || []).map(e => e.company_name));
    const toEnrich = unique.filter(n => !existingSet.has(n.toLowerCase()));

    if (toEnrich.length === 0) {
      return NextResponse.json({ enriched: 0, skipped: unique.length, message: 'All companies already enriched' });
    }

    const anthropic = new Anthropic({ apiKey });
    let totalEnriched = 0;

    // Process in batches of 20
    for (let i = 0; i < toEnrich.length; i += 20) {
      const batch = toEnrich.slice(i, i + 20);
      const companyList = batch.map((name, idx) => `${idx + 1}. ${name}`).join('\n');

      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 2048,
        messages: [{
          role: 'user',
          content: `Estimate the following for each company. Return ONLY a JSON array, no other text.

For each company return:
- company_name: exact name as given
- revenue_estimate: one of "<$1M", "$1-10M", "$10-50M", "$50-100M", "$100-500M", "$500M-1B", "$1B+"
- employee_estimate: one of "1-10", "11-50", "51-200", "201-1K", "1K-5K", "5K+"
- industry: short industry label (e.g. "SaaS", "Consulting", "Healthcare")
- description: one sentence about what they do
- confidence: "high" if well-known company, "medium" if reasonable guess, "low" if uncertain

Companies:
${companyList}

Return JSON array only:`
        }],
      });

      // Parse response
      const text = response.content[0].type === 'text' ? response.content[0].text : '';
      try {
        // Extract JSON from response (handle markdown code blocks)
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (!jsonMatch) continue;

        const estimates: CompanyEstimate[] = JSON.parse(jsonMatch[0]);

        // Upsert each company
        for (const est of estimates) {
          if (!est.company_name) continue;
          await supabase
            .from('ns_company_enrichment')
            .upsert({
              company_name: est.company_name.toLowerCase(),
              revenue_estimate: est.revenue_estimate || null,
              employee_estimate: est.employee_estimate || null,
              industry: est.industry || null,
              description: est.description || null,
              confidence: est.confidence || 'low',
              enriched_at: new Date().toISOString(),
            }, { onConflict: 'company_name' });
          totalEnriched++;
        }
      } catch (parseErr) {
        console.error('Failed to parse Haiku response:', parseErr, text);
      }
    }

    return NextResponse.json({
      enriched: totalEnriched,
      skipped: unique.length - toEnrich.length,
      total: unique.length,
    });
  } catch (error) {
    console.error('Company enrichment error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Company enrichment failed' },
      { status: 500 }
    );
  }
}
