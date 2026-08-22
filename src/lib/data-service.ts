import {
  Assignee,
  CategoryTrack,
  Project,
  Sprint,
  Tag,
  TaskCard,
  TimelineData,
} from '@/types/timeline';
import { defaultTimelineData } from './default-data';
import { isSupabaseConfigured, supabase } from './supabase';

const LOCAL_STORAGE_KEY_PREFIX = 'weekline_timeline_';

export function loadTimelineFromLocalStorage(slug: string = 'master-schedule'): TimelineData {
  if (typeof window === 'undefined') return defaultTimelineData;
  try {
    const raw = localStorage.getItem(`${LOCAL_STORAGE_KEY_PREFIX}${slug}`);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch (err) {
    console.warn('Failed to parse timeline from localStorage', err);
  }
  return defaultTimelineData;
}

export function saveTimelineToLocalStorage(data: TimelineData): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(
      `${LOCAL_STORAGE_KEY_PREFIX}${data.project.slug || 'master-schedule'}`,
      JSON.stringify(data)
    );
  } catch (err) {
    console.warn('Failed to save timeline to localStorage', err);
  }
}

export async function fetchTimelineData(slug: string = 'master-schedule'): Promise<TimelineData> {
  // 1. Fetch from Local SQLite Server API
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/timeline/${slug}`, { cache: 'no-store' });
      if (res.status === 403) {
        const errorData = await res.json();
        const err: any = new Error(errorData.error || 'Access restricted');
        err.isRestricted = true;
        err.projectTitle = errorData.projectTitle;
        throw err;
      }
      if (res.ok) {
        const sqliteData = await res.json();
        if (sqliteData && sqliteData.project) {
          saveTimelineToLocalStorage(sqliteData);
          return sqliteData;
        }
      }
    } catch (e: any) {
      if (e?.isRestricted) throw e;
      console.warn('SQLite fetch failed, checking Supabase/LocalStorage:', e);
    }
  }

  // 2. Fetch from Supabase PostgreSQL (if configured)
  if (isSupabaseConfigured && supabase) {
    try {
      const { data: projectData, error: projErr } = await supabase
        .from('projects')
        .select('*')
        .eq('slug', slug)
        .single();

      if (!projErr && projectData) {
        const projId = projectData.id;

        const [sprintsRes, catsRes, assigneesRes, tagsRes, tasksRes] =
          await Promise.all([
            supabase.from('sprints').select('*').eq('project_id', projId).order('order_index'),
            supabase.from('category_tracks').select('*').eq('project_id', projId).order('order_index'),
            supabase.from('assignees').select('*').eq('project_id', projId),
            supabase.from('tags').select('*').eq('project_id', projId),
            supabase.from('tasks').select('*').eq('project_id', projId),
          ]);

        const project: Project = {
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
        };

        const sprints: Sprint[] = (sprintsRes.data || []).map((s) => ({
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

        const categories: CategoryTrack[] = (catsRes.data || []).map((c) => ({
          id: c.id,
          projectId: c.project_id,
          title: c.title,
          description: c.description,
          orderIndex: c.order_index,
        }));

        const assignees: Assignee[] = (assigneesRes.data || []).map((a) => ({
          id: a.id,
          projectId: a.project_id,
          name: a.name,
          initials: a.initials,
          color: a.color,
        }));

        const tags: Tag[] = (tagsRes.data || []).map((t) => ({
          id: t.id,
          projectId: t.project_id,
          name: t.name,
          color: t.color,
          orderIndex: t.order_index,
        }));

        const tasks: TaskCard[] = (tasksRes.data || []).map((t) => {
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
        });

        const fullData: TimelineData = {
          project,
          sprints,
          categories,
          assignees,
          tags,
          tasks,
        };

        saveTimelineToLocalStorage(fullData);
        return fullData;
      }
    } catch (err) {
      console.warn('Supabase fetch failed:', err);
    }
  }

  // 3. LocalStorage Fallback
  return loadTimelineFromLocalStorage(slug);
}

export async function persistTimelineData(data: TimelineData): Promise<void> {
  saveTimelineToLocalStorage(data);

  if (typeof window !== 'undefined') {
    try {
      await fetch(`/api/timeline/${data.project.slug || 'master-schedule'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
    } catch (e) {
      console.warn('Failed to sync to SQLite API:', e);
    }
  }

  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('projects').upsert({
        id: data.project.id,
        user_id: data.project.userId,
        folder_id: data.project.folderId || null,
        slug: data.project.slug,
        title: data.project.title,
        subtitle: data.project.subtitle,
        client_name: data.project.clientName,
        brand_name: data.project.brandName,
        access_level: data.project.accessLevel || 'public_view',
        is_favorite: data.project.isFavorite || false,
        status: data.project.status,
        updated_at: new Date().toISOString(),
      });

      for (const sprint of data.sprints) {
        await supabase.from('sprints').upsert({
          id: sprint.id,
          project_id: data.project.id,
          name: sprint.name,
          month_label: sprint.monthLabel,
          schedule_label: sprint.scheduleLabel,
          order_index: sprint.orderIndex,
          start_date: sprint.startDate || null,
          end_date: sprint.endDate || null,
          workdays_only: sprint.workdaysOnly,
          week_groups: sprint.weekGroups,
          days: sprint.days,
          status: sprint.status,
        });
      }

      for (const cat of data.categories) {
        await supabase.from('category_tracks').upsert({
          id: cat.id,
          project_id: data.project.id,
          title: cat.title,
          description: cat.description,
          order_index: cat.orderIndex,
        });
      }

      for (const ass of data.assignees) {
        await supabase.from('assignees').upsert({
          id: ass.id,
          project_id: data.project.id,
          name: ass.name,
          initials: ass.initials,
          color: ass.color,
        });
      }

      if (data.tags && data.tags.length > 0) {
        for (const tag of data.tags) {
          await supabase.from('tags').upsert({
            id: tag.id,
            project_id: data.project.id,
            name: tag.name,
            color: tag.color,
            order_index: tag.orderIndex,
          });
        }
      }

      for (const task of data.tasks) {
        const taskAssigneeIds = task.assigneeIds && task.assigneeIds.length > 0
          ? task.assigneeIds
          : (task.assigneeId ? [task.assigneeId] : []);

        await supabase.from('tasks').upsert({
          id: task.id,
          project_id: data.project.id,
          sprint_id: task.sprintId,
          category_id: task.categoryId,
          tag_id: task.tagId,
          assignee_id: taskAssigneeIds[0] || task.assigneeId || '',
          assignee_ids: taskAssigneeIds,
          day_id: task.dayId,
          title: task.title,
          deliverables: task.deliverables,
          deliverable_items: task.deliverableItems,
          progress_percentage: task.progressPercentage,
          notes: task.notes,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.warn('Failed to sync to Supabase:', err);
    }
  }
}
