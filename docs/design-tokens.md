# Learnix Design System & Token Specification

This document defines the official brand palette, metallic gold utilities, semantic theme tokens, and responsive breakpoints for **Learnix**.

All CSS custom properties live in `src/styles/tokens.css` and are exposed to Tailwind CSS v4 utilities in `src/app/globals.css`.

---

## 1. Layer 1 — Official Brand Palette (Immutable)

| Brand Role | CSS Variable | Hex | Usage |
| :--- | :--- | :--- | :--- |
| **Main Background** | `--brand-background` | `#F8F8F7` | Warm alabaster light-mode page canvas |
| **White** | `--brand-white` | `#FFFFFF` | Light-mode cards, popovers, and elevated surfaces |
| **Charcoal** | `--brand-charcoal` | `#202124` | Primary ink in light mode; card surface in dark mode; text on metallic gold |
| **Gold Base** | `--brand-gold` | `#A88945` | Core brand gold accent and focus ring |
| **Gold Highlight** | `--brand-gold-highlight` | `#E5CC83` | Metallic gradient crest and dark-mode gold text/icon accent |
| **Gold Shadow** | `--brand-gold-shadow` | `#806127` | Metallic gradient edge and light-mode accessible gold text/icon accent |
| **Secondary Grey** | `--brand-grey` | `#737373` | Muted text and secondary iconography |

---

## 2. Metallic Gold Surface & Restraint Guidelines

```css
--gradient-gold: linear-gradient(
  110deg,
  #806127 0%,
  #A88945 25%,
  #E5CC83 48%,
  #A88945 72%,
  #806127 100%
);
```

### Tailwind Utilities
- `bg-gold-metallic`: Applies the 110° 5-stop metallic gradient with smooth background-position transition.
- `gold-sheen`: Layers a soft top-down specular highlight (`--gradient-gold-reflection`) and a subtle diagonal hover light sweep (`--gradient-gold-sheen`).
- `border-gold-metallic`: 1px metallic gold border around a card or button while preserving its interior surface color (`--card` or `--gold-fill`).
- `text-gold-metallic`: Clips the metallic gradient to short display text.

### Usage Rules
- **Allowed**: Primary CTA buttons (`<Button variant="gold">`), active navigation items, key status badges (`<Badge variant="gold">`), selected interactive pills, and featured card borders (`<Card variant="premium">`).
- **Avoid**: Large background fills, body copy, routine borders, or stacking multiple shiny surfaces side by side.

---

## 3. Layer 2 — Semantic Theme Tokens (Light & Dark Mode)

| Semantic Token | Tailwind Utility | Light Mode | Dark Mode | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `--background` | `bg-background` | `#F8F8F7` | `#17181A` | Primary page background |
| `--foreground` | `text-foreground` | `#202124` | `#F1F0ED` | Primary body ink |
| `--card` | `bg-card` | `#FFFFFF` | `#202124` | Card surface |
| `--popover` | `bg-popover` | `#FFFFFF` | `#26272B` | Dropdown, dialog, and tooltip surface |
| `--primary` | `bg-primary` | `#A88945` | `#A88945` | Brand primary accent |
| `--primary-foreground` | `text-primary-foreground` | `#202124` | `#202124` | Text over primary gold |
| `--secondary` | `bg-secondary` | `#EFEEEB` | `#2B2C30` | Neutral secondary controls |
| `--muted` | `bg-muted` | `#F0EFEC` | `#26272B` | Subtle containers & skeletons |
| `--muted-foreground` | `text-muted-foreground` | `#737373` | `#A3A3A3` | Secondary text (WCAG AA compliant) |
| `--accent` | `bg-accent` | `#F4EFE2` | `#2C2A24` | Hover/focus highlight surface |
| `--gold-foreground` | `text-gold-foreground` | `#806127` | `#E5CC83` | Accessible gold text & icons |
| `--gold-subtle` | `bg-gold-subtle` | `#F6F0E0` | `#2A261C` | Soft gold tint surface |
| `--gold-border` | `border-gold-border` | `#DCCB9C` | `#5C4A24` | Subtle gold hairline border |
| `--border` | `border-border` | `#E5E3DF` | `#313236` | Default structural border |
| `--input` | `border-input` | `#DCDAD5` | `#3A3B40` | Form control border |
| `--ring` | `outline-ring` | `#A88945` | `#E5CC83` | Focus ring |
| `--sidebar` | `bg-sidebar` | `#FFFFFF` | `#1C1D20` | Navigation rail surface |
| `--success` | `text-success` | `#2F7A4B` | `#57B37A` | Positive feedback |
| `--warning` | `text-warning` | `#A15C07` | `#E0A04A` | Cautionary feedback |
| `--destructive` | `text-destructive` | `#B42318` | `#E5534B` | Error / destructive states |
| `--info` | `text-info` | `#31659C` | `#6FA3D8` | Informational states |

---

## 4. Responsive Breakpoints & Navigation Modes

| Breakpoint | Min Width | Target Device | Navigation Behavior |
| :--- | :--- | :--- | :--- |
| `base` / `sm` | `0px` / `640px` | Mobile | Top bar hamburger drawer (`MobileNavDrawer`) + fixed bottom bar (`MobileBottomNav`) |
| `md` | `768px` | Tablet | Compact icon-rail sidebar (`4.25rem`) with hover/focus tooltips |
| `lg` | `1024px` | Laptop | Collapsible sidebar (`16rem` expanded ↔ `4.25rem` collapsed with tooltips) |
| `xl` / `2xl` | `1280px` / `1536px` | Desktop | Collapsible sidebar + spacious multi-column grid |
| `3xl` | `1920px` | Large Desktop | Max-width `1800px` centered workspace |
