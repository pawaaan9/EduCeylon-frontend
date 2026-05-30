import type {
  CourseReview,
  CourseReviewsPayload,
} from "@/lib/data/types";
import { apiGet, apiPost } from "./client";

export function fetchCourseReviews(slug: string): Promise<CourseReviewsPayload> {
  return apiGet<CourseReviewsPayload>(`/courses/${slug}/reviews`);
}

export function fetchMyCourseReviews(
  token: string,
  slug: string,
): Promise<CourseReview[]> {
  return apiGet<CourseReview[]>(`/students/me/courses/${slug}/review`, {
    token,
  });
}

export function saveMyCourseReview(
  token: string,
  slug: string,
  payload: { rating: number; comment: string },
): Promise<CourseReview> {
  return apiPost<CourseReview>(`/students/me/courses/${slug}/review`, {
    token,
    json: payload,
  });
}
