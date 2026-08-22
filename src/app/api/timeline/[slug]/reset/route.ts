import { NextRequest, NextResponse } from 'next/server';
import { defaultTimelineData } from '@/lib/default-data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    return NextResponse.json({
      success: true,
      message: `Reset requested for ${slug}`,
      data: defaultTimelineData,
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to reset' }, { status: 500 });
  }
}
