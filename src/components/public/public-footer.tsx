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
  ] as const;

  return (
    <footer className="border-t border-gray-200 bg-[#FAF9F4] text-[#0a1f1d] dark:border-[#1A453B] dark:bg-[#09251F] dark:text-[#FAF9F4]">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-[1.35fr_0.85fr_0.9fr_1.3fr]">
          {/* Column 1: About Learnix */}
          <div className="flex flex-col gap-4">
            <div className="[&_span]:!text-[#0a1f1d] dark:[&_span]:!text-white">
              <BrandLogo />
            </div>
            <p className="max-w-sm text-sm leading-relaxed text-gray-600 dark:text-[#B8CECA]">
              {t.footer.aboutDescription}
            </p>
            <div className="space-y-2 pt-1">
              <p className="text-xs font-semibold tracking-wider text-gray-500 uppercase dark:text-[#7A9993]">
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
                    className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:border-emerald-500 hover:text-emerald-600 dark:border-[#1A453B] dark:bg-[#12352D] dark:text-[#B8CECA] dark:hover:border-[#20B89A] dark:hover:bg-[#20B89A]/10 dark:hover:text-[#8FFFD2]"
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
            <h2 className="text-xs font-semibold tracking-wider text-[#0a1f1d] uppercase dark:text-white">
              {t.footer.usefulLinksTitle}
            </h2>
            <ul className="flex flex-col gap-2 text-sm">
              {usefulLinks.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-gray-600 transition-colors hover:text-emerald-600 dark:text-[#B8CECA] dark:hover:text-[#00E5C0]"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 3: Legal & Account */}
          <div className="flex flex-col gap-3">
            <h2 className="text-xs font-semibold tracking-wider text-[#0a1f1d] uppercase dark:text-white">
              {t.footer.legalLinksTitle}
            </h2>
            <ul className="flex flex-col gap-2 text-sm">
              {legalAndAccountLinks.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="text-gray-600 transition-colors hover:text-emerald-600 dark:text-[#B8CECA] dark:hover:text-[#00E5C0]"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Column 4: Contact Information */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xs font-semibold tracking-wider text-[#0a1f1d] uppercase dark:text-white">
                {t.footer.contactTitle}
              </h2>
              <Badge
                variant="gold-subtle"
                className="border-emerald-500/40 bg-emerald-500/15 text-[10px] text-emerald-600 dark:border-[#20B89A]/40 dark:bg-[#20B89A]/15 dark:text-[#8FFFD2]"
              >
                {t.common.placeholderTag}
              </Badge>
            </div>
            <ul className="flex flex-col gap-2.5 text-xs text-gray-600 dark:text-[#B8CECA]">
              <li className="flex items-start gap-2">
                <Mail className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-[#00E5C0]" aria-hidden="true" />
                <div>
                  <span className="font-semibold text-[#0a1f1d] dark:text-white">{t.contact.emailLabel}: </span>
                  <span>{t.contact.emailPlaceholderValue}</span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <Phone className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-[#00E5C0]" aria-hidden="true" />
                <div>
                  <span className="font-semibold text-[#0a1f1d] dark:text-white">{t.contact.phoneLabel}: </span>
                  <span>{t.contact.phonePlaceholderValue}</span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <MapPin className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-[#00E5C0]" aria-hidden="true" />
                <div>
                  <span className="font-semibold text-[#0a1f1d] dark:text-white">{t.contact.addressLabel}: </span>
                  <span>{t.contact.addressPlaceholderValue}</span>
                </div>
              </li>
              <li className="flex items-start gap-2">
                <Clock className="mt-0.5 size-3.5 shrink-0 text-emerald-600 dark:text-[#00E5C0]" aria-hidden="true" />
                <div>
                  <span className="font-semibold text-[#0a1f1d] dark:text-white">{t.contact.hoursLabel}: </span>
                  <span>{t.contact.hoursPlaceholderValue}</span>
                </div>
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-8 bg-gray-200 dark:bg-[#1A453B]" />

        <div className="flex flex-col items-center justify-between gap-4 text-xs text-gray-500 dark:text-[#B8CECA] sm:flex-row">
          <p>
            © {currentYear} {t.footer.copyright}
          </p>
          <div className="flex flex-wrap items-center gap-4">
            <Link href="/privacy" className="transition-colors hover:text-emerald-600 dark:hover:text-[#00E5C0]">
              {t.footer.privacyPolicy}
            </Link>
            <Link href="/terms" className="transition-colors hover:text-emerald-600 dark:hover:text-[#00E5C0]">
              {t.footer.termsOfService}
            </Link>
            <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-[#8FFFD2]">
              <Globe className="size-3.5" aria-hidden="true" />
              <span>EN · AR · DE · IT · FR</span>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}