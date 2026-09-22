import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/qne-client";
import { type CashTxn, formatMoney } from "@/lib/finance";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { exportToXlsx, type ExportColumn } from "@/lib/export-xlsx";
import { Download } from "lucide-react";

export const Route = createFileRoute("/transactions")({
  head: () => ({
    meta: [
      { title: "Transaction History — Finance Balance Monitor" },
      { name: "description", content: "Filterable log of cash transactions with audit-safe corrections." },
    ],
  }),
  component: TransactionsPage,
});

function TransactionsPage() {
  const qc = useQueryClient();
  const cashQ = useQuery({
    queryKey: ["cash"],
    queryFn: () => api.get<{ rows: CashTxn[] }>("/api/data/cash"),
  });

  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [type, setType] = useState<string>("all");
  const [account, setAccount] = useState("");

  const rows = cashQ.data?.rows ?? [];
  const accounts = useMemo(
    () => Array.from(new Set(rows.map((r) => r.bank_account_name).filter(Boolean))).sort(),
    [rows],
  );
  const filtered = rows.filter((r) => {
    if (from && r.txn_date < from) return false;
    if (to && r.txn_date > to) return false;
    if (type !== "all" && r.txn_type !== type) return false;
    if (account && r.bank_account_name !== account) return false;
    return true;
  });

  const groups = useMemo(() => {
    const map = new Map<string, {
      key: string;
      bank_account_name: string;
      bank_account_number: string;
      currency: string;
      rows: CashTxn[];
      balance: number;
    }>();
    for (const r of filtered) {
      const key = `${r.bank_account_name}|${r.bank_account_number || ""}|${r.currency}`;
      let g = map.get(key);
      if (!g) {
        g = {
          key,
          bank_account_name: r.bank_account_name,
          bank_account_number: r.bank_account_number || "",
          currency: r.currency,
          rows: [],
          balance: 0,
        };
        map.set(key, g);
      }
      g.rows.push(r);
      if (!r.is_superseded) {
        const sign = r.txn_type === "deposit" ? 1 : r.txn_type === "withdrawal" ? -1 : 0;
        g.balance += sign * Number(r.amount || 0);
      }
    }
    for (const g of map.values()) {
      g.rows.sort((a, b) => (a.txn_date < b.txn_date ? 1 : a.txn_date > b.txn_date ? -1 : 0));
    }
    return Array.from(map.values()).sort((a, b) =>
      a.bank_account_name.localeCompare(b.bank_account_name),
    );
  }, [filtered]);

  const [editing, setEditing] = useState<CashTxn | null>(null);
  const [form, setForm] = useState({
    txn_date: "",
    txn_type: "deposit" as CashTxn["txn_type"],
    amount: "",
    bank_account_name: "",
    bank_account_number: "",
    currency: "MYR",
    remarks: "",
  });

  function openEdit(r: CashTxn) {
    setEditing(r);
    setForm({
      txn_date: r.txn_date,
      txn_type: r.txn_type,
      amount: String(r.amount),
      bank_account_name: r.bank_account_name,
      bank_account_number: r.bank_account_number || "",
      currency: r.currency,
      remarks: r.remarks || "",
    });
  }

  const correctMut = useMutation({
    mutationFn: (body: any) => api.post("/api/data/cash", body),
    onSuccess: () => {
      toast.success("Correction recorded — original entry kept for audit");
      qc.invalidateQueries({ queryKey: ["cash"] });
      setEditing(null);
    },
    onError: (e: any) => toast.error(e?.message || "Failed"),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => api.del(`/api/data/cash?id=${encodeURIComponent(id)}`),
    onSuccess: () => {
      toast.success("Transaction deleted");
      qc.invalidateQueries({ queryKey: ["cash"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to delete"),
  });

  function confirmDelete(r: CashTxn) {
    if (!window.confirm(`Delete this ${r.txn_type} of ${formatMoney(r.amount, r.currency)} on ${r.txn_date}? This cannot be undone.`)) return;
    deleteMut.mutate(r.id);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Transaction History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Chronological log. Editing a past entry creates a correction; the original is preserved for audit.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={filtered.length === 0}
          onClick={() => {
            const cols: ExportColumn<CashTxn>[] = [
              { header: "Date", value: "txn_date", width: 12 },
              { header: "Type", value: "txn_type", width: 14 },
              { header: "Bank Account", value: "bank_account_name", width: 28 },
              { header: "Account Number", value: "bank_account_number", width: 20 },
              { header: "Currency", value: "currency", width: 10 },
              { header: "Amount", value: (r) => Number(r.amount || 0), numFmt: "#,##0.00;(#,##0.00);-", width: 16 },
              { header: "Signed Amount", value: (r) => {
                const s = r.txn_type === "deposit" ? 1 : r.txn_type === "withdrawal" ? -1 : 0;
                return r.is_superseded ? 0 : s * Number(r.amount || 0);
              }, numFmt: "#,##0.00;(#,##0.00);-", width: 16 },
              { header: "Remarks", value: (r) => r.remarks || "", width: 40 },
              { header: "Entered By", value: (r) => r.entered_by || "", width: 20 },
              { header: "Entered At", value: (r) => new Date(r.created_at).toLocaleString(), width: 22 },
              { header: "Superseded", value: (r) => (r.is_superseded ? "Yes" : "No"), width: 12 },
              { header: "Correction Of", value: (r) => r.supersedes_id || "", width: 18 },
            ];
            exportToXlsx("cash_transactions", [
              { name: "Cash Transactions", columns: cols, rows: filtered },
            ]);
          }}
        >
          <Download className="mr-2 h-4 w-4" /> Export Excel
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div className="space-y-1.5"><Label>From</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div className="space-y-1.5"><Label>To</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                <SelectItem value="deposit">Deposit</SelectItem>
                <SelectItem value="withdrawal">Withdrawal</SelectItem>
                <SelectItem value="transfer">Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Bank account</Label>
            <Select value={account || "__all"} onValueChange={(v) => setAccount(v === "__all" ? "" : v)}>
              <SelectTrigger><SelectValue placeholder="All accounts" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">All accounts</SelectItem>
                {accounts.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {cashQ.isLoading && (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">Loading…</CardContent></Card>
      )}
      {!cashQ.isLoading && groups.length === 0 && (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No transactions match your filters.</CardContent></Card>
      )}

      {groups.map((g) => (
        <Card key={g.key}>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <div className="min-w-0">
              <CardTitle className="text-base truncate">{g.bank_account_name}</CardTitle>
              {g.bank_account_number && (
                <div className="text-xs text-muted-foreground">{g.bank_account_number}</div>
              )}
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Net balance</div>
              <div className="font-mono text-sm">{formatMoney(g.balance, g.currency)}</div>
              <div className="text-xs text-muted-foreground">{g.rows.length} txn{g.rows.length === 1 ? "" : "s"}</div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-y bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2 text-left">Date</th>
                    <th className="px-4 py-2 text-left">Type</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                    <th className="px-4 py-2 text-left">Entered by</th>
                    <th className="px-4 py-2 text-left">Remarks</th>
                    <th className="px-4 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((r) => (
                    <tr key={r.id} className={`border-b last:border-0 ${r.is_superseded ? "opacity-60" : ""}`}>
                      <td className="px-4 py-2 tabular-nums">{r.txn_date}</td>
                      <td className="px-4 py-2">
                        <TypeBadge type={r.txn_type} />
                        {r.supersedes_id && <Badge variant="outline" className="ml-2">Correction</Badge>}
                        {r.is_superseded && <Badge variant="outline" className="ml-2">Superseded</Badge>}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{formatMoney(r.amount, r.currency)}</td>
                      <td className="px-4 py-2">
                        <div className="text-xs">{r.entered_by || "—"}</div>
                        <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                      </td>
                      <td className="px-4 py-2 max-w-xs truncate">{r.remarks || "—"}</td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          {!r.is_superseded && (
                            <Button size="sm" variant="ghost" onClick={() => openEdit(r)}>Correct</Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => confirmDelete(r)}
                            disabled={deleteMut.isPending}
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
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Correct transaction</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label>Date</Label><Input type="date" value={form.txn_date} onChange={(e) => setForm({ ...form, txn_date: e.target.value })} /></div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.txn_type} onValueChange={(v) => setForm({ ...form, txn_type: v as any })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="deposit">Deposit</SelectItem>
                  <SelectItem value="withdrawal">Withdrawal</SelectItem>
                  <SelectItem value="transfer">Transfer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label>Amount</Label><Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} /></div>
            <div className="space-y-1.5"><Label>Currency</Label><Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></div>
            <div className="space-y-1.5 col-span-2"><Label>Bank account name</Label><Input value={form.bank_account_name} onChange={(e) => setForm({ ...form, bank_account_name: e.target.value })} /></div>
            <div className="space-y-1.5 col-span-2"><Label>Bank account number</Label><Input value={form.bank_account_number} onChange={(e) => setForm({ ...form, bank_account_number: e.target.value })} /></div>
            <div className="space-y-1.5 col-span-2"><Label>Remarks</Label><Textarea rows={2} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button
              onClick={() =>
                editing &&
                correctMut.mutate({
                  ...form,
                  amount: Number(form.amount),
                  supersedes_id: editing.id,
                })
              }
              disabled={correctMut.isPending}
            >
              {correctMut.isPending ? "Saving…" : "Save correction"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TypeBadge({ type }: { type: CashTxn["txn_type"] }) {
  const cls =
    type === "deposit"
      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200"
      : type === "withdrawal"
        ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
        : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200";
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{type}</span>;
}
