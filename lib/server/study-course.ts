import "server-only";

import { resolveCourseSlug } from "@/lib/courses/slug";
import { ensureQuiz } from "@/lib/courses/quiz";
import { toStudyQuiz } from "@/lib/courses/quiz-student";
import type { LecturerCourse } from "@/lib/courses/types";
import type { Lecturer, Localized, StudyCourse } from "@/lib/data/types";
import { approvedLecturerMap } from "./approved-lecturers";
import { isStudentEnrolled } from "./enrollments";
import { lecturerCourseToPublic, listPublishedCoursesRaw } from "./public-courses";

function localized(text: string): Localized {
  return { en: text, si: text, ta: text };
}

function lecturerCourseToStudy(
  course: LecturerCourse,
  lecturer: Lecturer | null,
): StudyCourse {
  const publicCourse = lecturerCourseToPublic(course, lecturer);
  const description = course.description?.trim() || course.subtitle?.trim() || "";

  return {
    id: course.id,
    slug: publicCourse.slug,
    title: publicCourse.title,
    longDescription: localized(description),
    thumbnailGradient: publicCourse.thumbnailGradient,
    thumbnailURL: course.thumbnailURL,
    lecturer: publicCourse.lecturer,
    modules: course.modules.map((mod) => ({
      id: mod.id,
      title: localized(mod.title || "Module"),
      quiz:
        mod.quiz && mod.quiz.questions.length > 0
          ? toStudyQuiz(ensureQuiz(mod.quiz))
          : undefined,
      lessons: mod.lessons.map((lesson) => ({
        id: lesson.id,
        type: lesson.type,
        title: localized(lesson.title || "Lesson"),
        durationMin: lesson.durationMinutes ?? 0,
        videoURL: lesson.videoURL,
        pdfURL: lesson.pdfURL,
        externalURL: lesson.externalURL,
        quiz:
          lesson.quiz && lesson.quiz.questions.length > 0
            ? toStudyQuiz(ensureQuiz(lesson.quiz))
            : lesson.type === "quiz" && lesson.quiz
              ? toStudyQuiz(ensureQuiz(lesson.quiz))
              : undefined,
      })),
    })),
    finalQuiz:
      course.finalQuiz && course.finalQuiz.questions.length > 0
        ? toStudyQuiz(ensureQuiz(course.finalQuiz))
        : undefined,
  };
}

export async function getEnrolledStudyCourseBySlug(
  studentId: string,
  slug: string,
): Promise<StudyCourse | null> {
  const raw = await getEnrolledRawCourseBySlug(studentId, slug);
  if (!raw) return null;

  const lecturers = await approvedLecturerMap();
  const lecturer = lecturers.get(raw.lecturerId) ?? null;
  return lecturerCourseToStudy(raw, lecturer);
}

export async function getEnrolledRawCourseBySlug(
  studentId: string,
  slug: string,
) {
  const courses = await listPublishedCoursesRaw();
  const raw = courses.find((c) => resolveCourseSlug(c) === slug);
  if (!raw) return null;

  const enrolled = await isStudentEnrolled(studentId, raw.id);
  if (!enrolled) return null;

  return raw;
}
