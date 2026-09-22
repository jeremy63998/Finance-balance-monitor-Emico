import { createFileRoute } from "@tanstack/react-router";
import { requireAppAuth } from "@/lib/app-auth";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/data/facility-lc-amendments")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { tenantCode } = await requireAppAuth(request, { feature: ["facility_transactions", "facility_history", "facility_list", "dashboard"] });
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin
            .from("facility_lc_amendments" as any)
            .select("*")
            .eq("tenant_code", tenantCode)
            .order("txn_date", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(2000);
          if (error) return json({ error: error.message }, 500);
          return json({ rows: data ?? [] });
        } catch (e) {
          if (e instanceof Response) return e;
          return json({ error: String(e) }, 500);
        }
      },
      POST: async ({ request }) => {
        try {
          const { tenantCode, email, claims } = await requireAppAuth(request, { feature: ["facility_transactions"] });
          const body = (await request.json()) as any;
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const interestAmount = Number(body.interest_amount || 0);
          const postageAmount = Number(body.postage_amount || 0);
          const chargesAmount = Number(body.charges_amount || 0);
          const total = interestAmount + postageAmount + chargesAmount;
          const hasNewAmount = body.new_amount !== undefined && body.new_amount !== null && body.new_amount !== "";
          const hasNewMaturity =
            body.new_maturity_date !== undefined && body.new_maturity_date !== null && body.new_maturity_date !== "";
          if (total <= 0 && !hasNewAmount && !hasNewMaturity)
            return json({ error: "Enter at least one change or charge amount" }, 400);
          if (!body.lc_txn_id) return json({ error: "Missing LC reference" }, 400);
          if (total > 0 && (!body.settlement_bank_account_id || !body.settlement_bank_account_name))
            return json({ error: "Pick a settlement bank" }, 400);

          // Look up parent LC for label/facility context + previous values.
          const { data: lc } = await supabaseAdmin
            .from("facility_transactions" as any)
            .select("id, facility_id, facility_name, currency, amount, maturity_date")
            .eq("id", body.lc_txn_id)
            .eq("tenant_code", tenantCode)
            .maybeSingle();
          if (!lc) return json({ error: "LC not found" }, 404);

          const currency = body.currency || (lc as any).currency || "MYR";
          const txnDate = body.txn_date || new Date().toISOString().slice(0, 10);
          const prevAmount = Number((lc as any).amount || 0);
          const prevMaturity = (lc as any).maturity_date as string | null;
          const newAmount = hasNewAmount ? Number(body.new_amount) : null;
          const newMaturity = hasNewMaturity ? String(body.new_maturity_date) : null;

          const insert = {
            tenant_code: tenantCode,
            lc_txn_id: body.lc_txn_id,
            txn_date: txnDate,
            currency,
            interest_amount: interestAmount,
            postage_amount: postageAmount,
            charges_amount: chargesAmount,
            settlement_bank_account_id: body.settlement_bank_account_id || null,
            settlement_bank_account_name: body.settlement_bank_account_name || null,
            settlement_bank_account_number: body.settlement_bank_account_number || null,
            remarks: body.remarks || null,
            entered_by: (claims.name as string) || email || null,
            entered_by_email: email || null,
            new_amount: newAmount,
            previous_amount: hasNewAmount ? prevAmount : null,
            new_maturity_date: newMaturity,
            previous_maturity_date: hasNewMaturity ? prevMaturity : null,
          };

          const { data: amendment, error } = await supabaseAdmin
            .from("facility_lc_amendments" as any)
            .insert(insert as any)
            .select()
            .single();
          if (error) return json({ error: error.message }, 500);

          // Apply LC-level changes and reconcile the facility if the amount changed.
          const lcPatch: any = {};
          if (hasNewAmount && newAmount !== prevAmount) lcPatch.amount = newAmount;
          if (hasNewMaturity && newMaturity !== prevMaturity) lcPatch.maturity_date = newMaturity;
          if (Object.keys(lcPatch).length) {
            await supabaseAdmin
              .from("facility_transactions" as any)
              .update(lcPatch)
              .eq("id", body.lc_txn_id)
              .eq("tenant_code", tenantCode);
            if (lcPatch.amount !== undefined && (lc as any).facility_id) {
              const delta = Number(newAmount) - prevAmount;
              if (delta !== 0) {
                const { data: fac } = await supabaseAdmin
                  .from("facilities" as any)
                  .select("amount_drawn")
                  .eq("id", (lc as any).facility_id)
                  .eq("tenant_code", tenantCode)
                  .maybeSingle();
                if (fac) {
                  await supabaseAdmin
                    .from("facilities" as any)
                    .update({ amount_drawn: Math.max(0, Number((fac as any).amount_drawn || 0) + delta) })
                    .eq("id", (lc as any).facility_id)
                    .eq("tenant_code", tenantCode);
                }
              }
            }
          }

          if (total <= 0) return json({ row: amendment });


          // Post a single immediate cash withdrawal covering all three amounts.
          const parts: string[] = [];
          if (interestAmount > 0) parts.push(`interest ${interestAmount}`);
          if (postageAmount > 0) parts.push(`postage ${postageAmount}`);
          if (chargesAmount > 0) parts.push(`charges ${chargesAmount}`);
          const { data: cash } = await supabaseAdmin
            .from("cash_transactions" as any)
            .insert({
              tenant_code: tenantCode,
              txn_date: txnDate,
              txn_type: "withdrawal",
              amount: total,
              bank_account_name: body.settlement_bank_account_name,
              bank_account_number: body.settlement_bank_account_number || null,
              currency,
              remarks: `[LC amendment ${(lc as any).facility_name}] ${parts.join(", ")} · ${(amendment as any).id}`,
              entered_by: (claims.name as string) || email || null,
              entered_by_email: email || null,
            } as any)
            .select()
            .single();

          await supabaseAdmin
            .from("facility_lc_amendments" as any)
            .update({
              cash_txn_id: (cash as any)?.id ?? null,
              settled_at: new Date().toISOString(),
            } as any)
            .eq("id", (amendment as any).id)
            .eq("tenant_code", tenantCode);

          return json({ row: amendment });
        } catch (e) {
          if (e instanceof Response) return e;
          return json({ error: String(e) }, 500);
        }
      },
      DELETE: async ({ request }) => {
        try {
          const { tenantCode } = await requireAppAuth(request, { feature: ["facility_transactions"] });
          const url = new URL(request.url);
          const id = url.searchParams.get("id");
          if (!id) return json({ error: "Missing id" }, 400);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: row } = await supabaseAdmin
            .from("facility_lc_amendments" as any)
            .select("cash_txn_id")
            .eq("id", id)
            .eq("tenant_code", tenantCode)
            .maybeSingle();

          const { error } = await supabaseAdmin
            .from("facility_lc_amendments" as any)
            .delete()
            .eq("id", id)
            .eq("tenant_code", tenantCode);
          if (error) return json({ error: error.message }, 500);

          const cashId = (row as any)?.cash_txn_id;
          if (cashId) {
            await supabaseAdmin
              .from("cash_transactions" as any)
              .delete()
              .eq("id", cashId)
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
