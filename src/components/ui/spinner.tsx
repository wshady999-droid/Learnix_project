import { cva, type VariantProps } from "class-variance-authority";
import { LoaderCircle } from "lucide-react";

import { cn } from "@/lib/utils";

const spinnerVariants = cva("animate-spin text-current", {
  variants: {
    size: {
      sm: "size-4",
      md: "size-5",
      lg: "size-8",
    },
  },
  defaultVariants: { size: "md" },
});

interface SpinnerProps extends VariantProps<typeof spinnerVariants> {
  className?: string;
  /** Accessible label. Pass `null` when a parent already announces the busy state. */
  label?: string | null;
}

function Spinner({ size, className, label = "Loading" }: SpinnerProps) {
  if (label === null) {
    return <LoaderCircle aria-hidden="true" className={cn(spinnerVariants({ size }), className)} />;
  }

  return (
    <span role="status" className="inline-flex">
      <LoaderCircle aria-hidden="true" className={cn(spinnerVariants({ size }), className)} />
      <span className="sr-only">{label}</span>
    </span>
  );
}

export { Spinner };
