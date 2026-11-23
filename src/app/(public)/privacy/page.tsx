import type { Metadata } from "next";

import { LegalPageShell } from "@/components/public/legal-page-shell";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Learnix privacy policy and data protection practices.",
};

export default function PrivacyPage() {
  return <LegalPageShell kind="privacy" />;
}
