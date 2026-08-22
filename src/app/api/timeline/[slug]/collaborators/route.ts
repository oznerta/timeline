import { NextRequest, NextResponse } from 'next/server';
import {
  getTimelineFromDb,
  getProjectCollaborators,
  inviteCollaboratorToDb,
  removeCollaboratorFromDb,
  updateCollaboratorPermissionInDb,
} from '@/lib/db';
import { PermissionLevel } from '@/types/timeline';
import { sendCollaboratorInviteEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const timeline = getTimelineFromDb(slug);
    if (!timeline) {
      return NextResponse.json({ error: 'Timeline not found' }, { status: 404 });
    }

    const collaborators = getProjectCollaborators(timeline.project.id);
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
    const timeline = getTimelineFromDb(slug);
    if (!timeline) {
      return NextResponse.json({ error: 'Timeline not found' }, { status: 404 });
    }

    const body = await request.json();
    const { email, name, permission = 'editor', action, collaboratorId } = body;

    if (action === 'update_permission' && collaboratorId) {
      updateCollaboratorPermissionInDb(collaboratorId, permission as PermissionLevel);
      return NextResponse.json({ success: true, action: 'updated' });
    }

    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const collaborator = inviteCollaboratorToDb(
      timeline.project.id,
      email.trim(),
      name || email.split('@')[0],
      permission as PermissionLevel
    );

    // Send transactional invitation email via Resend
    const origin = request.headers.get('origin') || undefined;
    const emailResult = await sendCollaboratorInviteEmail({
      to: email.trim(),
      inviterName: name || 'A team member',
      timelineTitle: timeline.project.title,
      timelineSlug: slug,
      permission: permission as PermissionLevel,
      origin,
    });

    return NextResponse.json({
      collaborator,
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

    removeCollaboratorFromDb(collaboratorId);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE collaborator error:', error);
    return NextResponse.json({ error: 'Failed to remove collaborator' }, { status: 500 });
  }
}
