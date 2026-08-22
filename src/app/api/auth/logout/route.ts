import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ message: 'Signed out successfully' });

  response.cookies.set('timeline_auth_token', '', {
    path: '/',
    maxAge: 0,
  });

  response.cookies.set('timeline_user_id', '', {
    path: '/',
    maxAge: 0,
  });

  return response;
}
