import { NextRequest, NextResponse } from 'next/server';
import { findUserById, getTimelineFromDb, saveFullTimelineToDb, updateProjectAccessLevel } from '@/lib/db';
import { AccessLevel, TimelineData } from '@/types/timeline';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const data = getTimelineFromDb(slug);

    if (!data) {
      return NextResponse.json({ error: 'Timeline not found' }, { status: 404 });
    }

    const userId = request.cookies.get('timeline_user_id')?.value;
    const user = userId ? findUserById(userId) : null;

    const accessLevel: AccessLevel = data.project.accessLevel || 'public_view';
    const isOwner = Boolean(user && (!data.project.userId || user.id === data.project.userId));
    const collaborator = user
      ? (data.collaborators || []).find(
          (c) => c.email.toLowerCase() === user.email.toLowerCase()
        )
      : null;

    // Check Restricted access
    if (accessLevel === 'restricted' && !isOwner && !collaborator) {
      return NextResponse.json(
        {
          isRestricted: true,
          error: 'This timeline is private and restricted to invited collaborators.',
          projectTitle: data.project.title,
          slug,
        },
        { status: 403 }
      );
    }

    // Determine current user permission
    const userPermission = isOwner
      ? 'owner'
      : collaborator
      ? collaborator.permission
      : accessLevel === 'public_edit'
      ? 'editor'
      : 'viewer';

    return NextResponse.json({
      ...data,
      viewerInfo: {
        isOwner,
        permission: userPermission,
        accessLevel,
        isAuthenticated: Boolean(user),
      },
    });
  } catch (error) {
    console.error('API GET /api/timeline/[slug] error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();

    const existingData = getTimelineFromDb(slug);
    if (!existingData) {
      return NextResponse.json({ error: 'Timeline not found' }, { status: 404 });
    }

    const userId = request.cookies.get('timeline_user_id')?.value;
    const user = userId ? findUserById(userId) : null;

    const accessLevel: AccessLevel = existingData.project.accessLevel || 'public_view';
    const isOwner = Boolean(user && (!existingData.project.userId || user.id === existingData.project.userId));
    const collaborator = user
      ? (existingData.collaborators || []).find(
          (c) => c.email.toLowerCase() === user.email.toLowerCase()
        )
      : null;

    // Handle Quick Access Level Update Action
    if (body.action === 'update_access_level' && body.accessLevel) {
      if (!isOwner && (!collaborator || collaborator.permission !== 'editor')) {
        return NextResponse.json(
          { error: 'Only project owners and editors can modify link permissions' },
          { status: 403 }
        );
      }

      updateProjectAccessLevel(existingData.project.id, body.accessLevel as AccessLevel);
      return NextResponse.json({ success: true, accessLevel: body.accessLevel });
    }

    // Validate full timeline update permission
    const canEdit =
      isOwner ||
      collaborator?.permission === 'editor' ||
      accessLevel === 'public_edit';

    if (!canEdit) {
      return NextResponse.json(
        { error: 'Read-only access: You do not have permission to modify this timeline.' },
        { status: 403 }
      );
    }

    const timelinePayload = body as TimelineData;
    if (!timelinePayload || !timelinePayload.project || !timelinePayload.sprints) {
      return NextResponse.json({ error: 'Invalid timeline payload' }, { status: 400 });
    }

    saveFullTimelineToDb(timelinePayload);
    return NextResponse.json({ success: true, slug });
  } catch (error) {
    console.error('API POST /api/timeline/[slug] error:', error);
    return NextResponse.json({ error: 'Failed to save timeline' }, { status: 500 });
  }
}
