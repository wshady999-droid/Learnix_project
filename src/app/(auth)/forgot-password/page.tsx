import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/auth/forgot-password-form";

export const metadata: Metadata = {
  title: "Reset Password",
  description: "Recover and reset your Learnix account password.",
};

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
