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
import { defaultTimelineData, getInitials } from './default-data';
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

        const accessLevel = projectData.access_level || 'restricted';
        if (accessLevel === 'restricted') {
          const { data: { session } } = await supabase.auth.getSession();
          const currentEmail = session?.user?.email?.toLowerCase();
          const currentUserId = session?.user?.id;
          const isOwner = Boolean(
            currentUserId &&
            (!projectData.user_id || currentUserId === projectData.user_id)
          );
          const isCollaborator = (colRes.data || []).some(
            (c: any) => c.email?.toLowerCase() === currentEmail
          );

          if (!isOwner && !isCollaborator) {
            const err: any = new Error('Access restricted: Private timeline');
            err.isRestricted = true;
            err.projectTitle = projectData.title;
            throw err;
          }
        }

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

        const project: Project = {
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

        const colList = (colRes.data || []);
        const colEmails = colList.map((c: any) => (c.email || '').toLowerCase()).filter(Boolean);
        const colUserMap = new Map<string, string>();
        if (colEmails.length > 0) {
          try {
            const { data: uList } = await supabase
              .from('users')
              .select('email, name')
              .in('email', colEmails);
            (uList || []).forEach((u: any) => {
              if (u.email && u.name) {
                colUserMap.set(u.email.toLowerCase(), u.name);
              }
            });
          } catch (_) {}
        }

        const collaborators: Collaborator[] = colList.map((c: any) => ({
          id: c.id,
          projectId: c.project_id,
          email: c.email,
          name: colUserMap.get((c.email || '').toLowerCase()) || c.name || c.email.split('@')[0],
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

  return loadTimelineFromLocalStorage(slug);
}

export async function persistTimelineData(data: TimelineData): Promise<void> {
  saveTimelineToLocalStorage(data);

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
        access_level: data.project.accessLevel || 'restricted',
        settings: data.project.settings || {},
        is_favorite: data.project.isFavorite || false,
        status: data.project.status,
        updated_at: new Date().toISOString(),
      });

      // Synchronize User profile in public users table if userId is present
      if (data.project.userId && data.project.ownerName) {
        try {
          await supabase.from('users').upsert({
            id: data.project.userId,
            name: data.project.ownerName,
            email: data.project.ownerEmail || '',
            role: 'editor',
          });
        } catch (_) {}
      }

      // Synchronize Sprints
      for (const sprint of data.sprints) {
        await supabase.from('sprints').upsert({
          id: sprint.id,
          project_id: data.project.id,
          name: sprint.name,
          month_label: sprint.monthLabel,
          schedule_label: sprint.scheduleLabel,
          order_index: sprint.orderIndex,
          start_date: sprint.startDate,
          end_date: sprint.endDate,
          workdays_only: sprint.workdaysOnly,
          week_groups: sprint.weekGroups,
          days: sprint.days,
          status: sprint.status,
          updated_at: new Date().toISOString(),
        });
      }

      // Synchronize Categories (delete removed, upsert active)
      const currentCategoryIds = (data.categories || []).map((c) => c.id);
      if (currentCategoryIds.length > 0) {
        await supabase
          .from('category_tracks')
          .delete()
          .eq('project_id', data.project.id)
          .not('id', 'in', `(${currentCategoryIds.map((id) => `"${id}"`).join(',')})`);
      } else {
        await supabase.from('category_tracks').delete().eq('project_id', data.project.id);
      }

      for (const category of data.categories || []) {
        await supabase.from('category_tracks').upsert({
          id: category.id,
          project_id: data.project.id,
          title: category.title,
          description: category.description || '',
          order_index: category.orderIndex,
        });
      }

      // Synchronize Assignees (delete removed, upsert active)
      const currentAssigneeIds = (data.assignees || []).map((a) => a.id);
      if (currentAssigneeIds.length > 0) {
        await supabase
          .from('assignees')
          .delete()
          .eq('project_id', data.project.id)
          .not('id', 'in', `(${currentAssigneeIds.map((id) => `"${id}"`).join(',')})`);
      }

      if (data.assignees) {
        for (const assignee of data.assignees) {
          const isOwnerAssignee =
            assignee.id === data.project.userId ||
            assignee.id === 'owner' ||
            assignee.id.startsWith('assignee-');

          let assigneeName = assignee.name;
          if (isOwnerAssignee && data.project.ownerName) {
            assigneeName = data.project.ownerName;
          }

          // Strip any role indicators before saving to DB
          const cleanName = assigneeName
            .replace(/\(Owner\)/gi, '')
            .replace(/\(You\)/gi, '')
            .replace(/\(Editor\)/gi, '')
            .replace(/\(Viewer\)/gi, '')
            .trim();

          await supabase.from('assignees').upsert({
            id: assignee.id,
            project_id: data.project.id,
            name: cleanName || assigneeName,
            initials: getInitials(cleanName || assigneeName),
            color: assignee.color,
          });
        }
      }

      // Synchronize Tags (delete removed, upsert active)
      const currentTagIds = (data.tags || []).map((t) => t.id);
      if (currentTagIds.length > 0) {
        await supabase
          .from('tags')
          .delete()
          .eq('project_id', data.project.id)
          .not('id', 'in', `(${currentTagIds.map((id) => `"${id}"`).join(',')})`);
      }

      if (data.tags) {
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
          day_span: task.daySpan || 1,
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
      const raw = localStorage.getItem(LOCAL_STORAGE_FOLDERS_KEY);
      if (raw) {
        const folders: Folder[] = JSON.parse(raw);
        const updated = folders.map((f) => (f.id === folderId ? { ...f, name: name.trim() } : f));
        localStorage.setItem(LOCAL_STORAGE_FOLDERS_KEY, JSON.stringify(updated));
      }
    } catch {}
  }
}

export async function deleteWorkspaceFolder(folderId: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('folders').delete().eq('id', folderId);
      await supabase.from('projects').update({ folder_id: null }).eq('folder_id', folderId);
    } catch (e) {
      console.warn('Failed to delete folder in Supabase:', e);
    }
  }

  if (typeof window !== 'undefined') {
    try {
      const raw = localStorage.getItem(LOCAL_STORAGE_FOLDERS_KEY);
      if (raw) {
        const folders: Folder[] = JSON.parse(raw);
        const updated = folders.filter((f) => f.id !== folderId);
        localStorage.setItem(LOCAL_STORAGE_FOLDERS_KEY, JSON.stringify(updated));
      }
    } catch {}
  }
}

export async function fetchAllProjects(userId?: string, userEmail?: string): Promise<Project[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      let ownedQuery = supabase
        .from('projects')
        .select('*')
        .neq('status', 'trashed')
        .order('updated_at', { ascending: false });

      if (userId) {
        ownedQuery = ownedQuery.or(`user_id.eq.${userId},user_id.is.null`);
      }

      const [ownedRes, usersRes, colRes] = await Promise.all([
        ownedQuery,
        supabase.from('users').select('id, name, email'),
        userEmail
          ? supabase.from('collaborators').select('project_id').eq('email', userEmail.toLowerCase())
          : Promise.resolve({ data: [] }),
      ]);

      const userMap = new Map<string, { name: string; email: string }>();
      (usersRes.data || []).forEach((u: any) => userMap.set(u.id, { name: u.name, email: u.email }));

      const ownedData = ownedRes.data || [];
      const ownedIds = new Set(ownedData.map((p: any) => p.id));

      const sharedProjectIds = ((colRes as any)?.data || [])
        .map((c: any) => c.project_id)
        .filter((id: string) => id && !ownedIds.has(id));

      let sharedData: any[] = [];
      if (sharedProjectIds.length > 0) {
        const { data: sharedProjectsRes } = await supabase
          .from('projects')
          .select('*')
          .in('id', sharedProjectIds)
          .neq('status', 'trashed')
          .order('updated_at', { ascending: false });
        sharedData = sharedProjectsRes || [];
      }

      const mapProject = (p: any, isShared: boolean = false): Project => {
        const ownerInfo = p.user_id ? userMap.get(p.user_id) : undefined;
        return {
          id: p.id,
          userId: p.user_id,
          ownerName: ownerInfo?.name || p.owner_name,
          ownerEmail: ownerInfo?.email || p.owner_email,
          folderId: isShared ? undefined : p.folder_id,
          slug: p.slug,
          title: p.title,
          subtitle: p.subtitle,
          clientName: p.client_name,
          brandName: p.brand_name,
          accessLevel: p.access_level || 'public_view',
          isFavorite: p.is_favorite || false,
          isShared: isShared,
          status: p.status || 'active',
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        };
      };

      const ownedProjects = ownedData.map((p: any) => mapProject(p, false));
      const sharedProjects = sharedData.map((p: any) => mapProject(p, true));

      return [...ownedProjects, ...sharedProjects];
    } catch (e) {
      console.warn('Failed to fetch projects from Supabase:', e);
    }
  }

  return [];
}

export async function fetchTrashProjects(userId?: string): Promise<Project[]> {
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase
        .from('projects')
        .select('*')
        .eq('status', 'trashed')
        .order('updated_at', { ascending: false });

      if (userId) {
        query = query.or(`user_id.eq.${userId},user_id.is.null`);
      }

      const { data, error } = await query;
      if (!error && data) {
        return data.map((p: any) => ({
          id: p.id,
          userId: p.user_id,
          ownerName: p.owner_name,
          ownerEmail: p.owner_email,
          folderId: p.folder_id,
          slug: p.slug,
          title: p.title,
          subtitle: p.subtitle,
          clientName: p.client_name,
          brandName: p.brand_name,
          accessLevel: p.access_level || 'public_view',
          isFavorite: p.is_favorite || false,
          status: 'trashed',
          createdAt: p.created_at,
          updatedAt: p.updated_at,
        }));
      }
    } catch (e) {
      console.warn('Failed to fetch trash from Supabase:', e);
    }
  }

  return [];
}

export async function trashProject(projectId: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('projects')
        .update({ status: 'trashed', updated_at: new Date().toISOString() })
        .eq('id', projectId);
    } catch (e) {
      console.warn('Failed to trash project in Supabase:', e);
    }
  }
}

export async function restoreProject(projectId: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('projects')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .eq('id', projectId);
    } catch (e) {
      console.warn('Failed to restore project in Supabase:', e);
    }
  }
}

export async function deleteProjectPermanently(projectId: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('projects').delete().eq('id', projectId);
    } catch (e) {
      console.warn('Failed to permanently delete project in Supabase:', e);
    }
  }
}

export async function emptyTrash(userId?: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      let query = supabase.from('projects').delete().eq('status', 'trashed');
      if (userId) {
        query = query.eq('user_id', userId);
      }
      await query;
    } catch (e) {
      console.warn('Failed to empty trash in Supabase:', e);
    }
  }
}

export async function moveProjectToFolder(projectId: string, folderId: string | null): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('projects')
        .update({ folder_id: folderId, updated_at: new Date().toISOString() })
        .eq('id', projectId);
    } catch (e) {
      console.warn('Failed to move project in Supabase:', e);
    }
  }
}

export async function renameProject(projectId: string, title: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('projects')
        .update({ title: title.trim(), updated_at: new Date().toISOString() })
        .eq('id', projectId);
    } catch (e) {
      console.warn('Failed to rename project in Supabase:', e);
    }
  }
}

export async function updateProjectAccessLevel(projectId: string, accessLevel: PermissionLevel | 'restricted' | 'public_view' | 'public_edit'): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase
        .from('projects')
        .update({ access_level: accessLevel, updated_at: new Date().toISOString() })
        .eq('id', projectId);
    } catch (e) {
      console.warn('Failed to update access level in Supabase:', e);
    }
  }
}

export async function inviteCollaborator(
  projectId: string,
  email: string,
  permission: PermissionLevel = 'editor',
  timelineTitle: string = 'Timeline Sprint',
  slug: string = 'master-schedule',
  inviterName?: string
): Promise<void> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanName = cleanEmail.split('@')[0];

  try {
    await fetch(`/api/timeline/${slug}/collaborators`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: cleanEmail,
        name: cleanName,
        permission,
        inviterName,
      }),
    });
  } catch (_) {
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('collaborators').upsert({
          id: `col-${Date.now()}`,
          project_id: projectId,
          email: cleanEmail,
          name: cleanName,
          permission,
          created_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('Failed to save collaborator in Supabase:', e);
      }
    }
  }
}

export async function removeCollaborator(collaboratorId: string): Promise<void> {
  if (isSupabaseConfigured && supabase) {
    try {
      await supabase.from('collaborators').delete().eq('id', collaboratorId);
    } catch (e) {
      console.warn('Failed to remove collaborator in Supabase:', e);
    }
  }
}

// Workspace Project Aliases for Dashboard
export const fetchWorkspaceProjects = fetchAllProjects;
export const moveWorkspaceProject = moveProjectToFolder;
export const renameWorkspaceProject = renameProject;
export const trashWorkspaceProject = trashProject;
export const restoreWorkspaceProject = restoreProject;
export const deleteWorkspaceProjectPermanently = deleteProjectPermanently;
