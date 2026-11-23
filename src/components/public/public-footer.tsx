"use client";

import Link from "next/link";
import { toast } from "sonner";
import { Clock, Globe, Mail, MapPin, Phone, Share2 } from "lucide-react";

import { useLocale } from "@/components/i18n/locale-provider";
import { BrandLogo } from "@/components/shared/brand-logo";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

const SOCIAL_PLACEHOLDERS = [
  { id: "linkedin", name: "LinkedIn" },
  { id: "x", name: "X" },
  { id: "youtube", name: "YouTube" },
  { id: "github", name: "GitHub" },
] as const;

export function PublicFooter() {
  const { t } = useLocale();
  const currentYear = 2026;

  const usefulLinks = [
    { label: t.nav.home, href: "/#home" },
    { label: t.nav.about, href: "/#about" },
    { label: t.nav.features, href: "/#features" },
    { label: t.nav.courses, href: "/#courses" },
    { label: t.nav.ai, href: "/#ai-learning" },
    { label: t.nav.whyLearnix, href: "/#why-learnix" },
    { label: t.nav.contact, href: "/#contact" },
  ] as const;

  const legalAndAccountLinks = [
    { label: t.nav.login, href: "/login" },
    { label: t.nav.createAccount, href: "/signup" },
    { label: t.footer.privacyPolicy, href: "/privacy" },
    { label: t.footer.termsOfService, href: "/terms" },
    { label: t.footer.designSystemLink, href: "/foundation" },
  ] as const;

  return (
    <footer className="border-t border-border bg-card text-card-foreground">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.35fr_0.85fr_0.9fr_1.3fr]">
          {/* Column 1: About Learnix */}
          <div className="flex flex-col gap-4">
            <BrandLogo />
            <p className="max-w-sm text-sm leading-relaxed text-muted-foreground">
              {t.footer.aboutDescription}
            </p>
            <div className="space-y-2 pt-1">
              <p className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
                {t.footer.socialLabel}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {SOCIAL_PLACEHOLDERS.map((social) => (
                  <button
                    key={social.id}
                    type="button"
                    onClick={() =>
                      toast.info(`${social.name} — ${t.common.placeholderTag}`, {
                        description: t.footer.socialPlaceholderToast,
                      })
                    }
                    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-gold-border hover:bg-gold-subtle hover:text-gold-foreground"
                  >
                    <Share2 className="size-3" aria-hidden="true" />
                    <span>{social.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Column 2: Useful links */}
          <div className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold tracking-wider text-foreground uppercase">
              {t.footer.usefulLinksTitle}
            </h2>
            <ul className="flex flex-col gap-2 text-sm">
              {usefulLinks.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-muted-foreground transition-colors hover:text-gold-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Legal & Account */}
          <div className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold tracking-wider text-foreground uppercase">
              {t.footer.legalLinksTitle}
            </h2>
            <ul className="flex flex-col gap-2 text-sm">
              {legalAndAccountLinks.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-muted-foreground transition-colors hover:text-gold-foreground"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Contact Information (Clearly labeled owner placeholders) */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xs font-semibold tracking-wider text-foreground uppercase">
                {t.footer.contactTitle}
              </h2>
              <Badge variant="gold-subtle" className="text-[10px]">
                {t.common.placeholderTag}
              </Badge>
            </div>
            <ul className="flex flex-col gap-2.5 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <Mail className="mt-0.5 size-3.5 shrink-0 text-gold-foreground" aria-hidden="true" />
                <div>
                  <span className="font-semibold text-foreground">{t.contact.emailLabel}: </span>
                  <span>{t.contact.emailPlaceholderValue}</span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="mt-0.5 size-3.5 shrink-0 text-gold-foreground" aria-hidden="true" />
                <div>
                  <span className="font-semibold text-foreground">{t.contact.phoneLabel}: </span>
                  <span>{t.contact.phonePlaceholderValue}</span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-gold-foreground" aria-hidden="true" />
                <div>
                  <span className="font-semibold text-foreground">{t.contact.addressLabel}: </span>
                  <span>{t.contact.addressPlaceholderValue}</span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="mt-0.5 size-3.5 shrink-0 text-gold-foreground" aria-hidden="true" />
                <div>
                  <span className="font-semibold text-foreground">{t.contact.hoursLabel}: </span>
                  <span>{t.contact.hoursPlaceholderValue}</span>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col items-center justify-between gap-4 text-xs text-muted-foreground sm:flex-row">
          <p>
            © {currentYear} {t.footer.copyright}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/privacy" className="transition-colors hover:text-gold-foreground">
              {t.footer.privacyPolicy}
            </Link>
            <Link href="/terms" className="transition-colors hover:text-gold-foreground">
              {t.footer.termsOfService}
            </Link>
            <span className="inline-flex items-center gap-1 text-gold-foreground">
              <Globe className="size-3.5" aria-hidden="true" />
              <span>EN · AR · DE · IT · FR</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
