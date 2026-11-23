"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Award, CheckCircle2, Search, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";

interface VerifiedCert {
  certificateNumber: string;
  verificationHash: string;
  studentName: string;
  courseCode: string;
  courseTitle: string;
  finalScore: number | null;
  issuedAt: string;
  isRevoked: boolean;
}

export default function VerifyCertificatePage() {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifiedCert | null>(null);

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch(
        `/api/certificates/verify?code=${encodeURIComponent(code.trim())}`,
      );
      const json = (await res.json()) as {
        ok: boolean;
        error?: string;
        data?: VerifiedCert;
      };
      if (!res.ok || !json.ok || !json.data) {
        setError(json.error ?? "Certificate could not be verified.");
        return;
      }
      setResult(json.data);
    } catch {
      setError("Unable to reach verification service.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center space-y-6 px-4 py-12">
      <Button asChild variant="ghost" size="sm" className="w-fit -ml-2">
        <Link href="/">
          <ArrowLeft className="size-4" />
          <span>Back to Learnix Home</span>
        </Link>
      </Button>

      <Card className="border-gold-primary/50">
        <CardHeader>
          <div className="flex items-center gap-2 text-gold-foreground">
            <Award className="size-5" />
            <span className="text-xs font-semibold tracking-wider uppercase">
              Learnix Official Credential Registry
            </span>
          </div>
          <CardTitle className="mt-2 text-2xl">
            Certificate Verification
          </CardTitle>
          <CardDescription>
            Enter a Learnix Certificate ID (e.g. LRX-XXXXXX-XXXXXX) or
            verification hash to confirm authenticity.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <form onSubmit={handleVerify} className="flex flex-col gap-2 sm:flex-row">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="LRX-XXXXXX-XXXXXX or verification hash..."
              className="flex-1 font-mono text-xs"
            />
            <Button type="submit" variant="gold" disabled={loading}>
              <Search className="size-4" />
              <span>{loading ? "Verifying..." : "Verify"}</span>
            </Button>
          </form>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-xs text-destructive">
              <ShieldAlert className="size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="space-y-2 rounded-xl border border-gold-primary/60 bg-gold-primary/5 p-4 text-xs">
              <div className="flex items-center justify-between">
                <Badge
                  variant={result.isRevoked ? "destructive" : "gold"}
                  className="gap-1"
                >
                  <CheckCircle2 className="size-3.5" />
                  <span>
                    {result.isRevoked
                      ? "Revoked Credential"
                      : "Authentic Verified Certificate"}
                  </span>
                </Badge>
                <span className="font-mono text-muted-foreground">
                  {result.issuedAt.slice(0, 10)}
                </span>
              </div>
              <p className="text-base font-bold text-foreground">
                {result.courseCode} — {result.courseTitle}
              </p>
              <p className="text-muted-foreground">
                Awarded to:{" "}
                <strong className="text-foreground">{result.studentName}</strong>
              </p>
              <p className="font-mono text-[11px] text-muted-foreground">
                Certificate ID: {result.certificateNumber}
              </p>
              {result.finalScore !== null && (
                <p className="text-emerald-600 dark:text-emerald-400">
                  Final Score: {Number(result.finalScore).toFixed(1)}%
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
