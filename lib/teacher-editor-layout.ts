/** Default only. Account metadata below is presentation, NEVER authorization. */
export function hasHorizontalTeacherEditor(profile: { username?: string | null; role?: string | null; status?: string | null } | null | undefined) {
  return profile?.username === "m.abdelhameed" && profile.role === "teacher" && profile.status === "active";
}

export type TeacherEditorLayout = "columns" | "rows";
export type EditorLayoutSyncState = "local" | "saving" | "saved" | "error" | "delegated";
type LayoutStorage = Pick<Storage, "getItem" | "setItem">;
const layoutKey = (staffId: string) => `andalus:teacher-editor-layout:v1:${staffId}`;
const metadataKey = "weekly_plan_editor_layout";
type LayoutUser = { id: string; user_metadata?: Record<string, unknown> };
type LayoutAuthResult = { data: { user: LayoutUser | null }; error: unknown };
export type EditorLayoutAuth = {
  getUser: () => Promise<LayoutAuthResult>;
  updateUser: (attributes: { data: Record<string, unknown> }) => Promise<LayoutAuthResult>;
};

function validLayout(value: unknown): value is TeacherEditorLayout { return value === "rows" || value === "columns"; }

export function readAccountEditorLayout(user: LayoutUser | null | undefined, staffId: string): TeacherEditorLayout | null {
  if (!staffId || user?.id !== staffId) return null;
  const value = user.user_metadata?.[metadataKey];
  return validLayout(value) ? value : null;
}

/** Self-service Auth API only. A partial metadata update preserves other keys. */
export async function saveAccountEditorLayout(auth: EditorLayoutAuth, staffId: string, layout: TeacherEditorLayout, onlyIfMissing = false) {
  if (!staffId || !validLayout(layout)) throw new Error("Invalid layout preference");
  const current = await auth.getUser(); // Server request: do not use a cached JWT's metadata.
  if (current.error || current.data.user?.id !== staffId) throw new Error("Layout account changed or unavailable");
  const existing = readAccountEditorLayout(current.data.user, staffId);
  // First-load migration must never replace a choice already saved by another device.
  if (existing && (onlyIfMissing || existing === layout)) return existing;
  const result = await auth.updateUser({ data: { [metadataKey]: layout } });
  if (result.error || result.data.user?.id !== staffId || readAccountEditorLayout(result.data.user, staffId) !== layout) {
    throw new Error("Account layout save was not confirmed");
  }
  return layout;
}

/** Storage is optional (private browsing / blocked storage). Never stores plan text. */
export function readTeacherEditorLayout(storage: () => LayoutStorage, staffId: string, fallback: TeacherEditorLayout): TeacherEditorLayout {
  if (!staffId) return fallback;
  try {
    const value = storage().getItem(layoutKey(staffId));
    return value === "columns" || value === "rows" ? value : fallback;
  } catch { return fallback; }
}

export function rememberTeacherEditorLayout(storage: () => LayoutStorage, staffId: string, layout: TeacherEditorLayout) {
  if (!staffId || (layout !== "columns" && layout !== "rows")) return false;
  try { storage().setItem(layoutKey(staffId), layout); return true; }
  catch { return false; }
}

export function createEditorLayoutPreference(options: {
  auth: () => EditorLayoutAuth;
  storage: () => LayoutStorage;
  onChange: (state: { layout: TeacherEditorLayout; syncState: EditorLayoutSyncState }) => void;
}) {
  type Context = { staffId: string; delegated: boolean; layout: TeacherEditorLayout; pending: boolean };
  let context: Context | null = null;
  const migrationAttempted = new Set<string>();
  function publish(active: Context, syncState: EditorLayoutSyncState) {
    if (context === active) options.onChange({ layout: active.layout, syncState });
  }
  async function save(active: Context, layout: TeacherEditorLayout, onlyIfMissing = false) {
    if (context !== active || active.pending) return false;
    active.layout = layout;
    if (active.delegated) { publish(active, "delegated"); return false; }
    rememberTeacherEditorLayout(options.storage, active.staffId, layout);
    active.pending = true;
    publish(active, "saving");
    try {
      const confirmed = await saveAccountEditorLayout(options.auth(), active.staffId, layout, onlyIfMissing);
      if (context !== active) return false;
      active.layout = confirmed;
      rememberTeacherEditorLayout(options.storage, active.staffId, confirmed);
      publish(active, "saved");
      return true;
    } catch {
      publish(active, "error"); // Local display remains usable; never imply a successful sync.
      return false;
    } finally { active.pending = false; }
  }
  return {
    initialize(input: { staffId: string; user: LayoutUser; defaultLayout: TeacherEditorLayout; delegated: boolean }) {
      if (context?.staffId === input.staffId && context.delegated === input.delegated && context.pending) return;
      const cloud = input.delegated ? null : readAccountEditorLayout(input.user, input.staffId);
      let cached: TeacherEditorLayout | null = null;
      try {
        const value = options.storage().getItem(layoutKey(input.staffId));
        if (validLayout(value)) cached = value;
      } catch { /* Cloud preferences do not require browser storage. */ }
      const active: Context = { staffId: input.staffId, delegated: input.delegated, layout: cloud ?? cached ?? input.defaultLayout, pending: false };
      context = active;
      if (cloud) rememberTeacherEditorLayout(options.storage, input.staffId, cloud);
      publish(active, input.delegated ? "delegated" : cloud ? "saved" : "local");
      if (!input.delegated && !cloud && cached && !migrationAttempted.has(input.staffId)) {
        migrationAttempted.add(input.staffId);
        void save(active, cached, true);
      }
    },
    choose(layout: TeacherEditorLayout) {
      return context && validLayout(layout) ? save(context, layout) : Promise.resolve(false);
    },
    dispose() { context = null; },
  };
}
