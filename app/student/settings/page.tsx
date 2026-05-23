"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { updateProfile } from "firebase/auth";
import { GradientHeader } from "@/components/GradientHeader";
import { SriLankaPhoneField } from "@/components/SriLankaPhoneField";
import { StudentPhotoUpload } from "@/components/student/StudentPhotoUpload";
import {
  CheckCircleIcon,
  ShieldIcon,
  UserIcon,
  BellIcon,
  GlobeIcon,
} from "@/components/icons";
import {
  fetchMyStudentProfileForUser,
  saveMyStudentProfile,
} from "@/lib/api/students";
import {
  localizedLabel,
  SRI_LANKA_DISTRICTS,
} from "@/lib/data/sri-lanka-locations";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useI18n, useT } from "@/lib/i18n/I18nProvider";
import { LOCALE_LABELS, SUPPORTED_LOCALES, type Locale } from "@/lib/i18n/config";
import { normalizeSriLankaPhone } from "@/lib/phone/sri-lanka";
import {
  DEFAULT_NOTIFICATION_PREFS,
  STUDENT_STUDY_LEVELS,
  type StudentNotificationPrefs,
  type StudentProfile,
} from "@/lib/student/types";

type Tab = "general" | "security" | "notifications" | "language";

export default function SettingsPage() {
  const { t, locale, setLocale } = useI18n();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("general");
  const [profile, setProfile] = useState<StudentProfile | null>(null);
  const [form, setForm] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    void (async () => {
      setLoading(true);
      try {
        const data = await fetchMyStudentProfileForUser(user);
        if (cancelled) return;
        const next = data ?? {
          uid: user.uid,
          email: user.email ?? "",
          name: user.displayName ?? "",
          notificationPrefs: { ...DEFAULT_NOTIFICATION_PREFS },
        };
        if (next.phone) {
          const normalized = normalizeSriLankaPhone(next.phone);
          if (normalized) next.phone = normalized;
        }
        setProfile(next);
        setForm(next);
        setError(null);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t("student.settings.loadError"));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, t]);

  const dirty = useMemo(() => {
    if (!profile || !form) return false;
    return JSON.stringify(profile) !== JSON.stringify(form);
  }, [profile, form]);

  const handleReset = useCallback(() => {
    if (profile) setForm({ ...profile });
    setMessage(null);
    setError(null);
  }, [profile]);

  const handleSave = useCallback(async () => {
    if (!user || !form) return;
    if (!form.name.trim()) {
      setError(t("student.settings.validation.nameRequired"));
      return;
    }
  if (form.phone && !normalizeSriLankaPhone(form.phone)) {
      setError(t("student.settings.validation.phoneInvalid"));
      return;
    }

    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const token = await user.getIdToken();
      const saved = await saveMyStudentProfile(token, {
        name: form.name.trim(),
        photoURL: form.photoURL,
        phone: form.phone ? normalizeSriLankaPhone(form.phone) ?? form.phone : undefined,
        district: form.district?.trim() || undefined,
        studyLevel: form.studyLevel,
        schoolName: form.schoolName?.trim() || undefined,
        bio: form.bio?.trim() || undefined,
        notificationPrefs: form.notificationPrefs,
      });
      setProfile(saved);
      setForm(saved);
      setMessage(t("student.settings.saved"));
      try {
        await updateProfile(user, {
          displayName: saved.name,
          photoURL: saved.photoURL ?? undefined,
        });
      } catch {
        // non-fatal
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : t("student.settings.saveError"));
    } finally {
      setSaving(false);
    }
  }, [user, form, t]);

  function patchForm(patch: Partial<StudentProfile>) {
    setForm((prev) => (prev ? { ...prev, ...patch } : prev));
  }

  return (
    <>
      <GradientHeader
        title={t("settings.title")}
        subtitle={t("settings.subtitle")}
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReset}
              disabled={!dirty || saving || loading}
              className="btn border border-white/30 text-white hover:bg-white/10 disabled:opacity-60"
            >
              {t("settings.reset")}
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={!dirty || saving || loading}
              className="btn bg-white text-brand-700 hover:bg-white/90 disabled:opacity-60"
            >
              <CheckCircleIcon className="h-4 w-4" />
              {saving ? t("student.settings.saving") : t("settings.save")}
            </button>
          </div>
        }
      />

      {(message || error) && (
        <div
          role="alert"
          className={`mt-4 rounded-lg border px-4 py-2 text-sm ${
            error
              ? "border-rose-200 bg-rose-50 text-rose-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-800"
          }`}
        >
          {error ?? message}
        </div>
      )}

      <div className="flex items-center gap-1 border-b border-ink-200">
        {(
          [
            { id: "general", icon: <UserIcon className="h-4 w-4" /> },
            { id: "security", icon: <ShieldIcon className="h-4 w-4" /> },
            { id: "notifications", icon: <BellIcon className="h-4 w-4" /> },
            { id: "language", icon: <GlobeIcon className="h-4 w-4" /> },
          ] as { id: Tab; icon: React.ReactNode }[]
        ).map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setTab(x.id)}
            className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === x.id
                ? "border-brand-600 text-brand-700"
                : "border-transparent text-ink-600 hover:text-ink-900"
            }`}
          >
            {x.icon}
            {t(`settings.tab.${x.id}`)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="card p-10 text-center text-sm text-ink-500 mt-6">
          {t("student.settings.loading")}
        </div>
      ) : (
        <>
          {tab === "general" && form && (
            <GeneralTab form={form} onChange={patchForm} />
          )}
          {tab === "security" && <SecurityTab />}
          {tab === "notifications" && form && (
            <NotificationsTab
              prefs={form.notificationPrefs}
              onChange={(notificationPrefs) => patchForm({ notificationPrefs })}
            />
          )}
          {tab === "language" && (
            <LanguageTab locale={locale} setLocale={setLocale} />
          )}
        </>
      )}
    </>
  );
}

function GeneralTab({
  form,
  onChange,
}: {
  form: StudentProfile;
  onChange: (patch: Partial<StudentProfile>) => void;
}) {
  const { t, locale } = useI18n();

  return (
    <div className="card p-6 sm:p-8 mt-6">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-brand-50 text-brand-700 flex items-center justify-center flex-shrink-0">
          <UserIcon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-ink-900">
            {t("settings.profile.title")}
          </h2>
          <p className="text-sm text-ink-500 mt-1">
            {t("student.settings.profile.subtitle")}
          </p>
        </div>
      </div>

      <div className="mt-6 grid lg:grid-cols-[auto,1fr] gap-8">
        <StudentPhotoUpload
          currentUrl={form.photoURL}
          onChange={(photoURL) => onChange({ photoURL })}
        />

        <div className="grid sm:grid-cols-2 gap-4">
          <Field
            label={t("settings.profile.name")}
            value={form.name}
            onChange={(e) => onChange({ name: e.target.value })}
          />
          <Field
            label={t("settings.profile.email")}
            value={form.email}
            disabled
            hint={t("settings.profile.emailLocked")}
          />
          <div className="sm:col-span-2">
            <SriLankaPhoneField
              label={t("student.settings.phone")}
              value={form.phone ?? ""}
              onChange={(phone) => onChange({ phone })}
            />
          </div>
          <SelectField
            label={t("student.settings.district")}
            value={form.district ?? ""}
            onChange={(district) => onChange({ district: district || undefined })}
          >
            <option value="">{t("student.settings.districtPlaceholder")}</option>
            {SRI_LANKA_DISTRICTS.map((d) => (
              <option key={d.id} value={d.id}>
                {localizedLabel(d.name, locale)}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={t("student.settings.studyLevel")}
            value={form.studyLevel ?? ""}
            onChange={(studyLevel) =>
              onChange({
                studyLevel: (studyLevel || undefined) as StudentProfile["studyLevel"],
              })
            }
          >
            <option value="">{t("student.settings.studyLevelPlaceholder")}</option>
            {STUDENT_STUDY_LEVELS.map((level) => (
              <option key={level} value={level}>
                {t(`student.settings.studyLevels.${level}`)}
              </option>
            ))}
          </SelectField>
          <Field
            label={t("student.settings.school")}
            value={form.schoolName ?? ""}
            placeholder={t("student.settings.schoolPlaceholder")}
            onChange={(e) => onChange({ schoolName: e.target.value })}
            className="sm:col-span-2"
          />
          <TextAreaField
            label={t("student.settings.bio")}
            value={form.bio ?? ""}
            placeholder={t("student.settings.bioPlaceholder")}
            onChange={(e) => onChange({ bio: e.target.value })}
            className="sm:col-span-2"
          />
        </div>
      </div>
    </div>
  );
}

function SecurityTab() {
  const { t } = useI18n();
  return (
    <div className="card p-6 sm:p-8 mt-6">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center flex-shrink-0">
          <ShieldIcon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-ink-900">
            {t("settings.security.title")}
          </h2>
          <p className="text-sm text-ink-500 mt-1">
            {t("settings.security.subtitle")}
          </p>
        </div>
      </div>
      <p className="mt-6 text-sm text-ink-500 max-w-xl">
        {t("student.settings.securityComingSoon")}
      </p>
    </div>
  );
}

function NotificationsTab({
  prefs,
  onChange,
}: {
  prefs: StudentNotificationPrefs;
  onChange: (prefs: StudentNotificationPrefs) => void;
}) {
  const { t } = useI18n();
  const items: {
    key: keyof StudentNotificationPrefs;
    titleKey: string;
    descKey: string;
    defaultOn?: boolean;
  }[] = [
    {
      key: "liveReminders",
      titleKey: "student.settings.notify.liveReminders",
      descKey: "student.settings.notify.liveRemindersDesc",
    },
    {
      key: "courseAnnouncements",
      titleKey: "student.settings.notify.courseAnnouncements",
      descKey: "student.settings.notify.courseAnnouncementsDesc",
    },
    {
      key: "weeklyProgress",
      titleKey: "student.settings.notify.weeklyProgress",
      descKey: "student.settings.notify.weeklyProgressDesc",
    },
    {
      key: "promotions",
      titleKey: "student.settings.notify.promotions",
      descKey: "student.settings.notify.promotionsDesc",
      defaultOn: false,
    },
  ];

  return (
    <div className="card divide-y divide-ink-100 mt-6">
      {items.map((item) => (
        <ToggleRow
          key={item.key}
          title={t(item.titleKey)}
          desc={t(item.descKey)}
          on={prefs[item.key]}
          onToggle={(next) => onChange({ ...prefs, [item.key]: next })}
        />
      ))}
    </div>
  );
}

function LanguageTab({
  locale,
  setLocale,
}: {
  locale: Locale;
  setLocale: (l: Locale) => void;
}) {
  const { t } = useI18n();
  return (
    <div className="card p-6 sm:p-8 mt-6">
      <div className="flex items-start gap-4">
        <div className="h-12 w-12 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center flex-shrink-0">
          <GlobeIcon className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-ink-900">
            {t("settings.language.title")}
          </h2>
          <p className="text-sm text-ink-500 mt-1">
            {t("settings.language.subtitle")}
          </p>
        </div>
      </div>
      <div className="mt-6 grid sm:grid-cols-3 gap-3 max-w-2xl">
        {SUPPORTED_LOCALES.map((code) => (
          <button
            key={code}
            type="button"
            onClick={() => setLocale(code as Locale)}
            className={`text-left p-4 rounded-xl border-2 transition-all ${
              locale === code
                ? "border-brand-600 bg-brand-50"
                : "border-ink-200 bg-white hover:border-ink-300"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-ink-100 text-xs font-bold text-ink-700">
                {LOCALE_LABELS[code].flag}
              </span>
              {locale === code && (
                <CheckCircleIcon className="h-5 w-5 text-brand-600" />
              )}
            </div>
            <div className="mt-3 font-semibold text-ink-900">
              {LOCALE_LABELS[code].native}
            </div>
            <div className="text-xs text-ink-500">{LOCALE_LABELS[code].english}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  className,
  ...inputProps
}: {
  label: string;
  hint?: string;
  className?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="text-sm font-medium text-ink-700 block mb-1.5">{label}</span>
      <input className={`input-base ${inputProps.disabled ? "bg-ink-50 text-ink-500" : ""}`} {...inputProps} />
      {hint && <p className="text-xs text-ink-500 mt-1.5">{hint}</p>}
    </label>
  );
}

function TextAreaField({
  label,
  hint,
  className,
  ...inputProps
}: {
  label: string;
  hint?: string;
  className?: string;
} & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="text-sm font-medium text-ink-700 block mb-1.5">{label}</span>
      <textarea className="textarea-base min-h-[100px]" {...inputProps} />
      {hint && <p className="text-xs text-ink-500 mt-1.5">{hint}</p>}
    </label>
  );
}

function SelectField({
  label,
  children,
  className,
  value,
  onChange,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="text-sm font-medium text-ink-700 block mb-1.5">{label}</span>
      <select
        className="input-base select-base"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

function ToggleRow({
  title,
  desc,
  on,
  onToggle,
}: {
  title: string;
  desc: string;
  on: boolean;
  onToggle: (next: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6 p-5">
      <div>
        <div className="font-medium text-ink-900">{title}</div>
        <div className="text-sm text-ink-500 mt-0.5">{desc}</div>
      </div>
      <button
        type="button"
        onClick={() => onToggle(!on)}
        className={`relative h-6 w-11 rounded-full transition-colors flex-shrink-0 ${
          on ? "bg-brand-600" : "bg-ink-300"
        }`}
        aria-pressed={on}
      >
        <span
          className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            on ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
