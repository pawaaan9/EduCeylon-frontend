import { apiGet, apiPut } from "@/lib/api/client";
import type {
  SaveStudyLogPayload,
  StudentJournalSummary,
  StudentStudyLogEntry,
} from "@/lib/student/journal";

export async function fetchStudentJournal(
  token: string,
  year: number,
  month: number,
): Promise<StudentJournalSummary> {
  const params = new URLSearchParams({
    year: String(year),
    month: String(month),
  });
  return apiGet<StudentJournalSummary>(`/students/me/journal?${params}`, {
    token,
  });
}

export async function saveStudentStudyLog(
  token: string,
  payload: SaveStudyLogPayload,
): Promise<StudentStudyLogEntry> {
  return apiPut<StudentStudyLogEntry>("/students/me/journal/log", {
    token,
    json: payload,
  });
}
