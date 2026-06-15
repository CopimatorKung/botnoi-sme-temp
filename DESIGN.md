# Design

## Color

Primary: oklch(0.58 0.22 248) — Botnoi Blue (#2B7FFF approx)
Background: oklch(0.99 0.003 240) — near-white with cool blue tint
Surface/Card: oklch(1 0 0) — pure white
Sidebar: oklch(0.22 0.07 258) — dark navy

Accent shades (from primary):
- Blue-50: oklch(0.97 0.02 248)
- Blue-100: oklch(0.93 0.04 248)
- Blue-600: oklch(0.58 0.22 248)
- Blue-700: oklch(0.50 0.20 248)

Muted text: oklch(0.52 0.06 250) — navy-tinted gray, NOT slate-400
Border: oklch(0.88 0.025 240)

## Typography

Font stack: system-ui, -apple-system, sans-serif
Body size: 14px (0.875rem)
Line height: 1.5 body, 1.2 headings
Weight: 400 body, 600 semibold labels, 700 headings

## Spacing

Base unit: 4px
Component padding: 12px (sm) / 16px (md) / 20px (lg)
Card gap: 12px–16px

## Components

Buttons:
- Primary: bg-blue-600 text-white hover:bg-blue-700
- Secondary: bg-blue-50 text-blue-700 border border-blue-200
- Ghost: transparent hover:bg-blue-50

Sidebar: dark navy bg, white text, blue accent on active items
Cards: white bg, border border-blue-100/60, subtle shadow

## Motion

Minimal — transition-colors only on interactive elements (150ms)
No entrance animations except auth page fade-in
