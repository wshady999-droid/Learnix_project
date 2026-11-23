"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  ClipboardCheck,
  FileText,
  Loader2,
  Search,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface SearchResults {
  role: string;
  courses: Array<{ id: string; code: string; title: string; status: string }>;
  lessons: Array<{
    id: string;
    course_id: string;
    title: string;
    content_type: string;
  }>;
  exams: Array<{ id: string; course_id: string; title: string; status: string }>;
  students: Array<{
    id: string;
    full_name: string | null;
    email: string;
    role: string;
  }>;
}

export function GlobalSearchTrigger() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchResults | null>(null);

  async function handleSearch(nextQuery: string) {
    setQuery(nextQuery);
    if (nextQuery.trim().length < 2) {
      setResults(null);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(nextQuery.trim())}`,
      );
      const json = (await res.json()) as {
        ok: boolean;
        data?: SearchResults;
      };
      if (json.ok && json.data) {
        setResults(json.data);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        aria-label="Global Search"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <Search className="size-4" />
        <span className="hidden lg:inline text-xs text-muted-foreground">
          Search...
        </span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Permission-Aware Global Search</DialogTitle>
            <DialogDescription>
              Search courses, lessons, examinations, and authorized student records.
            </DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => void handleSearch(e.target.value)}
              placeholder="Type at least 2 characters..."
              className="pl-9"
            />
          </div>

          {loading && (
            <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
              <Loader2 className="mr-2 size-4 animate-spin text-gold-foreground" />
              Searching authorized records...
            </div>
          )}

          {!loading && results && (
            <div className="space-y-4 text-xs">
              {results.courses.length > 0 && (
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 font-semibold text-foreground">
                    <BookOpen className="size-3.5 text-gold-foreground" />
                    Courses ({results.courses.length})
                  </p>
                  {results.courses.map((c) => (
                    <Link
                      key={c.id}
                      href={
                        results.role === "admin"
                          ? "/admin/courses"
                          : results.role === "teacher"
                            ? "/teacher/courses"
                            : "/student/courses"
                      }
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between rounded-lg border border-border/80 p-2.5 hover:bg-muted/50"
                    >
                      <span className="font-medium text-foreground">
                        {c.code} — {c.title}
                      </span>
                      <Badge variant="outline">{c.status}</Badge>
                    </Link>
                  ))}
                </div>
              )}

              {results.lessons.length > 0 && (
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 font-semibold text-foreground">
                    <FileText className="size-3.5 text-gold-foreground" />
                    Lessons & Materials ({results.lessons.length})
                  </p>
                  {results.lessons.map((l) => (
                    <Link
                      key={l.id}
                      href={
                        results.role === "teacher"
                          ? "/teacher/courses"
                          : `/student/courses/${l.id}`
                      }
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between rounded-lg border border-border/80 p-2.5 hover:bg-muted/50"
                    >
                      <span className="font-medium text-foreground">
                        {l.title}
                      </span>
                      <Badge variant="outline" className="uppercase">
                        {l.content_type}
                      </Badge>
                    </Link>
                  ))}
                </div>
              )}

              {results.exams.length > 0 && (
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 font-semibold text-foreground">
                    <ClipboardCheck className="size-3.5 text-gold-foreground" />
                    Examinations ({results.exams.length})
                  </p>
                  {results.exams.map((ex) => (
                    <Link
                      key={ex.id}
                      href={
                        results.role === "teacher"
                          ? "/teacher/exams"
                          : `/student/exams/${ex.id}`
                      }
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between rounded-lg border border-border/80 p-2.5 hover:bg-muted/50"
                    >
                      <span className="font-medium text-foreground">
                        {ex.title}
                      </span>
                      <Badge variant="gold">{ex.status}</Badge>
                    </Link>
                  ))}
                </div>
              )}

              {results.students.length > 0 && (
                <div className="space-y-1.5">
                  <p className="flex items-center gap-1.5 font-semibold text-foreground">
                    <Users className="size-3.5 text-gold-foreground" />
                    Students ({results.students.length})
                  </p>
                  {results.students.map((s) => (
                    <Link
                      key={s.id}
                      href={
                        results.role === "admin"
                          ? "/admin/users"
                          : "/teacher/students"
                      }
                      onClick={() => setOpen(false)}
                      className="flex items-center justify-between rounded-lg border border-border/80 p-2.5 hover:bg-muted/50"
                    >
                      <span className="font-medium text-foreground">
                        {s.full_name || s.email}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">
                        {s.email}
                      </span>
                    </Link>
                  ))}
                </div>
              )}

              {results.courses.length === 0 &&
                results.lessons.length === 0 &&
                results.exams.length === 0 &&
                results.students.length === 0 && (
                  <p className="py-4 text-center text-muted-foreground">
                    No matching authorized records found for &quot;{query}&quot;.
                  </p>
                )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
