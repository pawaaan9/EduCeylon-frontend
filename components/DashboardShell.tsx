"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Logo } from "./Logo";
import { Avatar } from "./Avatar";
import { LanguageSwitcher } from "@/lib/i18n/LanguageSwitcher";
import {
  BellIcon,
  CloseIcon,
  LogoutIcon,
  MenuIcon,
  SearchIcon,
} from "./icons";
import { useT } from "@/lib/i18n/I18nProvider";
import { useAuth } from "@/lib/firebase/AuthProvider";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
};

export type NavSection = {
  heading?: string;
  items: NavItem[];
};

export function DashboardShell({
  role,
  user,
  sections,
  breadcrumb,
  children,
}: {
  role: "student" | "lecturer" | "admin";
  user: { name: string; email: string };
  sections: NavSection[];
  breadcrumb?: { label: string; href?: string }[];
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/";
  const t = useT();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const { user: authUser, profile, signOut: authSignOut } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!signOutConfirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSignOutConfirmOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [signOutConfirmOpen]);

  // Prefer the logged-in user (Firebase profile) over the static prop.
  const effectiveUser = profile
    ? { name: profile.name, email: profile.email }
    : authUser
    ? {
        name: authUser.displayName ?? authUser.email?.split("@")[0] ?? "User",
        email: authUser.email ?? "",
      }
    : user;

  async function handleSignOut() {
    setSignOutConfirmOpen(false);
    try {
      await authSignOut();
    } finally {
      router.push("/login");
    }
  }

  const roleLabel = {
    student: "Student Portal",
    lecturer: "Lecturer Portal",
    admin: "Admin Portal",
  }[role];

  const pageTitle = useMemo(() => {
    let match: NavItem | undefined;
    let matchLen = -1;
    for (const section of sections) {
      for (const item of section.items) {
        const href = item.href;
        const isMatch =
          pathname === href ||
          (href !== "/" && pathname.startsWith(`${href}/`));
        if (isMatch && href.length > matchLen) {
          match = item;
          matchLen = href.length;
        }
      }
    }
    return match?.label;
  }, [sections, pathname]);

  return (
    <div className="min-h-screen bg-ink-50">
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-72 lg:flex-col border-r border-ink-200 bg-white">
        <div className="h-16 border-b border-ink-200 flex items-center px-5">
          <Logo size="sm" />
        </div>
        <div className="px-5 py-4 border-b border-ink-200">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">
            {roleLabel}
          </div>
        </div>
        <SidebarNav sections={sections} pathname={pathname} />
        <UserPanel
          user={effectiveUser}
          signOutAriaLabel={t("action.signOut")}
          onRequestSignOut={() => setSignOutConfirmOpen(true)}
        />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 h-full w-80 bg-white shadow-xl flex flex-col fade-up">
            <div className="h-16 border-b border-ink-200 flex items-center justify-between px-5">
              <Logo size="sm" />
              <button
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-ink-100"
                aria-label="Close"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="px-5 py-4 border-b border-ink-200">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">
                {roleLabel}
              </div>
            </div>
            <SidebarNav
              sections={sections}
              pathname={pathname}
              onNavigate={() => setMobileOpen(false)}
            />
            <UserPanel
              user={effectiveUser}
              signOutAriaLabel={t("action.signOut")}
              onRequestSignOut={() => setSignOutConfirmOpen(true)}
            />
          </aside>
        </div>
      )}

      {signOutConfirmOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            aria-hidden
            onClick={() => setSignOutConfirmOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sign-out-dialog-title"
            className="relative w-full max-w-md rounded-2xl border border-ink-200 bg-white p-6 shadow-xl"
          >
            <h2 id="sign-out-dialog-title" className="text-lg font-semibold text-ink-900">
              {t("dashboard.signOutConfirm.title")}
            </h2>
            <p className="mt-2 text-sm text-ink-600 leading-relaxed">
              {t("dashboard.signOutConfirm.message")}
            </p>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="btn btn-secondary w-full sm:w-auto"
                onClick={() => setSignOutConfirmOpen(false)}
              >
                {t("action.cancel")}
              </button>
              <button type="button" className="btn btn-primary w-full sm:w-auto" onClick={handleSignOut}>
                {t("action.signOut")}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex min-h-screen flex-col min-w-0 lg:pl-72">
        <header className="sticky top-0 z-30 h-16 shrink-0 border-b border-ink-200 bg-white">
          <div className="h-full px-4 sm:px-6 lg:px-8 flex items-center gap-4">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                onClick={() => setMobileOpen(true)}
                className="lg:hidden inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-ink-200 text-ink-700"
                aria-label="Open menu"
              >
                <MenuIcon className="h-5 w-5" />
              </button>
              {breadcrumb && breadcrumb.length > 0 ? (
                <nav className="hidden sm:flex items-center gap-2 text-sm text-ink-500 truncate">
                  {breadcrumb.map((b, i) => (
                    <span key={`${b.label}-${i}`} className="flex items-center gap-2">
                      {b.href ? (
                        <Link href={b.href} className="hover:text-ink-900">
                          {b.label}
                        </Link>
                      ) : (
                        <span className="text-ink-900 font-medium">{b.label}</span>
                      )}
                      {i < breadcrumb.length - 1 && <span className="text-ink-300">/</span>}
                    </span>
                  ))}
                </nav>
              ) : pageTitle ? (
                <h1 className="hidden sm:block text-base font-semibold text-ink-900 truncate">
                  {pageTitle}
                </h1>
              ) : null}
            </div>

            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              <div className="hidden lg:flex items-center h-10 w-64 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-500 focus-within:border-brand-500 focus-within:shadow-[0_0_0_4px_rgba(59,130,246,0.12)] transition">
                <SearchIcon className="h-4 w-4 mr-2 text-ink-400" />
                <input
                  type="search"
                  placeholder={t("action.search")}
                  className="w-full bg-transparent outline-none text-ink-900 placeholder:text-ink-400"
                />
                <kbd className="hidden xl:inline ml-2 rounded border border-ink-200 bg-white px-1.5 py-0.5 text-[10px] text-ink-500">
                  ⌘K
                </kbd>
              </div>
              <LanguageSwitcher />
              <button
                className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-ink-200 text-ink-700 hover:bg-ink-50"
                aria-label={t("student.nav.notifications")}
              >
                <BellIcon className="h-5 w-5" />
                <span className="absolute top-2.5 right-2.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
              </button>
              <div className="hidden sm:flex items-center gap-2.5 pl-1 pr-3 h-10 rounded-xl border border-ink-200 bg-white">
                <Avatar name={effectiveUser.name} size={32} />
                <div className="leading-tight">
                  <div className="text-[13px] font-semibold text-ink-900 truncate max-w-[140px]">
                    {effectiveUser.name}
                  </div>
                  <div className="text-[10px] text-ink-500 truncate max-w-[140px] capitalize">
                    {roleLabel}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <div className="max-w-7xl mx-auto flex flex-col gap-6">{children}</div>
        </main>
      </div>
    </div>
  );
}

function SidebarNav({
  sections,
  pathname,
  onNavigate,
}: {
  sections: NavSection[];
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-6">
      {sections.map((section, i) => (
        <div key={`section-${i}`} className="space-y-1">
          {section.heading && (
            <div className="sidebar-section-label">{section.heading}</div>
          )}
          {section.items.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className="sidebar-link"
                data-active={active}
              >
                <item.icon className="h-5 w-5" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

function UserPanel({
  user,
  signOutAriaLabel,
  onRequestSignOut,
}: {
  user: { name: string; email: string };
  signOutAriaLabel: string;
  onRequestSignOut: () => void;
}) {
  return (
    <div className="border-t border-ink-200 p-4">
      <div className="flex items-center gap-3 p-2 rounded-xl bg-ink-50">
        <Avatar name={user.name} size={36} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="text-sm font-semibold text-ink-900 truncate">{user.name}</div>
          <div className="text-xs text-ink-500 truncate">{user.email}</div>
        </div>
        <button
          type="button"
          onClick={onRequestSignOut}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-500 hover:bg-white hover:text-ink-900"
          aria-label={signOutAriaLabel}
        >
          <LogoutIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
