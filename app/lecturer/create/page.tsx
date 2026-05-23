"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { CourseEditor } from "@/components/course/CourseEditor";

function CreateCourseContent() {
  const searchParams = useSearchParams();
  const courseId = searchParams.get("id") ?? undefined;
  const startNew = searchParams.get("new") === "1";
  return <CourseEditor courseId={courseId} startNew={startNew} />;
}

export default function CreateCoursePage() {
  return (
    <Suspense
      fallback={
        <div className="card p-10 text-center text-sm text-ink-500">Loading…</div>
      }
    >
      <CreateCourseContent />
    </Suspense>
  );
}
