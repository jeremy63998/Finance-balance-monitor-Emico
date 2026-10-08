import { createFileRoute } from "@tanstack/react-router";
import { requireAppAuth } from "@/lib/app-auth";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/data/cash")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { tenantCode } = await requireAppAuth(request, {
            feature: ["cash", "transactions", "dashboard", "reconciliation"],
          });
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin
            .from("cash_transactions" as any)
            .select("*")
            .eq("tenant_code", tenantCode)
            .order("txn_date", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(1000);
          if (error) return json({ error: error.message }, 500);
          return json({ rows: data ?? [] });
        } catch (e) {
          if (e instanceof Response) return e;
          return json({ error: String(e) }, 500);
        }
      },
      POST: async ({ request }) => {
        try {
          const { tenantCode, email, claims } = await requireAppAuth(request, {
            feature: ["cash", "facility_transactions"],
          });
          const body = (await request.json()) as any;
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          // Correction: if supersedes_id provided, mark original as superseded
          if (body.supersedes_id) {
            await supabaseAdmin
              .from("cash_transactions" as any)
              .update({ is_superseded: true } as any)
              .eq("id", body.supersedes_id)
              .eq("tenant_code", tenantCode);
          }

          const insert = {
            tenant_code: tenantCode,
            txn_date: body.txn_date,
            txn_type: body.txn_type,
            amount: Number(body.amount),
            bank_account_name: body.bank_account_name,
            bank_account_number: body.bank_account_number || null,
            currency: body.currency || "MYR",
            remarks: body.remarks || null,
            entered_by: (claims.name as string) || email || null,
            entered_by_email: email || null,
            supersedes_id: body.supersedes_id || null,
          };
          const { data, error } = await supabaseAdmin
            .from("cash_transactions" as any)
            .insert(insert as any)
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
          const { tenantCode } = await requireAppAuth(request, {
            feature: ["transactions", "cash"],
          });
          const url = new URL(request.url);
          const id = url.searchParams.get("id");
          if (!id) return json({ error: "Missing id" }, 400);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          // If this row was a correction, restore the original it superseded
          const { data: row } = await supabaseAdmin
            .from("cash_transactions" as any)
            .select("supersedes_id")
            .eq("id", id)
            .eq("tenant_code", tenantCode)
            .maybeSingle();
          const { error } = await supabaseAdmin
            .from("cash_transactions" as any)
            .delete()
            .eq("id", id)
            .eq("tenant_code", tenantCode);
          if (error) return json({ error: error.message }, 500);
          const supersedesId = (row as any)?.supersedes_id;
          if (supersedesId) {
            await supabaseAdmin
              .from("cash_transactions" as any)
              .update({ is_superseded: false } as any)
              .eq("id", supersedesId)
              .eq("tenant_code", tenantCode);
          }
          return json({ ok: true });
        } catch (e) {
          if (e instanceof Response) return e;
          return json({ error: String(e) }, 500);
        }
      },
    },
  },
});
