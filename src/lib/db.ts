import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import {
  AccessLevel,
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
  User,
} from '@/types/timeline';
import { defaultTimelineData, normalizeSprintTo7Days } from './default-data';

let dbInstance: Database.Database | null = null;

function ensureColumn(db: Database.Database, table: string, column: string, type: string) {
  try {
    const tableInfo = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
    const exists = tableInfo.some((col) => col.name === column);
    if (!exists) {
      db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`).run();
    }
  } catch (e) {
    console.warn(`Could not check or add column ${column} to ${table}:`, e);
  }
}

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbDirectory = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dbDirectory)) {
    fs.mkdirSync(dbDirectory, { recursive: true });
  }

  const dbPath = path.join(dbDirectory, 'timeline.db');
  dbInstance = new Database(dbPath, { timeout: 10000 });
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('busy_timeout = 10000');

  // Initialize SQLite schema
  dbInstance.exec(`
    CREATE TABLE IF NOT EXISTS organizations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      logo_url TEXT,
      plan TEXT DEFAULT 'pro',
      created_at TEXT
    );

    INSERT OR IGNORE INTO organizations (id, name, slug, plan, created_at)
    VALUES ('default', 'Default Workspace', 'default', 'pro', datetime('now'));

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT,
      name TEXT NOT NULL,
      avatar_url TEXT,
      role TEXT DEFAULT 'editor',
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS folders (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      name TEXT NOT NULL,
      color TEXT,
      order_index INTEGER DEFAULT 1,
      created_at TEXT
    );

    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      organization_id TEXT DEFAULT 'default',
      user_id TEXT,
      folder_id TEXT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      subtitle TEXT,
      client_name TEXT,
      brand_name TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      access_level TEXT NOT NULL DEFAULT 'restricted',
      is_trashed INTEGER NOT NULL DEFAULT 0,
      is_shared INTEGER NOT NULL DEFAULT 0,
      shared_by TEXT,
      created_at TEXT,
      updated_at TEXT
    );

    CREATE TABLE IF NOT EXISTS collaborators (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      permission TEXT NOT NULL DEFAULT 'editor',
      avatar_url TEXT,
      invited_at TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sprints (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      month_label TEXT NOT NULL,
      schedule_label TEXT NOT NULL,
      order_index INTEGER NOT NULL DEFAULT 1,
      start_date TEXT,
      end_date TEXT,
      workdays_only INTEGER NOT NULL DEFAULT 1,
      week_groups TEXT NOT NULL,
      days TEXT NOT NULL,
      status TEXT DEFAULT 'in_progress',
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS category_tracks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      order_index INTEGER NOT NULL DEFAULT 1,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS assignees (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      initials TEXT NOT NULL,
      color TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tags (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      name TEXT NOT NULL,
      color TEXT NOT NULL,
      order_index INTEGER DEFAULT 1,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL,
      sprint_id TEXT NOT NULL,
      category_id TEXT NOT NULL,
      tag_id TEXT,
      assignee_id TEXT NOT NULL,
      day_id TEXT NOT NULL,
      title TEXT NOT NULL,
      deliverables TEXT NOT NULL,
      deliverable_items TEXT,
      progress_percentage INTEGER NOT NULL DEFAULT 0,
      notes TEXT,
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY(project_id) REFERENCES projects(id) ON DELETE CASCADE,
      FOREIGN KEY(sprint_id) REFERENCES sprints(id) ON DELETE CASCADE,
      FOREIGN KEY(category_id) REFERENCES category_tracks(id) ON DELETE CASCADE,
      FOREIGN KEY(assignee_id) REFERENCES assignees(id) ON DELETE CASCADE
    );
  `);

  // Ensure all columns exist on pre-existing database tables
  ensureColumn(dbInstance, 'users', 'password_hash', 'TEXT');
  ensureColumn(dbInstance, 'users', 'avatar_url', 'TEXT');
  ensureColumn(dbInstance, 'users', 'role', 'TEXT DEFAULT "editor"');
  ensureColumn(dbInstance, 'users', 'created_at', 'TEXT');
  ensureColumn(dbInstance, 'projects', 'organization_id', 'TEXT DEFAULT "default"');
  ensureColumn(dbInstance, 'projects', 'user_id', 'TEXT');
  ensureColumn(dbInstance, 'projects', 'folder_id', 'TEXT');
  ensureColumn(dbInstance, 'projects', 'is_trashed', 'INTEGER DEFAULT 0');
  ensureColumn(dbInstance, 'projects', 'is_shared', 'INTEGER DEFAULT 0');
  ensureColumn(dbInstance, 'projects', 'shared_by', 'TEXT');
  ensureColumn(dbInstance, 'projects', 'subtitle', 'TEXT');
  ensureColumn(dbInstance, 'projects', 'client_name', 'TEXT');
  ensureColumn(dbInstance, 'projects', 'brand_name', 'TEXT');
  ensureColumn(dbInstance, 'projects', 'access_level', 'TEXT DEFAULT "public_view"');
  ensureColumn(dbInstance, 'tasks', 'tag_id', 'TEXT');
  ensureColumn(dbInstance, 'tasks', 'assignee_ids', 'TEXT');

  return dbInstance;
}

// User & Auth operations
export function createUserInDb(
  email: string,
  passwordHash: string,
  name: string
): { user: User } {
  const db = getDb();

  const userId = `user-${Date.now()}`;
  const user: User = {
    id: userId,
    email: email.toLowerCase(),
    name,
    createdAt: new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO users (id, email, password_hash, name, role, created_at)
    VALUES (?, ?, ?, ?, 'editor', ?)
  `).run(user.id, user.email, passwordHash, user.name, user.createdAt);

  return { user };
}

export function findUserByEmail(email: string): any | null {
  const db = getDb();
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase()) || null;
}

export function findUserById(id: string): User | null {
  const db = getDb();
  const row = db.prepare('SELECT id, email, name, avatar_url, created_at FROM users WHERE id = ?').get(id) as any;
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
  };
}

// Folder Operations
export function getAllFolders(userId?: string): Folder[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM folders ORDER BY order_index ASC, created_at ASC').all() as any[];
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    name: r.name,
    color: r.color,
    orderIndex: r.order_index,
    createdAt: r.created_at,
  }));
}

export function createFolderInDb(name: string, color: string = '#F59E0B', userId?: string): Folder {
  const db = getDb();
  const folder: Folder = {
    id: `folder-${Date.now()}`,
    userId: userId || undefined,
    name,
    color,
    orderIndex: 1,
    createdAt: new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO folders (id, user_id, name, color, order_index, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(folder.id, folder.userId || null, folder.name, folder.color, folder.orderIndex, folder.createdAt);

  return folder;
}

export function deleteFolderInDb(folderId: string): void {
  const db = getDb();
  db.prepare('UPDATE projects SET folder_id = NULL WHERE folder_id = ?').run(folderId);
  db.prepare('DELETE FROM folders WHERE id = ?').run(folderId);
}

export function renameFolderInDb(folderId: string, newName: string): void {
  const db = getDb();
  db.prepare('UPDATE folders SET name = ? WHERE id = ?').run(newName.trim(), folderId);
}

export function renameProjectInDb(projectId: string, newTitle: string): void {
  const db = getDb();
  db.prepare('UPDATE projects SET title = ?, updated_at = ? WHERE id = ? OR slug = ?').run(
    newTitle.trim(),
    new Date().toISOString(),
    projectId,
    projectId
  );
}

// Project & Trash Operations
export function getAllProjects(userId?: string): Project[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as any[];
  return rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    folderId: r.folder_id || null,
    slug: r.slug,
    title: r.title,
    subtitle: r.subtitle,
    clientName: r.client_name,
    brandName: r.brand_name,
    status: r.status,
    accessLevel: (r.access_level as AccessLevel) || 'restricted',
    isTrashed: Boolean(r.is_trashed),
    isShared: Boolean(r.is_shared),
    sharedBy: r.shared_by || undefined,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function updateProjectAccessLevel(projectId: string, accessLevel: AccessLevel): void {
  const db = getDb();
  db.prepare('UPDATE projects SET access_level = ?, updated_at = ? WHERE id = ? OR slug = ?').run(
    accessLevel,
    new Date().toISOString(),
    projectId,
    projectId
  );
}

export function trashProject(projectId: string): void {
  const db = getDb();
  db.prepare('UPDATE projects SET is_trashed = 1, updated_at = ? WHERE id = ? OR slug = ?').run(
    new Date().toISOString(),
    projectId,
    projectId
  );
}

export function restoreProject(projectId: string): void {
  const db = getDb();
  db.prepare('UPDATE projects SET is_trashed = 0, updated_at = ? WHERE id = ? OR slug = ?').run(
    new Date().toISOString(),
    projectId,
    projectId
  );
}

export function deleteProjectPermanently(projectId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM projects WHERE id = ? OR slug = ?').run(projectId, projectId);
}

export function emptyTrash(): void {
  const db = getDb();
  db.prepare('DELETE FROM projects WHERE is_trashed = 1').run();
}

export function moveProjectToFolder(projectId: string, folderId: string | null): void {
  const db = getDb();
  db.prepare('UPDATE projects SET folder_id = ?, updated_at = ? WHERE id = ? OR slug = ?').run(
    folderId,
    new Date().toISOString(),
    projectId,
    projectId
  );
}

// Collaborator Operations
export function getProjectCollaborators(projectId: string): Collaborator[] {
  const db = getDb();
  const rows = db.prepare('SELECT * FROM collaborators WHERE project_id = ? ORDER BY invited_at ASC').all(projectId) as any[];
  return rows.map((r) => ({
    id: r.id,
    projectId: r.project_id,
    email: r.email,
    name: r.name,
    permission: r.permission as PermissionLevel,
    avatarUrl: r.avatar_url,
    invitedAt: r.invited_at,
  }));
}

export function inviteCollaboratorToDb(
  projectId: string,
  email: string,
  name: string,
  permission: PermissionLevel = 'editor'
): Collaborator {
  const db = getDb();
  const existing = db.prepare('SELECT * FROM collaborators WHERE project_id = ? AND email = ?').get(projectId, email.toLowerCase()) as any;
  if (existing) {
    db.prepare('UPDATE collaborators SET permission = ?, name = ? WHERE id = ?').run(permission, name, existing.id);
    return {
      id: existing.id,
      projectId: existing.project_id,
      email: existing.email,
      name,
      permission,
      avatarUrl: existing.avatar_url,
      invitedAt: existing.invited_at,
    };
  }

  const col: Collaborator = {
    id: `col-${Date.now()}`,
    projectId,
    email: email.toLowerCase(),
    name,
    permission,
    invitedAt: new Date().toISOString(),
  };

  db.prepare(`
    INSERT INTO collaborators (id, project_id, email, name, permission, avatar_url, invited_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(col.id, col.projectId, col.email, col.name, col.permission, col.avatarUrl || null, col.invitedAt);

  return col;
}

export function updateCollaboratorPermissionInDb(
  collaboratorId: string,
  permission: PermissionLevel
): void {
  const db = getDb();
  db.prepare('UPDATE collaborators SET permission = ? WHERE id = ?').run(permission, collaboratorId);
}

export function removeCollaboratorFromDb(collaboratorId: string): void {
  const db = getDb();
  db.prepare('DELETE FROM collaborators WHERE id = ?').run(collaboratorId);
}

export function saveFullTimelineToDb(data: TimelineData): void {
  const db = getDb();

  const tx = db.transaction(() => {
    // 1. Resolve organization
    const orgRow = db.prepare('SELECT id FROM organizations LIMIT 1').get() as { id: string } | undefined;
    const orgId = data.project.organizationId || orgRow?.id || 'default';

    // 2. Upsert project
    const upsertProject = db.prepare(`
      INSERT INTO projects (id, organization_id, user_id, folder_id, slug, title, subtitle, client_name, brand_name, status, access_level, is_trashed, is_shared, shared_by, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        organization_id = excluded.organization_id,
        user_id = excluded.user_id,
        folder_id = excluded.folder_id,
        slug = excluded.slug,
        title = excluded.title,
        subtitle = excluded.subtitle,
        client_name = excluded.client_name,
        brand_name = excluded.brand_name,
        status = excluded.status,
        access_level = excluded.access_level,
        is_trashed = excluded.is_trashed,
        is_shared = excluded.is_shared,
        shared_by = excluded.shared_by,
        updated_at = excluded.updated_at
    `);

    upsertProject.run(
      data.project.id,
      orgId,
      data.project.userId || null,
      data.project.folderId || null,
      data.project.slug,
      data.project.title,
      data.project.subtitle || '',
      data.project.clientName || '',
      data.project.brandName || '',
      data.project.status || 'active',
      data.project.accessLevel || 'public_view',
      data.project.isTrashed ? 1 : 0,
      data.project.isShared ? 1 : 0,
      data.project.sharedBy || null,
      data.project.createdAt || new Date().toISOString(),
      new Date().toISOString()
    );

    // 2. Clean child records
    db.prepare('DELETE FROM tasks WHERE project_id = ?').run(data.project.id);
    db.prepare('DELETE FROM tags WHERE project_id = ?').run(data.project.id);
    db.prepare('DELETE FROM assignees WHERE project_id = ?').run(data.project.id);
    db.prepare('DELETE FROM category_tracks WHERE project_id = ?').run(data.project.id);
    db.prepare('DELETE FROM sprints WHERE project_id = ?').run(data.project.id);

    // Insert sprints
    const insertSprint = db.prepare(`
      INSERT INTO sprints (id, project_id, name, month_label, schedule_label, order_index, start_date, end_date, workdays_only, week_groups, days, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        name = excluded.name,
        month_label = excluded.month_label,
        schedule_label = excluded.schedule_label,
        order_index = excluded.order_index,
        start_date = excluded.start_date,
        end_date = excluded.end_date,
        workdays_only = excluded.workdays_only,
        week_groups = excluded.week_groups,
        days = excluded.days,
        status = excluded.status
    `);

    const insertCategory = db.prepare(`
      INSERT INTO category_tracks (id, project_id, title, description, order_index)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        title = excluded.title,
        description = excluded.description,
        order_index = excluded.order_index
    `);

    const insertAssignee = db.prepare(`
      INSERT INTO assignees (id, project_id, name, initials, color)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        name = excluded.name,
        initials = excluded.initials,
        color = excluded.color
    `);

    const insertTag = db.prepare(`
      INSERT INTO tags (id, project_id, name, color, order_index)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        name = excluded.name,
        color = excluded.color,
        order_index = excluded.order_index
    `);

    const insertTask = db.prepare(`
      INSERT INTO tasks (id, project_id, sprint_id, category_id, tag_id, assignee_id, assignee_ids, day_id, title, deliverables, deliverable_items, progress_percentage, notes, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        project_id = excluded.project_id,
        sprint_id = excluded.sprint_id,
        category_id = excluded.category_id,
        tag_id = excluded.tag_id,
        assignee_id = excluded.assignee_id,
        assignee_ids = excluded.assignee_ids,
        day_id = excluded.day_id,
        title = excluded.title,
        deliverables = excluded.deliverables,
        deliverable_items = excluded.deliverable_items,
        progress_percentage = excluded.progress_percentage,
        notes = excluded.notes,
        updated_at = excluded.updated_at
    `);

    for (const sprint of data.sprints) {
      insertSprint.run(
        sprint.id,
        data.project.id,
        sprint.name,
        sprint.monthLabel,
        sprint.scheduleLabel,
        sprint.orderIndex,
        sprint.startDate || null,
        sprint.endDate || null,
        sprint.workdaysOnly ? 1 : 0,
        JSON.stringify(sprint.weekGroups || []),
        JSON.stringify(sprint.days || []),
        sprint.status || 'in_progress'
      );
    }

    for (const cat of data.categories) {
      insertCategory.run(
        cat.id,
        data.project.id,
        cat.title,
        cat.description || '',
        cat.orderIndex || 1
      );
    }

    for (const ass of data.assignees) {
      insertAssignee.run(
        ass.id,
        data.project.id,
        ass.name,
        ass.initials,
        ass.color || '#F59E0B'
      );
    }

    if (data.tags && data.tags.length > 0) {
      for (const tag of data.tags) {
        insertTag.run(
          tag.id,
          data.project.id,
          tag.name,
          tag.color,
          tag.orderIndex || 1
        );
      }
    }

    for (const task of data.tasks) {
      const assigneeIds = task.assigneeIds && task.assigneeIds.length > 0
        ? task.assigneeIds
        : (task.assigneeId ? [task.assigneeId] : []);
      const primaryAssigneeId = assigneeIds[0] || task.assigneeId || '';

      insertTask.run(
        task.id,
        data.project.id,
        task.sprintId,
        task.categoryId,
        task.tagId || null,
        primaryAssigneeId,
        JSON.stringify(assigneeIds),
        task.dayId,
        task.title,
        JSON.stringify(task.deliverables || []),
        JSON.stringify(task.deliverableItems || []),
        task.progressPercentage || 0,
        task.notes || null,
        task.createdAt || new Date().toISOString(),
        new Date().toISOString()
      );
    }

    // Save collaborators if provided
    if (data.collaborators && data.collaborators.length > 0) {
      db.prepare('DELETE FROM collaborators WHERE project_id = ?').run(data.project.id);
      const insertCol = db.prepare(`
        INSERT INTO collaborators (id, project_id, email, name, permission, avatar_url, invited_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `);
      for (const col of data.collaborators) {
        insertCol.run(col.id, data.project.id, col.email, col.name, col.permission, col.avatarUrl || null, col.invitedAt);
      }
    }
  });

  tx();
}

export function getTimelineFromDb(slug: string): TimelineData | null {
  const db = getDb();

  const projectRow = db.prepare('SELECT * FROM projects WHERE slug = ?').get(slug) as any;
  if (!projectRow) {
    return null;
  }

  const projectId = projectRow.id;
  const sprintRows = db.prepare('SELECT * FROM sprints WHERE project_id = ? ORDER BY order_index').all(projectId) as any[];
  const categoryRows = db.prepare('SELECT * FROM category_tracks WHERE project_id = ? ORDER BY order_index').all(projectId) as any[];
  const assigneeRows = db.prepare('SELECT * FROM assignees WHERE project_id = ?').all(projectId) as any[];
  const tagRows = db.prepare('SELECT * FROM tags WHERE project_id = ? ORDER BY order_index ASC').all(projectId) as any[];
  const taskRows = db.prepare('SELECT * FROM tasks WHERE project_id = ?').all(projectId) as any[];
  const colRows = db.prepare('SELECT * FROM collaborators WHERE project_id = ? ORDER BY invited_at ASC').all(projectId) as any[];

  const project: Project = {
    id: projectRow.id,
    userId: projectRow.user_id,
    folderId: projectRow.folder_id || null,
    slug: projectRow.slug,
    title: projectRow.title,
    subtitle: projectRow.subtitle,
    clientName: projectRow.client_name,
    brandName: projectRow.brand_name,
    status: projectRow.status || 'active',
    accessLevel: (projectRow.access_level as AccessLevel) || 'restricted',
    isTrashed: Boolean(projectRow.is_trashed),
    isShared: Boolean(projectRow.is_shared),
    sharedBy: projectRow.shared_by || undefined,
    createdAt: projectRow.created_at,
    updatedAt: projectRow.updated_at,
  };

  const sprints: Sprint[] = sprintRows.map((s) =>
    normalizeSprintTo7Days({
      id: s.id,
      projectId: s.project_id,
      name: s.name,
      monthLabel: s.month_label,
      scheduleLabel: s.schedule_label,
      orderIndex: s.order_index,
      startDate: s.start_date,
      endDate: s.end_date,
      workdaysOnly: Boolean(s.workdays_only),
      weekGroups: JSON.parse(s.week_groups || '[]'),
      days: JSON.parse(s.days || '[]'),
      status: s.status || 'in_progress',
    })
  );

  const categories: CategoryTrack[] = categoryRows.map((c) => ({
    id: c.id,
    projectId: c.project_id,
    title: c.title,
    description: c.description,
    orderIndex: c.order_index,
  }));

  const assignees: Assignee[] = assigneeRows.map((a) => ({
    id: a.id,
    projectId: a.project_id,
    name: a.name,
    initials: a.initials,
    color: a.color,
  }));

  const tags: Tag[] = tagRows.map((t) => ({
    id: t.id,
    projectId: t.project_id,
    name: t.name,
    color: t.color,
    orderIndex: t.order_index,
  }));

  const tasks: TaskCard[] = taskRows.map((t) => {
    let assigneeIds: string[] = [];
    if (t.assignee_ids) {
      try {
        assigneeIds = JSON.parse(t.assignee_ids);
      } catch {
        assigneeIds = t.assignee_id ? [t.assignee_id] : [];
      }
    } else if (t.assignee_id) {
      assigneeIds = [t.assignee_id];
    }

    return {
      id: t.id,
      projectId: t.project_id,
      sprintId: t.sprint_id,
      categoryId: t.category_id,
      tagId: t.tag_id || undefined,
      assigneeId: assigneeIds[0] || t.assignee_id || '',
      assigneeIds,
      dayId: t.day_id,
      title: t.title,
      deliverables: JSON.parse(t.deliverables || '[]'),
      deliverableItems: t.deliverable_items ? JSON.parse(t.deliverable_items) : undefined,
      progressPercentage: t.progress_percentage || 0,
      notes: t.notes,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
    };
  });

  const collaborators: Collaborator[] = colRows.map((c) => ({
    id: c.id,
    projectId: c.project_id,
    email: c.email,
    name: c.name,
    permission: c.permission as PermissionLevel,
    avatarUrl: c.avatar_url,
    invitedAt: c.invited_at,
  }));

  return {
    project,
    sprints,
    categories,
    assignees,
    tags,
    tasks,
    collaborators,
  };
}

export function getAllProjectsList() {
  const db = getDb();
  return db.prepare('SELECT * FROM projects ORDER BY updated_at DESC').all() as any[];
}

export function resetDbToDefault() {
  saveFullTimelineToDb(defaultTimelineData);
  return defaultTimelineData;
}
