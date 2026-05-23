import type { LecturerCourse } from "@/lib/courses/types";

export type BasicsFieldKey =
  | "title"
  | "description"
  | "mainCategory"
  | "teachingLevel"
  | "language"
  | "thumbnailURL";

export type BasicsFieldErrors = Partial<Record<BasicsFieldKey, string>>;

export function validateBasicsStep(
  course: LecturerCourse,
  t: (key: string) => string,
): BasicsFieldErrors {
  const errors: BasicsFieldErrors = {};

  if (!course.title.trim()) {
    errors.title = t("lecturer.create.validation.titleRequired");
  }

  const desc = course.description?.trim() ?? "";
  if (!desc) {
    errors.description = t("lecturer.create.validation.descriptionRequired");
  }

  if (!course.mainCategory) {
    errors.mainCategory = t("lecturer.create.validation.categoryRequired");
  }

  if (!course.teachingLevel) {
    errors.teachingLevel = t("lecturer.create.validation.levelRequired");
  }

  if (!course.language) {
    errors.language = t("lecturer.create.validation.languageRequired");
  }

  if (!course.thumbnailURL) {
    errors.thumbnailURL = t("lecturer.create.validation.thumbnailRequired");
  }

  return errors;
}

export function isBasicsStepComplete(
  course: LecturerCourse,
  opts?: { pendingThumbnail?: boolean },
): boolean {
  const desc = course.description?.trim() ?? "";
  const hasThumbnail = !!course.thumbnailURL || !!opts?.pendingThumbnail;
  return (
    !!course.title.trim() &&
    desc.length > 0 &&
    !!course.mainCategory &&
    !!course.teachingLevel &&
    !!course.language &&
    hasThumbnail
  );
}

export function basicsErrorSummary(errors: BasicsFieldErrors): string[] {
  return Object.values(errors).filter(Boolean) as string[];
}
