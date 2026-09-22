import { createFileRoute } from "@tanstack/react-router";
import { requireAppAuth, requireAdminAuth } from "@/lib/app-auth";
import {
  TENANT_CODE,
  isAllowedEmail,
  isAdminEmail,
  FEATURES,
  type FeatureKey,
  type PermissionLevel,
  type Permissions,
} from "@/lib/tenant";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const FEATURE_KEYS = new Set<string>(FEATURES.map((f) => f.key));
const READ_ONLY = new Set<string>(FEATURES.filter((f) => f.readOnly).map((f) => f.key));

function sanitizePermissions(input: any): Permissions {
  const out: Permissions = {};
  if (!input || typeof input !== "object") return out;
  for (const [key, value] of Object.entries(input)) {
    if (!FEATURE_KEYS.has(key)) continue;
    let level = value as PermissionLevel;
    if (level !== "none" && level !== "view" && level !== "edit") continue;
    if (READ_ONLY.has(key) && level === "edit") level = "view";
    out[key as FeatureKey] = level;
  }
  return out;
}

export const Route = createFileRoute("/api/data/app-access")({
  server: {
    handlers: {
      // ?self=1 -> lightweight check the app shell uses to detect revoked
      // access and to learn which features this account may use.
      GET: async ({ request }) => {
        const self = new URL(request.url).searchParams.get("self") === "1";
        try {
          if (self) {
            const auth = await requireAppAuth(request);
            return json({ active: true, isAdmin: auth.isAdmin, permissions: auth.permissions });
          }
          const { tenantCode } = await requireAdminAuth(request);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin
            .from("app_access" as any)
            .select("*")
            .eq("tenant_code", tenantCode)
            .order("email", { ascending: true });
          if (error) return json({ error: error.message }, 500);
          return json({ rows: data ?? [] });
        } catch (e) {
          if (e instanceof Response) {
            if (self && e.status === 403) return json({ active: false });
            return e;
          }
          return json({ error: String(e) }, 500);
        }
      },
      POST: async ({ request }) => {
        try {
          const { tenantCode, email: actor } = await requireAdminAuth(request);
          const body = (await request.json()) as any;
          const target = String(body.email || "").trim().toLowerCase();
          if (!target) return json({ error: "Email is required" }, 400);
          if (!isAllowedEmail(target)) return json({ error: "Email must be a workspace account" }, 400);
          if (isAdminEmail(target) && body.is_active === false) {
            return json({ error: "The administrator account cannot be revoked" }, 400);
          }
          if (target === actor && body.is_active === false) {
            return json({ error: "You cannot revoke your own access" }, 400);
          }

          const isActive = body.is_active !== false;
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const record: Record<string, unknown> = {
            tenant_code: tenantCode || TENANT_CODE,
            email: target,
            is_active: isActive,
            revoked_at: isActive ? null : new Date().toISOString(),
            revoked_by_email: isActive ? null : actor,
          };
          if ("note" in body) record.note = body.note || null;
          if (body.permissions !== undefined) {
            record.permissions = isAdminEmail(target) ? {} : sanitizePermissions(body.permissions);
          }

          const { data, error } = await supabaseAdmin
            .from("app_access" as any)
            .upsert(record as any, { onConflict: "tenant_code,email" })
            .select()
            .single();
          if (error) return json({ error: error.message }, 500);
          return json({ row: data });
        } catch (e) {
          if (e instanceof Response) return e;
          return json({ error: String(e) }, 500);
        }
      },
    },
  },
});
