"use client";

import { DashboardShell, type NavSection } from "@/components/DashboardShell";
import { RequireRole } from "@/components/RequireRole";
import { LecturerProfileProvider } from "@/lib/lecturer/LecturerProfileProvider";
import {
  BellIcon,
  BookIcon,
  CalendarIcon,
  ChartIcon,
  HomeIcon,
  MoneyIcon,
  PlusIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/icons";
import { useT } from "@/lib/i18n/I18nProvider";

const FALLBACK_USER = { name: "Lecturer", email: "" };

export default function LecturerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useT();

  const sections: NavSection[] = [
    {
      heading: "Lecturer Portal",
      items: [
        { href: "/lecturer", label: t("lecturer.nav.dashboard"), icon: HomeIcon },
        {
          href: "/lecturer/courses",
          label: t("lecturer.nav.courses"),
          icon: BookIcon,
          exact: true,
        },
        {
          href: "/lecturer/create?new=1",
          label: t("lecturer.nav.create"),
          icon: PlusIcon,
          alsoActiveWhen: (pathname) => pathname.startsWith("/lecturer/create"),
        },
        { href: "/lecturer/live", label: t("lecturer.nav.live"), icon: CalendarIcon },
      ],
    },
    {
      heading: "Insights",
      items: [
        { href: "/lecturer/students", label: t("lecturer.nav.students"), icon: UsersIcon },
        { href: "/lecturer/analytics", label: t("lecturer.nav.analytics"), icon: ChartIcon },
        { href: "/lecturer/earnings", label: t("lecturer.nav.earnings"), icon: MoneyIcon },
      ],
    },
    {
      heading: "Personal",
      items: [
        { href: "/lecturer/announcements", label: t("lecturer.nav.announcements"), icon: BellIcon },
        { href: "/lecturer/settings", label: t("lecturer.nav.settings"), icon: SettingsIcon },
      ],
    },
  ];

  return (
    <RequireRole role="lecturer">
      <LecturerProfileProvider>
        <DashboardShell role="lecturer" user={FALLBACK_USER} sections={sections}>
          {children}
        </DashboardShell>
      </LecturerProfileProvider>
    </RequireRole>
  );
}
