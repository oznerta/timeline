import { NextRequest, NextResponse } from 'next/server';
import { findUserById } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const userId = request.cookies.get('timeline_user_id')?.value;
    if (!userId) {
      return NextResponse.json({ user: null });
    }

    const user = findUserById(userId);
    if (!user) {
      return NextResponse.json({ user: null });
    }

    return NextResponse.json({ user });
  } catch (error: any) {
    console.error('Session check error:', error);
    return NextResponse.json({ user: null });
  }
}
