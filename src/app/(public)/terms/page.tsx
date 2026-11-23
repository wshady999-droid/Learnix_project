import type { Metadata } from "next";

import { LegalPageShell } from "@/components/public/legal-page-shell";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Learnix terms of service and academic integrity guidelines.",
};

export default function TermsPage() {
  return <LegalPageShell kind="terms" />;
}
