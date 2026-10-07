import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseBrowserClient } from "./client";

export function delegatedStaffId() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("staff") ?? "";
}

let delegatedClient: SupabaseClient | null = null;
let delegatedTarget = "";

/** Only this workspace uses delegation. The real Auth session is never replaced. */
export function getStaffWorkspaceClient() {
  const target = delegatedStaffId();
  if (!target) return getSupabaseBrowserClient();
  if (delegatedClient && delegatedTarget === target) return delegatedClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  delegatedTarget = target;
  delegatedClient = createClient(url, key, {
    accessToken: async () => {
      const { data, error } = await getSupabaseBrowserClient().auth.getSession();
      if (error || !data.session) throw new Error("Super Admin session required.");
      return data.session.access_token;
    },
    global: {
      fetch: async (input, init) => {
        const requestUrl = new URL(String(input));
        const method = (init?.method ?? "GET").toUpperCase();
        if (requestUrl.pathname.startsWith("/rest/v1/rpc/")) {
          const operation = requestUrl.pathname.split("/").pop();
          if (method !== "POST") throw new Error("Delegated operations require POST.");
          return fetch(`${url}/rest/v1/rpc/super_admin_staff_action`, {
            ...init,
            body: JSON.stringify({ target_user_id: target, operation, payload: JSON.parse(String(init?.body ?? "{}")) }),
          });
        }
        // Never let a new/unhandled write silently use the Super Admin's broad RLS rights.
        if (!["GET", "HEAD"].includes(method)) {
          throw new Error("Use the audited workspace action. Account and assignment changes belong in Super Admin settings.");
        }
        return fetch(input, init);
      },
    },
  });
  return delegatedClient;
}
