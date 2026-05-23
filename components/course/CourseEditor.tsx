"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { GradientHeader } from "@/components/GradientHeader";
import {
  ArrowRightIcon,
  CheckCircleIcon,
  CheckIcon,
  TrashIcon,
} from "@/components/icons";
import { CourseAssetUpload } from "@/components/course/CourseAssetUpload";
import { CourseTagInput } from "@/components/course/CourseTagInput";
import { ModulesEditor } from "@/components/course/ModulesEditor";
import { WeeklyScheduleEditor } from "@/components/course/WeeklyScheduleEditor";
import {
  createMyCourse,
  deleteMyCourse,
  getMyCourse,
  publishMyCourse,
  updateMyCourse,
  uploadCourseAsset,
} from "@/lib/api/courses";
import {
  COURSE_ACCESS_OPTIONS,
  COURSE_LANGUAGE_OPTIONS,
  COURSE_VISIBILITY_OPTIONS,
  MAIN_CATEGORY_OPTIONS,
  TEACHING_LEVEL_OPTIONS,
  type CourseAccessType,
  type CourseLanguage,
  type CourseTeachingLevel,
  type CourseType,
  type CourseVisibility,
  emptyCourse,
  type LecturerCourse,
} from "@/lib/courses/types";
import { isBasicsStepComplete } from "@/lib/courses/create-validation";
import { useAuth } from "@/lib/firebase/AuthProvider";
import { useT } from "@/lib/i18n/I18nProvider";

type StepKey = "basics" | "type" | "content" | "pricing" | "review";

const STEPS: { key: StepKey; labelKey: string }[] = [
  { key: "basics", labelKey: "lecturer.create.step.basics" },
  { key: "type", labelKey: "lecturer.create.step.type" },
  { key: "content", labelKey: "lecturer.create.step.content" },
  { key: "pricing", labelKey: "lecturer.create.step.pricing" },
  { key: "review", labelKey: "lecturer.create.step.review" },
];

const AUTOSAVE_DEBOUNCE_MS = 1500;

type PendingAssets = {
  thumbnail?: File;
  cover?: File;
};

const CREATE_DRAFT_STORAGE_KEY = "educeylon:lecturer-create-draft-id";

export function CourseEditor({
  courseId: initialCourseId,
  startNew,
}: {
  courseId?: string;
  /** When true, start a blank course (ignore any saved in-tab draft). */
  startNew?: boolean;
}) {
  const t = useT();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [persistedId, setPersistedId] = useState<string | null>(
    initialCourseId ?? null,
  );
  const [pendingAssets, setPendingAssets] = useState<PendingAssets>({});
  const [course, setCourse] = useState<LecturerCourse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [savingStatus, setSavingStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [publishing, setPublishing] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const savedSnapshotRef = useRef<string>("");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inflightRef = useRef(false);
  const draftSavingRef = useRef(false);
  const persistedIdRef = useRef<string | null>(initialCourseId ?? null);
  const pendingAssetsRef = useRef<PendingAssets>({});

  useEffect(() => {
    persistedIdRef.current = persistedId;
  }, [persistedId]);

  useEffect(() => {
    pendingAssetsRef.current = pendingAssets;
  }, [pendingAssets]);

  const loginNext = persistedId
    ? `/lecturer/create?id=${encodeURIComponent(persistedId)}`
    : "/lecturer/create";

  // Resolve course id: URL param, in-tab draft, or start fresh.
  useEffect(() => {
    if (startNew) {
      sessionStorage.removeItem(CREATE_DRAFT_STORAGE_KEY);
      setPersistedId(null);
      persistedIdRef.current = null;
      setCourse(null);
      savedSnapshotRef.current = "";
      return;
    }
    if (initialCourseId) {
      sessionStorage.setItem(CREATE_DRAFT_STORAGE_KEY, initialCourseId);
      setPersistedId(initialCourseId);
      persistedIdRef.current = initialCourseId;
      return;
    }
    const stored = sessionStorage.getItem(CREATE_DRAFT_STORAGE_KEY);
    if (stored) {
      setPersistedId(stored);
      persistedIdRef.current = stored;
    }
  }, [initialCourseId, startNew]);

  // Load existing course from Firestore.
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(loginNext)}`);
      return;
    }
    if (!persistedId) return;
    // Already loaded for this id (e.g. right after create) — skip refetch.
    if (course?.id === persistedId) return;

    let alive = true;
    void (async () => {
      try {
        const token = await user.getIdToken();
        const data = await getMyCourse(token, persistedId);
        if (!alive) return;
        setCourse(data);
        savedSnapshotRef.current = snapshot(data);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof Error ? e.message : "Could not load course");
      }
    })();
    return () => {
      alive = false;
    };
  }, [authLoading, user, persistedId, router, loginNext, course?.id]);

  // New course: local draft only (nothing written to DB until save/publish).
  useEffect(() => {
    if (authLoading || !user || persistedId || course) return;
    const draft: LecturerCourse = {
      ...emptyCourse(user.uid),
      id: "local-draft",
    };
    setCourse(draft);
    savedSnapshotRef.current = snapshot(draft);
  }, [authLoading, user, persistedId, course]);

  const flushPendingAssets = useCallback(
    async (targetId: string, assets: PendingAssets) => {
      if (!user) return;
      const token = await user.getIdToken();
      const patch: Partial<LecturerCourse> = {};
      if (assets.thumbnail) {
        patch.thumbnailURL = await uploadCourseAsset(
          token,
          targetId,
          "thumbnail",
          assets.thumbnail,
        );
      }
      if (assets.cover) {
        patch.coverURL = await uploadCourseAsset(
          token,
          targetId,
          "cover",
          assets.cover,
        );
      }
      if (Object.keys(patch).length > 0) {
        const updated = await updateMyCourse(token, targetId, patch);
        setCourse((prev) => (prev ? { ...prev, ...updated } : prev));
        savedSnapshotRef.current = snapshot(updated);
      }
      setPendingAssets({});
    },
    [user],
  );

  const ensurePersisted = useCallback(
    async (data: LecturerCourse): Promise<string> => {
      if (!user) throw new Error("Not signed in");
      if (persistedIdRef.current) return persistedIdRef.current;

      const token = await user.getIdToken();
      const assetsSnapshot = { ...pendingAssetsRef.current };
      const created = await createMyCourse(token, editablePatch(data));
      await flushPendingAssets(created.id, assetsSnapshot);
      const merged = await getMyCourse(token, created.id);
      savedSnapshotRef.current = snapshot(merged);
      setCourse(merged);
      persistedIdRef.current = created.id;
      setPersistedId(created.id);
      sessionStorage.setItem(CREATE_DRAFT_STORAGE_KEY, created.id);
      return created.id;
    },
    [user, flushPendingAssets],
  );

  const persist = useCallback(
    async (patch: Partial<LecturerCourse>) => {
      if (!user || !persistedId) return null;
      const token = await user.getIdToken();
      return updateMyCourse(token, persistedId, patch);
    },
    [user, persistedId],
  );

  // Debounced autosave — only after the course exists in Firestore.
  useEffect(() => {
    if (!course || !persistedId) return;
    const next = snapshot(course);
    if (next === savedSnapshotRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    setSavingStatus("idle");
    saveTimerRef.current = setTimeout(() => {
      void doSave();
    }, AUTOSAVE_DEBOUNCE_MS);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [course]);

  async function doSave(): Promise<void> {
    if (!course || !user || !persistedId || inflightRef.current) return;
    inflightRef.current = true;
    setSavingStatus("saving");
    try {
      const result = await persist(editablePatch(course));
      if (result) {
        savedSnapshotRef.current = snapshot(result);
        setCourse((prev) =>
          prev ? { ...prev, updatedAt: result.updatedAt } : prev,
        );
      }
      setSavingStatus("saved");
    } catch (e) {
      setSavingStatus("error");
      setError(e instanceof Error ? e.message : "Auto-save failed");
    } finally {
      inflightRef.current = false;
    }
  }

  async function handleSaveDraft() {
    if (!course || !user || draftSavingRef.current) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);

    const payload: LecturerCourse = {
      ...course,
      status: "draft",
    };

    draftSavingRef.current = true;
    setSavingStatus("saving");
    setError(null);
    try {
      const token = await user.getIdToken();
      const id =
        persistedIdRef.current ?? (await ensurePersisted(payload));
      const result = await updateMyCourse(token, id, editablePatch(payload));
      savedSnapshotRef.current = snapshot(result);
      setCourse(result);
      setSavingStatus("saved");
    } catch (e) {
      setSavingStatus("error");
      setError(e instanceof Error ? e.message : "Could not save draft");
    } finally {
      draftSavingRef.current = false;
    }
  }

  async function handlePublish() {
    if (!user || !course) return;
    if (!basicsReady) {
      setStepIdx(0);
      return;
    }
    setPublishing(true);
    setError(null);
    try {
      const token = await user.getIdToken();
      const id = persistedIdRef.current ?? (await ensurePersisted(course));
      await updateMyCourse(token, id, editablePatch(course));
      const result = await publishMyCourse(token, id);
      setCourse(result);
      savedSnapshotRef.current = snapshot(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not publish");
    } finally {
      setPublishing(false);
    }
  }

  async function handleDelete() {
    setDeleteOpen(false);
    sessionStorage.removeItem(CREATE_DRAFT_STORAGE_KEY);
    if (!persistedId) {
      router.replace("/lecturer/courses");
      return;
    }
    if (!user) return;
    try {
      const token = await user.getIdToken();
      await deleteMyCourse(token, persistedId);
      router.replace("/lecturer/courses");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete course");
    }
  }

  const dirty = useMemo(() => {
    if (!course) return false;
    return snapshot(course) !== savedSnapshotRef.current;
  }, [course]);

  const basicsReady = useMemo(() => {
    if (!course) return false;
    return isBasicsStepComplete(course, {
      pendingThumbnail: Boolean(pendingAssets.thumbnail),
    });
  }, [course, pendingAssets.thumbnail]);

  const goToStep = useCallback(
    async (targetIdx: number) => {
      if (!course || !user) return;
      if (targetIdx < stepIdx) {
        setStepIdx(targetIdx);
        return;
      }
      if (stepIdx === 0 && targetIdx > 0 && !basicsReady) {
        return;
      }
      if (
        stepIdx === 0 &&
        targetIdx > 0 &&
        !persistedIdRef.current &&
        !draftSavingRef.current
      ) {
        setSavingStatus("saving");
        setError(null);
        try {
          await ensurePersisted(course);
          setSavingStatus("saved");
        } catch (e) {
          setSavingStatus("error");
          setError(
            e instanceof Error ? e.message : "Save the draft before continuing",
          );
          return;
        }
      }
      setStepIdx(targetIdx);
    },
    [course, user, stepIdx, basicsReady, ensurePersisted],
  );

  async function handleNext() {
    if (stepIdx >= STEPS.length - 1) return;
    await goToStep(stepIdx + 1);
  }

  const patchCourse = useCallback((patch: Partial<LecturerCourse>) => {
    setCourse((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  if (!course) {
    return (
      <>
        <GradientHeader
          title={t("lecturer.create.title")}
          subtitle={t("lecturer.create.subtitle")}
        />
        <div className="mt-6 card p-10 text-center text-sm text-ink-500">
          {error ? <span className="text-rose-600">{error}</span> : "Loading…"}
        </div>
      </>
    );
  }

  const step = STEPS[stepIdx]!;

  return (
    <>
      <GradientHeader
        title={
          course.title.trim() ||
          (persistedId
            ? t("lecturer.create.edit.title")
            : t("lecturer.create.title"))
        }
        subtitle={t("lecturer.create.subtitle")}
        actions={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void handleSaveDraft()}
              disabled={publishing || savingStatus === "saving"}
              className="btn border border-white/30 text-white hover:bg-white/10 disabled:opacity-60"
            >
              {savingStatus === "saving"
                ? t("lecturer.create.savingDraft")
                : t("lecturer.create.draft")}
            </button>
            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={publishing}
              className="btn bg-white text-brand-700 hover:bg-white/90 disabled:opacity-60"
            >
              {publishing ? t("lecturer.create.publishing") : t("lecturer.create.publish")}
            </button>
          </div>
        }
      >
        <div className="mt-3 flex items-center gap-3 text-xs text-white/80">
          <StatusPill status={course.status} t={t} />
          <SaveIndicator
            status={savingStatus}
            dirty={dirty}
            isLocalDraft={!persistedId}
            t={t}
          />
        </div>
      </GradientHeader>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700"
        >
          {error}
        </div>
      )}

      <nav aria-label="Course steps" className="card p-3 sm:p-4 mt-6">
        <ol className="grid grid-cols-5 gap-1">
          {STEPS.map((s, i) => {
            const active = i === stepIdx;
            const passed = i < stepIdx;
            return (
              <li key={s.key}>
                <button
                  type="button"
                  onClick={() => void goToStep(i)}
                  aria-current={active ? "step" : undefined}
                  className={`flex w-full flex-col items-center gap-1 rounded-lg px-0.5 py-2 transition-colors ${
                    active
                      ? "bg-brand-50 text-brand-800"
                      : passed
                        ? "text-ink-700 hover:bg-ink-50"
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
                    {passed ? <CheckIcon className="h-3.5 w-3.5" /> : i + 1}
                  </span>
                  <span className="text-[10px] sm:text-[11px] font-semibold leading-tight text-center">
                    {t(s.labelKey)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <section className="card p-6 sm:p-8 mt-4">
        {step.key === "basics" && (
          <BasicsStep
            course={course}
            onChange={patchCourse}
            uploadCourseId={persistedId}
            onPendingAsset={(kind, file) =>
              setPendingAssets((prev) => ({ ...prev, [kind]: file }))
            }
            onClearPendingAsset={(kind) =>
              setPendingAssets((prev) => {
                const next = { ...prev };
                delete next[kind];
                return next;
              })
            }
          />
        )}
        {step.key === "type" && (
          <TypeStep
            course={course}
            onChange={patchCourse}
          />
        )}
        {step.key === "content" && (
          <ContentStep
            course={course}
            onChange={patchCourse}
            uploadCourseId={persistedId}
          />
        )}
        {step.key === "pricing" && (
          <PricingStep
            course={course}
            onChange={patchCourse}
          />
        )}
        {step.key === "review" && <ReviewStep course={course} t={t} />}

        <footer className="mt-8 flex flex-col-reverse gap-3 border-t border-ink-100 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => void goToStep(Math.max(0, stepIdx - 1))}
            disabled={stepIdx === 0}
            className="btn btn-ghost disabled:opacity-50"
          >
            {t("action.back")}
          </button>

          <div className="flex flex-col-reverse sm:flex-row gap-2 sm:items-center">
            <button
              type="button"
              onClick={() => setDeleteOpen(true)}
              className="btn btn-ghost text-rose-600 hover:bg-rose-50"
            >
              <TrashIcon className="h-4 w-4" />
              {t("lecturer.create.delete")}
            </button>
            <Link
              href="/lecturer/courses"
              className="btn btn-ghost"
            >
              {t("lecturer.courses.manage")}
            </Link>
            {stepIdx < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => void handleNext()}
                disabled={
                  (stepIdx === 0 && !basicsReady) || savingStatus === "saving"
                }
                className="btn btn-primary disabled:opacity-50"
              >
                {t("action.next")} <ArrowRightIcon className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handlePublish()}
                disabled={publishing}
                className="btn btn-primary disabled:opacity-60"
              >
                <CheckCircleIcon className="h-4 w-4" />
                {publishing
                  ? t("lecturer.create.publishing")
                  : t("lecturer.create.publish")}
              </button>
            )}
          </div>
        </footer>
      </section>

      {deleteOpen && (
        <ConfirmDialog
          title={t("lecturer.create.delete")}
          description={t("lecturer.create.confirmDelete")}
          confirmLabel={t("lecturer.create.delete")}
          cancelLabel={t("action.cancel")}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={() => void handleDelete()}
        />
      )}
    </>
  );
}

function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" aria-hidden onClick={onCancel} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative w-full max-w-md rounded-2xl border border-ink-200 bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
        <p className="mt-2 text-sm text-ink-600 leading-relaxed">{description}</p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="btn btn-secondary w-full sm:w-auto"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="btn btn-primary w-full sm:w-auto bg-rose-600 shadow-none hover:bg-rose-700"
            onClick={onConfirm}
          >
            <TrashIcon className="h-4 w-4" />
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function snapshot(c: LecturerCourse): string {
  return JSON.stringify(editablePatch(c));
}

function editablePatch(c: LecturerCourse): Partial<LecturerCourse> {
  const {
    id: _id,
    lecturerId: _lid,
    createdAt: _ca,
    updatedAt: _ua,
    publishedAt: _pa,
    ...rest
  } = c;
  void _id;
  void _lid;
  void _ca;
  void _ua;
  void _pa;
  const patch = { ...rest } as Partial<LecturerCourse>;
  if (patch.thumbnailURL?.startsWith("blob:")) delete patch.thumbnailURL;
  if (patch.coverURL?.startsWith("blob:")) delete patch.coverURL;
  return patch;
}

function StatusPill({
  status,
  t,
}: {
  status: LecturerCourse["status"];
  t: (key: string) => string;
}) {
  const map = {
    draft: { label: "lecturer.create.review.draftBadge", cls: "bg-white/15" },
    pending: {
      label: "lecturer.create.review.pendingBadge",
      cls: "bg-amber-100/20 text-amber-100",
    },
    published: {
      label: "lecturer.create.review.publishedBadge",
      cls: "bg-emerald-100/20 text-emerald-50",
    },
    archived: { label: "lecturer.courses.statusArchived", cls: "bg-white/10" },
  } as const;
  const item = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${item.cls}`}
    >
      {t(item.label)}
    </span>
  );
}

function SaveIndicator({
  status,
  dirty,
  isLocalDraft,
  t,
}: {
  status: "idle" | "saving" | "saved" | "error";
  dirty: boolean;
  isLocalDraft: boolean;
  t: (key: string) => string;
}) {
  if (status === "saving") return <span>{t("lecturer.create.autoSaving")}</span>;
  if (status === "error")
    return <span className="text-rose-100">Auto-save failed</span>;
  if (isLocalDraft) {
    return <span>{t("lecturer.create.localDraft")}</span>;
  }
  if (status === "saved" && !dirty) return <span>{t("lecturer.create.autoSaved")}</span>;
  if (dirty) return <span>{t("lecturer.create.unsaved")}</span>;
  return null;
}

/* ---------------- Steps ---------------- */

function BasicsStep({
  course,
  onChange,
  uploadCourseId,
  onPendingAsset,
  onClearPendingAsset,
}: {
  course: LecturerCourse;
  onChange: (patch: Partial<LecturerCourse>) => void;
  uploadCourseId: string | null;
  onPendingAsset: (kind: "thumbnail" | "cover", file: File) => void;
  onClearPendingAsset: (kind: "thumbnail" | "cover") => void;
}) {
  const t = useT();
  return (
    <div className="grid gap-6">
      <CourseFormatChooser
        value={course.courseType}
        onChange={(v) => onChange({ courseType: v })}
      />

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 grid gap-5">
          <h2 className="text-lg font-semibold text-ink-900">
            {t("lecturer.create.basics")}
          </h2>

          <Labeled label={t("lecturer.create.title.label")} required>
            <input
              className="input-base"
              value={course.title}
              placeholder="e.g. A/L Combined Maths 2026"
              onChange={(e) => onChange({ title: e.target.value })}
            />
          </Labeled>

          <Labeled label={t("lecturer.create.subtitle.label")}>
            <input
              className="input-base"
              value={course.subtitle ?? ""}
              placeholder="A short one-liner about your course"
              onChange={(e) => onChange({ subtitle: e.target.value })}
            />
          </Labeled>

          <Labeled label={t("lecturer.create.description.label")} required>
            <textarea
              className="textarea-base min-h-[140px]"
              value={course.description ?? ""}
              placeholder="Describe what students will learn in this course…"
              onChange={(e) => onChange({ description: e.target.value })}
            />
          </Labeled>

          <div className="grid sm:grid-cols-2 gap-4">
            <SelectField
              label={t("lecturer.create.category")}
              required
              value={course.mainCategory ?? ""}
              onChange={(v) => onChange({ mainCategory: v || undefined })}
            >
              <option value="">—</option>
              {MAIN_CATEGORY_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {t(`category.${c}`)}
                </option>
              ))}
            </SelectField>
            <Labeled label={t("lecturer.create.subCategory")}>
              <input
                className="input-base"
                value={course.subCategory ?? ""}
                placeholder="e.g. Combined Maths"
                onChange={(e) => onChange({ subCategory: e.target.value })}
              />
            </Labeled>
            <SelectField
              label={t("lecturer.create.level")}
              required
              value={course.teachingLevel ?? ""}
              onChange={(v) =>
                onChange({
                  teachingLevel: (v || undefined) as CourseTeachingLevel | undefined,
                })
              }
            >
              <option value="">—</option>
              {TEACHING_LEVEL_OPTIONS.map((lvl) => (
                <option key={lvl} value={lvl}>
                  {t(`onboard.levels.${lvl}`)}
                </option>
              ))}
            </SelectField>
            <SelectField
              label={t("lecturer.create.language")}
              required
              value={course.language ?? ""}
              onChange={(v) =>
                onChange({ language: (v || undefined) as CourseLanguage | undefined })
              }
            >
              <option value="">—</option>
              {COURSE_LANGUAGE_OPTIONS.map((l) => (
                <option key={l} value={l}>
                  {t(`onboard.languages.${l}`)}
                </option>
              ))}
            </SelectField>
          </div>

          <Labeled label={t("lecturer.create.tags")}>
            <CourseTagInput
              values={course.tags}
              onChange={(tags) => onChange({ tags })}
            />
          </Labeled>
        </div>

        <aside className="grid gap-5">
          <div>
            <CourseAssetUpload
              courseId={uploadCourseId}
              kind="thumbnail"
              label={`${t("lecturer.create.thumbnail")} *`}
              helper="PNG / JPG up to 5MB"
              currentUrl={course.thumbnailURL}
              onChange={(url) => onChange({ thumbnailURL: url })}
              onPickFile={(file) => onPendingAsset("thumbnail", file)}
              onClearPending={() => onClearPendingAsset("thumbnail")}
              aspect="cover"
            />
          </div>
          <CourseAssetUpload
            courseId={uploadCourseId}
            kind="cover"
            label={t("lecturer.create.cover")}
            helper="Wide banner used on course page"
            currentUrl={course.coverURL}
            onChange={(url) => onChange({ coverURL: url })}
            onPickFile={(file) => onPendingAsset("cover", file)}
            onClearPending={() => onClearPendingAsset("cover")}
            aspect="wide"
          />
        </aside>
      </div>
    </div>
  );
}

function CourseFormatChooser({
  value,
  onChange,
}: {
  value: CourseType;
  onChange: (v: CourseType) => void;
}) {
  const t = useT();
  const options: { value: CourseType; descKey: string }[] = [
    { value: "recorded", descKey: "lecturer.create.type.recorded.desc" },
    { value: "live", descKey: "lecturer.create.type.live.desc" },
    { value: "hybrid", descKey: "lecturer.create.type.hybrid.desc" },
  ];
  return (
    <div className="rounded-2xl border border-brand-200 bg-brand-50/40 p-5 sm:p-6">
      <div className="mb-3">
        <h2 className="text-base sm:text-lg font-semibold text-ink-900">
          {t("lecturer.create.format.title")}
        </h2>
        <p className="mt-0.5 text-sm text-ink-600">
          {t("lecturer.create.format.subtitle")}
        </p>
      </div>
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
                  ? "border-brand-600 bg-white shadow-sm"
                  : "border-ink-200 bg-white hover:border-brand-300"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-ink-900">
                  {t(`lecturer.create.type.${o.value}`)}
                </span>
                {on && (
                  <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white">
                    <CheckIcon className="h-3 w-3" />
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-ink-500 leading-relaxed">
                {t(o.descKey)}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TypeStep({
  course,
  onChange,
}: {
  course: LecturerCourse;
  onChange: (patch: Partial<LecturerCourse>) => void;
}) {
  const t = useT();
  return (
    <div className="grid gap-6 max-w-2xl">
      <div>
        <h2 className="text-lg font-semibold text-ink-900">
          {t("lecturer.create.type.title")}
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          {t("lecturer.create.type.subtitle")}
        </p>
      </div>

      <div className="rounded-xl border border-ink-200 bg-ink-50/40 p-4 text-sm text-ink-600">
        <span className="text-xs font-semibold uppercase tracking-wide text-ink-500">
          {t("lecturer.create.type.label")}
        </span>
        <div className="mt-1 text-ink-900 font-medium">
          {t(`lecturer.create.type.${course.courseType}`)}
        </div>
        <p className="mt-1 text-xs text-ink-500">
          {t(`lecturer.create.type.${course.courseType}.desc`)}
        </p>
      </div>

      <RadioCardGroup
        label={t("lecturer.create.visibility.label")}
        value={course.visibility}
        onChange={(v) => onChange({ visibility: v as CourseVisibility })}
        options={COURSE_VISIBILITY_OPTIONS.map((v) => ({
          value: v,
          label: t(`lecturer.create.visibility.${v}`),
        }))}
      />

      <RadioCardGroup
        label={t("lecturer.create.access.label")}
        value={course.accessType}
        onChange={(v) => onChange({ accessType: v as CourseAccessType })}
        options={COURSE_ACCESS_OPTIONS.map((v) => ({
          value: v,
          label: t(`lecturer.create.access.${v}`),
        }))}
      />
    </div>
  );
}

function ContentStep({
  course,
  onChange,
  uploadCourseId,
}: {
  course: LecturerCourse;
  onChange: (patch: Partial<LecturerCourse>) => void;
  uploadCourseId: string | null;
}) {
  const t = useT();
  const showModules =
    course.courseType === "recorded" || course.courseType === "hybrid";
  const showSchedule =
    course.courseType === "live" || course.courseType === "hybrid";

  const titleKey =
    course.courseType === "live"
      ? "lecturer.create.content.schedule.title"
      : course.courseType === "hybrid"
        ? "lecturer.create.content.hybrid.title"
        : "lecturer.create.content.title";
  const subtitleKey =
    course.courseType === "live"
      ? "lecturer.create.content.schedule.subtitle"
      : course.courseType === "hybrid"
        ? "lecturer.create.content.hybrid.subtitle"
        : "lecturer.create.content.subtitle";

  return (
    <div className="grid gap-5">
      <div>
        <h2 className="text-lg font-semibold text-ink-900">{t(titleKey)}</h2>
        <p className="mt-1 text-sm text-ink-500">{t(subtitleKey)}</p>
      </div>

      {showSchedule && !uploadCourseId && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {t("lecturer.create.saveBeforeUpload")}
        </p>
      )}

      {showSchedule && (
        <section className="grid gap-3">
          {course.courseType === "hybrid" && (
            <h3 className="text-sm font-semibold uppercase tracking-wide text-ink-500">
              {t("lecturer.create.schedule.title")}
            </h3>
          )}
          <WeeklyScheduleEditor
            slots={course.weeklySchedule ?? []}
            onChange={(weeklySchedule) => onChange({ weeklySchedule })}
          />
        </section>
      )}

      {showModules && (
        <section className="grid gap-3">
          {course.courseType === "hybrid" && (
            <h3 className="mt-4 text-sm font-semibold uppercase tracking-wide text-ink-500">
              {t("lecturer.create.content.modules.title")}
            </h3>
          )}
          {!uploadCourseId && !showSchedule && (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {t("lecturer.create.saveBeforeUpload")}
            </p>
          )}
          <ModulesEditor
            courseId={uploadCourseId}
            modules={course.modules}
            onChange={(modules) => onChange({ modules })}
          />
        </section>
      )}
    </div>
  );
}

function PricingStep({
  course,
  onChange,
}: {
  course: LecturerCourse;
  onChange: (patch: Partial<LecturerCourse>) => void;
}) {
  const t = useT();
  const isPaid = course.accessType === "paid";
  return (
    <div className="grid gap-5 max-w-2xl">
      <h2 className="text-lg font-semibold text-ink-900">
        {t("lecturer.create.step.pricing")}
      </h2>

      <div className="grid sm:grid-cols-2 gap-4">
        <Labeled label={t("lecturer.create.price")}>
          <input
            type="number"
            min={0}
            disabled={!isPaid}
            className="input-base disabled:bg-ink-50 disabled:text-ink-400"
            value={course.price ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ price: v ? Number(v) : undefined });
            }}
          />
        </Labeled>
        <Labeled label={t("lecturer.create.discountPrice")}>
          <input
            type="number"
            min={0}
            disabled={!isPaid}
            className="input-base disabled:bg-ink-50 disabled:text-ink-400"
            value={course.discountPrice ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onChange({ discountPrice: v ? Number(v) : undefined });
            }}
          />
        </Labeled>
        <Labeled label={t("lecturer.create.startDate")}>
          <input
            type="date"
            className="input-base"
            value={course.startDate ?? ""}
            onChange={(e) => onChange({ startDate: e.target.value || undefined })}
          />
        </Labeled>
        <Labeled label={t("lecturer.create.endDate")}>
          <input
            type="date"
            className="input-base"
            value={course.endDate ?? ""}
            onChange={(e) => onChange({ endDate: e.target.value || undefined })}
          />
        </Labeled>
      </div>

      {!isPaid && (
        <p className="text-xs text-ink-500">
          {t("lecturer.create.access.free")} ·{" "}
          {t("lecturer.create.access.label")}
        </p>
      )}
    </div>
  );
}

function ReviewStep({
  course,
  t,
}: {
  course: LecturerCourse;
  t: (key: string) => string;
}) {
  const totalLessons = course.modules.reduce(
    (acc, m) => acc + m.lessons.length,
    0,
  );
  const slotCount = course.weeklySchedule?.length ?? 0;
  const showModulesRow =
    course.courseType === "recorded" || course.courseType === "hybrid";
  const showScheduleRow =
    course.courseType === "live" || course.courseType === "hybrid";
  return (
    <div className="grid gap-5">
      <div>
        <h2 className="text-lg font-semibold text-ink-900">
          {t("lecturer.create.review.title")}
        </h2>
        <p className="mt-1 text-sm text-ink-500">
          {t("lecturer.create.review.subtitle")}
        </p>
      </div>

      <dl className="grid gap-3 sm:grid-cols-2">
        <Row label={t("lecturer.create.title.label")} value={course.title || "—"} />
        <Row label={t("lecturer.create.category")} value={course.mainCategory ? t(`category.${course.mainCategory}`) : "—"} />
        <Row label={t("lecturer.create.level")} value={course.teachingLevel ? t(`onboard.levels.${course.teachingLevel}`) : "—"} />
        <Row label={t("lecturer.create.language")} value={course.language ? t(`onboard.languages.${course.language}`) : "—"} />
        <Row label={t("lecturer.create.type.label")} value={t(`lecturer.create.type.${course.courseType}`)} />
        <Row label={t("lecturer.create.visibility.label")} value={t(`lecturer.create.visibility.${course.visibility}`)} />
        <Row label={t("lecturer.create.access.label")} value={t(`lecturer.create.access.${course.accessType}`)} />
        <Row label={t("lecturer.create.price")} value={course.accessType === "paid" && course.price ? `LKR ${course.price.toLocaleString()}` : t("lecturer.create.access.free")} />
        {showModulesRow && (
          <Row
            label={t("lecturer.create.content.modules.title")}
            value={`${course.modules.length} ${t("lecturer.courses.modules")} · ${totalLessons} ${t("lecturer.courses.lessons")}`}
          />
        )}
        {showScheduleRow && (
          <Row
            label={t("lecturer.create.schedule.title")}
            value={
              slotCount === 0
                ? t("lecturer.create.schedule.empty")
                : `${slotCount} ${t("lecturer.create.schedule.slots")}`
            }
          />
        )}
      </dl>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-ink-200 p-3 bg-white">
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-ink-900">{value}</dd>
    </div>
  );
}

function Labeled({
  label,
  children,
  required,
  error,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
  error?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink-700 mb-1.5 block">
        {label}
        {required && <span className="text-rose-500 ml-0.5">*</span>}
      </span>
      {children}
      {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
    </label>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
  required,
  error,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  children: React.ReactNode;
  required?: boolean;
  error?: string;
}) {
  return (
    <Labeled label={label} required={required} error={error}>
      <select
        className={`input-base select-base ${error ? "border-rose-500 focus:border-rose-500" : ""}`}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </Labeled>
  );
}

function RadioCardGroup({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  const cols =
    options.length <= 2 ? "sm:grid-cols-2" : "sm:grid-cols-3";
  return (
    <div>
      <div className="text-sm font-medium text-ink-700 mb-2">{label}</div>
      <div className={`grid gap-3 ${cols}`}>
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
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-ink-900">{o.label}</span>
                {on && <CheckIcon className="h-4 w-4 text-brand-700" />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
