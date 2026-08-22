# UI & UX Quality Rules

Applies whenever building or editing user interfaces (Web apps, Mobile interfaces, Desktop UIs, Design Tokens).
For comprehensive brand identity, design tokens, color palette, typography scale, component patterns, and viewport-locked layout conventions, refer to `.omnigate/skills/ui-ux-design/SKILL.md`.

## 1. Adaptable & Modern Design System

- **Token Consistency**: Use design tokens or CSS variables for colors, typography, spacing, border radii, and shadows rather than ad-hoc inline values.
- **Theme Support**: Support Light / Dark modes cleanly where applicable using CSS variables or framework theme providers.
- **Visual Polish**: Maintain clean typography hierarchy, responsive layouts, consistent button states, and harmonious color palettes.

## 2. Mandatory Data-Driven States

For any component or screen rendering dynamic data, handle all four core UI states:
1. **Loading State**: Render skeleton loaders matching the content structure (avoid full-screen spinners where skeletons can be used).
2. **Success / Active State**: Render populated content smoothly with clear visual hierarchy.
3. **Empty State**: Render clear no-data guidance with actionable primary CTAs (e.g. "No items found. Create your first item").
4. **Error State**: Render informative, non-cryptic error messaging with a "Retry" or recovery option.

## 3. Component & Layout Best Practices

- **Forms & Inputs**: Provide inline validation feedback on blur. Mark required fields clearly. Disable submit buttons during async submission and show a loading spinner.
- **Modals & Overlays**: Trap focus within open modals, support `Esc` to close, lock background scrolling, and return focus to trigger elements upon closing.
- **Toasts & Feedback**: Confirm user actions with non-blocking toast notifications (auto-dismiss for success, persistent for errors).
- **Responsive Layouts**: Design mobile-first or ensure responsive breakpoints handle small screens, scrolling tables, and collapsing sidebars gracefully.
- **Accessibility (WCAG AA)**: Maintain readable contrast ratios, ARIA attributes on custom widgets, and visible keyboard focus outlines.
