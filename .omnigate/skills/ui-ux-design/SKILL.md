---
name: ui-ux-design
description: Production UI/UX Design System, Brand Identity, Design Tokens, Palette, Typography, Component Patterns, and Layout Conventions. Use when building or modifying UI components, styling, themes, screens, or page layouts.
---

# UI/UX Design System & Brand Governance Skill

This skill defines the mandatory design tokens, brand identity, layout conventions, and production component patterns for building enterprise-grade user interfaces.

---

## 1. Quick Reference & Core Files

When executing UI/UX development tasks, read the specialized reference files as needed:

- **[reference/design-tokens.md](reference/design-tokens.md)** — Canonical design tokens: Brand palette, surface colors, semantic tints, typography scale, spacing grid, radii, shadows, z-index, accessibility (WCAG AA), and density rules.
- **[reference/brand-identity.md](reference/brand-identity.md)** — App identity, document title bar, tagline, brand asset registry (`assets/`), logo usage rules, and theme switcher (System/Light/Dark) conventions.
- **[reference/component-patterns.md](reference/component-patterns.md)** — Production UI patterns: Viewport-locked no-scroll layout chain, data tables, bulk bars, status badges, forms, empty states, modals, and toasts.

---

## 2. Non-Negotiable UI Governance Principles

1. **Strict Design Token Adherence**: Never use arbitrary inline color hex codes (`#193e6b`), font sizes, or pixel offsets (`padding: 13px`). Always use established design tokens or framework theme variables (`bg-primary`, `text-surface-muted`, `var(--color-brand-primary)`).
2. **Viewport-Locked No-Scroll Layout Chain**: No page shall scroll at the browser window level. Pages must follow the Fill → Fixed → Inner-Scroll architecture:
   - App Shell: `height: 100vh; overflow: hidden;`
   - Page Outer Wrapper: `flex min-h-0 flex-1 flex-col overflow-hidden`
   - Fixed Header / Toolbar / Filter Bar: `shrink-0`
   - Scroll Region (e.g. Table Container / Form Content): `min-h-0 flex-1 overflow-y-auto`
   - Pagination / Sticky Footer: `shrink-0`
3. **Four Mandatory Data-Driven States**: Every dynamic view or component MUST handle:
   - **Loading State**: Structured skeleton loader (matching content geometry, no generic full-screen spinners).
   - **Success / Active State**: Clean visual hierarchy and data presentation.
   - **Empty State**: Explicit visual indicator with an actionable primary CTA.
   - **Error State**: Informative, non-cryptic error message with a clear Retry option.
4. **Theme Switcher & Accessibility**: Support System / Light / Dark modes seamlessly. Maintain a minimum contrast ratio of 4.5:1 (WCAG AA) for standard text and 3:1 for large text. Ensure visible focus rings (`ring-2 ring-primary`) for keyboard navigation.
5. **No Visual Degradation**: Never compromise UI density, alignment, or contrast. Ensure all interactive components have unique, descriptive IDs for automated testing.
