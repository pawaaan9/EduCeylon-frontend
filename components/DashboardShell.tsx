"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Logo } from "./Logo";
import { Avatar } from "./Avatar";
import { SignOutConfirmDialog } from "./SignOutConfirmDialog";
import { LanguageSwitcher } from "@/lib/i18n/LanguageSwitcher";
import {
  BellIcon,
  ChevronDownIcon,
  CloseIcon,
  LogoutIcon,
  MenuIcon,
  SearchIcon,
} from "./icons";
import { useT } from "@/lib/i18n/I18nProvider";
import { useAuth } from "@/lib/firebase/AuthProvider";

export type NavChildItem = {
  href: string;
  label: string;
  icon?: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  /** When true, only `/href` matches — not child paths like `/href/123`. */
  exact?: boolean;
  /** Extra pathnames that should highlight this item. */
  alsoActiveWhen?: (pathname: string) => boolean;
};

export type NavItem = {
  href?: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  /** When true, only `/href` matches — not child paths like `/href/123`. */
  exact?: boolean;
  /** Extra pathnames that should highlight this item (e.g. course editor under create). */
  alsoActiveWhen?: (pathname: string) => boolean;
  children?: NavChildItem[];
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
    if (!mobileOpen) return;
    const html = document.documentElement;
    const body = document.body;
    const scrollY = window.scrollY;
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyPosition = body.style.position;
    const prevBodyTop = body.style.top;
    const prevBodyWidth = body.style.width;

    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.width = "100%";

    return () => {
      html.style.overflow = prevHtmlOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.position = prevBodyPosition;
      body.style.top = prevBodyTop;
      body.style.width = prevBodyWidth;
      window.scrollTo(0, scrollY);
    };
  }, [mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

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

  const activeHref = useMemo(
    () => getActiveNavHref(pathname, sections),
    [pathname, sections],
  );

  const pageTitle = useMemo(() => {
    if (!activeHref) return undefined;
    for (const section of sections) {
      for (const item of section.items) {
        if (item.href === activeHref) return item.label;
        const child = item.children?.find((c) => c.href === activeHref);
        if (child) return child.label;
      }
    }
    return undefined;
  }, [sections, activeHref]);

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
        <SidebarNav sections={sections} activeHref={activeHref} />
        <UserPanel
          user={effectiveUser}
          signOutAriaLabel={t("action.signOut")}
          onRequestSignOut={() => setSignOutConfirmOpen(true)}
        />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true">
          <div
            className="absolute inset-0 bg-black/40"
            aria-hidden
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute left-0 top-0 flex h-[100dvh] max-h-[100dvh] w-[min(20rem,88vw)] flex-col overflow-y-auto overscroll-y-contain bg-white shadow-xl fade-up touch-pan-y">
            <div className="shrink-0 h-16 border-b border-ink-200 flex items-center justify-between px-5">
              <Logo size="sm" />
              <button
                onClick={() => setMobileOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg hover:bg-ink-100"
                aria-label="Close"
              >
                <CloseIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="shrink-0 px-5 py-4 border-b border-ink-200">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">
                {roleLabel}
              </div>
            </div>
            <SidebarNav
              sections={sections}
              activeHref={activeHref}
              onNavigate={() => setMobileOpen(false)}
              embedded
            />
            <UserPanel
              user={effectiveUser}
              signOutAriaLabel={t("action.signOut")}
              onRequestSignOut={() => setSignOutConfirmOpen(true)}
            />
          </aside>
        </div>
      )}

      <SignOutConfirmDialog
        open={signOutConfirmOpen}
        onClose={() => setSignOutConfirmOpen(false)}
        onConfirm={handleSignOut}
      />

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

/** Longest matching nav href so `/admin` is not active on `/admin/students`. */
function getActiveNavHref(pathname: string, sections: NavSection[]): string | null {
  let match: string | null = null;
  let matchScore = -1;
  for (const section of sections) {
    for (const item of section.items) {
      if (item.children) {
        for (const child of item.children) {
          const score = navLinkMatchScore(pathname, child);
          if (score > matchScore) {
            match = child.href;
            matchScore = score;
          }
        }
      }
      if (item.href) {
        const score = navLinkMatchScore(pathname, item);
        if (score > matchScore) {
          match = item.href;
          matchScore = score;
        }
      }
    }
  }
  return match;
}

function navLinkMatchScore(
  pathname: string,
  item: Pick<NavItem, "href" | "exact" | "alsoActiveWhen">,
): number {
  const href = item.href;
  if (!href) return -1;
  if (item.alsoActiveWhen?.(pathname)) {
    return 10_000 + href.length;
  }
  if (item.exact) {
    if (pathname === href || pathname === `${href}/`) {
      return 5_000 + href.length;
    }
    return -1;
  }
  const isMatch =
    pathname === href ||
    (href !== "/" && pathname.startsWith(`${href}/`));
  return isMatch ? href.length : -1;
}

function SidebarNav({
  sections,
  activeHref,
  onNavigate,
  embedded,
}: {
  sections: NavSection[];
  activeHref: string | null;
  onNavigate?: () => void;
  /** Mobile drawer: parent aside scrolls; nav is not a nested scroll region. */
  embedded?: boolean;
}) {
  return (
    <nav
      className={
        embedded
          ? "shrink-0 px-3 py-4 space-y-6"
          : "flex-1 min-h-0 overflow-y-auto scrollbar-thin px-3 py-4 space-y-6"
      }
    >
      {sections.map((section, i) => (
        <div key={`section-${i}`} className="space-y-1">
          {section.heading && (
            <div className="sidebar-section-label">{section.heading}</div>
          )}
          {section.items.map((item) => {
            if (item.children?.length) {
              return (
                <NavGroupItem
                  key={item.label}
                  item={item}
                  activeHref={activeHref}
                  onNavigate={onNavigate}
                />
              );
            }

            const active = item.href === activeHref;
            return (
              <Link
                key={item.href ?? item.label}
                href={item.href!}
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

function NavGroupItem({
  item,
  activeHref,
  onNavigate,
}: {
  item: NavItem;
  activeHref: string | null;
  onNavigate?: () => void;
}) {
  const children = item.children ?? [];
  const childActive = children.some((c) => c.href === activeHref);
  const groupActive = childActive || item.href === activeHref;
  const [expanded, setExpanded] = useState(childActive);

  useEffect(() => {
    if (childActive) setExpanded(true);
  }, [childActive]);

  return (
    <div className="space-y-0.5">
      <button
        type="button"
        onClick={() => setExpanded((open) => !open)}
        className="sidebar-link sidebar-link-group w-full text-left"
        data-active={groupActive}
        aria-expanded={expanded}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        <span className="flex-1 min-w-0">{item.label}</span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 text-ink-400 transition-transform duration-200 ${
            expanded ? "rotate-180" : ""
          }`}
          aria-hidden
        />
      </button>
      {expanded &&
        children.map((child) => {
          const ChildIcon = child.icon;
          const active = child.href === activeHref;
          return (
            <Link
              key={child.href}
              href={child.href}
              onClick={onNavigate}
              className="sidebar-link sidebar-link-nested"
              data-active={active}
            >
              {ChildIcon ? (
                <ChildIcon className="h-4 w-4" />
              ) : (
                <span className="h-4 w-4" aria-hidden />
              )}
              <span>{child.label}</span>
            </Link>
          );
        })}
    </div>
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
    <div className="shrink-0 border-t border-ink-200 p-4">
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
