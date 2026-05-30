import { CourseStudyClient } from "./CourseStudyClient";

export default async function CourseStudyPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return (
    <div className="-mx-4 -mt-6 sm:-mx-6 lg:-mx-8 lg:-mt-8">
      <CourseStudyClient slug={slug} />
    </div>
  );}
