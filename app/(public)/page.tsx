"use client";

import Link from "next/link";
import { FeaturedCoursesSection } from "@/components/FeaturedCoursesSection";
import { HomeLecturersSection } from "@/components/PublicLecturersSection";
import { SectionHeader } from "@/components/SectionHeader";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { CATEGORIES } from "@/lib/data/mock";
import {
  ArrowRightIcon,
  BoltIcon,
  GlobeIcon,
  GraduationIcon,
  PlayCircleIcon,
  ShieldIcon,
} from "@/components/icons";

export default function HomePage() {
  const { t } = useI18n();
  const { user, loading: authLoading } = useAuth();
  return (
    <div className="flex flex-col">
      {/* HERO */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 brand-gradient" aria-hidden />
        <div
          className="absolute inset-0 opacity-25"
          aria-hidden
          style={{
            backgroundImage:
              "radial-gradient(circle at 80% 10%, rgba(255,255,255,0.35), transparent 50%), radial-gradient(circle at 0% 100%, rgba(255,255,255,0.15), transparent 60%)",
          }}
        />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-28 text-white">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold backdrop-blur">
                <BoltIcon className="h-3.5 w-3.5" /> {t("home.hero.eyebrow")}
              </span>
              <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-tight">
                {t("home.hero.title")}
              </h1>
              <p className="mt-5 text-lg text-white/80 max-w-xl leading-relaxed">
                {t("home.hero.subtitle")}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/courses"
                  className="btn bg-white text-brand-700 hover:bg-white/90 shadow-lg"
                >
                  {t("home.hero.cta.primary")} <ArrowRightIcon className="h-4 w-4" />
                </Link>
                <Link
                  href="/register"
                  className="btn border border-white/30 text-white hover:bg-white/10"
                >
                  {t("home.hero.cta.secondary")}
                </Link>
              </div>
              <div className="mt-10 grid grid-cols-3 gap-6 max-w-lg">
                <HeroStat label={t("home.hero.stat.lecturers")} value="150+" />
                <HeroStat label={t("home.hero.stat.courses")} value="1,200+" />
                <HeroStat label={t("home.hero.stat.students")} value="42k" />
              </div>
            </div>
            <div className="relative hidden lg:block">
              <FloatingCourseStack />
            </div>
          </div>
        </div>
        {/* wave */}
        <svg
          className="relative block w-full text-white"
          viewBox="0 0 1440 80"
          preserveAspectRatio="none"
          aria-hidden
        >
          <path
            fill="currentColor"
            d="M0,32 C320,80 720,0 1440,48 L1440,80 L0,80 Z"
          />
        </svg>
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 flex flex-col gap-20 -mt-6">
        {/* CATEGORIES */}
        <section>
          <SectionHeader
            eyebrow="Categories"
            title={t("home.categories.title")}
            subtitle={t("home.categories.subtitle")}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {CATEGORIES.map((c) => (
              <Link
                key={c.key}
                href={`/courses?category=${c.key}`}
                className="group relative overflow-hidden rounded-2xl p-5 h-32 text-white transition-transform hover:-translate-y-0.5"
                style={{ background: c.gradient }}
              >
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
                <div className="relative flex flex-col h-full justify-between">
                  <GraduationIcon className="h-7 w-7 opacity-90" />
                  <div>
                    <div className="font-semibold text-base">
                      {t(`category.${c.key}`)}
                    </div>
                    <div className="text-xs text-white/80 mt-0.5 flex items-center gap-1">
                      Explore <ArrowRightIcon className="h-3 w-3" />
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <FeaturedCoursesSection limit={6} />

        <HomeLecturersSection limit={4} />

        {/* WHY */}
        <section>
          <SectionHeader
            eyebrow="Why EduCeylon"
            title={t("home.why.title")}
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Feature
              icon={<ShieldIcon className="h-6 w-6" />}
              title={t("home.why.f1.title")}
              desc={t("home.why.f1.desc")}
              tint="brand"
            />
            <Feature
              icon={<GlobeIcon className="h-6 w-6" />}
              title={t("home.why.f2.title")}
              desc={t("home.why.f2.desc")}
              tint="emerald"
            />
            <Feature
              icon={<BoltIcon className="h-6 w-6" />}
              title={t("home.why.f3.title")}
              desc={t("home.why.f3.desc")}
              tint="amber"
            />
            <Feature
              icon={<PlayCircleIcon className="h-6 w-6" />}
              title={t("home.why.f4.title")}
              desc={t("home.why.f4.desc")}
              tint="rose"
            />
          </div>
        </section>

        {/* CTA — hidden when already signed in */}
        {!authLoading && !user && (
        <section className="relative overflow-hidden rounded-3xl brand-gradient p-10 sm:p-14 text-white">
          <div
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage:
                "radial-gradient(circle at 85% 20%, rgba(255,255,255,0.35), transparent 50%)",
            }}
            aria-hidden
          />
          <div className="relative flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
                {t("home.cta.title")}
              </h2>
              <p className="mt-3 text-white/80">{t("home.cta.subtitle")}</p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                href="/register"
                className="btn bg-white text-brand-700 hover:bg-white/90"
              >
                {t("home.cta.primary")}
              </Link>
              <Link
                href="/register?role=lecturer"
                className="btn border border-white/30 text-white hover:bg-white/10"
              >
                {t("home.cta.secondary")}
              </Link>
            </div>
          </div>
        </section>
        )}
      </div>
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs text-white/70 uppercase tracking-wider mt-1">
        {label}
      </div>
    </div>
  );
}

function Feature({
  icon,
  title,
  desc,
  tint,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  tint: "brand" | "emerald" | "amber" | "rose";
}) {
  const tints: Record<string, string> = {
    brand: "bg-brand-50 text-brand-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    rose: "bg-rose-50 text-rose-700",
  };
  return (
    <div className="card p-6">
      <div
        className={`inline-flex h-12 w-12 items-center justify-center rounded-xl ${tints[tint]}`}
      >
        {icon}
      </div>
      <h3 className="mt-4 font-semibold text-ink-900">{title}</h3>
      <p className="mt-1.5 text-sm text-ink-600 leading-relaxed">{desc}</p>
    </div>
  );
}

function FloatingCourseStack() {
  return (
    <div className="relative h-[420px]">
      <div className="absolute top-0 right-0 w-72 rounded-2xl bg-white text-ink-900 shadow-2xl p-4 rotate-3">
        <div
          className="h-32 w-full rounded-xl mb-3 flex items-center justify-center text-white"
          style={{ background: "linear-gradient(135deg,#1e3a8a,#2563eb)" }}
        >
          <PlayCircleIcon className="h-10 w-10" />
        </div>
        <span className="badge">A/L ICT</span>
        <div className="font-semibold mt-2">A/L ICT Mastery 2026</div>
        <div className="text-xs text-ink-500 mt-1">86 lessons · 64h</div>
      </div>

      <div className="absolute top-32 left-0 w-72 rounded-2xl bg-white text-ink-900 shadow-2xl p-4 -rotate-3">
        <div
          className="h-32 w-full rounded-xl mb-3 flex items-center justify-center text-white"
          style={{ background: "linear-gradient(135deg,#0d9488,#14b8a6)" }}
        >
          <PlayCircleIcon className="h-10 w-10" />
        </div>
        <span className="badge badge-emerald">Languages</span>
        <div className="font-semibold mt-2">IELTS Band 7+ Bootcamp</div>
        <div className="text-xs text-ink-500 mt-1">64 lessons · 48h</div>
      </div>

      <div className="absolute bottom-0 right-12 w-64 rounded-2xl bg-white text-ink-900 shadow-2xl p-4 rotate-1">
        <div className="flex items-center gap-3">
          <div
            className="h-12 w-12 rounded-xl"
            style={{ background: "linear-gradient(135deg,#7c3aed,#a78bfa)" }}
          />
          <div>
            <div className="text-xs text-ink-500">Live class starting</div>
            <div className="font-semibold">O/L Maths Paper</div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between">
          <span className="badge badge-rose live-dot text-xs">LIVE in 2h</span>
          <span className="text-sm font-bold text-brand-700">LKR 6,500</span>
        </div>
      </div>
    </div>
  );
}
