import { Inbox, type LucideIcon } from "lucide-react";

import { StatePanel, type StatePanelProps } from "@/components/feedback/state-panel";

interface EmptyStateProps extends Omit<StatePanelProps, "icon" | "role" | "tone"> {
  icon?: LucideIcon;
}

/** Shown when a list/collection has no data yet. Offer a next step via `actions`. */
export function EmptyState({ icon = Inbox, bordered = true, ...props }: EmptyStateProps) {
  return <StatePanel icon={icon} tone="gold" role="status" bordered={bordered} {...props} />;
}
