"use client";

import { DashboardShell, type NavSection } from "@/components/DashboardShell";
import { RequireRole } from "@/components/RequireRole";
import {
  BellIcon,
  BookIcon,
  CalendarIcon,
  ChartIcon,
  HeartIcon,
  HomeIcon,
  JournalIcon,
  SettingsIcon,
  GlobeIcon,
} from "@/components/icons";
import { useT } from "@/lib/i18n/I18nProvider";

const FALLBACK_USER = { name: "Student", email: "" };

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const t = useT();

  const sections: NavSection[] = [
    {
      heading: "Student Portal",
      items: [
        { href: "/student", label: t("student.nav.dashboard"), icon: HomeIcon },
        { href: "/student/courses", label: t("student.nav.myCourses"), icon: BookIcon },
        { href: "/student/live", label: t("student.nav.live"), icon: CalendarIcon },
        { href: "/student/progress", label: t("student.nav.progress"), icon: ChartIcon },
        { href: "/student/journal", label: t("student.nav.journal"), icon: JournalIcon },
      ],
    },
    {
      heading: "Personal",
      items: [
        { href: "/student/wishlist", label: t("student.nav.wishlist"), icon: HeartIcon },
        {
          href: "/student/notifications",
          label: t("student.nav.notifications"),
          icon: BellIcon,
        },
        { href: "/student/settings", label: t("student.nav.settings"), icon: SettingsIcon },
      ],
    },
    {
      heading: "Discover",
      items: [
        { href: "/courses", label: t("student.nav.browse"), icon: GlobeIcon },
      ],
    },
  ];

  return (
    <RequireRole role="student">
      <DashboardShell role="student" user={FALLBACK_USER} sections={sections}>
        {children}
      </DashboardShell>
    </RequireRole>
  );
}
