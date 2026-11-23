import { Suspense } from "react";
import type { Metadata } from "next";

import { LoginForm } from "@/components/auth/login-form";
import { LoadingState } from "@/components/feedback/loading-state";

export const metadata: Metadata = {
  title: "Sign In",
  description: "Sign in to your Learnix learning, teaching, or administration account.",
};

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <LoginForm />
    </Suspense>
  );
}
