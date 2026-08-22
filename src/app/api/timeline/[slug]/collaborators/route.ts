import { NextRequest, NextResponse } from 'next/server';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { sendCollaboratorInviteEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    if (isSupabaseConfigured && supabase) {
      const { data: project } = await supabase
        .from('projects')
        .select('id')
        .eq('slug', slug)
        .single();

      if (project) {
        const { data: collaborators } = await supabase
          .from('collaborators')
          .select('*')
          .eq('project_id', project.id);

        return NextResponse.json({
          collaborators: (collaborators || []).map((c: any) => ({
            id: c.id,
            projectId: c.project_id,
            email: c.email,
            name: c.name || c.email.split('@')[0],
            permission: c.permission || 'editor',
            invitedAt: c.created_at,
          })),
        });
      }
    }

    return NextResponse.json({ collaborators: [] });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch collaborators' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();
    const { email, permission = 'editor', name = '' } = body;

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email address is required' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = (name || cleanEmail.split('@')[0]).trim();
    let projectTitle = 'Timeline Sprint';

    if (isSupabaseConfigured && supabase) {
      const { data: project } = await supabase
        .from('projects')
        .select('id, title')
        .eq('slug', slug)
        .single();

      if (project) {
        projectTitle = project.title;
        const newCol = {
          id: `col-${Date.now()}`,
          project_id: project.id,
          email: cleanEmail,
          name: cleanName,
          permission,
          created_at: new Date().toISOString(),
        };

        await supabase.from('collaborators').upsert(newCol);
      }
    }

    const origin = request.nextUrl.origin || 'http://localhost:3000';

    await sendCollaboratorInviteEmail({
      to: cleanEmail,
      inviterName: 'Project Owner',
      timelineTitle: projectTitle,
      timelineSlug: slug,
      permission,
      origin,
    });

    return NextResponse.json({
      success: true,
      collaborator: {
        id: `col-${Date.now()}`,
        email: cleanEmail,
        name: cleanName,
        permission,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to add collaborator' }, { status: 500 });
  }
}
