# Production UI Component & Layout Patterns

This specification details standard production layouts, data grids, form patterns, status badges, modals, and feedback components.

---

## 1. Viewport-Locked No-Scroll Page Layout Chain

Enterprise web apps must eliminate browser-level page scrolling. All viewports follow a strict flex-column layout chain:

```text
┌────────────────────────────────────────────────────────┐
│ App Shell Container (height: 100vh; overflow: hidden) │
│ ┌────────────────────────────────────────────────────┐ │
│ │ Top Navigation Bar (shrink-0)                      │ │
│ ├────────────────────────────────────────────────────┤ │
│ │ Main Content Wrapper (flex-1 min-h-0 flex-col)     │ │
│ │ ┌────────────────────────────────────────────────┐ │ │
│ │ │ Page Header & Filter Bar (shrink-0)            │ │ │
│ │ ├────────────────────────────────────────────────┤ │ │
│ │ │ Table / Content Region (flex-1 overflow-y-auto)│ │ │
│ │ │ [SCROLLS INNER CONTENT ONLY]                  │ │ │
│ │ ├────────────────────────────────────────────────┤ │ │
│ │ │ Pagination / Footer (shrink-0)                 │ │ │
│ │ └────────────────────────────────────────────────┘ │ │
│ └────────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

### Layout Code Blueprint (React + Tailwind Example)

```tsx
export function PageLayout({ header, filters, content, pagination }: PageLayoutProps) {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-4 overflow-hidden p-6">
      {/* Fixed Page Header & Toolbar */}
      <div className="flex shrink-0 items-center justify-between">
        {header}
      </div>

      {/* Fixed Filter & Search Bar */}
      {filters && <div className="shrink-0">{filters}</div>}

      {/* Primary Scrollable Content / Table Card */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-border-default bg-surface-card shadow-sm">
        <div className="min-h-0 flex-1 overflow-y-auto">
          {content}
        </div>
        
        {/* Fixed Pagination Bar pinned at container bottom */}
        {pagination && (
          <div className="shrink-0 border-t border-border-default bg-surface-card p-3">
            {pagination}
          </div>
        )}
      </div>
    </div>
  );
}
```

---

## 2. Table Containers & Data Grids

- **Sticky Header**: Table `<thead>` MUST use `sticky top-0 z-10 bg-surface-subtle` so column headers remain visible while scrolling table rows.
- **Row Hovers & Selection**: Rows must feature subtle hover highlighting (`hover:bg-surface-subtle/50`). Selected rows use a distinct tint (`bg-primary/5`).
- **Bulk Action Bar**: When items are checked via checkboxes, render a fixed float/top bulk action bar displaying item count, bulk operations (Delete, Export, Assign), and a Deselect All button.

---

## 3. Data-Driven States

Every dynamic view MUST handle:

### Loading Skeleton
```tsx
<div className="space-y-3 p-4">
  <div className="h-6 w-1/3 animate-pulse rounded bg-surface-subtle" />
  <div className="h-10 w-full animate-pulse rounded bg-surface-subtle" />
  <div className="h-10 w-full animate-pulse rounded bg-surface-subtle" />
</div>
```

### Empty State Pattern
```tsx
<div className="flex flex-col items-center justify-center p-12 text-center">
  <div className="rounded-full bg-surface-subtle p-4 text-text-muted">
    <FolderOpenIcon className="h-8 w-8" />
  </div>
  <h3 className="mt-4 text-lg font-semibold text-text-primary">No records found</h3>
  <p className="mt-1 text-sm text-text-secondary">Get started by creating your first entry.</p>
  <button className="mt-4 btn-primary">Create Entry</button>
</div>
```

---

## 4. Status Badges & Pills

Render status badges with soft tinted backgrounds, explicit text contrast, and a colored status dot:

```tsx
export function StatusBadge({ status }: { status: 'active' | 'pending' | 'failed' }) {
  const styles = {
    active: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300',
    pending: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300',
    failed: 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/50 dark:text-red-300',
  }[status];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${styles}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status.toUpperCase()}
    </span>
  );
}
```

---

## 5. Forms, Validation & Modals

- **Validation Error Placement**: Render red validation text (`text-xs text-red-600`) directly below affected input elements.
- **Async Form Submit**: Disable the submit button and show a spinner icon (`Loader2` rotating) during API submission.
- **Modal Overlays**: Modal dialogs must trap focus, lock page backdrop scrolling, support `Esc` key closing, and provide explicit Cancel / Confirm actions.
