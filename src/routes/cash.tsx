import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/qne-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { BankAccount } from "./bank-accounts";

export const Route = createFileRoute("/cash")({
  head: () => ({
    meta: [
      { title: "Cash Transaction Entry — Finance Balance Monitor" },
      { name: "description", content: "Record cash deposits, withdrawals, and transfers." },
    ],
  }),
  component: CashEntryPage,
});

type TxnType = "deposit" | "withdrawal" | "transfer" | "internal_transfer";

const empty = {
  txn_date: new Date().toISOString().slice(0, 10),
  txn_type: "deposit" as TxnType,
  amount: "",
  bank_account_id: "",
  bank_account_name: "",
  bank_account_number: "",
  from_account_id: "",
  to_account_id: "",
  currency: "MYR",
  remarks: "",
};

function CashEntryPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);

  const accountsQ = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get<{ rows: BankAccount[] }>("/api/data/bank-accounts"),
  });
  const accounts = (accountsQ.data?.rows ?? []).filter((a) => a.is_active);

  const mut = useMutation({
    mutationFn: async (payload: any) => {
      if (payload.txn_type === "internal_transfer") {
        const from = accounts.find((a) => a.id === payload.from_account_id);
        const to = accounts.find((a) => a.id === payload.to_account_id);
        if (!from || !to) throw new Error("Select both source and destination accounts");
        if (from.id === to.id) throw new Error("Source and destination must differ");
        const groupId = (crypto as any).randomUUID?.() ?? String(Date.now());
        const tag = `[Internal transfer ${groupId.slice(0, 8)}] `;
        const base = {
          txn_date: payload.txn_date,
          amount: Number(payload.amount),
          currency: payload.currency,
        };
        // withdrawal from source
        await api.post("/api/data/cash", {
          ...base,
          txn_type: "withdrawal",
          bank_account_name: from.account_name,
          bank_account_number: from.account_number,
          remarks: `${tag}To ${to.bank_name} — ${to.account_name}. ${payload.remarks || ""}`.trim(),
        });
        // deposit into destination
        await api.post("/api/data/cash", {
          ...base,
          txn_type: "deposit",
          bank_account_name: to.account_name,
          bank_account_number: to.account_number,
          remarks: `${tag}From ${from.bank_name} — ${from.account_name}. ${payload.remarks || ""}`.trim(),
        });
        return { ok: true };
      }
      return api.post("/api/data/cash", payload);
    },
    onSuccess: () => {
      toast.success("Cash transaction recorded");
      qc.invalidateQueries({ queryKey: ["cash"] });
      setForm({ ...empty });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save"),
  });

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Cash Transaction Entry</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Records post immediately and update the Summary Dashboard.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">New transaction</CardTitle>
          <CardDescription>Entered-by and date-entered are captured from your N3 session.</CardDescription>
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
              if (form.txn_type === "internal_transfer") {
                if (!form.from_account_id || !form.to_account_id) {
                  toast.error("Select both withdrawal and deposit banks");
                  return;
                }
                if (form.from_account_id === form.to_account_id) {
                  toast.error("Withdrawal and deposit banks must differ");
                  return;
                }
                mut.mutate({ ...form, amount: Number(form.amount) });
                return;
              }
              if (!form.bank_account_name) {
                toast.error("Select a bank account");
                return;
              }
              const { bank_account_id: _o1, from_account_id: _o2, to_account_id: _o3, ...payload } = form;
              mut.mutate({ ...payload, amount: Number(form.amount) });
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
            <Field label="Type">
              <Select
                value={form.txn_type}
                onValueChange={(v) => setForm({ ...form, txn_type: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="withdrawal">Withdrawal</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                  <SelectItem value="internal_transfer">Internal transfer</SelectItem>
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
            {accounts.length === 0 ? (
              <Field label="Bank account" className="md:col-span-2">
                <div className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                  No bank accounts yet.{" "}
                  <Link to="/bank-accounts" className="font-medium text-primary underline-offset-4 hover:underline">
                    Add one here
                  </Link>
                  .
                </div>
              </Field>
            ) : form.txn_type === "internal_transfer" ? (
              <>
                <Field label="Withdrawal bank (from)">
                  <Select
                    value={form.from_account_id}
                    onValueChange={(v) => {
                      const acc = accounts.find((a) => a.id === v);
                      setForm({
                        ...form,
                        from_account_id: v,
                        currency: acc?.currency || form.currency,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select source account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.bank_name} — {a.account_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Deposit bank (to)">
                  <Select
                    value={form.to_account_id}
                    onValueChange={(v) => setForm({ ...form, to_account_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select destination account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts
                        .filter((a) => a.id !== form.from_account_id)
                        .map((a) => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.bank_name} — {a.account_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </Field>
                <div className="md:col-span-2 rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                  Posts two linked entries: a withdrawal from the source bank and a deposit into the destination bank.
                </div>
              </>
            ) : (
              <>
                <Field label="Bank account" className="md:col-span-2">
                  <Select
                    value={form.bank_account_id}
                    onValueChange={(v) => {
                      const acc = accounts.find((a) => a.id === v);
                      if (!acc) return;
                      setForm({
                        ...form,
                        bank_account_id: acc.id,
                        bank_account_name: acc.account_name,
                        bank_account_number: acc.account_number,
                        currency: acc.currency || form.currency,
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a bank account" />
                    </SelectTrigger>
                    <SelectContent>
                      {accounts.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.bank_name} — {a.account_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Account number (auto-filled)">
                  <Input value={form.bank_account_number} readOnly className="bg-muted/50 font-mono" />
                </Field>
                <div className="hidden md:block" />
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
              <Button type="button" variant="outline" onClick={() => setForm(empty)}>
                Reset
              </Button>
              <Button type="submit" disabled={mut.isPending}>
                {mut.isPending ? "Saving…" : "Save transaction"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
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
