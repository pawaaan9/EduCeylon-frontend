import { Suspense } from "react";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getPublicCourseBySlug } from "@/lib/server/public-courses";
import { CourseDetailClient } from "./CourseDetailClient";

export const dynamic = "force-dynamic";

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getPublicCourseBySlug(slug);
  if (!result) return notFound();

  return (
    <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <nav className="text-sm text-ink-500 mb-6">
        <Link href="/" className="hover:text-ink-900">
          Home
        </Link>
        <span className="mx-2">/</span>
        <Link href="/courses" className="hover:text-ink-900">
          Courses
        </Link>
      </nav>
      <Suspense
        fallback={
          <div className="flex min-h-[320px] items-center justify-center">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-brand-200 border-t-brand-600" />
          </div>
        }
      >
        <CourseDetailClient course={result.course} lecturer={result.lecturer} />
      </Suspense>
    </div>
  );
}
