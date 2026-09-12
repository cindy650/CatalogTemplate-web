# UI Prototype Page Override

This page is a design validation surface, not production navigation. Apply the following priority order:

1. Apple HIG and web accessibility conventions
2. Catalog Template semantic tokens
3. UI/UX Pro Max recommendations that fit the workflow

## Product Intent

Help a production designer identify the next order or template task in one scan, open the correct editor, and understand whether the shop's production resources are ready.

## Direction

- Physical analogy: a calm print-production control room.
- Amplify: utilitarian clarity, premium restraint, spatial feedback.
- Prohibit: glassmorphism, decorative gradients, marketing hero sections, emoji icons, low-contrast gray text, and animation that competes with the work surface.
- Use Ant Design and the existing icon family for controls; do not introduce a second icon library.

## Proposed Tokens

```css
--ui-bg: #f4f6f9;
--ui-surface: #ffffff;
--ui-ink: #152035;
--ui-muted: #718096;
--ui-line: #d8dee8;
--ui-accent: #3978f6;
--ui-success: #43c28b;
--ui-warning: #d7a844;
--ui-danger: #d64545;
--ui-radius-sm: 8px;
--ui-radius-md: 12px;
--ui-radius-lg: 16px;
--ui-space-1: 4px;
--ui-space-2: 8px;
--ui-space-3: 12px;
--ui-space-4: 16px;
--ui-space-6: 24px;
--ui-space-8: 32px;
--ui-motion-fast: 150ms;
--ui-motion-standard: 220ms;
```

## Interaction Contract

- Primary actions use a verb and show immediate pressed/hover feedback.
- Every icon-only control has an accessible name and a visible focus ring.
- Cards may use pointer-driven `rotateX/rotateY` feedback within a small range; no layout-shifting scale or perspective on the whole page.
- Orbit status dots may pulse, but the pulse stops under `prefers-reduced-motion: reduce`.
- Keyboard users can switch prototype variants with Left/Right arrows; controls remain reachable with Tab.
- Minimum interactive target is 44px; mobile layout must not create horizontal scrolling.

## Required States Before Production Migration

Loading, empty, error/offline, disabled, long shop name, long template name, reduced motion, keyboard focus, and both light/dark contrast checks.

## Acceptance Screenshots

Capture Apple, Orbit, and Studio variants at 1440x900 and 375x812. Confirm no horizontal overflow, the primary action is visually dominant, and the card tilt remains subtle and stable.
