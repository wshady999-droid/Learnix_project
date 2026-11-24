"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Award,
  BookOpen,
  ClipboardCheck,
  Clock,
  GraduationCap,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { useLocale } from "@/components/i18n/locale-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getAdminDictionary } from "@/i18n/admin-dictionaries";
import type { AdminOverviewData } from "@/services/admin/queries";

interface AdminOverviewClientProps {
  data: AdminOverviewData;
}

export function AdminOverviewClient({ data }: AdminOverviewClientProps) {
  const { locale } = useLocale();
  const adminT = getAdminDictionary(locale);

  const kpiCards = [
    {
      label: adminT.overview.totalStudents,
      value: data.totalStudents,
      icon: GraduationCap,
      href: "/admin/users",
    },
    {
      label: adminT.overview.totalTeachers,
      value: data.totalTeachers,
      icon: Users,
      href: "/admin/users",
    },
    {
      label: adminT.overview.totalCourses,
      value: data.totalCourses,
      icon: BookOpen,
      href: "/admin/courses",
    },
    {
      label: adminT.overview.activeUsers,
      value: data.activeUsers,
      icon: UserCheck,
      href: "/admin/users",
    },
    {
      label: adminT.overview.pendingTeacherRequests,
      value: data.pendingTeacherRequests,
      icon: Clock,
      href: "/admin/users",
      highlight: data.pendingTeacherRequests > 0,
    },
    {
      label: adminT.overview.totalExaminations,
      value: data.totalExaminations,
      icon: ClipboardCheck,
      href: "/admin/analytics",
    },
    {
      label: adminT.overview.completionRate,
      value: `${data.completionRatePercent}%`,
      icon: Award,
      href: "/admin/analytics",
    },
    {
      label: adminT.overview.platformActivityCount,
      value: data.platformActivityCount,
      icon: Activity,
      href: "/admin/security",
    },
  ] as const;

  const platformBarData = [
    { name: adminT.overview.totalStudents, count: data.totalStudents },
    { name: adminT.overview.totalTeachers, count: data.totalTeachers },
    { name: adminT.overview.totalCourses, count: data.totalCourses },
    { name: adminT.overview.totalExaminations, count: data.totalExaminations },
  ];

  const completionPieData = [
    { name: adminT.common.active, value: data.activeEnrollments, color: "var(--chart-1)" },
    { name: "Completed", value: data.completedEnrollments, color: "var(--chart-3)" },
    { name: "Dropped", value: data.droppedEnrollments, color: "var(--chart-4)" },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            {adminT.overview.title}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {adminT.overview.subtitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="gold" size="sm">
            <Link href="/admin/users">{adminT.nav.users}</Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/analytics">{adminT.nav.analytics}</Link>
          </Button>
        </div>
      </div>

      {/* 8 Live KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <Link key={kpi.label} href={kpi.href} className="group block">
              <Card
                variant={"highlight" in kpi && kpi.highlight ? "premium" : "default"}
                className="h-full transition-all duration-150 group-hover:-translate-y-0.5 group-hover:border-gold-border group-hover:shadow-md"
              >
                <CardContent className="flex items-center justify-between gap-4 pt-1">
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">
                      {kpi.label}
                    </p>
                    <p className="text-2xl font-bold tracking-tight text-foreground">
                      {kpi.value}
                    </p>
                  </div>
                  <span className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border border-gold-border bg-gold-subtle text-gold-foreground">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* Analytics Charts */}
      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {adminT.overview.activityChartTitle}
            </CardTitle>
            <CardDescription>
              {adminT.overview.activityChartDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
                <BarChart
                  data={platformBarData}
                  margin={{ top: 8, right: 12, left: -12, bottom: 0 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="name"
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="var(--muted-foreground)"
                    fontSize={11}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <RechartsTooltip
                    contentStyle={{
                      backgroundColor: "var(--popover)",
                      borderColor: "var(--border)",
                      borderRadius: "0.625rem",
                      color: "var(--popover-foreground)",
                      fontSize: "12px",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="var(--chart-1)"
                    radius={[6, 6, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {adminT.overview.completionChartTitle}
            </CardTitle>
            <CardDescription>
              {adminT.overview.completionChartDescription}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.totalEnrollments === 0 ? (
              <div className="flex h-64 flex-col items-center justify-center text-center text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">
                  0 {adminT.analytics.enrollmentsLabel}
                </p>
                <p className="mt-1 max-w-xs">
                  {adminT.common.noRecordsDescription}
                </p>
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240}>
                  <PieChart>
                    <Pie
                      data={completionPieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={52}
                      outerRadius={80}
                      paddingAngle={3}
                    >
                      {completionPieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <RechartsTooltip
                      contentStyle={{
                        backgroundColor: "var(--popover)",
                        borderColor: "var(--border)",
                        borderRadius: "0.625rem",
                        color: "var(--popover-foreground)",
                        fontSize: "12px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent Audit Events */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base">
              {adminT.overview.recentAuditTitle}
            </CardTitle>
            <CardDescription>
              {adminT.overview.recentAuditDescription}
            </CardDescription>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link href="/admin/security">{adminT.nav.security}</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {data.recentAuditLogs.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title={adminT.common.noRecordsTitle}
              description={adminT.common.noRecordsDescription}
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{adminT.security.actionCol}</TableHead>
                  <TableHead>{adminT.security.entityCol}</TableHead>
                  <TableHead>{adminT.security.ipDeviceCol}</TableHead>
                  <TableHead className="text-end">
                    {adminT.security.timestampCol}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.recentAuditLogs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <Badge variant="gold-subtle" className="font-mono">
                        {log.action}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {log.entity_type}
                      {log.entity_id ? ` (${log.entity_id.slice(0, 8)}…)` : ""}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground">
                      {log.ip_address || log.user_agent || "Server"}
                    </TableCell>
                    <TableCell className="text-end font-mono text-xs text-muted-foreground">
                      {log.created_at.replace("T", " ").slice(0, 19)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
