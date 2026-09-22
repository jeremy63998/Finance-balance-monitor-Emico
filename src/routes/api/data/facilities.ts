import { createFileRoute } from "@tanstack/react-router";
import { requireAppAuth } from "@/lib/app-auth";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/data/facilities")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { tenantCode } = await requireAppAuth(request, { feature: ["facilities", "facility_list", "facility_transactions", "facility_history", "dashboard"] });
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin
            .from("facilities" as any)
            .select("*")
            .eq("tenant_code", tenantCode)
            .order("created_at", { ascending: false });
          if (error) return json({ error: error.message }, 500);
          return json({ rows: data ?? [] });
        } catch (e) {
          if (e instanceof Response) return e;
          return json({ error: String(e) }, 500);
        }
      },
      POST: async ({ request }) => {
        try {
          const { tenantCode, email, claims } = await requireAppAuth(request, { feature: ["facilities"] });
          const body = (await request.json()) as any;
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const record = {
            tenant_code: tenantCode,
            name: body.name,
            lending_bank: body.lending_bank,
            facility_type: body.facility_type,
            total_limit: Number(body.total_limit || 0),
            amount_drawn: Number(body.amount_drawn || 0),
            amount_repaid: Number(body.amount_repaid || 0),
            maturity_date: body.maturity_date || null,
            interest_rate: body.interest_rate === "" || body.interest_rate == null ? null : Number(body.interest_rate),
            currency: body.currency || "MYR",
            status: body.status || "active",
            remarks: body.remarks || null,
            entered_by: (claims.name as string) || email || null,
            entered_by_email: email || null,
          };

          if (body.id) {
            const { data, error } = await supabaseAdmin
              .from("facilities" as any)
              .update(record as any)
              .eq("id", body.id)
              .eq("tenant_code", tenantCode)
              .select()
              .single();
            if (error) return json({ error: error.message }, 500);
            return json({ row: data });
          } else {
            const { data, error } = await supabaseAdmin
              .from("facilities" as any)
              .insert(record as any)
              .select()
              .single();
            if (error) return json({ error: error.message }, 500);
            return json({ row: data });
          }
        } catch (e) {
          if (e instanceof Response) return e;
          return json({ error: String(e) }, 500);
        }
      },
    },
  },
});
