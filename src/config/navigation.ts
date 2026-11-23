import {
  BarChart3,
  BookOpen,
  Compass,
  GraduationCap,
  Layers,
  LayoutGrid,
  Palette,
  Settings,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import type { NavSection, UserRole } from "@/types/navigation";

/**
 * Navigation sections used by the Design System & Foundation workspace.
 * Anchor links let reviewers jump directly to each specification section.
 */
export const FOUNDATION_NAV_SECTIONS: readonly NavSection[] = [
  {
    id: "foundation",
    title: "Foundation",
    items: [
      {
        id: "overview",
        label: "Overview",
        href: "/",
        icon: Compass,
        exact: true,
        mobilePrimary: true,
      },
      {
        id: "tokens",
        label: "Brand & Tokens",
        href: "/#tokens",
        icon: Palette,
        badge: "Gold",
        mobilePrimary: true,
      },
      {
        id: "components",
        label: "UI Components",
        href: "/#components",
        icon: Layers,
        mobilePrimary: true,
      },
      {
        id: "analytics",
        label: "Analytics Preview",
        href: "/#analytics",
        icon: BarChart3,
        mobilePrimary: true,
      },
      {
        id: "architecture",
        label: "Architecture",
        href: "/#architecture",
        icon: LayoutGrid,
      },
    ],
  },
] as const;

/**
 * Role-scoped navigation blueprints ready for Part 2+ dashboards
 * (`(dashboard)/admin`, `(dashboard)/teacher`, `(dashboard)/student`).
 */
export const ROLE_NAV_BLUEPRINTS: Readonly<Record<UserRole, readonly NavSection[]>> = {
  student: [
    {
      id: "student-main",
      title: "Learning",
      items: [
        {
          id: "student-home",
          label: "Dashboard",
          href: "/student",
          icon: GraduationCap,
          exact: true,
          mobilePrimary: true,
        },
        {
          id: "student-courses",
          label: "My Courses",
          href: "/student/courses",
          icon: BookOpen,
          mobilePrimary: true,
        },
        {
          id: "student-ai",
          label: "AI Tutor",
          href: "/student/ai-tutor",
          icon: Sparkles,
          badge: "AI",
          mobilePrimary: true,
        },
      ],
    },
  ],
  teacher: [
    {
      id: "teacher-main",
      title: "Teaching",
      items: [
        {
          id: "teacher-home",
          label: "Overview",
          href: "/teacher",
          icon: LayoutGrid,
          exact: true,
          mobilePrimary: true,
        },
        {
          id: "teacher-courses",
          label: "Courses",
          href: "/teacher/courses",
          icon: BookOpen,
          mobilePrimary: true,
        },
        {
          id: "teacher-analytics",
          label: "Analytics",
          href: "/teacher/analytics",
          icon: BarChart3,
          mobilePrimary: true,
        },
      ],
    },
  ],
  admin: [
    {
      id: "admin-main",
      title: "Administration",
      items: [
        {
          id: "admin-home",
          label: "Control Center",
          href: "/admin",
          icon: ShieldCheck,
          exact: true,
          mobilePrimary: true,
        },
        {
          id: "admin-analytics",
          label: "Platform Metrics",
          href: "/admin/analytics",
          icon: BarChart3,
          mobilePrimary: true,
        },
        {
          id: "admin-settings",
          label: "Settings",
          href: "/admin/settings",
          icon: Settings,
          mobilePrimary: true,
        },
      ],
    },
  ],
};
