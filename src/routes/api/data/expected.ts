import { createFileRoute } from "@tanstack/react-router";
import { requireAppAuth } from "@/lib/app-auth";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/data/expected")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { tenantCode } = await requireAppAuth(request, {
            feature: ["expected", "dashboard"],
          });
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin
            .from("expected_transactions" as any)
            .select("*")
            .eq("tenant_code", tenantCode)
            .order("due_date", { ascending: true })
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
          const { tenantCode, email, claims } = await requireAppAuth(request, { feature: "expected" });
          const body = (await request.json()) as any;
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const insert = {
            tenant_code: tenantCode,
            direction: body.direction === "payable" ? "payable" : "receivable",
            due_date: body.due_date,
            amount: Number(body.amount),
            currency: body.currency || "MYR",
            counterparty: body.counterparty || null,
            bank_account_id: body.bank_account_id || null,
            bank_account_name: body.bank_account_name || null,
            bank_account_number: body.bank_account_number || null,
            status: "pending",
            remarks: body.remarks || null,
            entered_by: (claims.name as string) || email || null,
            entered_by_email: email || null,
          };
          const { data, error } = await supabaseAdmin
            .from("expected_transactions" as any)
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
      PUT: async ({ request }) => {
        try {
          const { tenantCode, email, claims } = await requireAppAuth(request, { feature: "expected" });
          const body = (await request.json()) as any;
          if (!body.id) return json({ error: "Missing id" }, 400);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: existing } = await supabaseAdmin
            .from("expected_transactions" as any)
            .select("*")
            .eq("id", body.id)
            .eq("tenant_code", tenantCode)
            .maybeSingle();
          if (!existing) return json({ error: "Not found" }, 404);
          const row = existing as any;

          // Mark as settled: post the matching cash transaction.
          if (body.action === "settle") {
            if (row.status === "settled") return json({ row });
            const bankName = body.bank_account_name || row.bank_account_name;
            const bankNumber = body.bank_account_number ?? row.bank_account_number;
            if (!bankName) return json({ error: "Select a bank account to settle into" }, 400);
            const { data: cashRow, error: cashErr } = await supabaseAdmin
              .from("cash_transactions" as any)
              .insert({
                tenant_code: tenantCode,
                txn_date: body.txn_date || new Date().toISOString().slice(0, 10),
                txn_type: row.direction === "payable" ? "withdrawal" : "deposit",
                amount: Number(row.amount),
                bank_account_name: bankName,
                bank_account_number: bankNumber || null,
                currency: row.currency || "MYR",
                remarks:
                  `[${row.direction === "payable" ? "Upcoming payment" : "Receivable"}] ` +
                  `${row.counterparty ? row.counterparty + ". " : ""}${row.remarks || ""}`.trim(),
                entered_by: (claims.name as string) || email || null,
                entered_by_email: email || null,
              } as any)
              .select()
              .single();
            if (cashErr) return json({ error: cashErr.message }, 500);
            const { data, error } = await supabaseAdmin
              .from("expected_transactions" as any)
              .update({
                status: "settled",
                settled_at: new Date().toISOString(),
                cash_txn_id: (cashRow as any).id,
                bank_account_name: bankName,
                bank_account_number: bankNumber || null,
              } as any)
              .eq("id", body.id)
              .eq("tenant_code", tenantCode)
              .select()
              .single();
            if (error) return json({ error: error.message }, 500);
            return json({ row: data });
          }

          if (body.action === "cancel") {
            const { data, error } = await supabaseAdmin
              .from("expected_transactions" as any)
              .update({ status: "cancelled" } as any)
              .eq("id", body.id)
              .eq("tenant_code", tenantCode)
              .select()
              .single();
            if (error) return json({ error: error.message }, 500);
            return json({ row: data });
          }

          // Plain edit (only while still pending)
          const update: any = {};
          for (const k of [
            "direction",
            "due_date",
            "amount",
            "currency",
            "counterparty",
            "bank_account_id",
            "bank_account_name",
            "bank_account_number",
            "remarks",
          ]) {
            if (k in body) update[k] = body[k] === "" ? null : body[k];
          }
          if ("amount" in update) update.amount = Number(update.amount);
          const { data, error } = await supabaseAdmin
            .from("expected_transactions" as any)
            .update(update)
            .eq("id", body.id)
            .eq("tenant_code", tenantCode)
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
          const { tenantCode } = await requireAppAuth(request, { feature: "expected" });
          const url = new URL(request.url);
          const id = url.searchParams.get("id");
          if (!id) return json({ error: "Missing id" }, 400);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data: row } = await supabaseAdmin
            .from("expected_transactions" as any)
            .select("cash_txn_id")
            .eq("id", id)
            .eq("tenant_code", tenantCode)
            .maybeSingle();
          const cashId = (row as any)?.cash_txn_id;
          if (cashId) {
            await supabaseAdmin
              .from("cash_transactions" as any)
              .delete()
              .eq("id", cashId)
              .eq("tenant_code", tenantCode);
          }
          const { error } = await supabaseAdmin
            .from("expected_transactions" as any)
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
