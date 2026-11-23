import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";
import { Spinner } from "@/components/ui/spinner";

const buttonVariants = cva(
  [
    "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg text-sm font-medium whitespace-nowrap select-none",
    "transition-[color,background-color,border-color,box-shadow,background-position,transform] duration-200 ease-standard",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
    "disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  ],
  {
    variants: {
      variant: {
        /** Primary call to action – metallic gold. Use once or twice per view. */
        gold: [
          "bg-gold-metallic gold-sheen font-semibold text-brand-charcoal shadow-gold",
          "[text-shadow:0_1px_0_rgb(255_255_255/0.25)]",
          "hover:[background-position:100%_50%] hover:shadow-gold-hover active:translate-y-px",
        ],
        /** High-emphasis neutral action. */
        solid:
          "bg-foreground text-background shadow-xs hover:bg-foreground/90 active:translate-y-px",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/70",
        outline:
          "border border-input bg-card text-foreground shadow-xs hover:border-gold-border hover:bg-accent",
        /** Outline with a metallic gold edge – premium secondary action. */
        "gold-outline":
          "border-gold-metallic text-gold-foreground shadow-xs hover:[--gold-fill:var(--gold-subtle)]",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
        destructive:
          "bg-destructive text-destructive-foreground shadow-xs hover:bg-destructive/90 active:translate-y-px",
        link: "h-auto px-0 text-gold-foreground underline-offset-4 hover:underline",
      },
      size: {
        sm: "h-8 gap-1.5 rounded-md px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-11 px-6 text-base",
        icon: "size-10",
        "icon-sm": "size-8 rounded-md",
        "icon-lg": "size-11",
      },
      fullWidth: {
        true: "w-full",
      },
    },
    defaultVariants: {
      variant: "gold",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends React.ComponentProps<"button">,
    VariantProps<typeof buttonVariants> {
  /** Render the child element (e.g. `<Link>`) with button styles. */
  asChild?: boolean;
  /** Shows a spinner, disables the button and sets `aria-busy`. */
  loading?: boolean;
}

function Button({
  className,
  variant,
  size,
  fullWidth,
  asChild = false,
  loading = false,
  disabled,
  children,
  type,
  ...props
}: ButtonProps) {
  const classes = cn(buttonVariants({ variant, size, fullWidth }), className);

  if (asChild) {
    return (
      <Slot.Root data-slot="button" className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }

  return (
    <button
      data-slot="button"
      type={type ?? "button"}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Spinner size="sm" label={null} /> : null}
      {children}
    </button>
  );
}

export { Button, buttonVariants };
