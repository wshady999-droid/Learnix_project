import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

interface LoadingStateProps {
  /** `spinner` for short waits, `skeleton` to preview the shape of upcoming content. */
  variant?: "spinner" | "skeleton";
  label?: string;
  /** Number of skeleton rows. */
  rows?: number;
  className?: string;
}

export function LoadingState({
  variant = "spinner",
  label = "Loading…",
  rows = 3,
  className,
}: LoadingStateProps) {
  if (variant === "skeleton") {
    return (
      <div role="status" aria-live="polite" className={cn("flex flex-col gap-3", className)}>
        <span className="sr-only">{label}</span>
        <Skeleton className="h-5 w-1/3" />
        {Array.from({ length: rows }, (_, index) => (
          <Skeleton key={index} className={cn("h-4", index % 2 === 0 ? "w-full" : "w-4/5")} />
        ))}
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col items-center justify-center gap-3 py-12 text-sm text-muted-foreground",
        className,
      )}
    >
      <Spinner size="lg" label={null} className="text-gold-foreground" />
      <span>{label}</span>
    </div>
  );
}
