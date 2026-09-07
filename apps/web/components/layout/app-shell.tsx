"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FolderKanban, Palette, Globe, Building2, UserCheck, ShieldCheck } from "lucide-react";
import { useTranslation } from "@/lib/i18n-context";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { t, locale, setLocale } = useTranslation();

  const navItems = [
    {
      href: "/",
      label: t.nav.dashboard,
      icon: FolderKanban,
      active:
        pathname === "/" ||
        (pathname.startsWith("/activities") && !pathname.startsWith("/passports")),
    },
    {
      href: "/passports",
      label: t.nav.passports,
      icon: ShieldCheck,
      active: pathname.startsWith("/passports"),
    },
    {
      href: "/design-preview",
      label: t.nav.designPreview,
      icon: Palette,
      active: pathname === "/design-preview",
    },
  ];

  return (
    <div className="min-h-screen bg-brand-surface text-foreground flex flex-col md:flex-row">
      {/* Desktop Persistent Left Sidebar */}
      <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r border-border bg-card z-30">
        {/* Brand Header */}
        <div className="p-5 border-b border-border flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-brand-primary flex items-center justify-center text-brand-primary-fg font-black text-base shadow-sm">
            K
          </div>
          <div>
            <span className="font-extrabold text-base tracking-tight text-foreground block">
              KATIBAY
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-brand-accent block">
              Audit Pipeline
            </span>
          </div>
        </div>

        {/* Organization Info */}
        <div className="p-4 mx-3 my-3 rounded-lg bg-muted/50 border border-border/60 flex items-center gap-2.5">
          <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground truncate">{t.nav.organization}</p>
            <p className="text-[11px] text-muted-foreground">AY 2026–2027</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 px-3 py-2 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-2.5 rounded-md text-sm font-semibold transition-colors",
                  item.active
                    ? "bg-brand-primary text-brand-primary-fg shadow-sm"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted",
                )}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Language Selector & User Profile */}
        <div className="p-4 border-t border-border space-y-3">
          {/* Language Switcher */}
          <div className="flex items-center justify-between px-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5 font-medium">
              <Globe className="w-3.5 h-3.5" />
              {t.common.language}
            </span>
            <div className="flex items-center gap-1 bg-muted rounded p-0.5 border border-border/80">
              <button
                type="button"
                onClick={() => setLocale("en")}
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-bold transition-colors",
                  locale === "en"
                    ? "bg-brand-primary text-brand-primary-fg shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLocale("fil")}
                className={cn(
                  "px-2 py-0.5 rounded text-[11px] font-bold transition-colors",
                  locale === "fil"
                    ? "bg-brand-primary text-brand-primary-fg shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                FIL
              </button>
            </div>
          </div>

          {/* User Role Card */}
          <div className="pt-2 border-t border-border/40 flex items-center gap-2.5 px-2">
            <div className="w-7 h-7 rounded-full bg-brand-accent/10 border border-brand-accent/20 flex items-center justify-center text-brand-accent">
              <UserCheck className="w-3.5 h-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground">Juan Dela Cruz</p>
              <p className="text-[10px] font-semibold text-brand-accent uppercase tracking-wider">
                {t.nav.userRole}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Top Header */}
      <header className="md:hidden sticky top-0 z-30 border-b border-border bg-card px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded bg-brand-primary flex items-center justify-center text-brand-primary-fg font-black text-sm">
            K
          </div>
          <div>
            <span className="font-extrabold text-sm tracking-tight text-foreground block">
              KATIBAY
            </span>
          </div>
        </div>

        {/* Mobile Language Switcher */}
        <div className="flex items-center gap-1 bg-muted rounded p-0.5 border border-border/80">
          <button
            type="button"
            onClick={() => setLocale("en")}
            className={cn(
              "px-2 py-0.5 rounded text-[11px] font-bold transition-colors",
              locale === "en" ? "bg-brand-primary text-brand-primary-fg" : "text-muted-foreground",
            )}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLocale("fil")}
            className={cn(
              "px-2 py-0.5 rounded text-[11px] font-bold transition-colors",
              locale === "fil" ? "bg-brand-primary text-brand-primary-fg" : "text-muted-foreground",
            )}
          >
            FIL
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 md:pl-64 min-h-screen pb-20 md:pb-10">{children}</main>

      {/* Mobile Bottom Tab Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 border-t border-border bg-card px-4 py-2 flex items-center justify-around shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-4 py-1.5 rounded-md text-xs font-bold transition-colors",
                item.active
                  ? "text-brand-accent font-extrabold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="w-5 h-5" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
