import type { Metadata } from "next";

import { SignupForm } from "@/components/auth/signup-form";

export const metadata: Metadata = {
  title: "Create Account",
  description:
    "Create your Learnix student account or submit a teacher application.",
};

export default function SignupPage() {
  return <SignupForm />;
}
