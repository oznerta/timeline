import { NextRequest, NextResponse } from 'next/server';
import {
  getAllProjects,
  trashProject,
  restoreProject,
  deleteProjectPermanently,
  emptyTrash,
  moveProjectToFolder,
  renameProjectInDb,
} from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const projects = getAllProjects();
    return NextResponse.json({ projects });
  } catch (error: any) {
    console.error('API GET /api/timelines error:', error);
    return NextResponse.json({ error: 'Failed to fetch timelines' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, projectId, folderId, title } = body;

    if (action === 'rename' && projectId && title) {
      renameProjectInDb(projectId, title.trim());
      return NextResponse.json({ success: true, action: 'renamed' });
    }

    if (action === 'trash' && projectId) {
      trashProject(projectId);
      return NextResponse.json({ success: true, action: 'trashed' });
    }

    if (action === 'restore' && projectId) {
      restoreProject(projectId);
      return NextResponse.json({ success: true, action: 'restored' });
    }

    if (action === 'delete_permanently' && projectId) {
      deleteProjectPermanently(projectId);
      return NextResponse.json({ success: true, action: 'deleted' });
    }

    if (action === 'empty_trash') {
      emptyTrash();
      return NextResponse.json({ success: true, action: 'empty_trash' });
    }

    if (action === 'move_to_folder' && projectId) {
      moveProjectToFolder(projectId, folderId || null);
      return NextResponse.json({ success: true, action: 'moved' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('API POST /api/timelines error:', error);
    return NextResponse.json({ error: 'Failed to process timeline action' }, { status: 500 });
  }
}
