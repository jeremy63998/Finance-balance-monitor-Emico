import { createFileRoute } from "@tanstack/react-router";
import { requireAppAuth } from "@/lib/app-auth";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

// Settle a matured facility drawdown:
//  1) post a cash withdrawal from the pre-selected settlement bank
//  2) post a facility repayment (which also updates facility.amount_repaid)
//  3) mark the drawdown row as settled with links to both new rows
export const Route = createFileRoute("/api/data/facility-transactions/settle")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const { tenantCode, email, claims } = await requireAppAuth(request, { feature: ["facility_transactions"] });
          const { id, bank_account_id: overrideBankId } = (await request.json()) as any;
          if (!id) return json({ error: "Missing id" }, 400);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: draw, error: drawErr } = await supabaseAdmin
            .from("facility_transactions" as any)
            .select("*")
            .eq("id", id)
            .eq("tenant_code", tenantCode)
            .maybeSingle();
          if (drawErr) return json({ error: drawErr.message }, 500);
          if (!draw) return json({ error: "Drawdown not found" }, 404);
          const d = draw as any;
          if (d.txn_type !== "drawdown") return json({ error: "Only drawdowns can be settled" }, 400);
          if (d.settled_at) return json({ error: "Already settled" }, 400);

          // Resolve the bank account: caller override wins, else the one saved on the drawdown.
          let bankId: string | null = overrideBankId || d.settlement_bank_account_id || null;
          let bankName: string | null = d.settlement_bank_account_name || null;
          let bankNumber: string | null = d.settlement_bank_account_number || null;
          if (overrideBankId || !bankName) {
            if (!bankId) return json({ error: "No settlement bank selected" }, 400);
            const { data: bank } = await supabaseAdmin
              .from("bank_accounts" as any)
              .select("account_name, account_number")
              .eq("id", bankId)
              .eq("tenant_code", tenantCode)
              .maybeSingle();
            if (!bank) return json({ error: "Bank account not found" }, 404);
            bankName = (bank as any).account_name;
            bankNumber = (bank as any).account_number;
          }

          const enteredBy = (claims.name as string) || email || null;
          const today = new Date().toISOString().slice(0, 10);
          const amount = Number(d.amount);
          const interestDue =
            d.interest_timing === "maturity" && !d.interest_settled_at ? Number(d.interest_amount || 0) : 0;
          const postageDue =
            d.postage_timing === "maturity" && !d.postage_settled_at ? Number(d.postage_amount || 0) : 0;
          const chargesDue =
            d.charges_timing === "maturity" && !d.charges_settled_at ? Number(d.charges_amount || 0) : 0;
          const extras: string[] = [];
          if (interestDue > 0) extras.push(`interest ${interestDue}`);
          if (postageDue > 0) extras.push(`postage ${postageDue}`);
          if (chargesDue > 0) extras.push(`charges ${chargesDue}`);
          const noteTag = `[Facility maturity ${d.facility_name}]`;

          // 1) Cash withdrawal from the settlement bank (principal + any maturity-timed extras).
          const { data: cashRow, error: cashErr } = await supabaseAdmin
            .from("cash_transactions" as any)
            .insert({
              tenant_code: tenantCode,
              txn_date: today,
              txn_type: "withdrawal",
              amount: amount + interestDue + postageDue + chargesDue,
              bank_account_name: bankName,
              bank_account_number: bankNumber,
              currency: d.currency || "MYR",
              remarks:
                extras.length > 0
                  ? `${noteTag} settlement of drawdown ${d.id} (principal ${amount} + ${extras.join(" + ")})`
                  : `${noteTag} settlement of drawdown ${d.id}`,
              entered_by: enteredBy,
              entered_by_email: email || null,
            } as any)
            .select()
            .single();
          if (cashErr) return json({ error: cashErr.message }, 500);



          // 2) Facility repayment (mirrors the manual entry path so facility totals stay in sync).
          const { data: repayRow, error: repayErr } = await supabaseAdmin
            .from("facility_transactions" as any)
            .insert({
              tenant_code: tenantCode,
              facility_id: d.facility_id,
              facility_name: d.facility_name,
              lending_bank: d.lending_bank,
              txn_date: today,
              txn_type: "repayment",
              amount,
              currency: d.currency || "MYR",
              remarks: `${noteTag} auto-repayment from ${bankName}`,
              entered_by: enteredBy,
              entered_by_email: email || null,
            } as any)
            .select()
            .single();
          if (repayErr) return json({ error: repayErr.message }, 500);

          if (d.facility_id) {
            const { data: fac } = await supabaseAdmin
              .from("facilities" as any)
              .select("amount_repaid")
              .eq("id", d.facility_id)
              .eq("tenant_code", tenantCode)
              .maybeSingle();
            if (fac) {
              await supabaseAdmin
                .from("facilities" as any)
                .update({ amount_repaid: Number((fac as any).amount_repaid || 0) + amount })
                .eq("id", d.facility_id)
                .eq("tenant_code", tenantCode);
            }
          }

          // 3) Mark drawdown settled with links back to what was posted.
          await supabaseAdmin
            .from("facility_transactions" as any)
            .update({
              settled_at: new Date().toISOString(),
              settlement_bank_account_id: bankId,
              settlement_bank_account_name: bankName,
              settlement_bank_account_number: bankNumber,
              settlement_cash_txn_id: (cashRow as any)?.id ?? null,
              settlement_repayment_txn_id: (repayRow as any)?.id ?? null,
              ...(interestDue > 0
                ? { interest_cash_txn_id: (cashRow as any)?.id ?? null, interest_settled_at: new Date().toISOString() }
                : {}),
              ...(postageDue > 0
                ? { postage_cash_txn_id: (cashRow as any)?.id ?? null, postage_settled_at: new Date().toISOString() }
                : {}),
              ...(chargesDue > 0
                ? { charges_cash_txn_id: (cashRow as any)?.id ?? null, charges_settled_at: new Date().toISOString() }
                : {}),
            } as any)
            .eq("id", id)
            .eq("tenant_code", tenantCode);

          return json({ ok: true, cash: cashRow, repayment: repayRow });
        } catch (e) {
          if (e instanceof Response) return e;
          return json({ error: String(e) }, 500);
        }
      },
    },
  },
});
