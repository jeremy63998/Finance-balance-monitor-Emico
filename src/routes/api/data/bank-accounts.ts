import { createFileRoute } from "@tanstack/react-router";
import { requireAppAuth } from "@/lib/app-auth";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/data/bank-accounts")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { tenantCode } = await requireAppAuth(request, { feature: ["bank_accounts", "cash", "dashboard"] });
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin
            .from("bank_accounts" as any)
            .select("*")
            .eq("tenant_code", tenantCode)
            .order("bank_name", { ascending: true })
            .order("account_name", { ascending: true });
          if (error) return json({ error: error.message }, 500);
          return json({ rows: data ?? [] });
        } catch (e) {
          if (e instanceof Response) return e;
          return json({ error: String(e) }, 500);
        }
      },
      POST: async ({ request }) => {
        try {
          const { tenantCode, email, claims } = await requireAppAuth(request, { feature: ["bank_accounts", "cash", "dashboard"] });
          const body = (await request.json()) as any;
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const record = {
            tenant_code: tenantCode,
            bank_name: body.bank_name,
            account_name: body.account_name,
            account_number: body.account_number,
            currency: (body.currency || "MYR").toUpperCase(),
            is_active: body.is_active !== false,
            remarks: body.remarks || null,
            overdraft_limit: Number(body.overdraft_limit) > 0 ? Number(body.overdraft_limit) : 0,
            entered_by: (claims.name as string) || email || null,
            entered_by_email: email || null,
          };


          if (body.id) {
            const { data, error } = await supabaseAdmin
              .from("bank_accounts" as any)
              .update(record as any)
              .eq("id", body.id)
              .eq("tenant_code", tenantCode)
              .select()
              .single();
            if (error) return json({ error: error.message }, 500);
            return json({ row: data });
          }
          const { data, error } = await supabaseAdmin
            .from("bank_accounts" as any)
            .insert(record as any)
            .select()
            .single();
          if (error) return json({ error: error.message }, 500);
          return json({ row: data });
        } catch (e) {
          if (e instanceof Response) return e;
          return json({ error: String(e) }, 500);
        }
      },
      DELETE: async ({ request }) => {
        try {
          const { tenantCode } = await requireAppAuth(request, { feature: ["bank_accounts", "cash", "dashboard"] });
          const url = new URL(request.url);
          const id = url.searchParams.get("id");
          if (!id) return json({ error: "Missing id" }, 400);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { error } = await supabaseAdmin
            .from("bank_accounts" as any)
            .delete()
            .eq("id", id)
            .eq("tenant_code", tenantCode);
          if (error) return json({ error: error.message }, 500);
          return json({ ok: true });
        } catch (e) {
          if (e instanceof Response) return e;
          return json({ error: String(e) }, 500);
        }
      },
    },
  },
});
