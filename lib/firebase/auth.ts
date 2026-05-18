"use client";

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  updateProfile,
  type User,
} from "firebase/auth";
import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { getFirebase, SUPERADMIN_EMAIL } from "./client";

export type AppRole = "admin" | "lecturer" | "student";

export type AppUserProfile = {
  uid: string;
  email: string;
  name: string;
  role: AppRole;
  createdAt?: unknown;
};

/**
 * Two-collection layout in Firestore:
 *  - admins/{uid} → platform staff (role is implicitly "admin")
 *  - users/{uid}  → students & lecturers (role explicit on the doc)
 */
const ADMINS_COLLECTION = "admins";
const USERS_COLLECTION = "users";

function isSuperadminEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase() === SUPERADMIN_EMAIL;
}

/**
 * Read the profile for a Firebase user. Admins are stored in `admins/{uid}`,
 * everyone else lives in `users/{uid}`.
 */
export async function getUserProfile(uid: string): Promise<AppUserProfile | null> {
  const { db } = getFirebase();
  const adminSnap = await getDoc(doc(db, ADMINS_COLLECTION, uid));
  if (adminSnap.exists()) {
    return { ...(adminSnap.data() as AppUserProfile), role: "admin" };
  }
  const userSnap = await getDoc(doc(db, USERS_COLLECTION, uid));
  if (userSnap.exists()) {
    const data = userSnap.data() as AppUserProfile;
    // Defensive: someone could have written role="admin" to users/{uid}
    // before we moved admins into their own collection. Treat as student.
    return { ...data, role: data.role === "admin" ? "student" : data.role };
  }
  return null;
}

/** Decide what role a freshly-signed-in account should have. */
function resolveBootstrapRole(email: string, requestedRole?: AppRole): AppRole {
  if (isSuperadminEmail(email)) return "admin";
  if (requestedRole === "lecturer") return "lecturer";
  return "student";
}

/**
 * Ensure a Firestore profile exists for the user.
 *  - Superadmin email → `admins/{uid}` (role "admin"), self-heals from `users/{uid}`.
 *  - Everyone else    → `users/{uid}` with the requested role (defaults to student).
 */
export async function ensureProfile(
  user: User,
  options?: { requestedRole?: AppRole; name?: string },
): Promise<AppUserProfile> {
  const { db } = getFirebase();
  const adminRef = doc(db, ADMINS_COLLECTION, user.uid);
  const userRef = doc(db, USERS_COLLECTION, user.uid);

  const isAdminEmail = isSuperadminEmail(user.email);

  // 1. Admin lives in `admins/{uid}`.
  const adminSnap = await getDoc(adminRef);
  if (adminSnap.exists()) {
    return { ...(adminSnap.data() as AppUserProfile), role: "admin" };
  }

  // 2. If the email is the superadmin, migrate any stale `users/{uid}` doc
  //    into `admins/{uid}` and remove the old record.
  if (isAdminEmail) {
    const staleSnap = await getDoc(userRef);
    const baseName =
      options?.name ??
      (staleSnap.exists() ? (staleSnap.data() as AppUserProfile).name : null) ??
      user.displayName ??
      user.email?.split("@")[0] ??
      "Admin";

    const adminProfile: AppUserProfile = {
      uid: user.uid,
      email: user.email ?? "",
      name: baseName,
      role: "admin",
      createdAt: serverTimestamp(),
    };
    await setDoc(adminRef, adminProfile);
    if (staleSnap.exists()) {
      try {
        await deleteDoc(userRef);
      } catch {
        // non-fatal — rules may forbid delete; the FE ignores users/{uid} for this email anyway.
      }
    }
    return adminProfile;
  }

  // 3. Otherwise the account is a student or lecturer.
  const existingUser = await getDoc(userRef);
  if (existingUser.exists()) {
    const data = existingUser.data() as AppUserProfile;
    return { ...data, role: data.role === "admin" ? "student" : data.role };
  }

  const role = resolveBootstrapRole(user.email ?? "", options?.requestedRole);
  const profile: AppUserProfile = {
    uid: user.uid,
    email: user.email ?? "",
    name: options?.name ?? user.displayName ?? user.email?.split("@")[0] ?? "User",
    role,
    createdAt: serverTimestamp(),
  };
  await setDoc(userRef, profile);
  return profile;
}

/** Sign in with email/password and return the resolved profile. */
export async function signInWithEmail(email: string, password: string) {
  const { auth } = getFirebase();
  const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
  const profile = await ensureProfile(cred.user);
  return { user: cred.user, profile };
}

/** Create a new student or lecturer account. */
export async function signUpWithEmail(input: {
  name: string;
  email: string;
  password: string;
  role: AppRole;
}) {
  const { auth } = getFirebase();
  const cred = await createUserWithEmailAndPassword(
    auth,
    input.email.trim(),
    input.password,
  );
  if (input.name) {
    try {
      await updateProfile(cred.user, { displayName: input.name });
    } catch {
      // non-fatal
    }
  }
  const profile = await ensureProfile(cred.user, {
    requestedRole: input.role,
    name: input.name,
  });
  return { user: cred.user, profile };
}

export async function signOut() {
  const { auth } = getFirebase();
  await fbSignOut(auth);
}

export function dashboardPathForRole(role: AppRole): string {
  if (role === "admin") return "/admin";
  if (role === "lecturer") return "/lecturer";
  return "/student";
}

export type AuthStateListener = (user: User | null) => void;

export function subscribeToAuth(listener: AuthStateListener) {
  const { auth } = getFirebase();
  return onAuthStateChanged(auth, listener);
}

/** Translate Firebase error codes to short, friendly messages. */
export function describeAuthError(err: unknown): string {
  const code =
    typeof err === "object" && err && "code" in err
      ? String((err as { code?: string }).code)
      : "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "Email or password is incorrect.";
    case "auth/invalid-email":
      return "That email address doesn’t look right.";
    case "auth/email-already-in-use":
      return "An account with this email already exists.";
    case "auth/weak-password":
      return "Password must be at least 6 characters.";
    case "auth/too-many-requests":
      return "Too many attempts. Try again in a few minutes.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    default:
      return err instanceof Error ? err.message : "Something went wrong.";
  }
}
