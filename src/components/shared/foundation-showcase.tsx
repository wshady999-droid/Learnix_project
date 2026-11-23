"use client";

import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";
import { z } from "zod";
import {
  Bell,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  FolderTree,
  GraduationCap,
  Info,
  Layers,
  Palette,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input, Textarea } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ROLE_NAV_BLUEPRINTS } from "@/config/navigation";
import type { UserRole } from "@/types/navigation";

const BRAND_SWATCHES = [
  {
    name: "Main Background",
    hex: "#F8F8F7",
    token: "--brand-background",
    role: "Warm alabaster light canvas",
    swatchClass: "bg-[#F8F8F7] text-[#202124] border border-border",
  },
  {
    name: "Pure White",
    hex: "#FFFFFF",
    token: "--brand-white",
    role: "Elevated cards & popovers",
    swatchClass: "bg-[#FFFFFF] text-[#202124] border border-border",
  },
  {
    name: "Charcoal",
    hex: "#202124",
    token: "--brand-charcoal",
    role: "Primary ink & dark surfaces",
    swatchClass: "bg-[#202124] text-[#FFFFFF]",
  },
  {
    name: "Gold Base",
    hex: "#A88945",
    token: "--brand-gold",
    role: "Core brand accent & focus ring",
    swatchClass: "bg-[#A88945] text-[#202124]",
  },
  {
    name: "Gold Highlight",
    hex: "#E5CC83",
    token: "--brand-gold-highlight",
    role: "Specular crest & dark-mode gold text",
    swatchClass: "bg-[#E5CC83] text-[#202124]",
  },
  {
    name: "Gold Shadow",
    hex: "#806127",
    token: "--brand-gold-shadow",
    role: "Deep metallic edge & light-mode gold text",
    swatchClass: "bg-[#806127] text-[#FFFFFF]",
  },
  {
    name: "Secondary Grey",
    hex: "#737373",
    token: "--brand-grey",
    role: "Muted copy & secondary icons",
    swatchClass: "bg-[#737373] text-[#FFFFFF]",
  },
] as const;

const ANALYTICS_SAMPLE = [
  { week: "W1", completion: 64, mastery: 58 },
  { week: "W2", completion: 70, mastery: 65 },
  { week: "W3", completion: 74, mastery: 71 },
  { week: "W4", completion: 82, mastery: 78 },
  { week: "W5", completion: 87, mastery: 84 },
  { week: "W6", completion: 92, mastery: 89 },
] as const;

const COMPONENT_CATALOG_ROWS = [
  {
    component: "Button",
    module: "src/components/ui/button.tsx",
    variants: "gold, gold-outline, solid, secondary, outline, ghost, destructive, link",
    status: "Ready",
  },
  {
    component: "Card",
    module: "src/components/ui/card.tsx",
    variants: "default, premium (metallic gold border), muted, ghost",
    status: "Ready",
  },
  {
    component: "Form + Input / Textarea",
    module: "src/components/ui/form.tsx",
    variants: "React Hook Form + Zod schema validation",
    status: "Ready",
  },
  {
    component: "Dialog & Sheet",
    module: "src/components/ui/dialog.tsx",
    variants: "Accessible modal + slide-over mobile drawer",
    status: "Ready",
  },
  {
    component: "DropdownMenu & Tooltip",
    module: "src/components/ui/dropdown-menu.tsx",
    variants: "Keyboard accessible menus + collapsed icon tooltips",
    status: "Ready",
  },
  {
    component: "Feedback States",
    module: "src/components/feedback/*",
    variants: "LoadingState, EmptyState, ErrorState, Sonner Toaster",
    status: "Ready",
  },
] as const;

const courseDraftSchema = z.object({
  title: z
    .string()
    .min(4, "Course title must be at least 4 characters.")
    .max(80, "Course title must be at most 80 characters."),
  category: z.string().min(2, "Please enter a subject category."),
  summary: z
    .string()
    .min(12, "Provide a concise learning objective (12+ characters).")
    .max(240, "Summary must stay under 240 characters."),
});

type CourseDraftValues = z.infer<typeof courseDraftSchema>;

export function FoundationShowcase() {
  const [selectedRole, setSelectedRole] = useState<UserRole>("student");
  const [feedbackTab, setFeedbackTab] = useState<"empty" | "loading" | "error">("empty");

  const form = useForm<CourseDraftValues>({
    resolver: zodResolver(courseDraftSchema),
    defaultValues: {
      title: "Foundations of Neural Architectures",
      category: "Artificial Intelligence",
      summary: "Master attention mechanisms, transformer blocks, and evaluation rigor.",
    },
  });

  function onSubmit(values: CourseDraftValues) {
    toast.success("Validated with Zod + React Hook Form", {
      description: `${values.title} (${values.category}) is valid and ready.`,
    });
  }

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex flex-col gap-10">
        {/* Hero Overview */}
        <Card variant="premium" className="overflow-hidden">
          <CardHeader className="gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="gold">
                <Sparkles aria-hidden="true" />
                Learnix
              </Badge>
              <Badge variant="gold-subtle">Part 1 · Technical Foundation & Design System</Badge>
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight sm:text-3xl">
              Production Architecture &amp; Controlled Metallic Gold Design System
            </CardTitle>
            <CardDescription className="max-w-3xl text-sm sm:text-base">
              Built with Next.js App Router, strict TypeScript, Tailwind CSS v4 design tokens,
              shadcn/ui primitives, Supabase SSR clients, Recharts, and React Hook Form + Zod.
              Switch between Light and Dark Mode in the top bar or collapse the sidebar on desktop
              to test icon tooltips.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-wrap gap-3 border-t border-border/70 pt-5">
            <Button
              variant="gold"
              onClick={() =>
                toast.success("Learnix Design System active", {
                  description: "Metallic gold gradient and semantic tokens verified.",
                })
              }
            >
              <Sparkles aria-hidden="true" />
              Trigger Toast Notification
            </Button>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="gold-outline">Open Modal Dialog</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Learnix Design Specification</DialogTitle>
                  <DialogDescription>
                    Metallic gold (`110deg` five-stop gradient) is reserved for primary actions,
                    active navigation states, key badges, and selected interactive highlights.
                  </DialogDescription>
                </DialogHeader>
                <div className="rounded-lg border bg-muted/50 p-4 text-xs text-muted-foreground">
                  <p className="font-mono text-foreground">
                    linear-gradient(110deg, #806127 0%, #A88945 25%, #E5CC83 48%, #A88945 72%,
                    #806127 100%)
                  </p>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="secondary">Close</Button>
                  </DialogClose>
                  <DialogClose asChild>
                    <Button variant="gold">Acknowledge</Button>
                  </DialogClose>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  Role Blueprint: <span className="capitalize">{selectedRole}</span>
                  <ChevronDown aria-hidden="true" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuLabel>Preview Navigation Role</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={selectedRole}
                  onValueChange={(value) => setSelectedRole(value as UserRole)}
                >
                  <DropdownMenuRadioItem value="student">Student</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="teacher">Teacher</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="admin">Administrator</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardFooter>
        </Card>

        {/* Section 1: Brand Palette & Metallic Gold */}
        <section id="tokens" aria-labelledby="heading-tokens" className="scroll-mt-20 space-y-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Palette className="size-4 text-gold-foreground" aria-hidden="true" />
              <h2 id="heading-tokens" className="text-lg font-semibold tracking-tight">
                Official Brand Palette &amp; Metallic Gold Surface
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Exact official brand hex values mapped to semantic CSS custom properties for Light
              and Dark Mode.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
            {BRAND_SWATCHES.map((swatch) => (
              <Card key={swatch.hex} className="gap-3 py-4">
                <CardContent className="flex flex-col gap-3 px-4">
                  <div
                    className={`flex h-20 items-end justify-between rounded-lg p-2.5 font-mono text-xs font-semibold ${swatch.swatchClass}`}
                  >
                    <span>{swatch.hex}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{swatch.name}</p>
                    <p className="font-mono text-[11px] text-gold-foreground">{swatch.token}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{swatch.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Controlled Metallic Gold Gradient</CardTitle>
              <CardDescription>
                110° five-stop metallic gradient with subtle top light reflection and smooth hover
                sheen.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
              <div className="gold-sheen flex min-h-28 flex-col justify-between rounded-xl bg-gold-metallic p-5 text-brand-charcoal shadow-gold">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold tracking-wider uppercase">
                    Learnix Metallic Gold
                  </span>
                  <span className="font-mono text-xs font-semibold">110deg · 5 stops</span>
                </div>
                <p className="font-mono text-xs">
                  #806127 (0%) → #A88945 (25%) → #E5CC83 (48%) → #A88945 (72%) → #806127 (100%)
                </p>
              </div>
              <div className="flex flex-col justify-center gap-2 rounded-xl border bg-muted/40 p-4 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">Restraint Rules Enforced:</p>
                <ul className="list-inside list-disc space-y-1">
                  <li>Primary CTAs and active navigation items only</li>
                  <li>High-priority badges and premium card hairline borders</li>
                  <li>Accessible charcoal ink (`#202124`) on metallic gold fills</li>
                  <li>Reduced-motion respected via `prefers-reduced-motion`</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </section>

        <Separator />

        {/* Section 2: Reusable UI Components */}
        <section
          id="components"
          aria-labelledby="heading-components"
          className="scroll-mt-20 space-y-6"
        >
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-gold-foreground" aria-hidden="true" />
              <h2 id="heading-components" className="text-lg font-semibold tracking-tight">
                Reusable UI Components
              </h2>
            </div>
            <p className="text-sm text-muted-foreground">
              Modular primitives for buttons, badges, tooltips, forms, dialogs, dropdowns, tables,
              and feedback states.
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Buttons, Badges & Tooltips */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Buttons, Badges &amp; Tooltips</CardTitle>
                <CardDescription>
                  Consistent sizing, focus rings, loading spinners, and accessible contrast.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="space-y-2">
                  <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Button Variants
                  </p>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Button variant="gold">Primary Gold</Button>
                    <Button variant="gold-outline">Gold Outline</Button>
                    <Button variant="solid">Solid Charcoal</Button>
                    <Button variant="secondary">Secondary</Button>
                    <Button variant="outline">Outline</Button>
                    <Button variant="ghost">Ghost</Button>
                    <Button variant="destructive">Destructive</Button>
                    <Button variant="secondary" loading>
                      Saving
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Semantic &amp; Brand Badges
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="gold">Premium Gold</Badge>
                    <Badge variant="gold-subtle">Selected Track</Badge>
                    <Badge variant="neutral">Neutral</Badge>
                    <Badge variant="success">Published</Badge>
                    <Badge variant="warning">Review Pending</Badge>
                    <Badge variant="info">AI Assisted</Badge>
                    <Badge variant="destructive">Action Required</Badge>
                    <Badge variant="outline">v1.0 Foundation</Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                    Tooltips &amp; Notifications
                  </p>
                  <div className="flex flex-wrap items-center gap-2.5">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button variant="outline" size="sm">
                          <Info aria-hidden="true" />
                          Hover for Tooltip
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        Tooltips also appear automatically on collapsed sidebar icons.
                      </TooltipContent>
                    </Tooltip>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        toast.info("Curriculum draft synced", {
                          description: "All changes are stored locally.",
                        })
                      }
                    >
                      <Bell aria-hidden="true" />
                      Info Toast
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* React Hook Form + Zod */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Form Validation (React Hook Form + Zod)</CardTitle>
                <CardDescription>
                  Typed schema validation with accessible `aria-invalid` and error announcements.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <FormField
                        control={form.control}
                        name="title"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Module Title</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Linear Algebra" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Subject Track</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. Mathematics" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="summary"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Learning Objective</FormLabel>
                          <FormControl>
                            <Textarea rows={2} {...field} />
                          </FormControl>
                          <FormDescription>
                            Clear, measurable outcome shown to students before enrollment.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="flex justify-end gap-2">
                      <Button type="button" variant="ghost" onClick={() => form.reset()}>
                        Reset
                      </Button>
                      <Button type="submit" variant="gold">
                        <Send aria-hidden="true" />
                        Validate Form
                      </Button>
                    </div>
                  </form>
                </Form>
              </CardContent>
            </Card>
          </div>

          {/* Feedback states: Empty, Loading, Error */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Standardized States (Empty, Loading &amp; Error)
              </CardTitle>
              <CardDescription>
                Switch between the three reusable state patterns used across all future dashboards.
              </CardDescription>
              <CardAction>
                <div className="inline-flex rounded-lg border bg-muted p-1">
                  {(["empty", "loading", "error"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setFeedbackTab(tab)}
                      className={`rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors ${
                        feedbackTab === tab
                          ? "gold-sheen bg-gold-metallic font-semibold text-brand-charcoal shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {tab}
                    </button>
                  ))}
                </div>
              </CardAction>
            </CardHeader>
            <CardContent>
              {feedbackTab === "empty" ? (
                <EmptyState
                  icon={BookOpen}
                  title="No modules published yet"
                  description="When instructors publish learning modules, they will appear here with progress metrics."
                  actions={
                    <Button
                      variant="gold"
                      size="sm"
                      onClick={() => toast.success("Ready for Part 2 course authoring")}
                    >
                      Create First Module
                    </Button>
                  }
                />
              ) : null}
              {feedbackTab === "loading" ? (
                <div className="grid gap-6 rounded-xl border border-dashed p-6 md:grid-cols-2">
                  <LoadingState variant="spinner" label="Loading curriculum structure…" />
                  <LoadingState
                    variant="skeleton"
                    rows={4}
                    label="Loading module placeholders…"
                    className="justify-center"
                  />
                </div>
              ) : null}
              {feedbackTab === "error" ? (
                <ErrorState
                  bordered
                  title="Unable to reach synchronization service"
                  description="Check your network connection or retry the request."
                  onRetry={() => toast.info("Retry handler invoked")}
                />
              ) : null}
            </CardContent>
          </Card>

          {/* Table */}
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Foundation Component Matrix</h3>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Component</TableHead>
                  <TableHead>Module Path</TableHead>
                  <TableHead>Capabilities &amp; Variants</TableHead>
                  <TableHead className="text-end">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {COMPONENT_CATALOG_ROWS.map((row) => (
                  <TableRow key={row.component}>
                    <TableCell className="font-medium text-foreground">{row.component}</TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {row.module}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{row.variants}</TableCell>
                    <TableCell className="text-end">
                      <Badge variant="success">
                        <CheckCircle2 aria-hidden="true" />
                        {row.status}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </section>

        <Separator />

        {/* Section 3: Analytics Foundation (Recharts) */}
        <section
          id="analytics"
          aria-labelledby="heading-analytics"
          className="scroll-mt-20 space-y-4"
        >
          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <Card>
              <CardHeader>
                <CardTitle id="heading-analytics" className="text-base">
                  Recharts Analytics Foundation
                </CardTitle>
                <CardDescription>
                  Configured with semantic chart tokens (`--chart-1` to `--chart-5`) that adapt
                  automatically to Light and Dark Mode.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-64 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={[...ANALYTICS_SAMPLE]}
                      margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient id="learnixGoldFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.45} />
                          <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis
                        dataKey="week"
                        stroke="var(--muted-foreground)"
                        fontSize={12}
                        tickLine={false}
                      />
                      <YAxis
                        stroke="var(--muted-foreground)"
                        fontSize={12}
                        tickLine={false}
                        domain={[40, 100]}
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
                      <Area
                        type="monotone"
                        dataKey="completion"
                        name="Completion %"
                        stroke="var(--chart-1)"
                        strokeWidth={2.25}
                        fill="url(#learnixGoldFill)"
                      />
                      <Area
                        type="monotone"
                        dataKey="mastery"
                        name="Mastery %"
                        stroke="var(--chart-3)"
                        strokeWidth={2}
                        fillOpacity={0}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            {/* Role Navigation Blueprint Preview */}
            <Card id="architecture" className="scroll-mt-20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FolderTree className="size-4 text-gold-foreground" aria-hidden="true" />
                  Modular Role Navigation Blueprints
                </CardTitle>
                <CardDescription>
                  Prepared navigation configs for Admin, Teacher, and Student workspaces.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  {(
                    [
                      { id: "student", label: "Student", icon: GraduationCap },
                      { id: "teacher", label: "Teacher", icon: BookOpen },
                      { id: "admin", label: "Admin", icon: ShieldCheck },
                    ] as const
                  ).map((role) => {
                    const Icon = role.icon;
                    const active = selectedRole === role.id;
                    return (
                      <Button
                        key={role.id}
                        size="sm"
                        variant={active ? "gold" : "outline"}
                        onClick={() => setSelectedRole(role.id)}
                      >
                        <Icon aria-hidden="true" />
                        {role.label}
                      </Button>
                    );
                  })}
                </div>

                <div className="rounded-xl border bg-muted/40 p-3.5">
                  {ROLE_NAV_BLUEPRINTS[selectedRole].map((section) => (
                    <div key={section.id} className="space-y-2">
                      <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                        {section.title} ({selectedRole})
                      </p>
                      <ul className="space-y-1.5">
                        {section.items.map((item) => {
                          const Icon = item.icon;
                          return (
                            <li
                              key={item.id}
                              className="flex items-center justify-between rounded-lg border bg-card px-3 py-2 text-xs"
                            >
                              <span className="flex items-center gap-2 font-medium text-foreground">
                                <Icon className="size-3.5 text-gold-foreground" />
                                {item.label}
                              </span>
                              <span className="font-mono text-muted-foreground">{item.href}</span>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </TooltipProvider>
  );
}
