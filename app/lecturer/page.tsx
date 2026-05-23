"use client";

import Link from "next/link";
import { GradientHeader } from "@/components/GradientHeader";
import { LecturerOnboardingBanner } from "@/components/LecturerOnboardingBanner";
import { StatCard } from "@/components/StatCard";
import {
  ArrowRightIcon,
  BookIcon,
  ChartIcon,
  MoneyIcon,
  PlusIcon,
  StarIcon,
  UsersIcon,
} from "@/components/icons";
import { Avatar } from "@/components/Avatar";
import { getCoursesByLecturer } from "@/lib/data/mock";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { firstName, resolveDisplayName } from "@/lib/user/display-name";

const LKR = new Intl.NumberFormat("en-LK", {
  style: "currency",
  currency: "LKR",
  maximumFractionDigits: 0,
});

export default function LecturerDashboardPage() {
  const { t, locale } = useI18n();
  const { user, profile } = useAuth();
  const myCourses = getCoursesByLecturer("lec-1");
  const greetingName = firstName(resolveDisplayName(profile, user));

  return (
    <>
      <GradientHeader
        title={`${t("dashboard.welcome")}, ${greetingName}`}
        subtitle={t("lecturer.dashboard.subtitle")}
        actions={
          <Link href="/lecturer/create?new=1" className="btn bg-white text-brand-700 hover:bg-white/90">
            <PlusIcon className="h-4 w-4" /> New course
          </Link>
        }
      />

      <LecturerOnboardingBanner />

      <section className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label={t("lecturer.stats.students")}
          value="12,500"
          icon={<UsersIcon className="h-5 w-5" />}
          trend={{ value: "+412 this month", positive: true }}
        />
        <StatCard
          label={t("lecturer.stats.courses")}
          value={myCourses.length}
          icon={<BookIcon className="h-5 w-5" />}
          tint="emerald"
        />
        <StatCard
          label={t("lecturer.stats.revenue")}
          value="248,500"
          icon={<MoneyIcon className="h-5 w-5" />}
          tint="amber"
          trend={{ value: "+18% MoM", positive: true }}
        />
        <StatCard
          label={t("lecturer.stats.rating")}
          value="4.9"
          icon={<StarIcon className="h-5 w-5" />}
          tint="rose"
        />
      </section>

      <section className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 card p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-ink-900 text-lg">Revenue (last 7 days)</h2>
            <span className="badge badge-emerald">+18% vs last week</span>
          </div>
          <RevenueChart />
        </div>

        <div className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-ink-900">Top students</h3>
            <Link
              href="/lecturer/students"
              className="text-xs font-semibold text-brand-700 hover:text-brand-900 inline-flex items-center gap-1"
            >
              {t("action.viewAll")} <ArrowRightIcon className="h-3 w-3" />
            </Link>
          </div>
          <ul className="space-y-3">
            {[
              { name: "Saduni Wickramasinghe", hrs: 48 },
              { name: "Tharindu Bandara", hrs: 41 },
              { name: "Nethmi Gunasekara", hrs: 37 },
              { name: "Imash Senanayake", hrs: 33 },
              { name: "Ravinda Jayasundara", hrs: 28 },
            ].map((s, i) => (
              <li key={s.name} className="flex items-center gap-3">
                <span className="text-xs font-bold w-5 text-ink-400">{i + 1}</span>
                <Avatar name={s.name} size={32} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-ink-900 truncate">{s.name}</div>
                  <div className="text-xs text-ink-500">{s.hrs}h watched</div>
                </div>
                <ChartIcon className="h-4 w-4 text-ink-300" />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-ink-900 text-lg">Your courses</h2>
          <Link
            href="/lecturer/courses"
            className="text-sm font-semibold text-brand-700 hover:text-brand-900 inline-flex items-center gap-1"
          >
            {t("action.viewAll")} <ArrowRightIcon className="h-4 w-4" />
          </Link>
        </div>
        <div className="overflow-x-auto -mx-2">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-ink-500">
                <th className="px-2 py-3 font-semibold">Course</th>
                <th className="px-2 py-3 font-semibold">Status</th>
                <th className="px-2 py-3 font-semibold">Students</th>
                <th className="px-2 py-3 font-semibold">Rating</th>
                <th className="px-2 py-3 font-semibold text-right">Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-100">
              {myCourses.map((c) => (
                <tr key={c.id} className="hover:bg-ink-50 transition-colors">
                  <td className="px-2 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-9 w-14 rounded-md flex-shrink-0"
                        style={{ background: c.thumbnailGradient }}
                      />
                      <div>
                        <div className="font-medium text-ink-900 line-clamp-1">
                          {c.title[locale] ?? c.title.en}
                        </div>
                        <div className="text-xs text-ink-500">{c.lessons} lessons</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3">
                    <StatusPill status={c.status ?? "published"} />
                  </td>
                  <td className="px-2 py-3 text-ink-700">
                    {c.students.toLocaleString()}
                  </td>
                  <td className="px-2 py-3">
                    <span className="inline-flex items-center gap-1 text-ink-700">
                      <StarIcon className="h-3.5 w-3.5 text-amber-500" />
                      {c.rating.toFixed(1)}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-right font-semibold text-ink-900">
                    {LKR.format(c.students * c.price * 0.7)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}

function StatusPill({ status }: { status: NonNullable<import("@/lib/data/types").Course["status"]> }) {
  const map: Record<string, string> = {
    published: "badge-emerald",
    draft: "badge-slate",
    pending: "badge-amber",
    rejected: "badge-rose",
  };
  return <span className={`badge ${map[status]}`}>{status}</span>;
}

function RevenueChart() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const values = [42, 65, 51, 78, 92, 110, 124];
  const max = Math.max(...values);
  return (
    <div>
      <div className="flex items-end gap-3 h-48">
        {values.map((v, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end gap-2">
            <div
              className="w-full rounded-t-lg brand-gradient transition-all relative group"
              style={{ height: `${(v / max) * 100}%` }}
            >
              <span className="absolute -top-7 left-1/2 -translate-x-1/2 text-xs font-bold text-ink-900 opacity-0 group-hover:opacity-100 transition-opacity">
                {v}k
              </span>
            </div>
            <div className="text-xs text-ink-500">{days[i]}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
