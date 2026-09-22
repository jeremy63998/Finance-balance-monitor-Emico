// Server-only auth helper. Verifies the Lovable Cloud (Supabase) access token
// on API route requests and enforces the Google Workspace domain lock.
import { createClient } from "@supabase/supabase-js";
import {
  ALLOWED_EMAIL_DOMAIN,
  TENANT_CODE,
  isAllowedEmail,
  isAdminEmail,
  canEdit,
  canView,
  type FeatureKey,
  type Permissions,
} from "./tenant";

export type AppAuth = {
  userId: string;
  email: string;
  tenantCode: string;
  isAdmin: boolean;
  permissions: Permissions;
  claims: Record<string, unknown>;
};

/** `feature` may list several keys — access is granted if ANY of them allows it. */
export type FeatureGuard = { feature: FeatureKey | FeatureKey[]; method?: string };

export async function requireAppAuth(request: Request, guard?: FeatureGuard): Promise<AppAuth> {
  const header = request.headers.get("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token) throw new Response("Unauthorized", { status: 401 });

  const supabase = createClient(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new Response("Unauthorized", { status: 401 });

  const email = String(data.user.email || "").toLowerCase();
  if (!isAllowedEmail(email)) {
    throw new Response(`Access restricted to @${ALLOWED_EMAIL_DOMAIN} accounts`, { status: 403 });
  }

  // Access control list: an email that has been revoked (e.g. the person left
  // and the workspace mailbox is no longer in use) loses access immediately,
  // even if they still hold a valid session on one of their devices.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: access } = await supabaseAdmin
    .from("app_access" as any)
    .select("is_active, permissions")
    .eq("tenant_code", TENANT_CODE)
    .eq("email", email)
    .maybeSingle();

  if (access && (access as any).is_active === false) {
    throw new Response("This account's access has been revoked", { status: 403 });
  }
  if (!access) {
    // First time we see this email — record it so it can be managed later.
    await supabaseAdmin
      .from("app_access" as any)
      .upsert(
        { tenant_code: TENANT_CODE, email, is_active: true } as any,
        { onConflict: "tenant_code,email" },
      );
  }

  const isAdmin = isAdminEmail(email);
  const permissions = ((access as any)?.permissions ?? {}) as Permissions;

  if (guard) {
    const needsEdit = (guard.method || request.method || "GET").toUpperCase() !== "GET";
    const keys = Array.isArray(guard.feature) ? guard.feature : [guard.feature];
    const ok = keys.some((key) =>
      needsEdit ? canEdit(permissions, key, isAdmin) : canView(permissions, key, isAdmin),
    );
    if (!ok) {
      throw new Response(
        needsEdit
          ? "You have view-only access to this section"
          : "You don't have access to this section",
        { status: 403 },
      );
    }
  }

  return {
    userId: data.user.id,
    email,
    tenantCode: TENANT_CODE,
    isAdmin,
    permissions,
    claims: {
      name: (data.user.user_metadata?.full_name as string) || (data.user.user_metadata?.name as string) || email,
      email,
    },
  };
}

/** Only the prime administrator may manage access and permissions. */
export async function requireAdminAuth(request: Request): Promise<AppAuth> {
  const auth = await requireAppAuth(request);
  if (!auth.isAdmin) {
    throw new Response("Only the administrator can manage access", { status: 403 });
  }
  return auth;
}
