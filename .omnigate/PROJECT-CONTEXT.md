# Project Context & Single Source of Truth

> **OmniGate AI Context File**  
> Living blueprint for **Weekline** — Simple, Streamlined Sprint Timeline Platform.

---

## 1. Project Overview

| Property | Value |
|---|---|
| **Project Name** | **Weekline** |
| **Workspace Model** | User-First Personal Workspace (Multi-Week Delivery Schedules) |
| **Primary Framework** | Next.js 16 (App Router) + React 19 + TypeScript |
| **Styling Engine** | Tailwind CSS v4 + Clean White / Light Theme Design Tokens |
| **Database Architecture** | Dual Database Engine: SQLite (Local) + Supabase PostgreSQL (Cloud) |
| **Core Paradigm** | Simple, focused Multi-Week Timeline Grid with Sticky Headers & Auth Guard |

---

## 2. System Architecture

```mermaid
graph TD
    User([User Browser])
    
    subgraph FrontendApp ["Next.js 16 Frontend Layer"]
        AuthRoute["/auth (Sign In / Create Account)"]
        DashboardRoute["/dashboard (My Timelines)"]
        CanvasRoute["/t/:slug (Master Delivery Schedule)"]
        AuthCtx["AuthContext (Session & State)"]
    end
    
    subgraph APILayer ["Dynamic Route Handlers"]
        AuthAPI["/api/auth (Login, Signup, Me, Logout)"]
        TimelineAPI["/api/timeline/:slug (CRUD Sync)"]
    end
    
    subgraph DataStorage ["Dual Database Layer"]
        LocalSQLite[("Local SQLite (data/timeline.db)")]
        CloudSupabase[("Supabase PostgreSQL (Cloud)")]
    end
    
    User --> AuthRoute
    User --> DashboardRoute
    User --> CanvasRoute
    
    DashboardRoute --> AuthCtx
    CanvasRoute --> AuthCtx
    
    AuthRoute --> AuthAPI
    DashboardRoute --> TimelineAPI
    CanvasRoute --> TimelineAPI
    
    AuthAPI --> LocalSQLite
    TimelineAPI --> LocalSQLite
    TimelineAPI -.-> CloudSupabase
```

---

## 3. Database Schema (ERD)

```mermaid
erDiagram
    USERS ||--o{ PROJECTS : "owns timelines"
    PROJECTS ||--o{ SPRINTS : "contains"
    PROJECTS ||--o{ CATEGORY_TRACKS : "defines"
    PROJECTS ||--o{ ASSIGNEES : "assigns"
    PROJECTS ||--o{ PHASES : "configures"
    SPRINTS ||--o{ TASKS : "schedules"
    CATEGORY_TRACKS ||--o{ TASKS : "categorizes"
    PHASES ||--o{ TASKS : "stages"
    ASSIGNEES ||--o{ TASKS : "executes"
    TASKS ||--o{ DELIVERABLES : "tracks"

    USERS {
        string id PK
        string email UK
        string password_hash
        string name
        string avatar_url
        string created_at
    }

    PROJECTS {
        string id PK
        string user_id FK
        string slug UK
        string title
        string subtitle
        string client_name
        string brand_name
        string status
        string created_at
        string updated_at
    }

    SPRINTS {
        string id PK
        string project_id FK
        string name
        string month_label
        string schedule_label
        string week_groups
        string days
    }

    CATEGORY_TRACKS {
        string id PK
        string project_id FK
        string title
        string description
        int order_index
    }

    PHASES {
        string id PK
        string project_id FK
        string badge_text
        string color_hex
        string color_gradient
    }

    TASKS {
        string id PK
        string project_id FK
        string sprint_id FK
        string category_id FK
        string phase_id FK
        string assignee_id FK
        string day_id
        string title
        string deliverables
        string deliverable_items
    }
```

---

## 4. Key Rules & Governance

1. **Simplicity First**: No organization complexity, no roles, no favorite hearts. Just clean personal timelines.
2. **Authentication & Route Guard**: Non-logged in users visiting `/dashboard` or `/` are redirected to `/auth`.
3. **Zero Dummy Data**: No hardcoded mock users or placeholder projects.
4. **Clean Light / White Aesthetic**: High-contrast slate typography and vibrant stage badges.
