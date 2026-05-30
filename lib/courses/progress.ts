export function computeProgressPercent(
  totalLessons: number,
  completedLessonIds: readonly string[],
): number {
  if (totalLessons <= 0) return 0;
  const done = Math.min(new Set(completedLessonIds).size, totalLessons);
  return Math.round((done / totalLessons) * 100);
}

export function countCompletedLessons(
  totalLessons: number,
  completedLessonIds: readonly string[],
): number {
  if (totalLessons <= 0) return 0;
  return Math.min(new Set(completedLessonIds).size, totalLessons);
}
