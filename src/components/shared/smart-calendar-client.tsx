"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  BookOpen,
  CalendarClock,
  ClipboardCheck,
  Clock,
  FileText,
} from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { SmartCalendarEvent } from "@/services/shared/queries";
import type { UserRole } from "@/types";

interface SmartCalendarClientProps {
  role: UserRole;
  events: SmartCalendarEvent[];
}

export function SmartCalendarClient({
  role,
  events,
}: SmartCalendarClientProps) {
  const [filter, setFilter] = useState<"all" | "exam" | "assignment" | "study">(
    "all",
  );

  const filtered = useMemo(
    () =>
      filter === "all" ? events : events.filter((e) => e.kind === filter),
    [events, filter],
  );

  const dashboardHref =
    role === "admin" ? "/admin" : role === "teacher" ? "/teacher" : "/student";

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-2">
            <Link href={dashboardHref}>
              <ArrowLeft className="size-4" />
              <span>Back to Dashboard</span>
            </Link>
          </Button>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">
            Learnix Smart Academic Calendar
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Unified view of examination windows, assignment deadlines, and
            study sessions.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All Events"],
            ["exam", "Examinations"],
            ["assignment", "Assignments"],
            ["study", "Study Sessions"],
          ] as const
        ).map(([key, label]) => (
          <Button
            key={key}
            variant={filter === key ? "gold" : "outline"}
            size="sm"
            onClick={() => setFilter(key)}
          >
            {label}
          </Button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No scheduled events"
          description="No exams, assignments, or study sessions match the selected filter."
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((ev) => (
            <Card key={ev.id} className="border-border/80">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <Badge
                    variant={ev.kind === "exam" ? "gold" : "outline"}
                    className="uppercase"
                  >
                    {ev.kind}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">
                    {ev.dateLabel}
                  </span>
                </div>
                <CardTitle className="mt-2 flex items-center gap-2 text-base">
                  {ev.kind === "exam" && (
                    <ClipboardCheck className="size-4 text-gold-foreground" />
                  )}
                  {ev.kind === "assignment" && (
                    <FileText className="size-4 text-gold-foreground" />
                  )}
                  {ev.kind === "study" && (
                    <BookOpen className="size-4 text-gold-foreground" />
                  )}
                  <span>{ev.title}</span>
                </CardTitle>
                <CardDescription className="text-xs">
                  {ev.courseTitle}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1 text-xs text-muted-foreground">
                <p>{ev.subtitle}</p>
                <p className="flex items-center gap-1.5 font-mono text-[11px] text-foreground">
                  <Clock className="size-3.5 text-gold-foreground" />
                  <span>{ev.timeLabel}</span>
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
