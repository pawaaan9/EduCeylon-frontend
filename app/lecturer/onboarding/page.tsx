"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  CheckIcon,
  CloseIcon,
  UploadIcon,
} from "@/components/icons";
import { GradientHeader } from "@/components/GradientHeader";
import { LecturerImageUpload } from "@/components/LecturerImageUpload";
import { QualificationsInput } from "@/components/QualificationsInput";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useI18n, useT } from "@/lib/i18n/I18nProvider";
import {
  evaluateMyLecturerProfile,
  fetchMyLecturerProfile,
  saveMyLecturerProfile,
  submitMyLecturerProfile,
  uploadLecturerAsset,
} from "@/lib/api/lecturers";
import {
  emptyLecturerProfile,
  type LecturerProfile,
  type LecturerQualification,
  type LecturerType,
  type OnboardingMeta,
  type OnboardingStepKey,
  type TeachingLevel,
  type TeachingMethod,
} from "@/lib/api/types";
import {
  findDistrict,
  localizedLabel,
  SRI_LANKA_DISTRICTS,
} from "@/lib/data/sri-lanka-locations";
import {
  DAY_OPTIONS,
  LANGUAGE_OPTIONS,
  LECTURER_TYPES,
  TEACHING_LEVELS,
  TEACHING_METHODS,
} from "@/app/lecturer/onboarding/constants";

function formatQualification(q: LecturerQualification): string {
  return [q.title, q.institute, q.year].filter(Boolean).join(" · ");
}

const STEPS: {
  key: OnboardingStepKey;
  titleKey: string;
  shortKey: string;
  descKey: string;
}[] = [
  { key: "basic", titleKey: "onboard.step.basic", shortKey: "onboard.step.basic.short", descKey: "onboard.step.basic.desc" },
  { key: "professional", titleKey: "onboard.step.professional", shortKey: "onboard.step.professional.short", descKey: "onboard.step.professional.desc" },
  { key: "teaching", titleKey: "onboard.step.teaching", shortKey: "onboard.step.teaching.short", descKey: "onboard.step.teaching.desc" },
  { key: "social", titleKey: "onboard.step.social", shortKey: "onboard.step.social.short", descKey: "onboard.step.social.desc" },
  { key: "verification", titleKey: "onboard.step.verification", shortKey: "onboard.step.verification.short", descKey: "onboard.step.verification.desc" },
  { key: "banking", titleKey: "onboard.step.banking", shortKey: "onboard.step.banking.short", descKey: "onboard.step.banking.desc" },
  { key: "review", titleKey: "onboard.step.review", shortKey: "onboard.step.review.short", descKey: "onboard.step.review.desc" },
];

export default function LecturerOnboardingPage() {
  const router = useRouter();
  const t = useT();
  const { user, profile: userProfile, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<LecturerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [stepIndex, setStepIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [onboarding, setOnboarding] = useState<OnboardingMeta | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login?next=/lecturer/onboarding");
      return;
    }
    if (userProfile && userProfile.role !== "lecturer") {
      router.replace("/");
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const token = await user.getIdToken();
        const data = await fetchMyLecturerProfile(token);
        if (cancelled) return;
        const base = data?.profile ?? emptyLecturerProfile(user.uid);
        if (!base.displayName && userProfile?.name) base.displayName = userProfile.name;
        if (!base.email && userProfile?.email) base.email = userProfile.email;
        setProfile(base);
        setOnboarding(data?.onboarding ?? null);
        if (base.approvalStatus === "pending" || base.approvalStatus === "approved") {
          setSubmitted(true);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, user, userProfile, router]);

  useEffect(() => {
    if (!user || !profile) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const token = await user.getIdToken();
        const { onboarding: next } = await evaluateMyLecturerProfile(token, profile);
        if (!cancelled) setOnboarding(next);
      } catch {
        // keep last known onboarding meta
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [profile, user]);

  const completion = onboarding?.completion ?? profile?.completion ?? 0;

  const step = STEPS[stepIndex]!;
  const maxReachable = onboarding?.maxReachableStepIndex ?? 0;
  const currentStepComplete = onboarding?.steps[step.key] ?? false;

  function goToStep(index: number) {
    if (!profile || index < 0 || index >= STEPS.length) return;
    if (index > maxReachable) return;
    setStepError(null);
    setStepIndex(index);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function save(patch: Partial<LecturerProfile>): Promise<boolean> {
    if (!profile || !user) return false;
    setSaving(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const { profile: next, onboarding: nextOnboarding } =
        await saveMyLecturerProfile(token, patch);
      setProfile(next);
      setOnboarding(nextOnboarding);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleNext() {
    if (!profile) return;
    if (!currentStepComplete) {
      setStepError(t("onboard.validation.fillRequired"));
      return;
    }
    setStepError(null);
    const saved = await save(profile);
    if (!saved) return;
    goToStep(Math.min(stepIndex + 1, STEPS.length - 1));
  }

  async function handleSubmitForReview() {
    if (!profile || !user) return;
    setSaving(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const { profile: next, onboarding: nextOnboarding } =
        await submitMyLecturerProfile(token);
      setProfile(next);
      setOnboarding(nextOnboarding);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit");
    } finally {
      setSaving(false);
    }
  }

  if (authLoading || loading || !profile) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <div className="h-1 w-40 overflow-hidden rounded-full bg-ink-200">
          <div className="h-full w-1/3 brand-gradient animate-pulse" />
        </div>
      </div>
    );
  }

  if (submitted) {
    return <SubmittedView profile={profile} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <GradientHeader
        title={t("onboard.hero.title")}
        subtitle={t("onboard.hero.subtitle")}
        actions={
          <div className="text-right">
            <div className="text-xs font-semibold uppercase tracking-wider text-white/70">
              {t("onboard.progress")}
            </div>
            <div className="text-3xl font-bold leading-none">{completion}%</div>
          </div>
        }
      >
        <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-white/15">
          <div
            className="h-full rounded-full bg-white/90 transition-all"
            style={{ width: `${completion}%` }}
          />
        </div>
      </GradientHeader>

      {/* Step progress — all 7 steps visible without horizontal scroll */}
      <nav aria-label="Onboarding steps" className="card p-3 sm:p-4">
        <ol className="grid grid-cols-7 gap-1">
          {STEPS.map((s, i) => {
            const active = i === stepIndex;
            const passed = i < stepIndex;
            const locked = i > maxReachable;
            return (
              <li key={s.key} className="min-w-0">
                <button
                  type="button"
                  onClick={() => goToStep(i)}
                  disabled={locked}
                  title={t(s.titleKey)}
                  aria-current={active ? "step" : undefined}
                  className={`flex w-full flex-col items-center gap-1 rounded-lg px-0.5 py-2 transition-colors ${
                    active
                      ? "bg-brand-50 text-brand-800"
                      : passed
                      ? "text-ink-700 hover:bg-ink-50"
                      : locked
                      ? "cursor-not-allowed text-ink-300"
                      : "text-ink-500 hover:bg-ink-50"
                  }`}
                >
                  <span
                    className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                      active
                        ? "bg-brand-600 text-white"
                        : passed
                        ? "bg-emerald-500 text-white"
                        : "bg-ink-100 text-ink-500"
                    }`}
                  >
                    {passed && !active ? (
                      <CheckIcon className="h-3.5 w-3.5" />
                    ) : (
                      i + 1
                    )}
                  </span>
                  <span className="w-full text-center text-[9px] font-semibold leading-tight sm:text-[11px] line-clamp-2">
                    {t(s.shortKey)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Step content */}
      <section className="card p-6 sm:p-8">
        <header className="mb-6">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-brand-600">
              {t("onboard.step")} {stepIndex + 1} / {STEPS.length}
            </div>
            <h2 className="mt-1 text-2xl font-bold text-ink-900">{t(step.titleKey)}</h2>
            <p className="mt-1 text-sm text-ink-600">{t(step.descKey)}</p>
          </div>
        </header>

        {(error || stepError) && (
          <div
            role="alert"
            className="mb-5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700"
          >
            {stepError ?? error}
          </div>
        )}

        {step.key === "basic" && (
          <BasicStep
            uid={profile.uid}
            value={profile}
            onChange={(patch) => setProfile((p) => (p ? { ...p, ...patch } : p))}
            onPersist={(patch) => save(patch)}
          />
        )}
        {step.key === "professional" && (
          <ProfessionalStep
            value={profile}
            onChange={(patch) => setProfile((p) => (p ? { ...p, ...patch } : p))}
          />
        )}
        {step.key === "teaching" && (
          <TeachingStep
            value={profile}
            onChange={(patch) => setProfile((p) => (p ? { ...p, ...patch } : p))}
          />
        )}
        {step.key === "social" && (
          <SocialStep
            value={profile}
            onChange={(patch) => setProfile((p) => (p ? { ...p, ...patch } : p))}
          />
        )}
        {step.key === "verification" && (
          <VerificationStep
            uid={profile.uid}
            value={profile}
            onChange={(patch) => setProfile((p) => (p ? { ...p, ...patch } : p))}
          />
        )}
        {step.key === "banking" && (
          <BankingStep
            value={profile}
            onChange={(patch) => setProfile((p) => (p ? { ...p, ...patch } : p))}
          />
        )}
        {step.key === "review" && (
          <ReviewStep
            value={profile}
            submittable={onboarding?.submittable ?? false}
          />
        )}

        <footer className="mt-8 flex flex-col-reverse gap-3 border-t border-ink-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => goToStep(stepIndex - 1)}
            disabled={stepIndex === 0 || saving}
            className="btn btn-ghost justify-center disabled:opacity-50"
          >
            {t("action.back")}
          </button>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => save(profile)}
              disabled={saving}
              className="btn btn-secondary justify-center disabled:opacity-60"
            >
              {saving ? t("onboard.saving") : t("action.save")}
            </button>
            {step.key !== "review" ? (
              <button
                type="button"
                onClick={() => void handleNext()}
                disabled={saving || !currentStepComplete}
                className="btn btn-primary justify-center disabled:opacity-60"
              >
                {t("onboard.saveContinue")} <ArrowRightIcon className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmitForReview}
                disabled={saving || !onboarding?.submittable}
                className="btn btn-primary justify-center disabled:opacity-60"
              >
                {saving ? t("onboard.submitting") : t("onboard.submitReview")}
              </button>
            )}
          </div>
        </footer>
      </section>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Steps                                                                       */
/* -------------------------------------------------------------------------- */

function BasicStep({
  uid,
  value,
  onChange,
  onPersist,
}: {
  uid: string;
  value: LecturerProfile;
  onChange: (patch: Partial<LecturerProfile>) => void;
  onPersist: (patch: Partial<LecturerProfile>) => Promise<boolean>;
}) {
  const t = useT();
  return (
    <div className="grid gap-5">
      <LecturerImageUpload
        uid={uid}
        label={t("onboard.basic.photo")}
        helper={t("onboard.basic.photo.helper")}
        currentUrl={value.photoURL}
        uploadKey="photo"
        onChange={(url) => void onPersist({ photoURL: url })}
        previewAspect="square"
        cropPreset="profile"
      />
      <LecturerImageUpload
        uid={uid}
        label={t("onboard.basic.cover")}
        helper={t("onboard.basic.cover.helper")}
        currentUrl={value.coverURL}
        uploadKey="cover"
        onChange={(url) => void onPersist({ coverURL: url })}
        previewAspect="cover"
        cropPreset="cover"
      />
      <Field
        label={t("onboard.basic.displayName")}
        value={value.displayName ?? ""}
        onChange={(e) => onChange({ displayName: e.target.value })}
        required
      />
      <TextArea
        label={t("onboard.basic.bio")}
        value={value.bio ?? ""}
        onChange={(e) => onChange({ bio: e.target.value })}
        rows={4}
        helper={t("onboard.basic.bio.helper")}
      />
      <LocationSelects value={value} onChange={onChange} />
      <CheckboxGroup
        label={t("onboard.basic.languages")}
        options={LANGUAGE_OPTIONS.map((code) => ({
          value: code,
          label: t(`onboard.languages.${code}`),
        }))}
        values={value.languages}
        onChange={(languages) => onChange({ languages })}
      />
    </div>
  );
}

function ProfessionalStep({
  value,
  onChange,
}: {
  value: LecturerProfile;
  onChange: (patch: Partial<LecturerProfile>) => void;
}) {
  const t = useT();
  return (
    <div className="grid gap-5">
      <Field
        label={t("onboard.prof.mainSubject")}
        placeholder="e.g. A/L ICT"
        value={value.mainSubject ?? ""}
        onChange={(e) => onChange({ mainSubject: e.target.value })}
      />
      <TagInput
        label={t("onboard.prof.subCategories")}
        helper={t("onboard.prof.subCategories.helper")}
        values={value.subCategories}
        onChange={(subCategories) => onChange({ subCategories })}
      />
      <CheckboxGroup
        label={t("onboard.prof.levels")}
        options={TEACHING_LEVELS.map((lvl) => ({
          value: lvl,
          label: t(`onboard.levels.${lvl}`),
        }))}
        values={value.teachingLevels}
        onChange={(arr) => onChange({ teachingLevels: arr as TeachingLevel[] })}
      />
      <Field
        label={t("onboard.prof.experience")}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        value={value.experienceYears ?? ""}
        onChange={(e) => {
          const digits = e.target.value.replace(/\D/g, "");
          if (digits === "") {
            onChange({ experienceYears: undefined });
            return;
          }
          onChange({ experienceYears: Math.min(60, parseInt(digits, 10)) });
        }}
      />
      <QualificationsInput
        label={t("onboard.prof.qualifications")}
        helper={t("onboard.prof.qualifications.helper")}
        values={value.qualifications}
        onChange={(qualifications) => onChange({ qualifications })}
      />
      <RadioGroup
        label={t("onboard.prof.type")}
        options={LECTURER_TYPES.map((tp) => ({
          value: tp,
          label: t(`onboard.types.${tp}`),
        }))}
        value={value.lecturerType ?? ""}
        onChange={(v) => onChange({ lecturerType: v as LecturerType })}
      />
    </div>
  );
}

function TeachingStep({
  value,
  onChange,
}: {
  value: LecturerProfile;
  onChange: (patch: Partial<LecturerProfile>) => void;
}) {
  const t = useT();
  return (
    <div className="grid gap-5">
      <CheckboxGroup
        label={t("onboard.teaching.methods")}
        options={TEACHING_METHODS.map((m) => ({
          value: m,
          label: t(`onboard.methods.${m}`),
        }))}
        values={value.teachingMethods}
        onChange={(arr) => onChange({ teachingMethods: arr as TeachingMethod[] })}
      />
      <CheckboxGroup
        label={t("onboard.teaching.days")}
        options={DAY_OPTIONS.map((d) => ({
          value: d,
          label: t(`onboard.days.${d}`),
        }))}
        values={value.availableDays}
        onChange={(availableDays) => onChange({ availableDays })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("onboard.teaching.from")}
          type="time"
          value={value.availableFrom ?? ""}
          onChange={(e) => onChange({ availableFrom: e.target.value })}
        />
        <Field
          label={t("onboard.teaching.to")}
          type="time"
          value={value.availableTo ?? ""}
          onChange={(e) => onChange({ availableTo: e.target.value })}
        />
      </div>
    </div>
  );
}

function SocialStep({
  value,
  onChange,
}: {
  value: LecturerProfile;
  onChange: (patch: Partial<LecturerProfile>) => void;
}) {
  const t = useT();
  return (
    <div className="grid gap-5">
      <p className="text-sm text-ink-500">{t("onboard.social.optional")}</p>
      <Field
        label={t("onboard.social.facebook")}
        type="url"
        placeholder="https://facebook.com/your-page"
        value={value.facebook ?? ""}
        onChange={(e) => onChange({ facebook: e.target.value })}
      />
      <Field
        label={t("onboard.social.youtube")}
        type="url"
        placeholder="https://youtube.com/@channel"
        value={value.youtube ?? ""}
        onChange={(e) => onChange({ youtube: e.target.value })}
      />
      <Field
        label={t("onboard.social.tiktok")}
        type="url"
        placeholder="https://tiktok.com/@handle"
        value={value.tiktok ?? ""}
        onChange={(e) => onChange({ tiktok: e.target.value })}
      />
      <Field
        label={t("onboard.social.instagram")}
        type="url"
        placeholder="https://instagram.com/handle"
        value={value.instagram ?? ""}
        onChange={(e) => onChange({ instagram: e.target.value })}
      />
      <Field
        label={t("onboard.social.website")}
        type="url"
        placeholder="https://yoursite.lk"
        value={value.website ?? ""}
        onChange={(e) => onChange({ website: e.target.value })}
      />
    </div>
  );
}

function VerificationStep({
  uid,
  value,
  onChange,
}: {
  uid: string;
  value: LecturerProfile;
  onChange: (patch: Partial<LecturerProfile>) => void;
}) {
  const t = useT();
  return (
    <div className="grid gap-5">
      <p className="text-sm text-ink-500">{t("onboard.verify.note")}</p>
      <div className="grid gap-5 sm:grid-cols-2">
        <LecturerImageUpload
          uid={uid}
          label={t("onboard.verify.nicFront")}
          currentUrl={value.nicFrontURL}
          uploadKey="nicFront"
          onChange={(url) => onChange({ nicFrontURL: url })}
          previewAspect="cover"
        />
        <LecturerImageUpload
          uid={uid}
          label={t("onboard.verify.nicBack")}
          currentUrl={value.nicBackURL}
          uploadKey="nicBack"
          onChange={(url) => onChange({ nicBackURL: url })}
          previewAspect="cover"
        />
      </div>
      <ExtraDocsUpload
        urls={value.extraDocs}
        onChange={(extraDocs) => onChange({ extraDocs })}
      />
    </div>
  );
}

function BankingStep({
  value,
  onChange,
}: {
  value: LecturerProfile;
  onChange: (patch: Partial<LecturerProfile>) => void;
}) {
  const t = useT();
  return (
    <div className="grid gap-5">
      <p className="text-sm text-ink-500">{t("onboard.bank.note")}</p>
      <Field
        label={t("onboard.bank.holder")}
        value={value.bankAccountHolder ?? ""}
        onChange={(e) => onChange({ bankAccountHolder: e.target.value })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label={t("onboard.bank.name")}
          value={value.bankName ?? ""}
          onChange={(e) => onChange({ bankName: e.target.value })}
        />
        <Field
          label={t("onboard.bank.branch")}
          value={value.bankBranch ?? ""}
          onChange={(e) => onChange({ bankBranch: e.target.value })}
        />
      </div>
      <Field
        label={t("onboard.bank.account")}
        value={value.bankAccountNumber ?? ""}
        onChange={(e) => onChange({ bankAccountNumber: e.target.value })}
      />
    </div>
  );
}

function ReviewStep({
  value,
  submittable,
}: {
  value: LecturerProfile;
  submittable: boolean;
}) {
  const t = useT();
  const { locale } = useI18n();
  const ready = submittable;
  return (
    <div className="space-y-5">
      <p className="text-sm text-ink-600">{t("onboard.review.intro")}</p>
      <ul className="grid gap-2 sm:grid-cols-2">
        {[
          ["onboard.review.displayName", value.displayName],
          [
            "onboard.review.location",
            (() => {
              const d = findDistrict(value.district);
              return d ? localizedLabel(d.name, locale) : "";
            })(),
          ],
          ["onboard.review.mainSubject", value.mainSubject],
          [
            "onboard.review.languages",
            value.languages.map((l) => l.toUpperCase()).join(", "),
          ],
          [
            "onboard.review.levels",
            value.teachingLevels.map((l) => l.toUpperCase()).join(", "),
          ],
          [
            "onboard.review.methods",
            value.teachingMethods.join(", "),
          ],
          ["onboard.review.experience", value.experienceYears?.toString()],
          [
            "onboard.review.qualifications",
            value.qualifications.length > 0
              ? value.qualifications.map(formatQualification).join("; ")
              : "",
          ],
          ["onboard.review.bankName", value.bankName],
        ].map(([k, v]) => (
          <li
            key={k as string}
            className="rounded-lg border border-ink-100 p-3 text-sm"
          >
            <div className="text-xs font-semibold uppercase tracking-wider text-ink-500">
              {t(k as string)}
            </div>
            <div className="mt-1 text-ink-900">
              {v && String(v).trim() ? v : <span className="text-rose-500">{t("onboard.review.missing")}</span>}
            </div>
          </li>
        ))}
      </ul>

      <div
        className={`rounded-lg border px-4 py-3 text-sm ${
          ready
            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
            : "border-amber-200 bg-amber-50 text-amber-800"
        }`}
      >
        {ready ? t("onboard.review.ready") : t("onboard.review.notReady")}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Submitted view                                                              */
/* -------------------------------------------------------------------------- */

function SubmittedView({ profile }: { profile: LecturerProfile }) {
  const t = useT();
  const isApproved = profile.approvalStatus === "approved";
  return (
    <div className="card mx-auto max-w-2xl p-8 text-center">
      <div
        className={`mx-auto inline-flex h-14 w-14 items-center justify-center rounded-full ${
          isApproved ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
        }`}
      >
        <CheckCircleIcon className="h-8 w-8" />
      </div>
      <h2 className="mt-4 text-2xl font-bold text-ink-900">
        {isApproved ? t("onboard.done.approvedTitle") : t("onboard.done.pendingTitle")}
      </h2>
      <p className="mt-2 text-ink-600">
        {isApproved ? t("onboard.done.approvedBody") : t("onboard.done.pendingBody")}
      </p>
      <Link href="/lecturer" className="btn btn-primary mt-6 inline-flex">
        {t("onboard.done.goDashboard")}
      </Link>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Form primitives                                                             */
/* -------------------------------------------------------------------------- */

function LocationSelects({
  value,
  onChange,
}: {
  value: LecturerProfile;
  onChange: (patch: Partial<LecturerProfile>) => void;
}) {
  const t = useT();
  const { locale } = useI18n();

  return (
    <SelectField
      label={t("onboard.basic.district")}
      value={value.district ?? ""}
      required
      onChange={(e) => onChange({ district: e.target.value || undefined })}
    >
      <option value="">{t("onboard.basic.district.placeholder")}</option>
      {SRI_LANKA_DISTRICTS.map((d) => (
        <option key={d.id} value={d.id}>
          {localizedLabel(d.name, locale)}
        </option>
      ))}
    </SelectField>
  );
}

function SelectField({
  label,
  helper,
  children,
  ...rest
}: {
  label: string;
  helper?: string;
  children: React.ReactNode;
} & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink-700 mb-1.5 block">
        {label}
        {rest.required && <span className="text-rose-500 ml-0.5">*</span>}
      </span>
      <select className="input-base select-base disabled:bg-ink-50 disabled:text-ink-500" {...rest}>
        {children}
      </select>
      {helper && <p className="mt-1 text-xs text-ink-500">{helper}</p>}
    </label>
  );
}

function Field({
  label,
  helper,
  ...rest
}: {
  label: string;
  helper?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink-700 mb-1.5 block">
        {label}
      </span>
      <input className="input-base" {...rest} />
      {helper && <p className="mt-1 text-xs text-ink-500">{helper}</p>}
    </label>
  );
}

function TextArea({
  label,
  helper,
  ...rest
}: {
  label: string;
  helper?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink-700 mb-1.5 block">
        {label}
      </span>
      <textarea
        className="w-full rounded-xl border border-ink-200 bg-white p-3 text-sm text-ink-900 focus:border-brand-500 focus:outline-none focus:shadow-[0_0_0_4px_rgba(59,130,246,0.15)]"
        {...rest}
      />
      {helper && <p className="mt-1 text-xs text-ink-500">{helper}</p>}
    </label>
  );
}

function CheckboxGroup({
  label,
  options,
  values,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (next: string[]) => void;
}) {
  function toggle(v: string) {
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  }
  return (
    <div>
      <div className="text-sm font-medium text-ink-700 mb-2">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = values.includes(o.value);
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => toggle(o.value)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                on
                  ? "border-brand-600 bg-brand-50 text-brand-800"
                  : "border-ink-200 bg-white text-ink-700 hover:border-ink-300"
              }`}
            >
              {on && <CheckIcon className="h-3.5 w-3.5" />}
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RadioGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <div>
      <div className="text-sm font-medium text-ink-700 mb-2">{label}</div>
      <div className="grid gap-3 sm:grid-cols-3">
        {options.map((o) => {
          const on = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              className={`rounded-xl border-2 p-4 text-left transition-all ${
                on
                  ? "border-brand-600 bg-brand-50"
                  : "border-ink-200 bg-white hover:border-ink-300"
              }`}
            >
              <div className="text-sm font-semibold text-ink-900">{o.label}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TagInput({
  label,
  helper,
  values,
  onChange,
}: {
  label: string;
  helper?: string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  function add() {
    const v = draft.trim();
    if (!v) return;
    if (!values.includes(v)) onChange([...values, v]);
    setDraft("");
  }
  return (
    <div>
      <div className="text-sm font-medium text-ink-700 mb-1.5">{label}</div>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-ink-200 bg-white p-2.5">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-800"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              className="inline-flex h-4 w-4 items-center justify-center rounded-full text-brand-700 hover:bg-brand-100"
              aria-label="Remove"
            >
              <CloseIcon className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              add();
            }
          }}
          onBlur={add}
          placeholder={helper ?? "Type and press Enter"}
          className="flex-1 min-w-[160px] bg-transparent text-sm outline-none placeholder:text-ink-400"
        />
      </div>
      {helper && <p className="mt-1 text-xs text-ink-500">{helper}</p>}
    </div>
  );
}


function ExtraDocsUpload({
  urls,
  onChange,
}: {
  urls: string[];
  onChange: (next: string[]) => void;
}) {
  const t = useT();
  const { user } = useAuth();
  const ref = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFile(file: File) {
    if (!user) return;
    setUploading(true);
    try {
      const token = await user.getIdToken();
      const url = await uploadLecturerAsset(token, "extraDoc", file);
      onChange([...urls, url]);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="text-sm font-medium text-ink-700 mb-1.5">
        {t("onboard.verify.extraDocs")}
      </div>
      <p className="mb-3 text-xs text-ink-500">{t("onboard.verify.extraDocs.helper")}</p>
      <input
        ref={ref}
        type="file"
        accept="image/*,application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
      />
      <div className="flex flex-wrap gap-2">
        {urls.map((u, i) => (
          <a
            key={u}
            href={u}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-1.5 text-xs text-ink-700 hover:border-ink-300"
          >
            Doc #{i + 1}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onChange(urls.filter((x) => x !== u));
              }}
              className="text-ink-400 hover:text-rose-500"
              aria-label="Remove"
            >
              <CloseIcon className="h-3 w-3" />
            </button>
          </a>
        ))}
        <button
          type="button"
          onClick={() => ref.current?.click()}
          disabled={uploading}
          className="btn btn-secondary"
        >
          <UploadIcon className="h-4 w-4" />
          {uploading ? t("onboard.upload.uploading") : t("onboard.verify.extraDocs.add")}
        </button>
      </div>
    </div>
  );
}
