import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Set New Password",
  description: "Set a new strong password for your Learnix account.",
};

export default function ResetPasswordPage() {
  return <ResetPasswordForm />;
}
