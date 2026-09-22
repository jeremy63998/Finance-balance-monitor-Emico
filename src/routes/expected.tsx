import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/qne-client";
import { formatMoney } from "@/lib/finance";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import type { BankAccount } from "./bank-accounts";

export const Route = createFileRoute("/expected")({
  head: () => ({
    meta: [
      { title: "Upcoming Payment & Receivable — Finance Balance Monitor" },
      {
        name: "description",
        content: "Record expected incoming receivables and upcoming payments with their due dates.",
      },
      { property: "og:title", content: "Upcoming Payment & Receivable" },
      {
        property: "og:description",
        content: "Track expected money in and money out by due date.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ExpectedPage,
});

export type ExpectedTxn = {
  id: string;
  tenant_code: string;
  direction: "receivable" | "payable";
  due_date: string;
  amount: number;
  currency: string;
  counterparty: string | null;
  bank_account_id: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  status: "pending" | "settled" | "cancelled";
  settled_at: string | null;
  cash_txn_id: string | null;
  remarks: string | null;
  entered_by: string | null;
  entered_by_email: string | null;
  created_at: string;
  updated_at: string;
};

const empty = {
  id: "",
  direction: "receivable" as "receivable" | "payable",
  due_date: new Date().toISOString().slice(0, 10),
  amount: "",
  currency: "MYR",
  counterparty: "",
  bank_account_id: "",
  bank_account_name: "",
  bank_account_number: "",
  remarks: "",
};

function ExpectedPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);

  const accountsQ = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get<{ rows: BankAccount[] }>("/api/data/bank-accounts"),
  });
  const accounts = (accountsQ.data?.rows ?? []).filter((a) => a.is_active);

  const listQ = useQuery({
    queryKey: ["expected"],
    queryFn: () => api.get<{ rows: ExpectedTxn[] }>("/api/data/expected"),
  });
  const rows = listQ.data?.rows ?? [];

  const pending = useMemo(
    () =>
      rows
        .filter((r) => r.status === "pending")
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()),
    [rows],
  );
  const done = useMemo(
    () =>
      rows
        .filter((r) => r.status !== "pending")
        .sort((a, b) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime()),
    [rows],
  );

  const expectedIn = pending
    .filter((r) => r.direction === "receivable")
    .reduce((s, r) => s + Number(r.amount), 0);
  const expectedOut = pending
    .filter((r) => r.direction === "payable")
    .reduce((s, r) => s + Number(r.amount), 0);

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["expected"] });
    qc.invalidateQueries({ queryKey: ["cash"] });
  };

  const save = useMutation({
    mutationFn: (payload: any) =>
      payload.id ? api.put("/api/data/expected", payload) : api.post("/api/data/expected", payload),
    onSuccess: () => {
      toast.success("Saved");
      setForm({ ...empty });
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save"),
  });

  const act = useMutation({
    mutationFn: (payload: any) => api.put("/api/data/expected", payload),
    onSuccess: () => {
      toast.success("Updated");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Failed to update"),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/api/data/expected?id=${id}`),
    onSuccess: () => {
      toast.success("Deleted");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message || "Failed to delete"),
  });

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Upcoming Payment / Receivable Entry</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Expected money in and money out. These appear on the Summary Dashboard with their due dates,
          and post to cash once marked as received or paid.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{form.id ? "Edit entry" : "New entry"}</CardTitle>
          <CardDescription>Entered-by and date-entered are captured from your session.</CardDescription>
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
              save.mutate({ ...form, id: form.id || undefined, amount: Number(form.amount) });
            }}
          >
            <Field label="Type">
              <Select
                value={form.direction}
                onValueChange={(v) => setForm({ ...form, direction: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receivable">Incoming receivable</SelectItem>
                  <SelectItem value="payable">Upcoming payment</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Expected date">
              <Input
                type="date"
                required
                value={form.due_date}
                onChange={(e) => setForm({ ...form, due_date: e.target.value })}
              />
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
                maxLength={5}
                onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
              />
            </Field>
            <Field label="Customer / supplier" className="md:col-span-2">
              <Input
                value={form.counterparty}
                placeholder="Who the money comes from or goes to"
                onChange={(e) => setForm({ ...form, counterparty: e.target.value })}
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
            ) : (
              <>
                <Field label="Bank account (expected)">
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
              <Button type="button" variant="outline" onClick={() => setForm({ ...empty })}>
                {form.id ? "Cancel edit" : "Reset"}
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving…" : form.id ? "Update entry" : "Save entry"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <SumCard label="Expected incoming (pending)" value={formatMoney(expectedIn)} tone="positive" />
        <SumCard label="Expected outgoing (pending)" value={formatMoney(expectedOut)} tone="negative" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Pending</CardTitle>
          <CardDescription>Mark as received / paid to post it into cash automatically.</CardDescription>
        </CardHeader>
        <CardContent>
          {listQ.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : pending.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing pending.</p>
          ) : (
            <ul className="divide-y">
              {pending.map((r) => {
                const days = Math.ceil(
                  (new Date(r.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                );
                return (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant={r.direction === "receivable" ? "secondary" : "outline"}>
                          {r.direction === "receivable" ? "Incoming" : "Payment"}
                        </Badge>
                        <span className="truncate text-sm font-medium">
                          {r.counterparty || r.remarks || "—"}
                        </span>
                      </div>
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Due {new Date(r.due_date).toLocaleDateString()} ·{" "}
                        {days < 0 ? `${Math.abs(days)}d overdue` : `in ${days}d`}
                        {r.bank_account_name ? ` · ${r.bank_account_name}` : ""}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono text-sm font-semibold ${
                          r.direction === "receivable" ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {r.direction === "receivable" ? "+" : "−"}
                        {formatMoney(Number(r.amount), r.currency)}
                      </span>
                      <Button
                        size="sm"
                        disabled={act.isPending}
                        onClick={() => act.mutate({ id: r.id, action: "settle" })}
                      >
                        {r.direction === "receivable" ? "Mark received" : "Mark paid"}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          setForm({
                            id: r.id,
                            direction: r.direction,
                            due_date: r.due_date,
                            amount: String(r.amount),
                            currency: r.currency,
                            counterparty: r.counterparty ?? "",
                            bank_account_id: r.bank_account_id ?? "",
                            bank_account_name: r.bank_account_name ?? "",
                            bank_account_number: r.bank_account_number ?? "",
                            remarks: r.remarks ?? "",
                          })
                        }
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => act.mutate({ id: r.id, action: "cancel" })}
                      >
                        Cancel
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Completed & cancelled</CardTitle>
        </CardHeader>
        <CardContent>
          {done.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing here yet.</p>
          ) : (
            <ul className="divide-y">
              {done.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={r.status === "settled" ? "default" : "outline"}>
                        {r.status === "settled"
                          ? r.direction === "receivable"
                            ? "Received"
                            : "Paid"
                          : "Cancelled"}
                      </Badge>
                      <span className="truncate font-medium">{r.counterparty || r.remarks || "—"}</span>
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      Due {new Date(r.due_date).toLocaleDateString()}
                      {r.bank_account_name ? ` · ${r.bank_account_name}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono">{formatMoney(Number(r.amount), r.currency)}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={del.isPending}
                      onClick={() => {
                        if (
                          confirm(
                            "Delete this entry? Any cash record it created will be removed too.",
                          )
                        )
                          del.mutate(r.id);
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function SumCard({ label, value, tone }: { label: string; value: string; tone: "positive" | "negative" }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div
          className={`mt-1 text-2xl font-semibold tabular-nums ${
            tone === "positive" ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {value}
        </div>
      </CardContent>
    </Card>
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
