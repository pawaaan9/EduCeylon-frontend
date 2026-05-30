type QuizRef = { id: string; questions: readonly unknown[] };

type ReqLesson = { id: string; quiz?: QuizRef };

type ReqModule = { id: string; lessons: ReqLesson[]; quiz?: QuizRef };

function quizHasQuestions(quiz: QuizRef | undefined): quiz is QuizRef {
  return (quiz?.questions?.length ?? 0) > 0;
}

function findLessonContext(
  modules: ReqModule[],
  lessonId: string,
):
  | {
      mod: ReqModule;
      lesson: ReqLesson;
      isLastInModule: boolean;
      isLastInCourse: boolean;
    }
  | undefined {
  for (let mi = 0; mi < modules.length; mi++) {
    const mod = modules[mi];
    for (let li = 0; li < mod.lessons.length; li++) {
      if (mod.lessons[li].id !== lessonId) continue;
      const isLastInModule = li === mod.lessons.length - 1;
      const isLastInCourse =
        mi === modules.length - 1 && li === mod.lessons.length - 1;
      return { mod, lesson: mod.lessons[li], isLastInModule, isLastInCourse };
    }
  }
  return undefined;
}

function lessonQuizIds(lesson: ReqLesson): string[] {
  if (!quizHasQuestions(lesson.quiz)) return [];
  return [lesson.quiz.id];
}

/** Quiz IDs a student must submit before marking a lesson complete. */
export function getLessonRequiredQuizIds(
  modules: ReqModule[],
  finalQuiz: QuizRef | undefined,
  lessonId: string,
): string[] {
  const ctx = findLessonContext(modules, lessonId);
  if (!ctx) return [];

  const ids = [...lessonQuizIds(ctx.lesson)];

  if (ctx.isLastInModule && quizHasQuestions(ctx.mod.quiz)) {
    ids.push(ctx.mod.quiz.id);
  }
  if (ctx.isLastInCourse && quizHasQuestions(finalQuiz)) {
    ids.push(finalQuiz.id);
  }

  return ids;
}

/** Quiz IDs required before marking an entire module complete. */
export function getModuleRequiredQuizIds(
  modules: ReqModule[],
  finalQuiz: QuizRef | undefined,
  moduleId: string,
): string[] {
  const mod = modules.find((m) => m.id === moduleId);
  if (!mod) return [];

  const ids: string[] = [];
  for (const lesson of mod.lessons) {
    ids.push(...lessonQuizIds(lesson));
  }
  if (quizHasQuestions(mod.quiz)) {
    ids.push(mod.quiz.id);
  }

  const lastMod = modules[modules.length - 1];
  if (lastMod?.id === moduleId && quizHasQuestions(finalQuiz)) {
    ids.push(finalQuiz.id);
  }

  return ids;
}

export function pendingQuizIds(
  requiredQuizIds: string[],
  attempts: Record<string, unknown>,
): string[] {
  return requiredQuizIds.filter((id) => !attempts[id]);
}

export function canMarkLessonComplete(
  modules: ReqModule[],
  finalQuiz: QuizRef | undefined,
  lessonId: string,
  attempts: Record<string, unknown>,
): boolean {
  return (
    pendingQuizIds(
      getLessonRequiredQuizIds(modules, finalQuiz, lessonId),
      attempts,
    ).length === 0
  );
}

export function canMarkModuleComplete(
  modules: ReqModule[],
  finalQuiz: QuizRef | undefined,
  moduleId: string,
  attempts: Record<string, unknown>,
): boolean {
  return (
    pendingQuizIds(
      getModuleRequiredQuizIds(modules, finalQuiz, moduleId),
      attempts,
    ).length === 0
  );
}
