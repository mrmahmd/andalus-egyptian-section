import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set(["https://mrmahmd.github.io", "http://127.0.0.1:3000", "http://localhost:3000"]);

function corsHeaders(origin: string | null) {
  return {
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://mrmahmd.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function json(body: Record<string, string>, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(origin), "Content-Type": "application/json" } });
}

function defaultKeyFromMap(name: string) {
  try {
    const keys = JSON.parse(Deno.env.get(name) ?? "{}") as Record<string, string>;
    return keys.default ?? Object.values(keys)[0] ?? "";
  } catch {
    return "";
  }
}

Deno.serve(async (request) => {
  const origin = request.headers.get("Origin");
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(origin) });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, origin);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401, origin);

  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    // Supabase projects created with the newer API key model use SB_* names,
    // while older projects expose the SUPABASE_* equivalents.
    // Prefer the current hosted key maps. A legacy variable can still exist
    // while being empty or retired in newer Supabase projects.
    const publishableKey = defaultKeyFromMap("SUPABASE_PUBLISHABLE_KEYS") || Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SB_PUBLISHABLE_KEY") || "";
    const serviceRoleKey = defaultKeyFromMap("SUPABASE_SECRET_KEYS") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("SB_SECRET_KEY") || "";
    if (!url || !publishableKey || !serviceRoleKey) {
      return json({ error: "The password-reset function is missing its secure Supabase configuration." }, 500, origin);
    }
    // Use the caller's own JWT for the permission check. This follows the
    // same RLS-protected profile lookup that the Super Admin dashboard uses.
    const callerClient = createClient(url, publishableKey, {
      global: { headers: { Authorization: authorization } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: callerData, error: callerError } = await callerClient.auth.getUser(authorization.slice("Bearer ".length));
    if (callerError || !callerData.user) return json({ error: "Unauthorized" }, 401, origin);

    const { data: callerProfile, error: callerProfileError } = await callerClient.from("profiles").select("role, status").eq("user_id", callerData.user.id).maybeSingle();
    if (callerProfileError) return json({ error: "The Super Admin profile could not be verified. Please try again." }, 500, origin);
    if (!callerProfile) return json({ error: "Your signed-in account does not have a school profile." }, 403, origin);
    if (callerProfile.role !== "super_admin" || callerProfile.status !== "active") return json({ error: "Only the active Super Admin can reset staff passwords." }, 403, origin);

    const adminClient = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { targetUserId, password } = await request.json();
    if (typeof targetUserId !== "string" || typeof password !== "string" || password.length < 8 || password.length > 128) return json({ error: "A temporary password must be 8 to 128 characters." }, 400, origin);
    if (targetUserId === callerData.user.id) return json({ error: "Use account recovery for the Super Admin account." }, 400, origin);

    // The active Super Admin's JWT is RLS-authorized to read the real staff
    // directory. Keep this check on that trusted session; the admin client is
    // then used only for Supabase Auth's password update operation.
    const { data: targetProfile, error: targetError } = await callerClient.from("profiles").select("role").eq("user_id", targetUserId).maybeSingle();
    if (targetError || !targetProfile || !["teacher", "admin"].includes(targetProfile.role)) return json({ error: "This staff account cannot be reset." }, 404, origin);

    const { error: updateError } = await adminClient.auth.admin.updateUserById(targetUserId, { password });
    if (updateError) return json({ error: updateError.message }, 400, origin);
    return json({ message: "Temporary password updated." }, 200, origin);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Password reset failed." }, 500, origin);
  }
});
