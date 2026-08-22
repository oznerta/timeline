import { describe, it, expect, beforeEach } from 'vitest';
import {
  getDb,
  createUserInDb,
  findUserByEmail,
  findUserById,
  createFolderInDb,
  getAllFolders,
  renameFolderInDb,
  deleteFolderInDb,
  saveFullTimelineToDb,
  getTimelineFromDb,
  getAllProjects,
  renameProjectInDb,
  moveProjectToFolder,
  trashProject,
  restoreProject,
  deleteProjectPermanently,
  inviteCollaboratorToDb,
  getProjectCollaborators,
  removeCollaboratorFromDb,
} from '@/lib/db';
import { createInitialTimeline } from '@/lib/default-data';

describe('Database & Model Persistence (SQLite)', () => {
  beforeEach(() => {
    // Ensure DB is initialized
    getDb();
  });

  it('creates and finds users by email and ID', () => {
    const email = `testuser_${Date.now()}@example.com`;
    const passwordHash = 'salt123:hash456';
    const name = 'Test Engineer';

    const { user } = createUserInDb(email, passwordHash, name);
    expect(user.id).toBeDefined();
    expect(user.email).toBe(email.toLowerCase());
    expect(user.name).toBe(name);

    const foundByEmail = findUserByEmail(email);
    expect(foundByEmail).not.toBeNull();
    expect(foundByEmail.id).toBe(user.id);

    const foundById = findUserById(user.id);
    expect(foundById).not.toBeNull();
    expect(foundById?.email).toBe(email.toLowerCase());
  });

  it('performs complete Folder CRUD operations', () => {
    const folderName = `Design Assets ${Date.now()}`;
    const folder = createFolderInDb(folderName, '#F59E0B');

    expect(folder.id).toBeDefined();
    expect(folder.name).toBe(folderName);

    const folders = getAllFolders();
    expect(folders.some((f) => f.id === folder.id)).toBe(true);

    renameFolderInDb(folder.id, 'Renamed Folder');
    const renamed = getAllFolders().find((f) => f.id === folder.id);
    expect(renamed?.name).toBe('Renamed Folder');

    deleteFolderInDb(folder.id);
    const afterDelete = getAllFolders().find((f) => f.id === folder.id);
    expect(afterDelete).toBeUndefined();
  });

  it('saves and retrieves full Timeline models with 0 mock tasks', () => {
    const slug = `clean-sprint-${Date.now()}`;
    const initial = createInitialTimeline('Clean Sprint Alpha', slug, '2026-08-22');

    expect(initial.tasks).toHaveLength(0);
    saveFullTimelineToDb(initial);

    const retrieved = getTimelineFromDb(slug);
    expect(retrieved).not.toBeNull();
    expect(retrieved?.project.title).toBe('Clean Sprint Alpha');
    expect(retrieved?.project.slug).toBe(slug);
    expect(retrieved?.sprints).toHaveLength(1);
    expect(retrieved?.sprints[0].days).toHaveLength(28);
    expect(retrieved?.tasks).toHaveLength(0);
  });

  it('handles Project lifecycle: rename, move to folder, trash, restore, and delete', () => {
    const slug = `lifecycle-proj-${Date.now()}`;
    const timeline = createInitialTimeline('Lifecycle Sprint', slug, '2026-08-22');
    saveFullTimelineToDb(timeline);

    const folder = createFolderInDb('Target Folder', '#3B82F6');

    // Move to folder
    moveProjectToFolder(timeline.project.id, folder.id);
    let proj = getAllProjects().find((p) => p.slug === slug);
    expect(proj?.folderId).toBe(folder.id);

    // Rename
    renameProjectInDb(timeline.project.id, 'Renamed Sprint Title');
    proj = getAllProjects().find((p) => p.slug === slug);
    expect(proj?.title).toBe('Renamed Sprint Title');

    // Trash
    trashProject(timeline.project.id);
    proj = getAllProjects().find((p) => p.slug === slug);
    expect(proj?.isTrashed).toBe(true);

    // Restore
    restoreProject(timeline.project.id);
    proj = getAllProjects().find((p) => p.slug === slug);
    expect(proj?.isTrashed).toBe(false);

    // Permanent delete
    deleteProjectPermanently(timeline.project.id);
    proj = getAllProjects().find((p) => p.slug === slug);
    expect(proj).toBeUndefined();

    deleteFolderInDb(folder.id);
  });

  it('manages collaborator invitations and permissions', () => {
    const slug = `collab-proj-${Date.now()}`;
    const timeline = createInitialTimeline('Collaboration Sprint', slug, '2026-08-22');
    saveFullTimelineToDb(timeline);

    const collabEmail = `collab_${Date.now()}@team.com`;
    const collaborator = inviteCollaboratorToDb(timeline.project.id, collabEmail, 'Alex Designer', 'editor');

    expect(collaborator.id).toBeDefined();
    expect(collaborator.email).toBe(collabEmail);
    expect(collaborator.permission).toBe('editor');

    const list = getProjectCollaborators(timeline.project.id);
    expect(list.some((c) => c.email === collabEmail)).toBe(true);

    removeCollaboratorFromDb(collaborator.id);
    const afterRemoval = getProjectCollaborators(timeline.project.id);
    expect(afterRemoval.some((c) => c.email === collabEmail)).toBe(false);

    deleteProjectPermanently(timeline.project.id);
  });
});
