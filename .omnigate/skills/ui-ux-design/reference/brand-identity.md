# Brand Identity & Asset Guidelines

This document outlines app identity conventions, brand asset management, logo usage rules, and theme switching standards.

---

## 1. App Identity & Document Standards

- **App Identity Name**: Defined in `.omnigate/PROJECT-CONTEXT.md` under Section 9 (`UI Application Definition`).
- **Browser Document Title Bar**: Format MUST follow `Page Name · App Name` (e.g. `Contacts · Agentic CRM`).
- **Brand Personality**: Professional, Enterprise-grade, Modern, High-Performance, Governed.

---

## 2. Brand Asset Directory & Naming Convention

Place all brand assets inside `<BRAND_ASSETS_PATH>` (e.g. `src/assets/` or `public/assets/`):

```text
assets/
├── logo-full-light.png   # Full horizontal logo for light backgrounds (sidebar / navbar expanded)
├── logo-full-dark.png    # Full horizontal logo for dark backgrounds
├── logo-short-light.png  # Icon-only square logo for light backgrounds (sidebar collapsed)
├── logo-short-dark.png   # Icon-only square logo for dark backgrounds
├── favicon-light.ico     # Browser favicon for light system theme
└── favicon-dark.ico      # Browser favicon for dark system theme
```

### Logo Usage & Clearance Rules
- **Clearance Margin**: Maintain at least `16px` of clear padding around brand logos.
- **Minimum Dimensions**:
  - Full Logo: Minimum width `140px`, height proportional.
  - Collapsed Short Logo: Minimum `32px × 32px`.
- **Dynamic Theme Switching**: Logo components MUST toggle source dynamically based on active theme state:
  ```tsx
  <img 
    src={isDark ? '/assets/logo-full-dark.png' : '/assets/logo-full-light.png'} 
    alt="Company Logo" 
    className="h-8 w-auto"
  />
  ```

---

## 3. Theme Switcher Convention

- **Theme Modes Supported**: `System` (follows OS preference), `Dark`, and `Light`.
- **Persistence**: Persist user choice in `localStorage` under `theme-preference`.
- **Root Class Target**: Toggle the `.dark` class on `document.documentElement` (`<html>` element).
- **CSS Variable Cascade**: Ensure all design tokens in `design-tokens.md` cascade seamlessly through CSS root variables (`:root` vs `.dark`).
