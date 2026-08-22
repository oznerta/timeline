import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    return NextResponse.json({
      message: 'Supabase client-side authentication is active.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Authentication route' }, { status: 500 });
  }
}
