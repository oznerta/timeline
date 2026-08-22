import { NextRequest, NextResponse } from 'next/server';
import { resetDbToDefault } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const data = resetDbToDefault();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('API POST /api/timeline/[slug]/reset error:', error);
    return NextResponse.json({ error: 'Failed to reset database' }, { status: 500 });
  }
}
