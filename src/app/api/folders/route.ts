import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('folders')
        .select('*')
        .order('created_at', { ascending: true });

      if (!error && data) {
        return NextResponse.json({
          folders: data.map((f: any) => ({
            id: f.id,
            userId: f.user_id,
            name: f.name,
            color: f.color,
            orderIndex: f.order_index,
            createdAt: f.created_at,
          })),
        });
      }
    }
    return NextResponse.json({ folders: [] });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, folderId, name, color } = body;

    if (isSupabaseConfigured && supabase) {
      if (action === 'rename' && folderId && name) {
        await supabase
          .from('folders')
          .update({ name: name.trim(), updated_at: new Date().toISOString() })
          .eq('id', folderId);
        return NextResponse.json({ success: true });
      }

      if (action === 'delete' && folderId) {
        await supabase.from('folders').delete().eq('id', folderId);
        return NextResponse.json({ success: true });
      }

      if (name) {
        const newFolder = {
          id: `folder-${Date.now()}`,
          user_id: 'user',
          name: name.trim(),
          color: color || '#F59E0B',
          created_at: new Date().toISOString(),
        };
        await supabase.from('folders').insert(newFolder);
        return NextResponse.json({ folder: newFolder });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to manage folder' }, { status: 500 });
  }
}
