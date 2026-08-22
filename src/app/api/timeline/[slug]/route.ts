import { NextRequest, NextResponse } from 'next/server';
import { findUserById, getTimelineFromDb, saveFullTimelineToDb, updateProjectAccessLevel } from '@/lib/db';
import { AccessLevel, TimelineData } from '@/types/timeline';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    let data = getTimelineFromDb(slug);

    // If not found in SQLite and Supabase is configured
    if (!data && isSupabaseConfigured && supabase) {
      try {
        const { data: projectData } = await supabase
          .from('projects')
          .select('*')
          .eq('slug', slug)
          .single();

        if (projectData) {
          const projId = projectData.id;
          const [sprintsRes, catsRes, assigneesRes, tagsRes, tasksRes, colRes] =
            await Promise.all([
              supabase.from('sprints').select('*').eq('project_id', projId).order('order_index'),
              supabase.from('category_tracks').select('*').eq('project_id', projId).order('order_index'),
              supabase.from('assignees').select('*').eq('project_id', projId),
              supabase.from('tags').select('*').eq('project_id', projId),
              supabase.from('tasks').select('*').eq('project_id', projId),
              supabase.from('collaborators').select('*').eq('project_id', projId),
            ]);

          data = {
            project: {
              id: projectData.id,
              userId: projectData.user_id,
              folderId: projectData.folder_id,
              slug: projectData.slug,
              title: projectData.title,
              subtitle: projectData.subtitle,
              clientName: projectData.client_name,
              brandName: projectData.brand_name,
              accessLevel: projectData.access_level || 'public_view',
              isFavorite: projectData.is_favorite || false,
              status: projectData.status || 'active',
              createdAt: projectData.created_at,
              updatedAt: projectData.updated_at,
            },
            sprints: (sprintsRes.data || []).map((s: any) => ({
              id: s.id,
              projectId: s.project_id,
              name: s.name,
              monthLabel: s.month_label,
              scheduleLabel: s.schedule_label,
              orderIndex: s.order_index,
              startDate: s.start_date,
              endDate: s.end_date,
              workdaysOnly: s.workdays_only,
              weekGroups: s.week_groups || [],
              days: s.days || [],
              status: s.status || 'in_progress',
            })),
            categories: (catsRes.data || []).map((c: any) => ({
              id: c.id,
              projectId: c.project_id,
              title: c.title,
              description: c.description,
              orderIndex: c.order_index,
            })),
            assignees: (assigneesRes.data || []).map((a: any) => ({
              id: a.id,
              projectId: a.project_id,
              name: a.name,
              initials: a.initials,
              color: a.color,
            })),
            tags: (tagsRes.data || []).map((t: any) => ({
              id: t.id,
              projectId: t.project_id,
              name: t.name,
              color: t.color,
              orderIndex: t.order_index,
            })),
            collaborators: (colRes.data || []).map((c: any) => ({
              id: c.id,
              projectId: c.project_id,
              email: c.email,
              name: c.name || c.email.split('@')[0],
              permission: c.permission || 'editor',
              invitedAt: c.created_at,
            })),
            tasks: (tasksRes.data || []).map((t: any) => {
              let assigneeIds = t.assignee_ids || [];
              if (typeof assigneeIds === 'string') {
                try {
                  assigneeIds = JSON.parse(assigneeIds);
                } catch {
                  assigneeIds = [];
                }
              }
              if (assigneeIds.length === 0 && t.assignee_id) {
                assigneeIds = [t.assignee_id];
              }

              return {
                id: t.id,
                projectId: t.project_id,
                sprintId: t.sprint_id,
                categoryId: t.category_id,
                tagId: t.tag_id,
                assigneeId: assigneeIds[0] || t.assignee_id || '',
                assigneeIds,
                dayId: t.day_id,
                title: t.title || '',
                deliverables: t.deliverables || [],
                deliverableItems: t.deliverable_items,
                progressPercentage: t.progress_percentage || 0,
                notes: t.notes,
                createdAt: t.created_at,
                updatedAt: t.updated_at,
              };
            }),
          };
        }
      } catch {}
    }

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

    // Handle Quick Access Level Update Action
    if (body.action === 'update_access_level' && body.accessLevel) {
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase
            .from('projects')
            .update({ access_level: body.accessLevel })
            .eq('slug', slug);
        } catch {}
      }
      try {
        const existingData = getTimelineFromDb(slug);
        if (existingData) {
          updateProjectAccessLevel(existingData.project.id, body.accessLevel as AccessLevel);
        }
      } catch {}
      return NextResponse.json({ success: true, accessLevel: body.accessLevel });
    }

    const timelinePayload = body as TimelineData;
    if (!timelinePayload || !timelinePayload.project || !timelinePayload.sprints) {
      return NextResponse.json({ error: 'Invalid timeline payload' }, { status: 400 });
    }

    try {
      saveFullTimelineToDb(timelinePayload);
    } catch {}

    return NextResponse.json({ success: true, slug });
  } catch (error) {
    console.error('API POST /api/timeline/[slug] error:', error);
    return NextResponse.json({ error: 'Failed to save timeline' }, { status: 500 });
  }
}
