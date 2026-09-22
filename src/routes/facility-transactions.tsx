import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/qne-client";
import type { Facility } from "@/lib/finance";
import { formatMoney, facilityAvailable } from "@/lib/finance";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { exportToXlsx, type ExportColumn } from "@/lib/export-xlsx";
import { Download } from "lucide-react";
import type { BankAccount } from "./bank-accounts";

export const Route = createFileRoute("/facility-transactions")({
  head: () => ({
    meta: [
      { title: "Facility Transaction Entry — Finance Balance Monitor" },
      { name: "description", content: "Record drawdowns and repayments against your credit facilities." },
    ],
  }),
  component: FacilityTxnPage,
});

type FacilityTxnType = "drawdown" | "repayment" | "letter_of_credit";

export type FacilityTxn = {
  id: string;
  facility_id: string | null;
  facility_name: string;
  lending_bank: string;
  txn_date: string;
  txn_number: string | null;

  txn_type: FacilityTxnType;
  amount: number;
  currency: string;
  remarks: string | null;
  entered_by: string | null;
  entered_by_email: string | null;
  is_superseded: boolean;
  supersedes_id: string | null;
  created_at: string;
  maturity_date: string | null;
  settlement_bank_account_id: string | null;
  settlement_bank_account_name: string | null;
  settlement_bank_account_number: string | null;
  settled_at: string | null;
  settlement_cash_txn_id: string | null;
  settlement_repayment_txn_id: string | null;
  interest_amount: number | null;
  interest_timing: "immediate" | "maturity" | null;
  interest_cash_txn_id: string | null;
  interest_settled_at: string | null;
  postage_amount: number | null;
  postage_timing: "immediate" | "maturity" | null;
  postage_cash_txn_id: string | null;
  postage_settled_at: string | null;
  charges_amount: number | null;
  charges_timing: "immediate" | "maturity" | null;
  charges_cash_txn_id: string | null;
  charges_settled_at: string | null;
};

export type LcAmendment = {
  id: string;
  lc_txn_id: string;
  txn_date: string;
  currency: string;
  interest_amount: number;
  postage_amount: number;
  charges_amount: number;
  settlement_bank_account_name: string | null;
  settlement_bank_account_number: string | null;
  cash_txn_id: string | null;
  settled_at: string | null;
  remarks: string | null;
  entered_by: string | null;
  entered_by_email: string | null;
  created_at: string;
  new_amount: number | null;
  previous_amount: number | null;
  new_maturity_date: string | null;
  previous_maturity_date: string | null;
};

const empty = {
  txn_date: new Date().toISOString().slice(0, 10),
  txn_number: "",

  txn_type: "drawdown" as FacilityTxnType,
  amount: "",
  facility_id: "",
  facility_name: "",
  lending_bank: "",
  currency: "MYR",
  remarks: "",
  maturity_date: "",
  settlement_bank_account_id: "",
  settlement_bank_account_name: "",
  settlement_bank_account_number: "",
  interest_amount: "",
  interest_timing: "immediate" as "immediate" | "maturity",
  postage_amount: "",
  postage_timing: "immediate" as "immediate" | "maturity",
  charges_amount: "",
  charges_timing: "immediate" as "immediate" | "maturity",
};


function FacilityTxnPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);

  function loadForEdit(r: FacilityTxn) {
    setEditingId(r.id);
    setForm({
      txn_date: r.txn_date,
      txn_number: r.txn_number || "",

      txn_type: r.txn_type,
      amount: String(r.amount),
      facility_id: r.facility_id || "",
      facility_name: r.facility_name,
      lending_bank: r.lending_bank,
      currency: r.currency,
      remarks: r.remarks || "",
      maturity_date: r.maturity_date || "",
      settlement_bank_account_id: r.settlement_bank_account_id || "",
      settlement_bank_account_name: r.settlement_bank_account_name || "",
      settlement_bank_account_number: r.settlement_bank_account_number || "",
      interest_amount: r.interest_amount ? String(r.interest_amount) : "",
      interest_timing: (r.interest_timing || "immediate") as "immediate" | "maturity",
      postage_amount: r.postage_amount ? String(r.postage_amount) : "",
      postage_timing: (r.postage_timing || "immediate") as "immediate" | "maturity",
      charges_amount: r.charges_amount ? String(r.charges_amount) : "",
      charges_timing: (r.charges_timing || "immediate") as "immediate" | "maturity",
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm({ ...empty });
  }


  const facQ = useQuery({
    queryKey: ["facilities"],
    queryFn: () => api.get<{ rows: Facility[] }>("/api/data/facilities"),
  });
  const facilities = (facQ.data?.rows ?? []).filter((f) => f.status === "active");

  const banksQ = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get<{ rows: BankAccount[] }>("/api/data/bank-accounts"),
  });
  const banks = (banksQ.data?.rows ?? []).filter((b) => b.is_active);

  const txnQ = useQuery({
    queryKey: ["facility-transactions"],
    queryFn: () => api.get<{ rows: FacilityTxn[] }>("/api/data/facility-transactions"),
  });

  const today = new Date().toISOString().slice(0, 10);
  const matured = useMemo(() => {
    return (txnQ.data?.rows ?? []).filter(
      (r) =>
        r.txn_type === "drawdown" &&
        !r.is_superseded &&
        !r.settled_at &&
        r.maturity_date &&
        r.maturity_date <= today,
    );
  }, [txnQ.data, today]);

  const upcoming = useMemo(() => {
    return (txnQ.data?.rows ?? []).filter(
      (r) =>
        r.txn_type === "drawdown" &&
        !r.is_superseded &&
        !r.settled_at &&
        r.maturity_date &&
        r.maturity_date > today,
    );
  }, [txnQ.data, today]);

  const lcRows = useMemo(
    () => (txnQ.data?.rows ?? []).filter((r) => r.txn_type === "letter_of_credit"),
    [txnQ.data],
  );
  const nonLcRows = useMemo(
    () => (txnQ.data?.rows ?? []).filter((r) => r.txn_type !== "letter_of_credit"),
    [txnQ.data],
  );

  const mut = useMutation({
    mutationFn: (payload: any) =>
      payload.id
        ? api.put("/api/data/facility-transactions", payload)
        : api.post("/api/data/facility-transactions", payload),
    onSuccess: () => {
      toast.success(editingId ? "Transaction updated" : "Facility transaction recorded");
      qc.invalidateQueries({ queryKey: ["facility-transactions"] });
      qc.invalidateQueries({ queryKey: ["facilities"] });
      setEditingId(null);
      setForm({ ...empty });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save"),
  });

  const settleMut = useMutation({
    mutationFn: (id: string) => api.post("/api/data/facility-transactions/settle", { id }),
    onSuccess: () => {
      toast.success("Drawdown settled — cash withdrawal and repayment posted");
      qc.invalidateQueries({ queryKey: ["facility-transactions"] });
      qc.invalidateQueries({ queryKey: ["facilities"] });
      qc.invalidateQueries({ queryKey: ["cash"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to settle"),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => api.del(`/api/data/facility-transactions?id=${encodeURIComponent(id)}`),
    onSuccess: () => {
      toast.success("Transaction deleted");
      qc.invalidateQueries({ queryKey: ["facility-transactions"] });
      qc.invalidateQueries({ queryKey: ["facilities"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to delete"),
  });

  const convertMut = useMutation({
    mutationFn: async (r: FacilityTxn) => {
      await api.put("/api/data/facility-transactions", {
        id: r.id,
        txn_date: r.txn_date,
        txn_type: "drawdown",
        amount: r.amount,
        currency: r.currency,
        remarks: r.remarks,
        facility_id: r.facility_id,
        facility_name: r.facility_name,
        lending_bank: r.lending_bank,
        maturity_date: null,
        settlement_bank_account_id: r.settlement_bank_account_id,
        settlement_bank_account_name: r.settlement_bank_account_name,
        settlement_bank_account_number: r.settlement_bank_account_number,
        interest_amount: r.interest_amount || 0,
        interest_timing: r.interest_timing,
        postage_amount: r.postage_amount || 0,
        postage_timing: r.postage_timing,
        charges_amount: r.charges_amount || 0,
        charges_timing: r.charges_timing,
      });
      return r;
    },
    onSuccess: (r) => {
      toast.success("Converted to drawdown — fill in the new details");
      qc.invalidateQueries({ queryKey: ["facility-transactions"] });
      qc.invalidateQueries({ queryKey: ["facilities"] });
      // Load the freshly-converted row straight into the entry form.
      loadForEdit({ ...r, txn_type: "drawdown", maturity_date: null });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to convert"),
  });

  const amendQ = useQuery({
    queryKey: ["facility-lc-amendments"],
    queryFn: () => api.get<{ rows: LcAmendment[] }>("/api/data/facility-lc-amendments"),
  });
  const amendmentsByLc = useMemo(() => {
    const m = new Map<string, LcAmendment[]>();
    for (const a of amendQ.data?.rows ?? []) {
      const arr = m.get(a.lc_txn_id) ?? [];
      arr.push(a);
      m.set(a.lc_txn_id, arr);
    }
    return m;
  }, [amendQ.data]);

  const [amendTarget, setAmendTarget] = useState<FacilityTxn | null>(null);
  const [amendForm, setAmendForm] = useState({
    txn_date: new Date().toISOString().slice(0, 10),
    interest_amount: "",
    postage_amount: "",
    charges_amount: "",
    settlement_bank_account_id: "",
    settlement_bank_account_name: "",
    settlement_bank_account_number: "",
    remarks: "",
    new_amount: "",
    new_maturity_date: "",
  });
  function openAmend(r: FacilityTxn) {
    setAmendTarget(r);
    setAmendForm({
      txn_date: new Date().toISOString().slice(0, 10),
      interest_amount: "",
      postage_amount: "",
      charges_amount: "",
      settlement_bank_account_id: r.settlement_bank_account_id || "",
      settlement_bank_account_name: r.settlement_bank_account_name || "",
      settlement_bank_account_number: r.settlement_bank_account_number || "",
      remarks: "",
      new_amount: "",
      new_maturity_date: "",
    });
  }
  const amendMut = useMutation({
    mutationFn: (payload: any) => api.post("/api/data/facility-lc-amendments", payload),
    onSuccess: () => {
      toast.success("Amendment recorded");
      qc.invalidateQueries({ queryKey: ["facility-lc-amendments"] });
      qc.invalidateQueries({ queryKey: ["cash"] });
      setAmendTarget(null);
    },
    onError: (e: any) => toast.error(e?.message || "Failed to record amendment"),
  });
  const amendDelMut = useMutation({
    mutationFn: (id: string) =>
      api.del(`/api/data/facility-lc-amendments?id=${encodeURIComponent(id)}`),
    onSuccess: () => {
      toast.success("Amendment deleted");
      qc.invalidateQueries({ queryKey: ["facility-lc-amendments"] });
      qc.invalidateQueries({ queryKey: ["cash"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to delete amendment"),
  });

  const isDrawdown = form.txn_type === "drawdown";
  const isLC = form.txn_type === "letter_of_credit";
  const showCharges = isDrawdown || isLC;
  const showSettlementBank = isDrawdown || isLC;

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="max-w-4xl space-y-6 min-w-0">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Facility Transaction Entry</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Record drawdowns and repayments. Totals on the facility record update automatically.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={(txnQ.data?.rows ?? []).length === 0}
          onClick={() => {
            const all = txnQ.data?.rows ?? [];
            const cols: ExportColumn<FacilityTxn>[] = [
              { header: "Date", value: "txn_date", width: 12 },
              { header: "Txn #", value: (r) => r.txn_number || "", width: 14 },
              { header: "Type", value: "txn_type", width: 14 },
              { header: "Facility", value: "facility_name", width: 28 },
              { header: "Bank", value: "lending_bank", width: 22 },
              { header: "Currency", value: "currency", width: 10 },
              { header: "Amount", value: (r) => Number(r.amount || 0), numFmt: "#,##0.00;(#,##0.00);-", width: 16 },
              { header: "Maturity Date", value: (r) => r.maturity_date || "", width: 14 },
              { header: "Settlement Bank", value: (r) => r.settlement_bank_account_name || "", width: 24 },
              { header: "Settlement Account #", value: (r) => r.settlement_bank_account_number || "", width: 20 },
              { header: "Settled At", value: (r) => r.settled_at ? new Date(r.settled_at).toLocaleString() : "", width: 22 },
              { header: "Interest", value: (r) => r.interest_amount ?? null, numFmt: "#,##0.00;(#,##0.00);-", width: 14 },
              { header: "Interest Timing", value: (r) => r.interest_timing || "", width: 14 },
              { header: "Postage", value: (r) => r.postage_amount ?? null, numFmt: "#,##0.00;(#,##0.00);-", width: 12 },
              { header: "Postage Timing", value: (r) => r.postage_timing || "", width: 14 },
              { header: "Charges", value: (r) => r.charges_amount ?? null, numFmt: "#,##0.00;(#,##0.00);-", width: 12 },
              { header: "Charges Timing", value: (r) => r.charges_timing || "", width: 14 },
              { header: "Remarks", value: (r) => r.remarks || "", width: 40 },
              { header: "Entered By", value: (r) => r.entered_by || r.entered_by_email || "", width: 22 },
              { header: "Created At", value: (r) => new Date(r.created_at).toLocaleString(), width: 22 },
              { header: "Superseded", value: (r) => (r.is_superseded ? "Yes" : "No"), width: 12 },
            ];
            const nonLc = all.filter((r) => r.txn_type !== "letter_of_credit");
            const lc = all.filter((r) => r.txn_type === "letter_of_credit");
            const sheets = [
              { name: "Drawdowns & Repayments", columns: cols, rows: nonLc },
            ];
            if (lc.length > 0) sheets.push({ name: "Letters of Credit", columns: cols, rows: lc });
            exportToXlsx("facility_transactions", sheets);
          }}
        >
          <Download className="mr-2 h-4 w-4" /> Export Excel
        </Button>
      </div>


      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editingId ? "Edit facility transaction" : "New facility transaction"}
          </CardTitle>
          <CardDescription>
            {editingId
              ? "Changes reconcile the facility totals automatically."
              : "Entered-by and date are captured from your N3 session."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.amount || Number(form.amount) <= 0) {
                toast.error("Enter a valid amount");
                return;
              }
              if (!form.facility_id) {
                toast.error("Select a facility");
                return;
              }
              if (isDrawdown && form.maturity_date && !form.settlement_bank_account_id) {
                toast.error("Pick a settlement bank for the maturity");
                return;
              }
              const intAmt = Number(form.interest_amount || 0);
              const postAmt = Number(form.postage_amount || 0);
              const chgAmt = Number(form.charges_amount || 0);
              if (
                showCharges &&
                (intAmt > 0 || postAmt > 0 || chgAmt > 0) &&
                !form.settlement_bank_account_id
              ) {
                toast.error("Pick a settlement bank so ancillary charges can be deducted");
                return;
              }
              // Letter of Credit locks all ancillary timings to immediate.
              const intTiming = isLC ? "immediate" : form.interest_timing;
              const postTiming = isLC ? "immediate" : form.postage_timing;
              const chgTiming = isLC ? "immediate" : form.charges_timing;
              mut.mutate({
                ...(editingId ? { id: editingId } : {}),
                ...form,
                amount: Number(form.amount),
                maturity_date: isDrawdown ? form.maturity_date || null : null,
                settlement_bank_account_id: showSettlementBank ? form.settlement_bank_account_id || null : null,
                settlement_bank_account_name: showSettlementBank ? form.settlement_bank_account_name || null : null,
                settlement_bank_account_number: showSettlementBank ? form.settlement_bank_account_number || null : null,
                interest_amount: showCharges ? intAmt : 0,
                interest_timing: showCharges && intAmt > 0 ? intTiming : null,
                postage_amount: showCharges ? postAmt : 0,
                postage_timing: showCharges && postAmt > 0 ? postTiming : null,
                charges_amount: showCharges ? chgAmt : 0,
                charges_timing: showCharges && chgAmt > 0 ? chgTiming : null,
              });
            }}
          >
            <Field label="Date">
              <Input
                type="date"
                required
                value={form.txn_date}
                onChange={(e) => setForm({ ...form, txn_date: e.target.value })}
              />
            </Field>
            <Field label="Facility transaction no." className="md:col-span-2">
              <Input
                placeholder="Bank reference / facility transaction number"
                value={form.txn_number}
                onChange={(e) => setForm({ ...form, txn_number: e.target.value })}
              />
            </Field>

            <Field label="Type">
              <Select value={form.txn_type} onValueChange={(v) => setForm({ ...form, txn_type: v as FacilityTxnType })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="drawdown">Drawdown</SelectItem>
                  <SelectItem value="repayment">Repayment</SelectItem>
                  <SelectItem value="letter_of_credit">Letter of Credit</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Amount">
              <Input
                type="number"
                step="0.01"
                min="0"
                required
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </Field>
            <Field label="Currency">
              <Input
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                maxLength={5}
              />
            </Field>
            {facilities.length === 0 ? (
              <Field label="Facility" className="md:col-span-2">
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  No active facilities.{" "}
                  <Link to="/facilities" className="font-medium text-primary underline-offset-4 hover:underline">
                    Add one here
                  </Link>
                  .
                </div>
              </Field>
            ) : (
              <>
                <Field label="Facility" className="md:col-span-2">
                  <Select
                    value={form.facility_id}
                    onValueChange={(v) => {
                      const f = facilities.find((x) => x.id === v);
                      if (!f) return;
                      setForm({
                        ...form,
                        facility_id: f.id,
                        facility_name: f.name,
                        lending_bank: f.lending_bank,
                        currency: f.currency || form.currency,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a facility" />
                    </SelectTrigger>
                    <SelectContent>
                      {facilities.map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.lending_bank} — {f.name} · Available {formatMoney(facilityAvailable(f), f.currency)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Lending bank (auto-filled)">
                  <Input value={form.lending_bank} readOnly className="bg-muted/50" />
                </Field>
                <Field label="Facility name (auto-filled)">
                  <Input value={form.facility_name} readOnly className="bg-muted/50" />
                </Field>
              </>
            )}

            {isDrawdown && (
              <>
                <div className="md:col-span-2 mt-2 rounded-md border bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Maturity & settlement
                </div>
                <Field label="Maturity date (optional)">
                  <Input
                    type="date"
                    value={form.maturity_date}
                    onChange={(e) => setForm({ ...form, maturity_date: e.target.value })}
                  />
                </Field>
                <Field label="Settlement bank (deducted on maturity)">
                  {banks.length === 0 ? (
                    <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                      No bank accounts yet.{" "}
                      <Link to="/bank-accounts" className="font-medium text-primary underline-offset-4 hover:underline">
                        Add one
                      </Link>
                    </div>
                  ) : (
                    <Select
                      value={form.settlement_bank_account_id}
                      onValueChange={(v) => {
                        const b = banks.find((x) => x.id === v);
                        if (!b) return;
                        setForm({
                          ...form,
                          settlement_bank_account_id: b.id,
                          settlement_bank_account_name: b.account_name,
                          settlement_bank_account_number: b.account_number,
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={form.maturity_date ? "Select bank to deduct from" : "Optional"} />
                      </SelectTrigger>
                      <SelectContent>
                        {banks.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.bank_name} — {b.account_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>
                {form.maturity_date && (
                  <div className="md:col-span-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    On or after {form.maturity_date}, a one-click Settle button will appear below. Settling posts a cash
                    withdrawal from the selected bank and a matching facility repayment.
                  </div>
                )}
              </>
            )}

            {isLC && (
              <>
                <div className="md:col-span-2 mt-2 rounded-md border bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Deduction bank
                </div>
                <Field label="Settlement bank (used for immediate charges)" className="md:col-span-2">
                  {banks.length === 0 ? (
                    <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                      No bank accounts yet.{" "}
                      <Link to="/bank-accounts" className="font-medium text-primary underline-offset-4 hover:underline">
                        Add one
                      </Link>
                    </div>
                  ) : (
                    <Select
                      value={form.settlement_bank_account_id}
                      onValueChange={(v) => {
                        const b = banks.find((x) => x.id === v);
                        if (!b) return;
                        setForm({
                          ...form,
                          settlement_bank_account_id: b.id,
                          settlement_bank_account_name: b.account_name,
                          settlement_bank_account_number: b.account_number,
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select bank to deduct charges from" />
                      </SelectTrigger>
                      <SelectContent>
                        {banks.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.bank_name} — {b.account_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </Field>
              </>
            )}

            {showCharges && (
              <>
                <div className="md:col-span-2 mt-2 rounded-md border bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Bank interest
                </div>
                <Field label="Interest amount">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.interest_amount}
                    onChange={(e) => setForm({ ...form, interest_amount: e.target.value })}
                    placeholder="0.00"
                  />
                </Field>
                <Field label="Deduct interest">
                  {isLC ? (
                    <Input value="Immediately from the bank" readOnly className="bg-muted/50" />
                  ) : (
                    <Select
                      value={form.interest_timing}
                      onValueChange={(v) =>
                        setForm({ ...form, interest_timing: v as "immediate" | "maturity" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">Immediately from the bank</SelectItem>
                        <SelectItem value="maturity">On maturity (with principal)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </Field>
                {Number(form.interest_amount || 0) > 0 && !isLC && (
                  <div className="md:col-span-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                    {form.interest_timing === "immediate"
                      ? `Saving will post a cash withdrawal of ${form.interest_amount} for interest from the selected settlement bank now.`
                      : `Interest of ${form.interest_amount} will be added to the maturity settlement and deducted with the principal.`}
                  </div>
                )}

                <div className="md:col-span-2 mt-2 rounded-md border bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Postage expenses
                </div>
                <Field label="Postage amount">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.postage_amount}
                    onChange={(e) => setForm({ ...form, postage_amount: e.target.value })}
                    placeholder="0.00"
                  />
                </Field>
                <Field label="Deduct postage">
                  {isLC ? (
                    <Input value="Immediately from the bank" readOnly className="bg-muted/50" />
                  ) : (
                    <Select
                      value={form.postage_timing}
                      onValueChange={(v) =>
                        setForm({ ...form, postage_timing: v as "immediate" | "maturity" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">Immediately from the bank</SelectItem>
                        <SelectItem value="maturity">On maturity (with principal)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </Field>

                <div className="md:col-span-2 mt-2 rounded-md border bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Bank charges
                </div>
                <Field label="Bank charges amount">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={form.charges_amount}
                    onChange={(e) => setForm({ ...form, charges_amount: e.target.value })}
                    placeholder="0.00"
                  />
                </Field>
                <Field label="Deduct charges">
                  {isLC ? (
                    <Input value="Immediately from the bank" readOnly className="bg-muted/50" />
                  ) : (
                    <Select
                      value={form.charges_timing}
                      onValueChange={(v) =>
                        setForm({ ...form, charges_timing: v as "immediate" | "maturity" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="immediate">Immediately from the bank</SelectItem>
                        <SelectItem value="maturity">On maturity (with principal)</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                </Field>
              </>
            )}



            <Field label="Remarks" className="md:col-span-2">
              <Textarea
                rows={3}
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              />
            </Field>
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={cancelEdit}>
                {editingId ? "Cancel edit" : "Reset"}
              </Button>
              <Button type="submit" disabled={mut.isPending}>
                {mut.isPending ? "Saving…" : editingId ? "Save changes" : "Save transaction"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Matured drawdowns
            {matured.length > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                {matured.length} due
              </span>
            )}
          </CardTitle>
          <CardDescription>
            Drawdowns whose maturity date has arrived. Click Settle to post the cash withdrawal + facility repayment.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {matured.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Nothing due today.</p>
          ) : (
            <MaturityTable
              rows={matured}
              banks={banks}
              onSettle={(id) => {
                if (window.confirm("Post a cash withdrawal from the settlement bank and record the facility repayment?")) {
                  settleMut.mutate(id);
                }
              }}
              settling={settleMut.isPending}
            />
          )}
        </CardContent>
      </Card>

      {upcoming.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upcoming maturities</CardTitle>
            <CardDescription>Drawdowns with a future maturity date.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <MaturityTable rows={upcoming} banks={banks} upcoming />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent facility transactions</CardTitle>
          <CardDescription>Latest 1000 entries across all facilities.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {txnQ.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : nonLcRows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No facility transactions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Facility</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2 text-right">Charges</th>
                    <th className="px-4 py-2">Maturity</th>
                    <th className="px-4 py-2">Entered by</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {nonLcRows.map((r) => (
                    <tr key={r.id} className={r.is_superseded ? "opacity-50" : ""}>
                      <td className="px-4 py-2 whitespace-nowrap">{r.txn_date}</td>
                      <td className="px-4 py-2">
                        <div className="font-medium">{r.facility_name}</div>
                        <div className="text-xs text-muted-foreground">{r.lending_bank}</div>
                      </td>
                      <td className="px-4 py-2 capitalize">{r.txn_type}</td>
                      <td className="px-4 py-2 text-right font-mono">{formatMoney(Number(r.amount), r.currency)}</td>
                      <td className="px-4 py-2 text-right font-mono text-xs">
                        {(() => {
                          const items: { label: string; amt: number; timing: string | null; paid: boolean }[] = [];
                          if (Number(r.interest_amount || 0) > 0)
                            items.push({ label: "Interest", amt: Number(r.interest_amount), timing: r.interest_timing, paid: !!r.interest_settled_at });
                          if (Number(r.postage_amount || 0) > 0)
                            items.push({ label: "Postage", amt: Number(r.postage_amount), timing: r.postage_timing, paid: !!r.postage_settled_at });
                          if (Number(r.charges_amount || 0) > 0)
                            items.push({ label: "Charges", amt: Number(r.charges_amount), timing: r.charges_timing, paid: !!r.charges_settled_at });
                          if (items.length === 0) return <span className="text-muted-foreground">—</span>;
                          return (
                            <div className="space-y-1">
                              {items.map((it) => (
                                <div key={it.label}>
                                  <div>
                                    {it.label}: {formatMoney(it.amt, r.currency)}
                                  </div>
                                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                    {it.timing === "maturity" ? "on maturity" : "immediate"}
                                    {it.paid ? " · paid" : ""}
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-xs">
                        {r.maturity_date ? (
                          r.settled_at ? (
                            <span className="text-muted-foreground">
                              {r.maturity_date} · <span className="text-primary">settled</span>
                            </span>
                          ) : (
                            r.maturity_date
                          )
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {r.entered_by || r.entered_by_email || "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            disabled={!!r.settled_at}
                            title={r.settled_at ? "Settled transactions cannot be edited" : "Edit"}
                            onClick={() => loadForEdit(r)}
                          >
                            Edit
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            disabled={delMut.isPending}
                            onClick={() => {
                              if (window.confirm("Delete this transaction? This reverses its effect on the facility totals.")) {
                                delMut.mutate(r.id);
                              }
                            }}
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            Letters of Credit
            {lcRows.length > 0 && (
              <span className="ml-2 inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {lcRows.length}
              </span>
            )}
          </CardTitle>
          <CardDescription>
            LC amounts consume facility availability but are tracked in this dedicated list.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {lcRows.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No letters of credit recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Facility</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2 text-right">Charges</th>
                    <th className="px-4 py-2">Deducted from</th>
                    <th className="px-4 py-2">Remarks</th>
                    <th className="px-4 py-2">Entered by</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {lcRows.map((r) => {
                    const ams = amendmentsByLc.get(r.id) ?? [];
                    const interestBase = Number(r.interest_amount || 0);
                    const postageBase = Number(r.postage_amount || 0);
                    const chargesBase = Number(r.charges_amount || 0);
                    const interestAmend = ams.reduce((s, a) => s + Number(a.interest_amount || 0), 0);
                    const postageAmend = ams.reduce((s, a) => s + Number(a.postage_amount || 0), 0);
                    const chargesAmend = ams.reduce((s, a) => s + Number(a.charges_amount || 0), 0);
                    const interestTotal = interestBase + interestAmend;
                    const postageTotal = postageBase + postageAmend;
                    const chargesTotal = chargesBase + chargesAmend;
                    const grand = interestTotal + postageTotal + chargesTotal;
                    return (
                      <tr key={r.id} className={r.is_superseded ? "opacity-50" : ""}>
                        <td className="px-4 py-2 whitespace-nowrap">{r.txn_date}</td>
                        <td className="px-4 py-2">
                          <div className="font-medium">{r.facility_name}</div>
                          <div className="text-xs text-muted-foreground">{r.lending_bank}</div>
                        </td>
                        <td className="px-4 py-2 text-right font-mono">{formatMoney(Number(r.amount), r.currency)}</td>
                        <td className="px-4 py-2 text-right font-mono text-xs">
                          {grand === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <div className="space-y-1">
                              {interestTotal > 0 && (
                                <div>
                                  <div>Interest: {formatMoney(interestTotal, r.currency)}</div>
                                  {interestAmend > 0 && (
                                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                      base {formatMoney(interestBase, r.currency)} + amend {formatMoney(interestAmend, r.currency)}
                                    </div>
                                  )}
                                </div>
                              )}
                              {postageTotal > 0 && (
                                <div>
                                  <div>Postage: {formatMoney(postageTotal, r.currency)}</div>
                                  {postageAmend > 0 && (
                                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                      base {formatMoney(postageBase, r.currency)} + amend {formatMoney(postageAmend, r.currency)}
                                    </div>
                                  )}
                                </div>
                              )}
                              {chargesTotal > 0 && (
                                <div>
                                  <div>Charges: {formatMoney(chargesTotal, r.currency)}</div>
                                  {chargesAmend > 0 && (
                                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                                      base {formatMoney(chargesBase, r.currency)} + amend {formatMoney(chargesAmend, r.currency)}
                                    </div>
                                  )}
                                </div>
                              )}
                              <div className="border-t pt-1 font-semibold">
                                Total: {formatMoney(grand, r.currency)}
                              </div>
                            </div>
                          )}
                          {ams.length > 0 && (
                            <details className="mt-2 text-left">
                              <summary className="cursor-pointer text-[10px] uppercase tracking-wide text-muted-foreground">
                                History ({ams.length} change{ams.length > 1 ? "s" : ""})
                              </summary>
                              <div className="mt-1 space-y-1">
                                {ams.map((a) => (
                                  <div key={a.id} className="flex items-start justify-between gap-2 rounded border px-2 py-1 text-[11px]">
                                    <div>
                                      <div className="font-medium">{a.txn_date}</div>
                                      {a.previous_amount !== null && a.new_amount !== null && (
                                        <div>
                                          Amount: {formatMoney(a.previous_amount, a.currency)} → {formatMoney(a.new_amount, a.currency)}
                                        </div>
                                      )}
                                      {a.new_maturity_date && (
                                        <div>
                                          Maturity: {a.previous_maturity_date || "—"} → {a.new_maturity_date}
                                        </div>
                                      )}
                                      {Number(a.interest_amount) > 0 && <div>+ Interest {formatMoney(a.interest_amount, a.currency)}</div>}
                                      {Number(a.postage_amount) > 0 && <div>+ Postage {formatMoney(a.postage_amount, a.currency)}</div>}
                                      {Number(a.charges_amount) > 0 && <div>+ Charges {formatMoney(a.charges_amount, a.currency)}</div>}
                                      {a.settlement_bank_account_name && (Number(a.interest_amount) + Number(a.postage_amount) + Number(a.charges_amount)) > 0 && (
                                        <div className="text-muted-foreground">via {a.settlement_bank_account_name}</div>
                                      )}
                                      {(a.entered_by || a.entered_by_email) && (
                                        <div className="text-muted-foreground">by {a.entered_by || a.entered_by_email}</div>
                                      )}
                                      {a.remarks && <div className="text-muted-foreground">{a.remarks}</div>}
                                    </div>
                                    <button
                                      type="button"
                                      className="text-destructive"
                                      disabled={amendDelMut.isPending}
                                      title="Delete this history entry and its cash withdrawal (LC amount/maturity changes will remain)"
                                      onClick={() => {
                                        if (window.confirm("Delete this amendment entry? Its cash withdrawal will be removed but any amount/maturity changes it applied will remain on the LC."))
                                          amendDelMut.mutate(a.id);
                                      }}
                                    >
                                      ×
                                    </button>
                                  </div>
                                ))}
                              </div>
                            </details>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs">
                          {r.settlement_bank_account_name ? (
                            <>
                              <div className="font-medium">{r.settlement_bank_account_name}</div>
                              <div className="text-muted-foreground">{r.settlement_bank_account_number}</div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground max-w-xs truncate" title={r.remarks || ""}>
                          {r.remarks || "—"}
                        </td>
                        <td className="px-4 py-2 text-xs text-muted-foreground">
                          {r.entered_by || r.entered_by_email || "—"}
                        </td>
                        <td className="px-4 py-2 text-right">
                          <div className="flex flex-wrap justify-end gap-1">
                            <Button type="button" variant="ghost" size="sm" onClick={() => loadForEdit(r)}>
                              Edit
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              title="Add extra interest, postage, or bank charges to this LC"
                              onClick={() => openAmend(r)}
                            >
                              Amend
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={convertMut.isPending}
                              title="Convert this LC into a normal drawdown"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    "Convert this LC into a normal drawdown? Its amount stays on the facility; the entry will move to the drawdowns list.",
                                  )
                                ) {
                                  convertMut.mutate(r);
                                }
                              }}
                            >
                              Convert to drawdown
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              disabled={delMut.isPending}
                              onClick={() => {
                                if (window.confirm("Delete this LC? This frees up the facility balance it consumed.")) {
                                  delMut.mutate(r.id);
                                }
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!amendTarget} onOpenChange={(o) => !o && setAmendTarget(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Amend LC — {amendTarget?.facility_name}</DialogTitle>
            <DialogDescription>
              Add extra interest, postage, or bank charges. All amounts are deducted immediately from the chosen bank.
            </DialogDescription>
          </DialogHeader>
          <form
            className="grid grid-cols-2 gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!amendTarget) return;
              const i = Number(amendForm.interest_amount || 0);
              const p = Number(amendForm.postage_amount || 0);
              const c = Number(amendForm.charges_amount || 0);
              const hasNewAmt = amendForm.new_amount !== "";
              const hasNewMat = amendForm.new_maturity_date !== "";
              if (i + p + c <= 0 && !hasNewAmt && !hasNewMat) {
                toast.error("Enter at least one change or amount");
                return;
              }
              if (i + p + c > 0 && !amendForm.settlement_bank_account_id) {
                toast.error("Pick a settlement bank");
                return;
              }
              amendMut.mutate({
                lc_txn_id: amendTarget.id,
                txn_date: amendForm.txn_date,
                currency: amendTarget.currency,
                interest_amount: i,
                postage_amount: p,
                charges_amount: c,
                settlement_bank_account_id: amendForm.settlement_bank_account_id || null,
                settlement_bank_account_name: amendForm.settlement_bank_account_name || null,
                settlement_bank_account_number: amendForm.settlement_bank_account_number || null,
                remarks: amendForm.remarks,
                new_amount: hasNewAmt ? Number(amendForm.new_amount) : null,
                new_maturity_date: hasNewMat ? amendForm.new_maturity_date : null,
              });
            }}
          >
            <Field label="Date">
              <Input
                type="date"
                required
                value={amendForm.txn_date}
                onChange={(e) => setAmendForm({ ...amendForm, txn_date: e.target.value })}
              />
            </Field>
            <Field label="Deduct from bank">
              <Select
                value={amendForm.settlement_bank_account_id}
                onValueChange={(v) => {
                  const b = banks.find((x) => x.id === v);
                  if (!b) return;
                  setAmendForm({
                    ...amendForm,
                    settlement_bank_account_id: b.id,
                    settlement_bank_account_name: b.account_name,
                    settlement_bank_account_number: b.account_number,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select bank" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.bank_name} — {b.account_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <div className="col-span-2 mt-1 rounded-md border bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Change LC terms (optional)
            </div>
            <Field label={`New LC amount (current ${formatMoney(Number(amendTarget?.amount || 0), amendTarget?.currency || "MYR")})`}>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amendForm.new_amount}
                onChange={(e) => setAmendForm({ ...amendForm, new_amount: e.target.value })}
                placeholder="Leave blank to keep"
              />
            </Field>
            <Field label={`New maturity date (current ${amendTarget?.maturity_date || "—"})`}>
              <Input
                type="date"
                value={amendForm.new_maturity_date}
                onChange={(e) => setAmendForm({ ...amendForm, new_maturity_date: e.target.value })}
              />
            </Field>

            <div className="col-span-2 mt-1 rounded-md border bg-muted/30 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Additional charges (deducted immediately)
            </div>
            <Field label="Additional interest">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amendForm.interest_amount}
                onChange={(e) => setAmendForm({ ...amendForm, interest_amount: e.target.value })}
                placeholder="0.00"
              />
            </Field>
            <Field label="Additional postage">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amendForm.postage_amount}
                onChange={(e) => setAmendForm({ ...amendForm, postage_amount: e.target.value })}
                placeholder="0.00"
              />
            </Field>
            <Field label="Additional bank charges" className="col-span-2">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={amendForm.charges_amount}
                onChange={(e) => setAmendForm({ ...amendForm, charges_amount: e.target.value })}
                placeholder="0.00"
              />
            </Field>
            <Field label="Remarks" className="col-span-2">
              <Textarea
                rows={2}
                value={amendForm.remarks}
                onChange={(e) => setAmendForm({ ...amendForm, remarks: e.target.value })}
              />
            </Field>
            <DialogFooter className="col-span-2">
              <Button type="button" variant="outline" onClick={() => setAmendTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={amendMut.isPending}>
                {amendMut.isPending ? "Saving…" : "Save amendment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      </div>
      <HistorySidebar rows={txnQ.data?.rows ?? []} />
    </div>
  );
}


function MaturityTable({
  rows,
  banks,
  onSettle,
  settling,
  upcoming,
}: {
  rows: FacilityTxn[];
  banks: BankAccount[];
  onSettle?: (id: string) => void;
  settling?: boolean;
  upcoming?: boolean;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
          <tr>
            <th className="px-4 py-2">Maturity</th>
            <th className="px-4 py-2">Facility</th>
            <th className="px-4 py-2 text-right">Amount</th>
            <th className="px-4 py-2">Deduct from</th>
            {!upcoming && <th className="px-4 py-2"></th>}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r) => {
            const bank =
              banks.find((b) => b.id === r.settlement_bank_account_id) ||
              (r.settlement_bank_account_name
                ? { bank_name: "", account_name: r.settlement_bank_account_name, account_number: r.settlement_bank_account_number || "" }
                : null);
            return (
              <tr key={r.id}>
                <td className="px-4 py-2 whitespace-nowrap font-medium">{r.maturity_date}</td>
                <td className="px-4 py-2">
                  <div className="font-medium">{r.facility_name}</div>
                  <div className="text-xs text-muted-foreground">{r.lending_bank}</div>
                </td>
                <td className="px-4 py-2 text-right font-mono">
                  {formatMoney(Number(r.amount), r.currency)}
                  {r.interest_timing === "maturity" && Number(r.interest_amount || 0) > 0 && (
                    <div className="text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                      + interest {formatMoney(Number(r.interest_amount), r.currency)}
                    </div>
                  )}
                  {r.postage_timing === "maturity" && Number(r.postage_amount || 0) > 0 && (
                    <div className="text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                      + postage {formatMoney(Number(r.postage_amount), r.currency)}
                    </div>
                  )}
                  {r.charges_timing === "maturity" && Number(r.charges_amount || 0) > 0 && (
                    <div className="text-[10px] font-normal uppercase tracking-wide text-muted-foreground">
                      + charges {formatMoney(Number(r.charges_amount), r.currency)}
                    </div>
                  )}
                </td>
                <td className="px-4 py-2 text-xs">
                  {bank ? (
                    <>
                      <div className="font-medium">{(bank as any).bank_name || bank.account_name}</div>
                      <div className="text-muted-foreground">{bank.account_number}</div>
                    </>
                  ) : (
                    <span className="text-destructive">No settlement bank set</span>
                  )}
                </td>
                {!upcoming && (
                  <td className="px-4 py-2 text-right">
                    <Button
                      type="button"
                      size="sm"
                      disabled={settling || !r.settlement_bank_account_id}
                      onClick={() => onSettle?.(r.id)}
                    >
                      Settle
                    </Button>
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function HistorySidebar({ rows }: { rows: FacilityTxn[] }) {
  const sorted = useMemo(
    () =>
      [...rows].sort((a, b) => {
        const da = a.txn_date || "";
        const db = b.txn_date || "";
        if (da !== db) return db.localeCompare(da);
        return (b.created_at || "").localeCompare(a.created_at || "");
      }),
    [rows],
  );
  const typeLabel = (t: FacilityTxnType) =>
    t === "drawdown" ? "Drawdown" : t === "repayment" ? "Repayment" : "LC";
  const typeClass = (t: FacilityTxnType) =>
    t === "drawdown"
      ? "bg-blue-500/10 text-blue-700 dark:text-blue-300"
      : t === "repayment"
        ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        : "bg-amber-500/10 text-amber-700 dark:text-amber-300";
  const statusOf = (r: FacilityTxn) => {
    if (r.is_superseded) return { label: "Edited", cls: "bg-muted text-muted-foreground" };
    if (r.txn_type === "repayment") return { label: "Posted", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" };
    if (r.settled_at) return { label: "Settled", cls: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" };
    return { label: "Open", cls: "bg-orange-500/10 text-orange-700 dark:text-orange-300" };
  };
  return (
    <aside className="xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
      <Card className="flex h-full flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Transaction history</CardTitle>
          <CardDescription>All facility transactions, most recent first.</CardDescription>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto pr-2">
          {sorted.length === 0 ? (
            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              No transactions yet.
            </div>
          ) : (
            <ul className="space-y-2">
              {sorted.map((r) => {
                const s = statusOf(r);
                return (
                  <li
                    key={r.id}
                    className={`rounded-md border p-2 text-xs ${r.is_superseded ? "opacity-70" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${typeClass(r.txn_type)}`}>
                        {typeLabel(r.txn_type)}
                      </span>
                      <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${s.cls}`}>
                        {s.label}
                      </span>
                    </div>
                    <div className="mt-1 font-medium">{r.facility_name}</div>
                    <div className="text-muted-foreground">{r.lending_bank}</div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span>{r.txn_date}</span>
                      <span className="font-semibold">
                        {r.currency} {formatMoney(Number(r.amount || 0))}
                      </span>
                    </div>
                    {r.maturity_date && (
                      <div className="text-muted-foreground">Matures {r.maturity_date}</div>
                    )}
                    {(r.entered_by || r.entered_by_email) && (
                      <div className="mt-1 text-muted-foreground">
                        by {r.entered_by || r.entered_by_email}
                      </div>
                    )}
                    {r.remarks && (
                      <div className="mt-1 line-clamp-2 text-muted-foreground">{r.remarks}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </aside>
  );
}

