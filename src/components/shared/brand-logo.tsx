import { Brain } from "lucide-react";

import { cn } from "@/lib/utils";

interface BrandLogoProps {
  /** Hide the wordmark when rendered inside a compact icon rail. */
  hideWordmarkInCompact?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function BrandLogo({
  hideWordmarkInCompact = false,
  size = "md",
  className,
}: BrandLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2.5 select-none", className)}>
      <span
        aria-hidden="true"
        className={cn(
          "gold-sheen inline-flex shrink-0 items-center justify-center rounded-lg bg-gold-metallic text-brand-charcoal shadow-gold",
          size === "md" ? "size-9" : "size-8",
        )}
      >
        <Brain className={size === "md" ? "size-5" : "size-4"} />
      </span>
      <span
        className={cn(
          "flex flex-col leading-none",
          hideWordmarkInCompact && "compact:hidden",
        )}
      >
        <span className="text-base font-bold tracking-tight text-foreground">Learnix</span>
      </span>
    </span>
  );
}
