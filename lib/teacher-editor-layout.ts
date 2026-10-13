/** Presentation only. The authenticated/delegated profile still controls all data permissions. */
export function hasHorizontalTeacherEditor(profile: { username?: string | null; role?: string | null; status?: string | null } | null | undefined) {
  return profile?.username === "m.abdelhameed" && profile.role === "teacher" && profile.status === "active";
}
