import {
  Assignee,
  CategoryTrack,
  Collaborator,
  Folder,
  PermissionLevel,
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

        const [sprintsRes, catsRes, assigneesRes, tagsRes, tasksRes, colRes] =
          await Promise.all([
            supabase.from('sprints').select('*').eq('project_id', projId).order('order_index'),
            supabase.from('category_tracks').select('*').eq('project_id', projId).order('order_index'),
            supabase.from('assignees').select('*').eq('project_id', projId),
            supabase.from('tags').select('*').eq('project_id', projId),
            supabase.from('tasks').select('*').eq('project_id', projId),
            supabase.from('collaborators').select('*').eq('project_id', projId),
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

        const collaborators: Collaborator[] = (colRes.data || []).map((c: any) => ({
          id: c.id,
          projectId: c.project_id,
          email: c.email,
          name: c.name || c.email.split('@')[0],
          permission: c.permission || 'editor',
          invitedAt: c.created_at,
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
          collaborators,
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

      // Synchronize Sprints (delete removed, upsert active)
      const currentSprintIds = data.sprints.map((s) => s.id);
      if (currentSprintIds.length > 0) {
        await supabase
          .from('sprints')
          .delete()
          .eq('project_id', data.project.id)
          .not('id', 'in', `(${currentSprintIds.map((id) => `"${id}"`).join(',')})`);
      }
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

      // Synchronize Category Tracks (delete removed, upsert active)
      const currentCatIds = data.categories.map((c) => c.id);
      if (currentCatIds.length > 0) {
        await supabase
          .from('category_tracks')
          .delete()
          .eq('project_id', data.project.id)
          .not('id', 'in', `(${currentCatIds.map((id) => `"${id}"`).join(',')})`);
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

      // Synchronize Assignees (delete removed, upsert active)
      const currentAssIds = data.assignees.map((a) => a.id);
      if (currentAssIds.length > 0) {
        await supabase
          .from('assignees')
          .delete()
          .eq('project_id', data.project.id)
          .not('id', 'in', `(${currentAssIds.map((id) => `"${id}"`).join(',')})`);
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

      // Synchronize Tags (delete removed, upsert active)
      const currentTagIds = (data.tags || []).map((t) => t.id);
      if (currentTagIds.length > 0) {
        await supabase
          .from('tags')
          .delete()
          .eq('project_id', data.project.id)
          .not('id', 'in', `(${currentTagIds.map((id) => `"${id}"`).join(',')})`);
      } else {
        await supabase.from('tags').delete().eq('project_id', data.project.id);
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

      // Synchronize Tasks (delete removed, upsert active)
      const currentTaskIds = data.tasks.map((t) => t.id);
      if (currentTaskIds.length > 0) {
        await supabase
          .from('tasks')
          .delete()
          .eq('project_id', data.project.id)
          .not('id', 'in', `(${currentTaskIds.map((id) => `"${id}"`).join(',')})`);
      } else {
        await supabase.from('tasks').delete().eq('project_id', data.project.id);
      }

      for (const task of data.tasks) {
        const taskAssigneeIds =
          task.assigneeIds && task.assigneeIds.length > 0
            ? task.assigneeIds
            : task.assigneeId
            ? [task.assigneeId]
            : [];

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

// ==========================================
// WORKSPACE FOLDERS & TIMELINES OPERATIONS
// ==========================================

const LOCAL_STORAGE_FOLDERS_KEY = 'weekline_workspace_folders';
const LOCAL_STORAGE_PROJECTS_KEY = 'weekline_workspace_projects';

export async function fetchWorkspaceFolders(userId?: string): Promise<Folder[]> {
  // 1. Fetch from Supabase if configured
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase.from('folders').select('*').order('created_at', { ascending: true });
      if (userId) {
        query = query.or(`user_id.eq.${userId},user_id.eq.user,user_id.is.null`);
      }
      const { data, error } = await query;
      if (!error && data) {
        const folders: Folder[] = data.map((f: any) => ({
          id: f.id,
          userId: f.user_id,
          name: f.name,
          color: f.color,
          orderIndex: f.order_index,
          createdAt: f.created_at,
        }));
        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_STORAGE_FOLDERS_KEY, JSON.stringify(folders));
        }
        return folders;
      }
    } catch (e) {
      console.warn('Failed to fetch folders from Supabase:', e);
    }
  }

  // 2. Fetch from Local API (SQLite)
  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/folders', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.folders) {
          localStorage.setItem(LOCAL_STORAGE_FOLDERS_KEY, JSON.stringify(data.folders));
          return data.folders;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch folders from API:', e);
    }
  }

  // 3. Fallback to LocalStorage
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_FOLDERS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
  }

  return [];
}

export async function createWorkspaceFolder(name: string, color: string = '#F59E0B', userId?: string): Promise<Folder> {
  const newFolder: Folder = {
    id: `folder-${Date.now()}`,
    userId: userId || 'user',
    name: name.trim(),
    color,
    createdAt: new Date().toISOString(),
  };

  // Supabase
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('folders').upsert({
        id: newFolder.id,
        user_id: newFolder.userId,
        name: newFolder.name,
        color: newFolder.color,
        created_at: newFolder.createdAt,
        updated_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('Failed to create folder in Supabase:', e);
    }
  }

  // Local API (SQLite)
  if (typeof window !== 'undefined') {
    try {
      fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color }),
      }).catch(() => {});
    } catch {}
  }

  // LocalStorage
  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_FOLDERS_KEY);
      const existing: Folder[] = raw ? JSON.parse(raw) : [];
      const updated = [...existing.filter((f) => f.id !== newFolder.id), newFolder];
      localStorage.setItem(LOCAL_STORAGE_FOLDERS_KEY, JSON.stringify(updated));
    } catch {}
  }

  return newFolder;
}

export async function renameWorkspaceFolder(folderId: string, name: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('folders').update({
        name: name.trim(),
        updated_at: new Date().toISOString(),
      }).eq('id', folderId);
    } catch (e) {
      console.warn('Failed to rename folder in Supabase:', e);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      fetch('/api/folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', folderId, name: name.trim() }),
      }).catch(() => {});
    } catch {}
  }
}

export async function deleteWorkspaceFolder(folderId: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      // Unlink projects from this folder
      await supabase.from('projects').update({ folder_id: null }).eq('folder_id', folderId);
      await supabase.from('folders').delete().eq('id', folderId);
    } catch (e) {
      console.warn('Failed to delete folder in Supabase:', e);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      fetch(`/api/folders?id=${folderId}`, { method: 'DELETE' }).catch(() => {});
    } catch {}
  }
}

export async function fetchWorkspaceProjects(userId?: string): Promise<Project[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase.from('projects').select('*').order('updated_at', { ascending: false });
      if (userId) {
        query = query.or(`user_id.eq.${userId},user_id.is.null`);
      }
      const { data, error } = await query;
      if (!error && data) {
        const projects: Project[] = data.map((p: any) => ({
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
          isTrashed: p.status === 'trashed',
          status: p.status || 'active',
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        }));
        if (typeof window !== 'undefined') {
          localStorage.setItem(LOCAL_STORAGE_PROJECTS_KEY, JSON.stringify(projects));
        }
        return projects;
      }
    } catch (e) {
      console.warn('Failed to fetch projects from Supabase:', e);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/timelines', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data.projects) {
          localStorage.setItem(LOCAL_STORAGE_PROJECTS_KEY, JSON.stringify(data.projects));
          return data.projects;
        }
      }
    } catch (e) {
      console.warn('Failed to fetch projects from API:', e);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_PROJECTS_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
  }

  return [];
}

export async function moveWorkspaceProject(projectId: string, folderId: string | null): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('projects').update({
        folder_id: folderId,
        updated_at: new Date().toISOString(),
      }).eq('id', projectId);
    } catch (e) {
      console.warn('Failed to move project in Supabase:', e);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      fetch('/api/timelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'move_to_folder', projectId, folderId }),
      }).catch(() => {});
    } catch {}
  }
}

export async function renameWorkspaceProject(projectId: string, title: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('projects').update({
        title: title.trim(),
        updated_at: new Date().toISOString(),
      }).eq('id', projectId);
    } catch (e) {
      console.warn('Failed to rename project in Supabase:', e);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      fetch('/api/timelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'rename', projectId, title: title.trim() }),
      }).catch(() => {});
    } catch {}
  }
}

export async function trashWorkspaceProject(projectId: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('projects').update({
        status: 'trashed',
        updated_at: new Date().toISOString(),
      }).eq('id', projectId);
    } catch (e) {
      console.warn('Failed to trash project in Supabase:', e);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      fetch('/api/timelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'trash', projectId }),
      }).catch(() => {});
    } catch {}
  }
}

export async function restoreWorkspaceProject(projectId: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('projects').update({
        status: 'active',
        updated_at: new Date().toISOString(),
      }).eq('id', projectId);
    } catch (e) {
      console.warn('Failed to restore project in Supabase:', e);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      fetch('/api/timelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', projectId }),
      }).catch(() => {});
    } catch {}
  }
}

export async function deleteWorkspaceProjectPermanently(projectId: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('projects').delete().eq('id', projectId);
    } catch (e) {
      console.warn('Failed to permanently delete project in Supabase:', e);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      fetch('/api/timelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete_permanently', projectId }),
      }).catch(() => {});
    } catch {}
  }
}

