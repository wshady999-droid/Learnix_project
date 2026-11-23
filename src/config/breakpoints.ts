/**
 * Responsive breakpoints (min-width). Must stay in sync with Tailwind's
 * defaults + the custom `3xl` breakpoint declared in `src/app/globals.css`.
 *
 * Device mapping:
 *   mobile        < 768px   (base, sm)
 *   tablet        768px     (md)   → compact icon sidebar
 *   laptop        1024px    (lg)   → collapsible sidebar
 *   desktop       1280px    (xl / 2xl at 1536px)
 *   large desktop 1920px    (3xl)
 */
export const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
  "3xl": 1920,
} as const;

export type Breakpoint = keyof typeof BREAKPOINTS;

export const mediaQuery = {
  up: (bp: Breakpoint) => `(min-width: ${BREAKPOINTS[bp]}px)`,
  down: (bp: Breakpoint) => `(max-width: ${BREAKPOINTS[bp] - 0.02}px)`,
  between: (from: Breakpoint, to: Breakpoint) =>
    `(min-width: ${BREAKPOINTS[from]}px) and (max-width: ${BREAKPOINTS[to] - 0.02}px)`,
} as const;
