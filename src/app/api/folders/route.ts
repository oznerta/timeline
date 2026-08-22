import { NextRequest, NextResponse } from 'next/server';
import { getAllFolders, createFolderInDb, deleteFolderInDb, renameFolderInDb } from '@/lib/db';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  try {
    const folders = getAllFolders();
    return NextResponse.json({ folders });
  } catch (error: any) {
    console.error('API GET /api/folders error:', error);
    return NextResponse.json({ error: 'Failed to fetch folders' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, folderId, name, color } = body;

    if (action === 'rename' && folderId && name) {
      renameFolderInDb(folderId, name.trim());
      return NextResponse.json({ success: true, action: 'renamed' });
    }

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Folder name is required' }, { status: 400 });
    }

    const folder = createFolderInDb(name.trim(), undefined, color);
    return NextResponse.json({ folder });
  } catch (error: any) {
    console.error('API POST /api/folders error:', error);
    return NextResponse.json({ error: 'Failed to create or update folder' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Folder id is required' }, { status: 400 });
    }

    deleteFolderInDb(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('API DELETE /api/folders error:', error);
    return NextResponse.json({ error: 'Failed to delete folder' }, { status: 500 });
  }
}
