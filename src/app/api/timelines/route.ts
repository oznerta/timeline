import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    if (isSupabaseConfigured && supabase) {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('updated_at', { ascending: false });

      if (!error && data) {
        return NextResponse.json({
          projects: data.map((p: any) => ({
            id: p.id,
            userId: p.user_id,
            folderId: p.folder_id,
            slug: p.slug,
            title: p.title,
            subtitle: p.subtitle,
            clientName: p.client_name,
            brandName: p.brand_name,
            accessLevel: p.access_level || 'public_view',
            isFavorite: p.is_favorite || false,
            status: p.status || 'active',
            createdAt: p.created_at,
            updatedAt: p.updated_at,
          })),
        });
      }
    }
    return NextResponse.json({ projects: [] });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch timelines' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, projectId, folderId, title } = body;

    if (isSupabaseConfigured && supabase) {
      if (action === 'rename' && projectId && title) {
        await supabase
          .from('projects')
          .update({ title: title.trim(), updated_at: new Date().toISOString() })
          .eq('id', projectId);
        return NextResponse.json({ success: true, action: 'renamed' });
      }

      if (action === 'trash' && projectId) {
        await supabase
          .from('projects')
          .update({ status: 'trashed', updated_at: new Date().toISOString() })
          .eq('id', projectId);
        return NextResponse.json({ success: true, action: 'trashed' });
      }

      if (action === 'restore' && projectId) {
        await supabase
          .from('projects')
          .update({ status: 'active', updated_at: new Date().toISOString() })
          .eq('id', projectId);
        return NextResponse.json({ success: true, action: 'restored' });
      }

      if (action === 'delete_permanently' && projectId) {
        await supabase.from('projects').delete().eq('id', projectId);
        return NextResponse.json({ success: true, action: 'deleted' });
      }

      if (action === 'empty_trash') {
        await supabase.from('projects').delete().eq('status', 'trashed');
        return NextResponse.json({ success: true, action: 'empty_trash' });
      }

      if (action === 'move_to_folder' && projectId) {
        await supabase
          .from('projects')
          .update({ folder_id: folderId || null, updated_at: new Date().toISOString() })
          .eq('id', projectId);
        return NextResponse.json({ success: true, action: 'moved' });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to manage timelines' }, { status: 500 });
  }
}
