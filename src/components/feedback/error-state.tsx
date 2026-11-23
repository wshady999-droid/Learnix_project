"use client";

import { RotateCcw, TriangleAlert, type LucideIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { StatePanel, type StatePanelProps } from "@/components/feedback/state-panel";

interface ErrorStateProps extends Omit<StatePanelProps, "icon" | "role" | "tone" | "title"> {
  icon?: LucideIcon;
  title?: string;
  /** When provided, renders a "Try again" button. */
  onRetry?: () => void;
  retryLabel?: string;
}

/** Recoverable error display. Never render raw error messages/stack traces to users. */
export function ErrorState({
  icon = TriangleAlert,
  title = "Something went wrong",
  description = "An unexpected error occurred. Please try again.",
  onRetry,
  retryLabel = "Try again",
  actions,
  ...props
}: ErrorStateProps) {
  return (
    <StatePanel
      icon={icon}
      tone="destructive"
      role="alert"
      title={title}
      description={description}
      actions={
        onRetry || actions ? (
          <>
            {onRetry ? (
              <Button variant="outline" onClick={onRetry}>
                <RotateCcw aria-hidden="true" />
                {retryLabel}
              </Button>
            ) : null}
            {actions}
          </>
        ) : undefined
      }
      {...props}
    />
  );
}
