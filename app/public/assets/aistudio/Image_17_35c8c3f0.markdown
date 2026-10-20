---
name: Clinical Clarity
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#43474d'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#74777e'
  outline-variant: '#c3c6ce'
  surface-tint: '#49607c'
  primary: '#001428'
  on-primary: '#ffffff'
  primary-container: '#0f2942'
  on-primary-container: '#7991af'
  inverse-primary: '#b0c9e8'
  secondary: '#006a61'
  on-secondary: '#ffffff'
  secondary-container: '#86f2e4'
  on-secondary-container: '#006f66'
  tertiary: '#00170c'
  on-tertiary: '#ffffff'
  tertiary-container: '#002e1d'
  on-tertiary-container: '#00a270'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d1e4ff'
  primary-fixed-dim: '#b0c9e8'
  on-primary-fixed: '#011d35'
  on-primary-fixed-variant: '#314863'
  secondary-fixed: '#89f5e7'
  secondary-fixed-dim: '#6bd8cb'
  on-secondary-fixed: '#00201d'
  on-secondary-fixed-variant: '#005049'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
  label-token-lg:
    fontFamily: JetBrains Mono
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: 0.05em
  label-token-md:
    fontFamily: JetBrains Mono
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: 0.02em
  label-data:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-meta:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '600'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system is tailored for a mission-critical hospital healthcare queue management platform. The brand identity balances civic dependability with clinical precision. It avoids overly decorative flourishes, AI-generated glass effects, or marketing gloss, anchoring itself in the pragmatic demands of busy out-patient departments (OPD), triage desks, and triage waiting displays.

The primary users are triage nurses, hospital desk administrators, clinical consultants, and stressed patients or family members. The interface must communicate reassurance, systematic order, and absolute transparency regarding wait times, queue states, and room routing.

The aesthetic fuses **Corporate / Modern** hospital systems with **High-Utility Functionalism**:
- High-contrast, WCAG AAA compliant structural hierarchies that remain legible under fluorescent hospital lighting or at distance on wall-mounted monitors.
- Dense yet breathable information architecture optimizing triage throughput.
- Physical clarity: clean hairline dividers, structural data badges, and disciplined status semantics that signal triage urgency without inciting panic.

## Colors

The color system enforces a reliable, clinical hierarchy:

- **Primary (`#0F2942`)**: Deep Navy Blue serves as the institutional foundation for primary navigation, high-level structural chrome, key headings, and high-priority active tokens. A secondary brand shade (`#1A365D`) handles interactive hover and pressed states.
- **Secondary (`#0D9488`) & Accent Teal (`#14B8A6`)**: Clinical Teal represents actionable progress, active clinic room routing, and interactive CTAs.
- **Surface & Backgrounds**: Crisp clinical base on pure white (`#FFFFFF`) layered over soft clinical off-white canvas (`#F8FAFC`). Internal cards and utility surfaces rely on structured white tiles bordered by hairline slate tones.
- **Neutral Greys**: Grounded slate grays (`#334155` for high-contrast reading text, `#64748B` for secondary operational labels, and `#E2E8F0` for crisp architectural dividers and borders).
- **Clinical Semantics**:
  - `Critical Red` (`#EF4444` surface with `#991B1B` text on `#FEF2F2` background) for emergency room triage, missed tokens, and critical system delays.
  - `Amber Warning` (`#F59E0B` with `#92400E` text on `#FFFBEB` background) for extended wait thresholds and unattended calls.
  - `Success Emerald` (`#10B981` with `#065F46` text on `#ECFDF5` background) for completed consults and actively called queue numbers.

## Typography

Typography prioritizes legibility, systematic scanability, and rigorous numerical alignment. 

- **Primary Interface (Inter)**: Handles layout navigation, dialogs, operational states, and body content. Inter's tall x-height and neutral grotesque contours provide instant readability across mobile handsets and clinical workstation terminals.
- **Tabular Data & Queue Tokens (JetBrains Mono)**: Applied selectively for ticket identifiers (e.g., `OPD-A-042`), bed IDs, counter numbers, and timestamps (`11:42:08 AM`). Monospaced alignment prevents layout jitter during real-time queue shifts and ensures tokens stand out distinctly from clinical notes.
- **Numeric Font Variants**: When using Inter for metrics and countdowns, the `tabular-nums` OpenType feature flag must remain active.

## Layout & Spacing

The layout model is built around a structured 12-column responsive grid engineered for dense, multi-pane operational panels and public status boards.

### Grid & Breakpoints
- **Desktop (1024px and above)**: 12-column grid with `1.5rem` (`24px`) gutters and `2rem` (`32px`) container margins. Supports a fixed left-rail navigation (triage shortcuts, counter switcher), a flexible central queue matrix, and an operational patient details inspector.
- **Tablet (768px – 1023px)**: 8-column layout with `1rem` (`16px`) gutters and margins. Side panels collapse into drawer sheets; queue cards switch to 2-column or full-width stacked views.
- **Mobile (< 768px)**: 4-column layout with `1rem` (`16px`) outer margins. Focused, single-column operational flow for mobile nurses or patients tracking tokens on personal phones.

### Spacing Philosophy
- Base unit is `4px` with a default step of `8px` (`0.5rem`).
- Information density is kept compact for administrative portals (`space-xs` and `space-sm` for inline badges and status metadata) to maximize above-the-fold patient visibility without feeling cramped.
- Public display modes switch margins to wider outer gutters to prevent edge-burn and maintain peripheral comfort on mounted televisions.

## Elevation & Depth

Visual hierarchy uses a conservative approach combining crisp hairline boundaries (`#E2E8F0`) with subtle, warm-tinted slate shadows. Heavy drop shadows and glass blurs are intentionally omitted to maintain accessibility across lower-spec clinic hardware and bright triage lighting.

- **Level 0 (Flat Canvas)**: `#F8FAFC` base application shell.
- **Level 1 (Card & Section Containers)**: `#FFFFFF` fill with an explicit `1px` solid border using `#E2E8F0` and `box-shadow: 0 1px 2px 0 rgba(15, 41, 66, 0.05)`. Used for patient rows, queue blocks, and metric summary boxes.
- **Level 2 (Active Focus & Drag States)**: Elevates called patient cards and floating alert strips using `box-shadow: 0 4px 6px -1px rgba(15, 41, 66, 0.08), 0 2px 4px -2px rgba(15, 41, 66, 0.04)`.
- **Level 3 (Modals & Overlays)**: Drawer inspectors, manual token creation modals, and room override dialogs use `box-shadow: 0 10px 15px -3px rgba(15, 41, 66, 0.1), 0 4px 6px -4px rgba(15, 41, 66, 0.06)` paired with a semi-opaque neutral backdrop `#0F2942` at 40% opacity.

## Shapes

The design system embraces a **Soft (Level 1)** geometric language. Modest rounding reinforces stability, functional hygiene, and visual organization while avoiding consumer-app pill exaggeration.

- **Base Components**: Inputs, action buttons, table cells, and status badges utilize `0.25rem` (`4px`) or `0.375rem` (`6px`) corner radiuses for an orderly, technical appearance.
- **Cards & Data Modules**: Outer containers and patient queue cards utilize `0.5rem` (`8px`) radiuses (`rounded-lg`), delivering crisp containment without breaking alignment across tightly tiled grids.
- **Special Elements**: Patient status indicator dots, triage indicator pips, and token priority badges maintain small, restrained geometry rather than oversized rounded pills.

## Components

### Buttons
- **Primary**: Solid Deep Navy (`#0F2942`), pure white text, 600 weight, 36px default height (44px on touch), 4px radius. Focus ring: 2px offset with `#0D9488`.
- **Secondary / Action**: Clinical Teal (`#0D9488`) background, white text; reserved for the primary workflow action: calling the next patient (`CALL NEXT`).
- **Tertiary / Outline**: Background transparent, 1px border in `#CBD5E1`, text `#334155`. Hover shifts to `#F1F5F9`.
- **Destructive**: Background `#FEF2F2`, 1px border in `#FCA5A5`, text `#991B1B`. Used for no-show flags and queue cancellations.

### Queue Status Chips & Badges
- Compact padding (`0.125rem 0.5rem`), font size `11px`, `JetBrains Mono` or uppercase `Inter` 700.
- **Waiting**: Background `#F1F5F9`, text `#475569`, border `#E2E8F0`.
- **With Doctor / Active**: Background `#ECFDF5`, text `#065F46`, border `#A7F3D0` with an animated pulsating green pip.
- **Delayed / Priority Warning**: Background `#FFFBEB`, text `#92400E`, border `#FDE68A`.
- **Emergency / Urgent**: Background `#FEF2F2`, text `#991B1B`, border `#FECACA`.

### Patient Queue Cards
- Structured tile on pure white with a 1px border `#E2E8F0`.
- Left-side 4px status spine reflecting the triage level (Emergency Red, Priority Amber, Routine Slate).
- Prominent monospaced queue token (e.g., `A-104`) on top-left, followed by obfuscated patient ID (`PT-****348`), appointment category (`Cardiology OPD`), and live waiting elapsed duration (`14m 20s`).

### Input Fields & Controls
- **Text Inputs & Dropdowns**: Height 38px, background `#FFFFFF`, border 1px `#CBD5E1`, text `#0F2942`, placeholder `#94A3B8`. Active focus triggers a 1px border and 2px halo in `#0D9488`.
- **Checkboxes & Radios**: 16px square/circle with crisp slate border, filling with `#0D9488` when active.

### Live Waiting Room Display Board
- High-contrast split view designed for 1080p/4K public monitors. Left half displays large tabular callouts for "NOW SERVING" with prominent token number (`label-token-lg`) and corresponding clinic/counter number. Right side holds a clean scrolling list of upcoming tokens.