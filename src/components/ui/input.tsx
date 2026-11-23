import { cn } from "@/lib/utils";

const fieldBase = [
  "w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm text-foreground shadow-xs",
  "transition-[border-color,box-shadow] duration-150 ease-standard outline-none",
  "placeholder:text-muted-foreground/80",
  "hover:border-gold-border",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25 focus-visible:outline-none",
  "aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/25",
  "disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60",
].join(" ");

function Input({ className, type = "text", ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        fieldBase,
        "h-10 py-2",
        "file:me-3 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
        className,
      )}
      {...props}
    />
  );
}

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(fieldBase, "field-sizing-content min-h-20 py-2", className)}
      {...props}
    />
  );
}

export { Input, Textarea, fieldBase };
