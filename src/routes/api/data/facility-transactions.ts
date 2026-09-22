import { createFileRoute } from "@tanstack/react-router";
import { requireAppAuth } from "@/lib/app-auth";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

export const Route = createFileRoute("/api/data/facility-transactions")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          const { tenantCode } = await requireAppAuth(request, { feature: ["facility_transactions", "facility_history", "facility_list", "dashboard"] });
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          const { data, error } = await supabaseAdmin
            .from("facility_transactions" as any)
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
          const { tenantCode, email, claims } = await requireAppAuth(request, { feature: ["facility_transactions"] });
          const body = (await request.json()) as any;
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          if (body.supersedes_id) {
            await supabaseAdmin
              .from("facility_transactions" as any)
              .update({ is_superseded: true } as any)
              .eq("id", body.supersedes_id)
              .eq("tenant_code", tenantCode);
          }

          const amount = Number(body.amount);
          const normTiming = (v: any, amt: number) =>
            amt > 0 ? (v === "maturity" ? "maturity" : "immediate") : null;
          const interestAmount = Number(body.interest_amount || 0);
          const interestTiming = normTiming(body.interest_timing, interestAmount);
          const postageAmount = Number(body.postage_amount || 0);
          const postageTiming = normTiming(body.postage_timing, postageAmount);
          const chargesAmount = Number(body.charges_amount || 0);
          const chargesTiming = normTiming(body.charges_timing, chargesAmount);
          const insert = {
            tenant_code: tenantCode,
            facility_id: body.facility_id || null,
            facility_name: body.facility_name,
            lending_bank: body.lending_bank,
            txn_date: body.txn_date,
            txn_number: body.txn_number || null,
            txn_type: body.txn_type, // "drawdown" | "repayment"

            amount,
            currency: body.currency || "MYR",
            remarks: body.remarks || null,
            entered_by: (claims.name as string) || email || null,
            entered_by_email: email || null,
            supersedes_id: body.supersedes_id || null,
            maturity_date: body.maturity_date || null,
            settlement_bank_account_id: body.settlement_bank_account_id || null,
            settlement_bank_account_name: body.settlement_bank_account_name || null,
            settlement_bank_account_number: body.settlement_bank_account_number || null,
            interest_amount: interestAmount,
            interest_timing: interestTiming,
            postage_amount: postageAmount,
            postage_timing: postageTiming,
            charges_amount: chargesAmount,
            charges_timing: chargesTiming,
          };
          const { data, error } = await supabaseAdmin
            .from("facility_transactions" as any)
            .insert(insert as any)
            .select()
            .single();
          if (error) return json({ error: error.message }, 500);

          // For any immediate charge, post a cash withdrawal now from the settlement bank.
          async function postImmediate(
            label: string,
            amt: number,
            timing: string | null,
            cashCol: string,
            settledCol: string,
          ) {
            if (
              (body.txn_type !== "drawdown" && body.txn_type !== "letter_of_credit") ||
              amt <= 0 ||
              timing !== "immediate" ||
              !body.settlement_bank_account_id ||
              !body.settlement_bank_account_name
            )
              return;
            const { data: cash } = await supabaseAdmin
              .from("cash_transactions" as any)
              .insert({
                tenant_code: tenantCode,
                txn_date: body.txn_date,
                txn_type: "withdrawal",
                amount: amt,
                bank_account_name: body.settlement_bank_account_name,
                bank_account_number: body.settlement_bank_account_number || null,
                currency: body.currency || "MYR",
                remarks: `[Facility ${label} ${body.facility_name}] ${body.txn_type} ${(data as any)?.id}`,
                entered_by: (claims.name as string) || email || null,
                entered_by_email: email || null,
              } as any)
              .select()
              .single();
            await supabaseAdmin
              .from("facility_transactions" as any)
              .update({
                [cashCol]: (cash as any)?.id ?? null,
                [settledCol]: new Date().toISOString(),
              } as any)
              .eq("id", (data as any).id)
              .eq("tenant_code", tenantCode);
          }
          await postImmediate("interest", interestAmount, interestTiming, "interest_cash_txn_id", "interest_settled_at");
          await postImmediate("postage", postageAmount, postageTiming, "postage_cash_txn_id", "postage_settled_at");
          await postImmediate("charges", chargesAmount, chargesTiming, "charges_cash_txn_id", "charges_settled_at");



          // Roll the amount into the parent facility totals so dashboards stay in sync.
          if (body.facility_id) {
            const { data: fac } = await supabaseAdmin
              .from("facilities" as any)
              .select("amount_drawn, amount_repaid")
              .eq("id", body.facility_id)
              .eq("tenant_code", tenantCode)
              .maybeSingle();
            if (fac) {
              const patch: any = {};
              if (body.txn_type === "drawdown" || body.txn_type === "letter_of_credit") {
                patch.amount_drawn = Number((fac as any).amount_drawn || 0) + amount;
              } else if (body.txn_type === "repayment") {
                patch.amount_repaid = Number((fac as any).amount_repaid || 0) + amount;
              }
              if (Object.keys(patch).length) {
                await supabaseAdmin
                  .from("facilities" as any)
                  .update(patch)
                  .eq("id", body.facility_id)
                  .eq("tenant_code", tenantCode);
              }
            }
          }

          return json({ row: data });
        } catch (e) {
          if (e instanceof Response) return e;
          return json({ error: String(e) }, 500);
        }
      },
      PUT: async ({ request }) => {
        try {
          const { tenantCode } = await requireAppAuth(request, { feature: ["facility_transactions"] });
          const body = (await request.json()) as any;
          const id = body.id;
          if (!id) return json({ error: "Missing id" }, 400);
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: existing } = await supabaseAdmin
            .from("facility_transactions" as any)
            .select("*")
            .eq("id", id)
            .eq("tenant_code", tenantCode)
            .maybeSingle();
          if (!existing) return json({ error: "Not found" }, 404);
          const prev = existing as any;
          if (prev.settled_at) return json({ error: "Settled drawdowns cannot be edited" }, 400);

          const newAmount = Number(body.amount);
          const newType = body.txn_type;
          const patch: any = {
            txn_date: body.txn_date,
            txn_number: body.txn_number ?? null,
            txn_type: newType,
            amount: newAmount,
            currency: body.currency || prev.currency,
            remarks: body.remarks ?? null,

            maturity_date: newType === "drawdown" ? body.maturity_date || null : null,
            settlement_bank_account_id:
              newType === "drawdown" || newType === "letter_of_credit" ? body.settlement_bank_account_id || null : null,
            settlement_bank_account_name:
              newType === "drawdown" || newType === "letter_of_credit" ? body.settlement_bank_account_name || null : null,
            settlement_bank_account_number:
              newType === "drawdown" || newType === "letter_of_credit" ? body.settlement_bank_account_number || null : null,
          };
          // Ancillary charges — only editable while not yet paid. LC is always immediate.
          const supportsCharges = newType === "drawdown" || newType === "letter_of_credit";
          const setCharge = (amtKey: string, timingKey: string, prevSettled: any) => {
            if (supportsCharges && !prevSettled) {
              const amt = Number(body[amtKey] || 0);
              patch[amtKey] = amt;
              if (amt <= 0) patch[timingKey] = null;
              else if (newType === "letter_of_credit") patch[timingKey] = "immediate";
              else patch[timingKey] = body[timingKey] === "maturity" ? "maturity" : "immediate";
            } else if (!supportsCharges) {
              patch[amtKey] = 0;
              patch[timingKey] = null;
            }
          };
          setCharge("interest_amount", "interest_timing", prev.interest_settled_at);
          setCharge("postage_amount", "postage_timing", prev.postage_settled_at);
          setCharge("charges_amount", "charges_timing", prev.charges_settled_at);

          
          // Allow re-pointing the facility only when caller sends it explicitly.
          if (body.facility_id !== undefined) {
            patch.facility_id = body.facility_id || null;
            patch.facility_name = body.facility_name;
            patch.lending_bank = body.lending_bank;
          }

          const { error: updErr } = await supabaseAdmin
            .from("facility_transactions" as any)
            .update(patch)
            .eq("id", id)
            .eq("tenant_code", tenantCode);
          if (updErr) return json({ error: updErr.message }, 500);

          // Reconcile facility totals: reverse old delta, apply new delta.
          const prevFacId = prev.facility_id as string | null;
          const newFacId = (patch.facility_id !== undefined ? patch.facility_id : prevFacId) as string | null;
          const prevAmt = Number(prev.amount || 0);
          const prevType = prev.txn_type as string;

          async function adjust(facId: string, drawnDelta: number, repaidDelta: number) {
            const { data: f } = await supabaseAdmin
              .from("facilities" as any)
              .select("amount_drawn, amount_repaid")
              .eq("id", facId)
              .eq("tenant_code", tenantCode)
              .maybeSingle();
            if (!f) return;
            await supabaseAdmin
              .from("facilities" as any)
              .update({
                amount_drawn: Math.max(0, Number((f as any).amount_drawn || 0) + drawnDelta),
                amount_repaid: Math.max(0, Number((f as any).amount_repaid || 0) + repaidDelta),
              })
              .eq("id", facId)
              .eq("tenant_code", tenantCode);
          }

          const usesDrawn = (t: string) => t === "drawdown" || t === "letter_of_credit";
          if (prevFacId && newFacId && prevFacId === newFacId) {
            const drawnDelta =
              (usesDrawn(newType) ? newAmount : 0) - (usesDrawn(prevType) ? prevAmt : 0);
            const repaidDelta =
              (newType === "repayment" ? newAmount : 0) - (prevType === "repayment" ? prevAmt : 0);
            if (drawnDelta !== 0 || repaidDelta !== 0) await adjust(prevFacId, drawnDelta, repaidDelta);
          } else {
            if (prevFacId) {
              await adjust(
                prevFacId,
                usesDrawn(prevType) ? -prevAmt : 0,
                prevType === "repayment" ? -prevAmt : 0,
              );
            }
            if (newFacId) {
              await adjust(
                newFacId,
                usesDrawn(newType) ? newAmount : 0,
                newType === "repayment" ? newAmount : 0,
              );
            }
          }

          return json({ ok: true });
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
            .from("facility_transactions" as any)
            .select("supersedes_id, facility_id, txn_type, amount")
            .eq("id", id)
            .eq("tenant_code", tenantCode)
            .maybeSingle();

          const { error } = await supabaseAdmin
            .from("facility_transactions" as any)
            .delete()
            .eq("id", id)
            .eq("tenant_code", tenantCode);
          if (error) return json({ error: error.message }, 500);

          // Reverse the parent-facility total change.
          const facilityId = (row as any)?.facility_id;
          if (facilityId) {
            const { data: fac } = await supabaseAdmin
              .from("facilities" as any)
              .select("amount_drawn, amount_repaid")
              .eq("id", facilityId)
              .eq("tenant_code", tenantCode)
              .maybeSingle();
            if (fac) {
              const amt = Number((row as any).amount || 0);
              const patch: any = {};
              const t = (row as any).txn_type;
              if (t === "drawdown" || t === "letter_of_credit") {
                patch.amount_drawn = Math.max(0, Number((fac as any).amount_drawn || 0) - amt);
              } else if (t === "repayment") {
                patch.amount_repaid = Math.max(0, Number((fac as any).amount_repaid || 0) - amt);
              }
              if (Object.keys(patch).length) {
                await supabaseAdmin
                  .from("facilities" as any)
                  .update(patch)
                  .eq("id", facilityId)
                  .eq("tenant_code", tenantCode);
              }
            }
          }

          const supersedesId = (row as any)?.supersedes_id;
          if (supersedesId) {
            await supabaseAdmin
              .from("facility_transactions" as any)
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
