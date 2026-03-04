import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const host = process.env.RAPIDAPI_HOST || 'real-time-people-company-data.p.rapidapi.com';
  const key = process.env.RAPIDAPI_KEY || '';

  if (!key) {
    return NextResponse.json({ error: 'RAPIDAPI_KEY not set', host });
  }

  try {
    const url = `https://${host}/?username=gregosborne`;
    const res = await fetch(url, {
      headers: {
        'X-RapidAPI-Key': key,
        'X-RapidAPI-Host': host,
      },
    });

    const body = await res.text();

    return NextResponse.json({
      status: res.status,
      host,
      keyPrefix: key.substring(0, 8) + '...',
      bodyPreview: body.substring(0, 500),
    });
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : 'fetch failed',
      host,
      keyPrefix: key.substring(0, 8) + '...',
    });
  }
}
