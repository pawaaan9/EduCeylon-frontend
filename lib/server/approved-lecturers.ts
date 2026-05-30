import "server-only";

import type { Lecturer } from "@/lib/data/types";
import { listAllLecturerProfiles } from "./admin-lecturers";
import { profileToPublicLecturer } from "./public-lecturers";

export async function approvedLecturerMap(): Promise<Map<string, Lecturer>> {
  const profiles = await listAllLecturerProfiles();
  const map = new Map<string, Lecturer>();
  for (const profile of profiles) {
    if (profile.approvalStatus !== "approved") continue;
    map.set(profile.uid, profileToPublicLecturer(profile));
  }
  return map;
}
