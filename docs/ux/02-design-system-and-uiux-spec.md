# Video Downloader Design System and UI/UX Spec

Status: Draft for review  
Scope: Item 2 deliverable (publish-ready documentation)

## 1. Design Principles

1. Clarity over novelty.
2. One primary action per screen.
3. Status visibility at all times.
4. Progressive disclosure for advanced controls.
5. Accessibility is baseline quality, not enhancement.
6. Motion must communicate state or causality.
7. Consistency of spacing, typography, and control behavior.

## 2. Foundations

### 2.1 Color System

#### Brand / Primary

- primary-50: #EEF6FF
- primary-100: #DAECFF
- primary-200: #B9DAFF
- primary-300: #8FC1FF
- primary-400: #62A4FF
- primary-500: #2F7BFF
- primary-600: #1F63E6
- primary-700: #1B4FB8
- primary-800: #1A438F
- primary-900: #193B73

#### Neutrals

- neutral-0: #FFFFFF
- neutral-25: #FCFCFD
- neutral-50: #F7F8FA
- neutral-100: #ECEFF3
- neutral-200: #DDE2EA
- neutral-300: #C6CDD8
- neutral-400: #98A2B3
- neutral-500: #667085
- neutral-600: #475467
- neutral-700: #344054
- neutral-800: #1D2939
- neutral-900: #101828
- neutral-950: #090D14

#### Semantic

- success-500: #1F9D68
- warning-500: #D08700
- error-500: #D92D20
- info-500: #1170E4

#### Surface and Text (Light)

- bg.canvas: neutral-25
- bg.surface: neutral-0
- bg.subtle: neutral-50
- text.primary: neutral-900
- text.secondary: neutral-600
- text.tertiary: neutral-500
- border.default: neutral-200

#### Surface and Text (Dark)

- bg.canvas: #090D14
- bg.surface: #101828
- bg.subtle: #1D2939
- text.primary: #F2F4F7
- text.secondary: #CED4DC
- text.tertiary: #98A2B3
- border.default: #344054

#### Contrast and Usage Rules

- Body text minimum contrast: 4.5:1.
- Large text minimum contrast: 3:1.
- Interactive controls target 4.5:1 for text/icon against background.
- Semantic colors never carry meaning alone; pair with icon/text.
- Error and success states include descriptive copy and state label.

### 2.2 Typography (9 Levels)

Base typeface:

- Primary: SF Pro Display fallback chain to system sans.
- Monospace: SF Mono fallback chain to ui-monospace.

Type scale uses clamp for responsive behavior.

1. display: clamp(2.25rem, 1.8rem + 1.4vw, 3rem), lh 1.1, weight 700
2. h1: clamp(1.875rem, 1.55rem + 0.9vw, 2.5rem), lh 1.15, weight 650
3. h2: clamp(1.5rem, 1.32rem + 0.6vw, 2rem), lh 1.2, weight 650
4. h3: clamp(1.25rem, 1.16rem + 0.35vw, 1.5rem), lh 1.25, weight 600
5. title: clamp(1.125rem, 1.08rem + 0.2vw, 1.25rem), lh 1.3, weight 600
6. body: clamp(1rem, 0.97rem + 0.12vw, 1.0625rem), lh 1.6, weight 400
7. body-sm: clamp(0.9375rem, 0.9rem + 0.1vw, 1rem), lh 1.55, weight 400
8. label: clamp(0.875rem, 0.84rem + 0.1vw, 0.9375rem), lh 1.4, weight 500
9. caption: clamp(0.75rem, 0.72rem + 0.08vw, 0.8125rem), lh 1.35, weight 500

Accessibility notes:

- Dynamic Type compatible: line-wrapping on all headings.
- Do not lock container heights around text components.
- Maintain 1.4 minimum line-height for interactive labels.

### 2.3 12-Column Grid

- Desktop >= 1280: 12 cols, 80px max content column width, 24px gutter, 80px side margins.
- Tablet 768-1279: 12 cols, 16px gutter, 32px side margins.
- Mobile < 768: 4 cols conceptual, implemented as 12 with spanning rules, 16px gutters, 16px side margins.

Column spans:

- Primary form/card blocks: span 6-8 desktop.
- Secondary metadata panels: span 4 desktop.
- Mobile: all primary blocks span full width.

### 2.4 Spacing System (8px)

Spacing tokens:

- 0, 4, 8, 12, 16, 24, 32, 40, 48, 56, 64, 80, 96

Rules:

- Intra-component spacing: 8 or 12.
- Inter-component spacing: 16 or 24.
- Section spacing: 40 or 48.
- Page vertical rhythm: 24 baseline on mobile, 32 desktop.

## 3. Component Catalog (40 Components)

Each component includes anatomy, states, usage, accessibility, and code spec.

### 3.1 Inputs and Actions

1. Button

- Anatomy: container, label, optional leading/trailing icon.
- States: default, hover, focus-visible, pressed, disabled, loading.
- Usage: one primary per view region.
- A11y: 44x44 min target, visible focus ring.
- Code: shadcn button variants (primary, secondary, ghost, destructive).

2. Icon Button

- Anatomy: square hit area, icon glyph.
- States: default, hover, focus, pressed, disabled.
- Usage: utility actions only.
- A11y: aria-label required.
- Code: button size icon.

3. Link Button

- Anatomy: text label, optional arrow icon.
- States: default, hover underline, focus.
- Usage: tertiary navigation.
- A11y: semantic anchor if navigation.
- Code: shadcn button variant link.

4. Split Button

- Anatomy: primary action + chevron menu trigger.
- States: default, open, disabled.
- Usage: advanced actions only.
- A11y: menu role, keyboard arrow navigation.
- Code: button + dropdown-menu composition.

5. Input (Single-line)

- Anatomy: label, input field, helper/error text.
- States: empty, filled, focus, invalid, disabled.
- Usage: URL and metadata fields.
- A11y: label association, aria-invalid, describedby.
- Code: shadcn input + form wrapper.

6. Textarea
7. Select
8. Combobox
9. Checkbox
10. Radio Group
11. Switch
12. Slider
13. Form Field Wrapper
14. Form Section
15. Search Bar
16. URL Submit Bar

(For 6-16 follow same standards: explicit label, keyboard support, inline validation messaging, no placeholder-only labels.)

### 3.2 Containers and Data

17. Card
18. Metric Card
19. Status Card
20. List Item
21. Table
22. Data Row
23. Badge
24. Tag
25. Progress Bar
26. Circular Progress

Core rules:

- Cards keep one dominant content block.
- Badges represent status taxonomy only.
- Progress controls expose text percent and state label.

### 3.3 Feedback and Overlays

27. Skeleton
28. Empty State
29. Error State
30. Toast
31. Alert Banner
32. Dialog
33. Drawer
34. Popover
35. Tooltip

Core rules:

- Toast for non-blocking confirmations.
- Banner for persistent contextual warnings.
- Dialog for destructive or high-stakes confirmations only.
- Error states always include recovery action.

### 3.4 Navigation and Structure

36. Tabs
37. Breadcrumbs
38. Pagination
39. Avatar
40. Divider

Core rules:

- Tabs for lateral context switches.
- Breadcrumbs only in deep hierarchies.
- Pagination with page size and accessible labels.

## 4. UX Patterns

1. URL Submission Pattern

- Enter URL -> client validation -> server submit -> optimistic job card.

2. Async Processing Pattern

- queued, processing, ready, failed status progression with timestamp.

3. Download Expiry Pattern

- countdown chip and near-expiry warning state.

4. Empty-to-First-Success Pattern

- educational empty state with sample URL format guidance.

5. Error Recovery Pattern

- immediate reason + single suggested next action.

6. Session Quota Pattern

- progressive warnings: info (75%), warning (90%), blocked (100%).

## 5. Navigation, Hierarchy, Gestures, Platform Rules

### 5.1 Hierarchy

- Level 1: Page title + primary action.
- Level 2: Core task region.
- Level 3: Supplemental metadata.

### 5.2 Layout Patterns

- Single-task centered layout (submit flow).
- Master-detail layout (history and file detail).
- Dashboard layout (future admin mode).

### 5.3 Navigation

Primary:

- Home
- Downloads
- Session
- Settings

Contextual:

- Job Detail from list item.

### 5.4 Gestures and Inputs

- Tap/click parity for actions.
- Swipe dismiss for non-critical toasts on mobile.
- Pull-to-refresh optional for status lists (mobile).

### 5.5 Platform Rules

- Touch target minimum 44x44.
- Preserve safe-area spacing on mobile.
- Avoid hover-only affordances.
- Reduce motion media query support required.

## 6. Core Screens With Wireframes

### 6.1 Home / Submit

```text
+--------------------------------------------------+
| Video Downloader                                 |
| Paste a video URL                                |
| [ URL input________________________ ] [Download] |
|                                                  |
| Recent Jobs                                      |
| [Card: queued]                                   |
| [Card: processing 68%]                           |
| [Card: ready  Download]                          |
+--------------------------------------------------+
```

States:

- Empty: helper copy and sample accepted URLs.
- Loading: skeleton cards and disabled submit.
- Error: inline URL error and recover CTA.

### 6.2 Job Detail

```text
+----------------------------------------------+
| Job #A1                                      |
| Status: Processing                           |
| Timeline: queued -> processing -> ready      |
| Progress: [======-----] 62%                  |
| Source URL                                   |
| File estimate                                |
+----------------------------------------------+
```

### 6.3 Download Ready

```text
+----------------------------------------------+
| File Ready                                    |
| Name: ...                                     |
| Size: ...                                     |
| Expires in: 00:42:11                          |
| [Download Now]                                |
+----------------------------------------------+
```

### 6.4 Downloads List

```text
+--------------------------------------------------+
| Downloads                                        |
| [Search] [Status Filter]                         |
| ------------------------------------------------ |
| Ready | file.mp4 | expires 34m | [Download]      |
| Failed| file.mp4 | reason...    | [Retry tips]   |
+--------------------------------------------------+
```

### 6.5 Session Overview

```text
+----------------------------------------------+
| Session Usage                                 |
| Jobs submitted: 7                              |
| Downloads: 4                                   |
| Storage used: 312 MB / 500 MB                  |
| [usage bar]                                    |
+----------------------------------------------+
```

### 6.6 Settings

```text
+----------------------------------------------+
| Preferences                                    |
| Theme: [System v]                              |
| Reduce motion: [on/off]                        |
| High contrast mode: [on/off]                   |
+----------------------------------------------+
```

### 6.7 Status Surface

```text
+----------------------------------------------+
| Service Status                                 |
| API: up | Queue: up | Storage: degraded        |
| Guidance: downloads may be delayed             |
+----------------------------------------------+
```

### 6.8 Failure Recovery Screen

```text
+----------------------------------------------+
| Something went wrong                           |
| Could not process this URL                     |
| [Try another URL] [View supported sources]     |
+----------------------------------------------+
```

## 7. Buttons, Forms, Cards, Data Visualization

### Buttons

- Primary: one per surface.
- Secondary: supportive actions.
- Destructive: explicit confirmation if data loss.

### Forms

- Inline validation timing: on blur + on submit.
- Preserve user input on recoverable errors.
- Error copy includes reason and resolution.

### Cards

- Prioritize status and next action.
- Keep metadata compact and scannable.

### Data Visualization

- Keep charts sparse and utility-first.
- Use bars and simple trend lines only.
- Always provide numeric labels and text equivalents.

## 8. Accessibility Requirements

- WCAG 2.2 AA minimum.
- Keyboard support for all controls and menus.
- Focus ring visible on every interactive element.
- aria-live polite regions for status changes.
- Dynamic Type: all major views support text scaling without clipping.
- Reduced motion mode suppresses non-essential animation.
- Semantic markup for headings, nav, main, form, table.

## 9. Micro-interactions

- Submit to queued: 200ms fade/scale confirmation.
- Status updates: subtle crossfade, no bouncing effects.
- Download ready: brief glow pulse around CTA (disabled in reduced-motion).
- Error appears with inline slide/fade and focus shift to error summary.

## 10. Responsive Behavior

- Mobile: single-column, sticky primary action near viewport bottom.
- Tablet: split content blocks with vertical emphasis.
- Desktop: balanced two-region composition where needed.
- Breakpoints: 0-767, 768-1279, 1280+.

## 11. Do and Don't

Do:

- keep one primary CTA per task area
- show explicit states: queued, processing, ready, failed
- preserve user context during async updates
- keep copy concise and instructional

Don't:

- hide critical errors in transient toasts only
- overload cards with low-priority metadata
- use color as the only state indicator
- rely on hover for key affordances

## 12. Developer Guide (shadcn + Next.js)

### 12.1 Setup Plan

1. Add shadcn/ui and required deps.
2. Create token-aware theme variables in global css.
3. Generate base primitives: button, input, card, form, dialog, drawer, tabs, table, badge, tooltip, toast.
4. Create custom composed components for URL submit, status cards, and session usage.

### 12.2 File Structure Proposal

- frontend/components/ui (shadcn primitives)
- frontend/components/system (composed design-system components)
- frontend/components/patterns (flow-level blocks)
- frontend/lib/design-tokens.ts (typed token access)
- frontend/docs (optional story docs later)

### 12.3 Code Specs

- Use CSS variables mapped from tokens JSON.
- Use tailwind utility classes with semantic aliases.
- Keep component APIs strict and predictable.
- Include a11y props in all interactive interfaces.

### 12.4 Quality Gates

- Lint and typecheck required.
- Keyboard navigation walkthrough required.
- Light and dark mode snapshots required.
- Contrast checks on all semantic states required.

## 13. Designer's Notes

- Minimalism is operational clarity, not visual emptiness.
- Trust is built by truthful state communication during delays.
- Avoid premium styling tropes that reduce readability.
- Keep hierarchy stable across breakpoints so users never relearn core actions.
