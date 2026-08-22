# 🚀 Weekline — Sprint Delivery Timeline Platform

**Weekline** is a modern, high-contrast, production-grade sprint delivery schedule and organization workspace platform built with **Next.js 16 (App Router)**, **React 19**, **TypeScript**, and **Tailwind CSS**, governed by **OmniGate AI**.

---

## 🌟 Key Features

1. **Clean White / Light Aesthetic**: High-contrast modern typography, crisp borders, and vibrant stage gradients (`DESIGN`, `DEV`, `REVIEW`, `QA TEST`, `PUBLISH`).
2. **Multi-Week Delivery Schedules**: Dynamic month calculation, 4-week structured view, and customizable week filtering.
3. **Multi-Select Combobox Drawer**: Dynamically toggle and display any combination of weeks (`Week 1`, `Week 2`, `Week 3`, `Week 4`, or `All Weeks`).
4. **Organization-Based Workspaces**: Multi-tenant workspace management, zero dummy data, and real user persistence.
5. **Authentication & Route Guard**: Complete Sign In / Sign Up portal with strict dashboard route protection and session restoration (SQLite + Supabase).
6. **Master Timeline Board**:
   - Fixed viewport-width month schedule header (does not scroll horizontally).
   - Sticky top week groups and days header.
   - Sticky left work stream tracks column with grouped `+ Add` actions.

---

## 🛠️ Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to launch **Weekline**.

---

## 🗺️ Application Routes

| Route | Purpose |
|---|---|
| [`/`](http://localhost:3000) / [`/dashboard`](http://localhost:3000/dashboard) | **Weekline Organization Workspace Dashboard** *(Protected)* |
| [`/auth`](http://localhost:3000/auth) | **Authentication Portal (Sign In / Sign Up)** |
| [`/t/:slug`](http://localhost:3000/t/master-schedule) | **Master Delivery Schedule** |

---

## 🏛️ Governance

This project is governed by **OmniGate AI**. System configuration and architecture blueprints reside in `.omnigate/PROJECT-CONTEXT.md`.
