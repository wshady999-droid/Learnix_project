import type { LucideIcon } from "lucide-react";

/** Platform user roles used across auth, RLS, and dashboard routing. */
export type UserRole = "admin" | "teacher" | "student";

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  /** Optional description for command palettes or accessible announcements. */
  description?: string;
  /** When true, only active on exact pathname match. */
  exact?: boolean;
  /** When true, shown in the mobile bottom navigation bar (up to 4 items). */
  mobilePrimary?: boolean;
}

export interface NavSection {
  id: string;
  title?: string;
  items: readonly NavItem[];
}
