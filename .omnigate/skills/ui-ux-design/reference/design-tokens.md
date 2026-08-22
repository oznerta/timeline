# Production Design Tokens & Style System

This specification defines the design token tokens, color palettes, typography scale, spacing grid, radii, shadows, and accessibility rules.

---

## 1. Color System

### Brand & Accent Palette
- **Primary / Brand**: `#193E6B` (`hsl(213, 62%, 26%)`) — Deep Midnight Blue
- **Secondary / Accent**: `#B3A125` (`hsl(52, 65%, 42%)`) — Green Gold
- **Tertiary / Warm**: `#E9AC53` (`hsl(36, 76%, 62%)`) — Sunray Gold
- **Vibrant Accent**: `#991547` (`hsl(337, 76%, 34%)`) — Violet Red
- **Teal / Slate Accent**: `#448E9D` (`hsl(190, 40%, 44%)`) — Jelly Bean Teal
- **Purple / Royal Accent**: `#7F3F98` (`hsl(283, 42%, 42%)`) — Cadmium Violet

### Surface & Neutral Scale (Light / Dark Modes)

| Token Name | Light Mode Hex | Dark Mode Hex | Usage |
| :--- | :--- | :--- | :--- |
| `surface-app` | `#F8FAFC` | `#0F172A` | Page viewport background |
| `surface-card` | `#FFFFFF` | `#1E293B` | Cards, panels, tables, dialogs |
| `surface-subtle` | `#F1F5F9` | `#334155` | Table headers, muted rows, input fills |
| `border-default` | `#E2E8F0` | `#334155` | Dividers, card borders, table grid lines |
| `border-strong` | `#CBD5E1` | `#475569` | Input borders, active states |
| `text-primary` | `#0F172A` | `#F8FAFC` | Main headings, body text, primary labels |
| `text-secondary` | `#475569` | `#94A3B8` | Subtitles, table column headers, icons |
| `text-muted` | `#64748B` | `#64748B` | Captions, placeholders, disabled text |

### Semantic Status Tints

| Semantic State | Base Color | Light Tint Bg | Dark Tint Bg | Text / Border |
| :--- | :--- | :--- | :--- | :--- |
| **Success** | `#16A34A` (Green) | `#F0FDF4` | `#062E1B` | `#15803D` / `#86EFAC` |
| **Warning** | `#D97706` (Amber) | `#FFFBEB` | `#361F04` | `#B45309` / `#FDE68A` |
| **Error / Danger**| `#DC2626` (Red) | `#FEF2F2` | `#3A0D0D` | `#B91C1C` / `#FCA5A5` |
| **Info / Neutral** | `#2563EB` (Blue) | `#EFF6FF` | `#0D2759` | `#1D4ED8` / `#93C5FD` |

---

## 2. Typography Scale

- **Headings Font Family**: `Montserrat`, `Inter`, or system sans-serif.
- **Body Font Family**: `Source Sans 3`, `Roboto`, or system sans-serif.

| Level | Size | Line Height | Weight | Tracking | Usage |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `Display` | `32px / 2rem` | `40px` | `700 (Bold)` | `-0.02em` | Page H1 hero headers |
| `Heading-1` | `24px / 1.5rem` | `32px` | `600 (SemiBold)`| `-0.01em` | Section headers, modal titles |
| `Heading-2` | `18px / 1.125rem`| `26px` | `600 (SemiBold)`| `0` | Card titles, group headings |
| `Subheading` | `14px / 0.875rem`| `20px` | `600 (SemiBold)`| `0.01em` | Table headers, form field labels |
| `Body` | `14px / 0.875rem`| `20px` | `400 (Regular)` | `0` | Standard paragraph, table cell text |
| `Caption` | `12px / 0.75rem` | `16px` | `400 (Regular)` | `0.01em` | Help text, timestamps, badge labels |

---

## 3. Spacing, Radii, Shadows & Elevation

### Spacing Grid (4px / 8px Base)
- `space-1` (`4px`), `space-2` (`8px`), `space-3` (`12px`), `space-4` (`16px`), `space-6` (`24px`), `space-8` (`32px`), `space-12` (`48px`).

### Border Radii Scale
- `radius-sm`: `4px` (Badges, small buttons, tooltips)
- `radius-md`: `6px` (Standard buttons, inputs, dropdowns)
- `radius-lg`: `8px` (Cards, table containers, panels)
- `radius-xl`: `12px` (Modals, slide-over sheets)
- `radius-full`: `9999px` (Pill badges, round avatars)

### Elevation & Shadows
- `shadow-sm`: `0 1px 2px 0 rgba(0, 0, 0, 0.05)` (Cards, inputs)
- `shadow-md`: `0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)` (Dropdown menus, popovers)
- `shadow-lg`: `0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)` (Modals, slide-overs)

---

## 4. Density Modes & Icon Rules

### Density Standards
- **Compact (Default for Enterprise CRUD)**: Table cell padding `py-2 px-3` (8px top/bottom), input height `36px` (`h-9`), dense spacing `gap-4`.
- **Comfortable**: Table cell padding `py-3 px-4`, input height `40px` (`h-10`), spacing `gap-6`.

### Icon System Standard
- **Registry**: Inline SVG or Lucide React icons.
- **ViewBox**: `0 0 24 24`.
- **Stroke**: `2px` outline style.
- **Sizing**: Default `18px` (`w-4.5 h-4.5`) or `20px` (`w-5 h-5`).

---

## 5. Accessibility & Focus Compliance (WCAG AA)

- **Contrast Floor**: Minimum `4.5:1` ratio for body text, `3:1` for UI icons/borders.
- **Focus Rings**: All interactive controls must render a distinct focus ring on keyboard tab navigation (`focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2`).
- **Interactive IDs**: Every input, button, table, and modal MUST feature a unique `id` attribute for automated testing and screen reader accessibility.
