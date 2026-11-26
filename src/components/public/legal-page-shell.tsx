"use client";

import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";

import { useLocale } from "@/components/i18n/locale-provider";
import { PublicFooter } from "@/components/public/public-footer";
import { PublicNavbar } from "@/components/public/public-navbar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface LegalPageShellProps {
  kind: "privacy" | "terms";
}

export function LegalPageShell({ kind }: LegalPageShellProps) {
  const { t } = useLocale();

  const title = kind === "privacy" ? t.legal.privacyTitle : t.legal.termsTitle;
  const subtitle = kind === "privacy" ? t.legal.privacySubtitle : t.legal.termsSubtitle;
  const sections = kind === "privacy" ? t.legal.privacySections : t.legal.termsSections;

  return (
    <div className="flex min-h-dvh flex-col bg-[#09251F] text-[#FAF9F4]">
      <PublicNavbar />

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-12 sm:px-6 lg:px-8">
        <div className="mb-6">
          <Button asChild variant="ghost" size="sm" className="text-[#B8CECA] hover:text-white hover:bg-[#12352D]">
            <Link href="/">
              <ArrowLeft className="size-4 rtl:rotate-180" aria-hidden="true" />
              <span>{t.common.backToHome}</span>
            </Link>
          </Button>
        </div>

        <div className="space-y-3">
          <Badge variant="outline" className="border-[#20B89A] text-[#00E5C0]">
            <FileText className="size-3.5" aria-hidden="true" />
            <span>{t.legal.placeholderBadge}</span>
          </Badge>
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {title}
          </h1>
          <p className="text-sm text-[#B8CECA] sm:text-base">{subtitle}</p>
        </div>

        <div className="mt-6 rounded-xl border border-[#20B89A]/30 bg-[#20B89A]/10 p-4 text-xs leading-relaxed text-[#8FFFD2]">
          {t.legal.placeholderNotice}
        </div>

        <div className="mt-8 space-y-4">
          {sections.map((section) => (
            <Card key={section.title} className="border-[#1A453B] bg-[#12352D]">
              <CardHeader>
                <CardTitle className="text-base text-white">{section.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm leading-relaxed text-[#B8CECA]">{section.body}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}