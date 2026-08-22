import { NextRequest, NextResponse } from 'next/server';
import {
  getTimelineFromDb,
  getProjectCollaborators,
  inviteCollaboratorToDb,
  removeCollaboratorFromDb,
  updateCollaboratorPermissionInDb,
} from '@/lib/db';
import { PermissionLevel, Collaborator } from '@/types/timeline';
import { sendCollaboratorInviteEmail } from '@/lib/email';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function resolveProject(slug: string): Promise<{ id: string; title: string } | null> {
  // 1. Check SQLite
  try {
    const timeline = getTimelineFromDb(slug);
    if (timeline?.project) {
      return { id: timeline.project.id, title: timeline.project.title };
    }
  } catch {}

  // 2. Check Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase
        .from('projects')
        .select('id, title')
        .eq('slug', slug)
        .single();
      if (!error && data) {
        return { id: data.id, title: data.title };
      }
    } catch {}
  }

  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const project = await resolveProject(slug);
    if (!project) {
      return NextResponse.json({ error: 'Timeline not found' }, { status: 404 });
    }

    // 1. Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase
          .from('collaborators')
          .select('*')
          .eq('project_id', project.id);
        if (!error && data) {
          const collaborators: Collaborator[] = data.map((c: any) => ({
            id: c.id,
            projectId: c.project_id,
            email: c.email,
            name: c.name || c.email.split('@')[0],
            permission: c.permission || 'editor',
            invitedAt: c.created_at,
          }));
          return NextResponse.json({ collaborators });
        }
      } catch {}
    }

    // 2. SQLite
    const collaborators = getProjectCollaborators(project.id);
    return NextResponse.json({ collaborators });
  } catch (error: any) {
    console.error('GET collaborators error:', error);
    return NextResponse.json({ error: 'Failed to fetch collaborators' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const project = await resolveProject(slug);
    if (!project) {
      return NextResponse.json({ error: 'Timeline not found' }, { status: 404 });
    }

    const body = await request.json();
    const { email, name, permission = 'editor', action, collaboratorId, inviterName } = body;

    if (action === 'update_permission' && collaboratorId) {
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase
            .from('collaborators')
            .update({ permission: permission as PermissionLevel })
            .eq('id', collaboratorId);
        } catch {}
      }
      try {
        updateCollaboratorPermissionInDb(collaboratorId, permission as PermissionLevel);
      } catch {}
      return NextResponse.json({ success: true, action: 'updated' });
    }

    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const newCollaborator: Collaborator = {
      id: `col-${Date.now()}`,
      projectId: project.id,
      email: email.trim(),
      name: name || email.split('@')[0],
      permission: permission as PermissionLevel,
      invitedAt: new Date().toISOString(),
    };

    // Save to Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('collaborators').upsert({
          id: newCollaborator.id,
          project_id: newCollaborator.projectId,
          email: newCollaborator.email,
          name: newCollaborator.name,
          permission: newCollaborator.permission,
          created_at: newCollaborator.invitedAt,
        });
      } catch (e) {
        console.warn('Failed to insert collaborator to Supabase:', e);
      }
    }

    // Save to SQLite
    try {
      inviteCollaboratorToDb(
        project.id,
        email.trim(),
        name || email.split('@')[0],
        permission as PermissionLevel
      );
    } catch {}

    // Send transactional invitation email via Resend
    const origin = request.headers.get('origin') || undefined;
    const emailResult = await sendCollaboratorInviteEmail({
      to: email.trim(),
      inviterName: inviterName || 'A team member',
      timelineTitle: project.title,
      timelineSlug: slug,
      permission: permission as PermissionLevel,
      origin,
    });

    return NextResponse.json({
      collaborator: newCollaborator,
      success: true,
      emailSent: emailResult.success,
      emailSimulated: emailResult.simulated,
    });
  } catch (error: any) {
    console.error('POST collaborator error:', error);
    return NextResponse.json({ error: 'Failed to invite collaborator' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { searchParams } = new URL(request.url);
    const collaboratorId = searchParams.get('id');

    if (!collaboratorId) {
      return NextResponse.json({ error: 'Collaborator id is required' }, { status: 400 });
    }

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('collaborators').delete().eq('id', collaboratorId);
      } catch {}
    }

    try {
      removeCollaboratorFromDb(collaboratorId);
    } catch {}

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE collaborator error:', error);
    return NextResponse.json({ error: 'Failed to remove collaborator' }, { status: 500 });
  }
}
