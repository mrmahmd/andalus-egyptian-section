import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "https://mrmahmd.github.io",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, string>, status: number) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  try {
    const url = Deno.env.get("SUPABASE_URL") ?? "";
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const callerClient = createClient(url, publishableKey);
    const { data: callerData, error: callerError } = await callerClient.auth.getUser(authorization.slice("Bearer ".length));
    if (callerError || !callerData.user) return json({ error: "Unauthorized" }, 401);

    const adminClient = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: callerProfile, error: callerProfileError } = await adminClient.from("profiles").select("role, status").eq("user_id", callerData.user.id).maybeSingle();
    if (callerProfileError || callerProfile?.role !== "super_admin" || callerProfile.status !== "active") return json({ error: "Only the active Super Admin can reset staff passwords." }, 403);

    const { targetUserId, password } = await request.json();
    if (typeof targetUserId !== "string" || typeof password !== "string" || password.length < 8 || password.length > 128) return json({ error: "A temporary password must be 8 to 128 characters." }, 400);
    if (targetUserId === callerData.user.id) return json({ error: "Use account recovery for the Super Admin account." }, 400);

    const { data: targetProfile, error: targetError } = await adminClient.from("profiles").select("role").eq("user_id", targetUserId).maybeSingle();
    if (targetError || !targetProfile || !["teacher", "admin"].includes(targetProfile.role)) return json({ error: "This staff account cannot be reset." }, 404);

    const { error: updateError } = await adminClient.auth.admin.updateUserById(targetUserId, { password });
    if (updateError) return json({ error: updateError.message }, 400);
    return json({ message: "Temporary password updated." }, 200);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Password reset failed." }, 500);
  }
});
