import { NextRequest, NextResponse } from 'next/server';
import { AccessLevel, TimelineData } from '@/types/timeline';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { defaultTimelineData } from '@/lib/default-data';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    if (isSupabaseConfigured && supabase) {
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

        let ownerName = projectData.owner_name;
        let ownerEmail = projectData.owner_email;
        if (projectData.user_id) {
          try {
            const { data: userData } = await supabase
              .from('users')
              .select('name, email')
              .eq('id', projectData.user_id)
              .maybeSingle();
            if (userData) {
              ownerName = userData.name;
              ownerEmail = userData.email;
            }
          } catch (_) {}
        }

        const accessLevel = projectData.access_level || 'public_view';
        const project = {
          id: projectData.id,
          userId: projectData.user_id,
          ownerName: ownerName,
          ownerEmail: ownerEmail,
          folderId: projectData.folder_id,
          slug: projectData.slug,
          title: projectData.title,
          subtitle: projectData.subtitle,
          clientName: projectData.client_name,
          brandName: projectData.brand_name,
          accessLevel: accessLevel,
          settings: projectData.settings || {},
          isFavorite: projectData.is_favorite || false,
          status: projectData.status || 'active',
          createdAt: projectData.created_at,
          updatedAt: projectData.updated_at,
        };

        const sprints = (sprintsRes.data || []).map((s: any) => ({
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
        }));

        const categories = (catsRes.data || []).map((c: any) => ({
          id: c.id,
          projectId: c.project_id,
          title: c.title,
          description: c.description,
          orderIndex: c.order_index,
        }));

        const assignees = (assigneesRes.data || []).map((a: any) => ({
          id: a.id,
          projectId: a.project_id,
          name: a.name,
          initials: a.initials,
          color: a.color,
        }));

        const tags = (tagsRes.data || []).map((t: any) => ({
          id: t.id,
          projectId: t.project_id,
          name: t.name,
          color: t.color,
          orderIndex: t.order_index,
        }));

        const collaborators = (colRes.data || []).map((c: any) => ({
          id: c.id,
          projectId: c.project_id,
          email: c.email,
          name: c.name || c.email.split('@')[0],
          permission: c.permission || 'editor',
          invitedAt: c.created_at,
        }));

        const tasks = (tasksRes.data || []).map((t: any) => {
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
            daySpan: t.day_span || 1,
            title: t.title || '',
            deliverables: t.deliverables || [],
            deliverableItems: t.deliverable_items,
            progressPercentage: t.progress_percentage || 0,
            notes: t.notes,
            createdAt: t.created_at,
            updatedAt: t.updated_at,
          };
        });

        return NextResponse.json({
          project,
          sprints,
          categories,
          assignees,
          tags,
          tasks,
          collaborators,
        });
      }
    }

    return NextResponse.json(defaultTimelineData);
  } catch (error: any) {
    console.error('API GET /api/timeline/[slug] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch timeline data' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;
    const body = await request.json();

    // Access level update
    if (body.accessLevel) {
      if (isSupabaseConfigured && supabase) {
        await supabase
          .from('projects')
          .update({
            access_level: body.accessLevel,
            updated_at: new Date().toISOString(),
          })
          .eq('slug', slug);
      }
      return NextResponse.json({ success: true, accessLevel: body.accessLevel });
    }

    // Full timeline save
    const timelineData: TimelineData = body;
    if (isSupabaseConfigured && supabase) {
      await supabase.from('projects').upsert({
        id: timelineData.project.id,
        user_id: timelineData.project.userId,
        folder_id: timelineData.project.folderId || null,
        slug: timelineData.project.slug,
        title: timelineData.project.title,
        subtitle: timelineData.project.subtitle,
        client_name: timelineData.project.clientName,
        brand_name: timelineData.project.brandName,
        access_level: timelineData.project.accessLevel || 'public_view',
        is_favorite: timelineData.project.isFavorite || false,
        status: timelineData.project.status,
        updated_at: new Date().toISOString(),
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API POST /api/timeline/[slug] error:', error);
    return NextResponse.json(
      { error: 'Failed to save timeline data' },
      { status: 500 }
    );
  }
}
