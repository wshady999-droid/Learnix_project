import type { LucideIcon } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const iconToneVariants = cva(
  "flex size-12 items-center justify-center rounded-full ring-8 [&_svg]:size-5",
  {
    variants: {
      tone: {
        neutral: "bg-muted text-muted-foreground ring-muted/40",
        gold: "bg-gold-subtle text-gold-foreground ring-gold-subtle/50",
        destructive: "bg-destructive-subtle text-destructive ring-destructive-subtle/50",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface StatePanelProps extends VariantProps<typeof iconToneVariants> {
  icon: LucideIcon;
  title: string;
  description?: React.ReactNode;
  /** Primary/secondary actions (buttons, links). */
  actions?: React.ReactNode;
  /** `role` for assistive tech, e.g. "alert" for errors. */
  role?: "status" | "alert";
  /** Render inside a dashed bordered container. */
  bordered?: boolean;
  size?: "sm" | "md";
  className?: string;
}

/** Shared layout for empty / error / informational states. */
export function StatePanel({
  icon: Icon,
  title,
  description,
  actions,
  tone,
  role,
  bordered = false,
  size = "md",
  className,
}: StatePanelProps) {
  return (
    <section
      role={role}
      className={cn(
        "flex flex-col items-center justify-center text-center",
        size === "md" ? "gap-4 px-6 py-12" : "gap-3 px-4 py-8",
        bordered && "rounded-xl border border-dashed bg-card/50",
        className,
      )}
    >
      <div className={iconToneVariants({ tone })}>
        <Icon aria-hidden="true" />
      </div>
      <div className="flex max-w-sm flex-col gap-1.5">
        <h2 className={cn("font-semibold text-foreground", size === "md" ? "text-base" : "text-sm")}>
          {title}
        </h2>
        {description ? (
          typeof description === "string" ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : (
            <div className="text-sm text-muted-foreground">{description}</div>
          )
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center justify-center gap-2">{actions}</div> : null}
    </section>
  );
}
