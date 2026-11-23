import { AppShell } from "@/components/navigation/app-shell";
import { FoundationShowcase } from "@/components/shared/foundation-showcase";

export default function FoundationPage() {
  return (
    <AppShell
      title="Learnix"
      subtitle="Part 1 · Foundation & Design System"
    >
      <FoundationShowcase />
    </AppShell>
  );
}
