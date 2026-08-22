-- ==========================================================
-- PRODUCTION SUPABASE SCHEMA: WEEKLINE TIMELINE PLATFORM
-- ==========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Organizations Table
CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  name TEXT NOT NULL DEFAULT 'Personal Workspace',
  slug TEXT UNIQUE NOT NULL DEFAULT 'default',
  plan TEXT NOT NULL DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default organization
INSERT INTO organizations (id, name, slug, plan)
VALUES ('default', 'Personal Workspace', 'default', 'free')
ON CONFLICT (slug) DO NOTHING;

-- 2. Users Table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password_hash TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'editor',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Folders Table (Dashboard Organization)
CREATE TABLE IF NOT EXISTS folders (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#F59E0B',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Projects (Timelines)
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  organization_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  user_id TEXT,
  folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL DEFAULT 'Timeline',
  subtitle TEXT NOT NULL DEFAULT 'Sprint Production Cycle & Milestones',
  client_name TEXT NOT NULL DEFAULT 'Client Name',
  brand_name TEXT NOT NULL DEFAULT 'Graphic Design Studio',
  access_level TEXT NOT NULL DEFAULT 'public_view',
  is_favorite BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Collaborators
CREATE TABLE IF NOT EXISTS collaborators (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  permission TEXT NOT NULL DEFAULT 'editor',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Sprints
CREATE TABLE IF NOT EXISTS sprints (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Sprint 1',
  month_label TEXT NOT NULL DEFAULT 'MONTH',
  schedule_label TEXT NOT NULL DEFAULT 'SCHEDULE',
  order_index INT NOT NULL DEFAULT 1,
  start_date DATE,
  end_date DATE,
  workdays_only BOOLEAN NOT NULL DEFAULT false,
  week_groups JSONB NOT NULL DEFAULT '[]'::jsonb,
  days JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'in_progress',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Category Tracks (Work Streams)
CREATE TABLE IF NOT EXISTS category_tracks (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  order_index INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Assignees (Timeline Members)
CREATE TABLE IF NOT EXISTS assignees (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT DEFAULT '',
  initials TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL DEFAULT '#F59E0B',
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. Tags (Custom Colored Badges)
CREATE TABLE IF NOT EXISTS tags (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#0F172A',
  order_index INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Tasks (Checklist-First Cards)
CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sprint_id TEXT NOT NULL REFERENCES sprints(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES category_tracks(id) ON DELETE CASCADE,
  tag_id TEXT REFERENCES tags(id) ON DELETE SET NULL,
  assignee_id TEXT DEFAULT '',
  assignee_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  day_id TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  deliverables JSONB NOT NULL DEFAULT '[]'::jsonb,
  deliverable_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  progress_percentage INT NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  order_index INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================================
-- INDEXES FOR HIGH-PERFORMANCE QUERYING
-- ==========================================================
CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_user ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_folder ON projects(folder_id);
CREATE INDEX IF NOT EXISTS idx_folders_user ON folders(user_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_project ON collaborators(project_id);
CREATE INDEX IF NOT EXISTS idx_collaborators_email ON collaborators(email);
CREATE INDEX IF NOT EXISTS idx_sprints_project ON sprints(project_id);
CREATE INDEX IF NOT EXISTS idx_categories_project ON category_tracks(project_id);
CREATE INDEX IF NOT EXISTS idx_tags_project ON tags(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_sprint ON tasks(sprint_id);
CREATE INDEX IF NOT EXISTS idx_tasks_category ON tasks(category_id);
CREATE INDEX IF NOT EXISTS idx_tasks_day ON tasks(day_id);

-- ==========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE sprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignees ENABLE ROW LEVEL SECURITY;
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Allow full access for application operations
CREATE POLICY "Full access for organizations" ON organizations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Full access for users" ON users FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Full access for folders" ON folders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Full access for projects" ON projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Full access for collaborators" ON collaborators FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Full access for sprints" ON sprints FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Full access for category_tracks" ON category_tracks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Full access for assignees" ON assignees FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Full access for tags" ON tags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Full access for tasks" ON tasks FOR ALL USING (true) WITH CHECK (true);
