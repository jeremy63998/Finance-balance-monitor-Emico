import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/qne-client";
import {
  type CashTxn,
  type Facility,
  cashSignedAmount,
  facilityAvailable,
  facilityMaturityAlert,
  facilityOutstanding,
  formatMoney,
} from "@/lib/finance";
import type { BankAccount } from "./bank-accounts";
import type { FacilityTxn } from "./facility-transactions";
import type { ExpectedTxn } from "./expected";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  Banknote,
  CalendarDays,
  CircleDollarSign,
  Landmark,
  Receipt,
  Scale,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Summary Dashboard — Finance Balance Monitor" },
      {
        name: "description",
        content:
          "Live cash, credit facility, and maturity summary with N3 bank balance cross-reference.",
      },
    ],
  }),
  component: DashboardPage,
});

function useCash() {
  return useQuery({
    queryKey: ["cash"],
    queryFn: () => api.get<{ rows: CashTxn[] }>("/api/data/cash"),
  });
}
function useFacilities() {
  return useQuery({
    queryKey: ["facilities"],
    queryFn: () => api.get<{ rows: Facility[] }>("/api/data/facilities"),
  });
}
function useFacilityTransactions() {
  return useQuery({
    queryKey: ["facility-transactions"],
    queryFn: () => api.get<{ rows: FacilityTxn[] }>("/api/data/facility-transactions"),
  });
}

function DashboardPage() {
  const cashQ = useCash();
  const facQ = useFacilities();
  const bankAccountsQ = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get<{ rows: BankAccount[] }>("/api/data/bank-accounts"),
  });
  const txnQ = useFacilityTransactions();
  const expectedQ = useQuery({
    queryKey: ["expected"],
    queryFn: () => api.get<{ rows: ExpectedTxn[] }>("/api/data/expected"),
  });
  const expectedPending = useMemo(
    () =>
      (expectedQ.data?.rows ?? [])
        .filter((r) => r.status === "pending")
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()),
    [expectedQ.data],
  );
  const expectedIn = expectedPending
    .filter((r) => r.direction === "receivable")
    .reduce((s, r) => s + Number(r.amount), 0);
  const expectedOut = expectedPending
    .filter((r) => r.direction === "payable")
    .reduce((s, r) => s + Number(r.amount), 0);
  const [cashOpen, setCashOpen] = useState(false);
  const [availOpen, setAvailOpen] = useState(false);
  const [expectedDialog, setExpectedDialog] = useState<"receivable" | "payable" | null>(null);

  const cashRows = (cashQ.data?.rows ?? []).filter((r) => !r.is_superseded);
  const facilities = (facQ.data?.rows ?? []).filter((f) => f.status === "active");
  const bankAccounts = bankAccountsQ.data?.rows ?? [];

  const overdraftByKey = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of bankAccounts) {
      const key = `${b.account_name}|${b.account_number ?? ""}|${(b.currency || "MYR").toUpperCase()}`;
      m.set(key, (m.get(key) ?? 0) + Number(b.overdraft_limit || 0));
    }
    return m;
  }, [bankAccounts]);
  const totalOverdraft = useMemo(
    () => bankAccounts.reduce((s, b) => s + Number(b.overdraft_limit || 0), 0),
    [bankAccounts],
  );

  const totals = useMemo(() => {
    const totalCash = cashRows.reduce((s, r) => s + cashSignedAmount(r), 0);
    const totalLimit = facilities.reduce((s, f) => s + Number(f.total_limit), 0);
    const totalDrawn = facilities.reduce((s, f) => s + facilityOutstanding(f), 0);
    const totalAvailable = facilities.reduce((s, f) => s + facilityAvailable(f), 0);
    const netLiquidity = totalCash + totalAvailable + totalOverdraft;
    return { totalCash, totalLimit, totalDrawn, totalAvailable, netLiquidity };
  }, [cashRows, facilities, totalOverdraft]);

  const cashByBank = useMemo(() => {
    const map = new Map<
      string,
      {
        account_name: string;
        account_number: string | null;
        currency: string;
        balance: number;
        overdraft: number;
        txns: number;
      }
    >();
    for (const r of cashRows) {
      const key = `${r.bank_account_name}|${r.bank_account_number ?? ""}|${r.currency || "MYR"}`;
      const cur = map.get(key) ?? {
        account_name: r.bank_account_name,
        account_number: r.bank_account_number,
        currency: r.currency || "MYR",
        balance: 0,
        overdraft: overdraftByKey.get(key) ?? 0,
        txns: 0,
      };
      cur.balance += cashSignedAmount(r);
      cur.txns += 1;
      map.set(key, cur);
    }
    // Include bank accounts with an overdraft but no transactions yet.
    for (const b of bankAccounts) {
      const key = `${b.account_name}|${b.account_number ?? ""}|${(b.currency || "MYR").toUpperCase()}`;
      if (!map.has(key) && Number(b.overdraft_limit || 0) > 0) {
        map.set(key, {
          account_name: b.account_name,
          account_number: b.account_number,
          currency: b.currency || "MYR",
          balance: 0,
          overdraft: Number(b.overdraft_limit || 0),
          txns: 0,
        });
      }
    }
    return [...map.values()].sort((a, b) => (b.balance + b.overdraft) - (a.balance + a.overdraft));
  }, [cashRows, bankAccounts, overdraftByKey]);


  const withMaturity = facilities
    .filter((f) => f.maturity_date)
    .sort(
      (a, b) => new Date(a.maturity_date!).getTime() - new Date(b.maturity_date!).getTime(),
    );

  const now = new Date();
  const in60Days = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
  const upcomingMatured = useMemo(() => {
    const facilityRows = facilities
      .filter((f) => f.maturity_date && new Date(f.maturity_date) >= now && new Date(f.maturity_date) <= in60Days)
      .map((f) => ({ kind: "facility" as const, id: f.id, item: f, date: f.maturity_date!, amount: facilityOutstanding(f) }));
    const drawdownRows = (txnQ.data?.rows ?? [])
      .filter(
        (r) =>
          r.txn_type === "drawdown" &&
          !r.is_superseded &&
          !r.settled_at &&
          r.maturity_date &&
          new Date(r.maturity_date) >= now &&
          new Date(r.maturity_date) <= in60Days,
      )
      .map((r) => ({ kind: "drawdown" as const, id: r.id, item: r, date: r.maturity_date!, amount: Number(r.amount) }));
    return [...facilityRows, ...drawdownRows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [facilities, txnQ.data, now, in60Days]);
  const totalUpcomingMatured = upcomingMatured.reduce((s, x) => s + x.amount, 0);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentTxns = cashRows
    .filter((r) => r.txn_date && new Date(r.txn_date) >= sevenDaysAgo)
    .sort((a, b) => new Date(b.txn_date!).getTime() - new Date(a.txn_date!).getTime());

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Summary Dashboard</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Real-time cash position, credit facility exposure, and upcoming maturities.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4">
        <BigStat
          label="Total Cash Balance"
          value={formatMoney(totals.totalCash)}
          icon={<Banknote className="h-5 w-5" />}
          tone={totals.totalCash >= 0 ? "positive" : "negative"}
          onClick={() => setCashOpen(true)}
          hint="Click to see by bank"
        />
        <BigStat
          label="Cash Balance with Overdraft"
          value={formatMoney(totals.totalCash + totalOverdraft)}
          icon={<Banknote className="h-5 w-5" />}
          tone={totals.totalCash + totalOverdraft >= 0 ? "positive" : "negative"}
          onClick={() => setCashOpen(true)}
          hint="Cash + total overdraft facility"
        />
        <BigStat
          label="Total Facility Limit"
          value={formatMoney(totals.totalLimit)}
          icon={<Landmark className="h-5 w-5" />}
        />
        <BigStat
          label="Facility Drawn"
          value={formatMoney(totals.totalDrawn)}
          icon={<TrendingDown className="h-5 w-5" />}
          tone="warn"
        />
        <BigStat
          label="Facility Available"
          value={formatMoney(totals.totalAvailable)}
          icon={<TrendingUp className="h-5 w-5" />}
          tone="positive"
          onClick={() => setAvailOpen(true)}
          hint="Click to see by facility"
        />
        <BigStat
          label="Net Liquidity"
          value={formatMoney(totals.netLiquidity)}
          icon={<Scale className="h-5 w-5" />}
          tone={totals.netLiquidity >= 0 ? "positive" : "negative"}
          emphasized
        />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> Upcoming Facility Matured (Next 60 Days)
            </CardTitle>
            <span className="text-xs text-muted-foreground">
              Total: {formatMoney(totalUpcomingMatured)}
            </span>
          </CardHeader>
          <CardContent>
            {upcomingMatured.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No facilities or drawdowns maturing in the next 60 days.
              </p>
            ) : (
              <ul className="divide-y">
                {upcomingMatured.map((x) => {
                  const days = Math.ceil(
                    (new Date(x.date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                  );
                  const label =
                    x.kind === "facility"
                      ? x.item.name ?? x.item.facility_type
                      : x.item.remarks ?? `Drawdown · ${x.item.facility_name}`;
                  const sub =
                    x.kind === "facility"
                      ? `${new Date(x.date).toLocaleDateString()} · in ${days} day${days === 1 ? "" : "s"}`
                      : `${x.item.lending_bank} · ${new Date(x.date).toLocaleDateString()} · in ${days} day${days === 1 ? "" : "s"}`;
                  return (
                    <li key={`${x.kind}-${x.id}`} className="flex items-center justify-between py-2 text-sm">
                      <div>
                        <div className="font-medium">{label}</div>
                        <div className="text-xs text-muted-foreground">{sub}</div>
                      </div>
                      <div className="text-right font-medium">{formatMoney(x.amount)}</div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Receipt className="h-4 w-4" /> Recent Cash Transactions (Last 7 Days)
            </CardTitle>
            <span className="text-xs text-muted-foreground">{recentTxns.length} txn(s)</span>
          </CardHeader>
          <CardContent>
            {recentTxns.length === 0 ? (
              <p className="text-sm text-muted-foreground">No cash transactions in the last 7 days.</p>
            ) : (
              <ul className="divide-y">
                {recentTxns.map((t) => {
                  const amt = cashSignedAmount(t);
                  return (
                    <li key={t.id} className="flex items-center justify-between py-2 text-sm">
                      <div className="min-w-0">
                        <div className="font-medium truncate">{t.remarks ?? t.txn_type}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(t.txn_date!).toLocaleDateString()}
                          {t.bank_account_name ? ` · ${t.bank_account_name}` : ""}
                        </div>
                      </div>
                      <div className={`text-right font-medium ${amt < 0 ? "text-red-600" : "text-emerald-600"}`}>
                        {formatMoney(amt)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CalendarDays className="h-4 w-4" /> Expected Payments &amp; Receivables
            </CardTitle>
            <span className="flex flex-wrap items-center gap-1.5 text-xs">
              <button
                type="button"
                onClick={() => setExpectedDialog("receivable")}
                className="rounded-md border px-2 py-1 font-medium text-emerald-700 transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
              >
                In {formatMoney(expectedIn)}
              </button>
              <button
                type="button"
                onClick={() => setExpectedDialog("payable")}
                className="rounded-md border px-2 py-1 font-medium text-red-700 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
              >
                Out {formatMoney(expectedOut)}
              </button>
              <span className="text-muted-foreground">
                · Net {formatMoney(expectedIn - expectedOut)}
              </span>
            </span>
          </CardHeader>
          <CardContent>
            {expectedPending.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No upcoming payments or receivables recorded yet.
              </p>
            ) : (
              <ul className="divide-y">
                {expectedPending.map((r) => {
                  const days = Math.ceil(
                    (new Date(r.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                  );
                  const incoming = r.direction === "receivable";
                  return (
                    <li key={r.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                      <div className="min-w-0">
                        <div className="truncate font-medium">
                          {r.counterparty || r.remarks || (incoming ? "Receivable" : "Payment")}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {incoming ? "Incoming" : "Payment"} ·{" "}
                          {new Date(r.due_date).toLocaleDateString()} ·{" "}
                          {days < 0 ? `${Math.abs(days)}d overdue` : `in ${days}d`}
                          {r.bank_account_name ? ` · ${r.bank_account_name}` : ""}
                        </div>
                      </div>
                      <div
                        className={`text-right font-medium ${
                          incoming ? "text-emerald-600" : "text-red-600"
                        }`}
                      >
                        {incoming ? "+" : "−"}
                        {formatMoney(Number(r.amount), r.currency)}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>



      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Facility Maturities</CardTitle>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" /> Safe
              <span className="ml-2 inline-block h-2 w-2 rounded-full bg-amber-500" /> Watch
              <span className="ml-2 inline-block h-2 w-2 rounded-full bg-red-500" /> Urgent
            </div>
          </CardHeader>
          <CardContent>
            {facQ.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : withMaturity.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No active facilities with maturity dates. Add facilities from the Facility Management screen.
              </p>
            ) : (
              <ul className="divide-y">
                {withMaturity.map((f) => {
                  const alert = facilityMaturityAlert(f.maturity_date);
                  const dot =
                    alert === "red"
                      ? "bg-red-500"
                      : alert === "amber"
                        ? "bg-amber-500"
                        : "bg-emerald-500";
                  const days = Math.ceil(
                    (new Date(f.maturity_date!).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                  );
                  return (
                    <li key={f.id} className="flex items-center justify-between gap-4 py-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <span className={`mt-1.5 inline-block h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium">{f.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {f.lending_bank} · {f.facility_type.replace("_", " ")}
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium">{f.maturity_date}</div>
                        <div className="text-xs text-muted-foreground">
                          {days < 0 ? `${Math.abs(days)}d overdue` : `${days}d away`}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>



      </section>

      <Dialog open={cashOpen} onOpenChange={setCashOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Cash by Bank Account</DialogTitle>
            <DialogDescription>
              Net balance per bank account, derived from recorded cash transactions.
            </DialogDescription>
          </DialogHeader>
          {cashByBank.length === 0 ? (
            <p className="text-sm text-muted-foreground">No cash transactions recorded yet.</p>
          ) : (
            <ul className="divide-y">
              {cashByBank.map((b, i) => {
                const available = b.balance + b.overdraft;
                return (
                  <li key={i} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{b.account_name}</div>
                      <div className="truncate text-xs text-muted-foreground font-mono">
                        {b.account_number || "—"} · {b.txns} txn{b.txns === 1 ? "" : "s"}
                      </div>
                      {b.overdraft > 0 && (
                        <div className="text-xs text-muted-foreground">
                          Cash {formatMoney(b.balance, b.currency)} + OD {formatMoney(b.overdraft, b.currency)}
                        </div>
                      )}
                    </div>
                    <Badge
                      variant="secondary"
                      className={`font-mono tabular-nums ${
                        available < 0 ? "text-red-600 dark:text-red-400" : ""
                      }`}
                    >
                      {formatMoney(available, b.currency)}
                    </Badge>
                  </li>
                );
              })}
              <li className="flex items-center justify-between gap-4 pt-3">
                <div className="text-sm font-semibold">Total (incl. overdraft)</div>
                <div className="font-mono tabular-nums text-sm font-semibold">
                  {formatMoney(totals.totalCash + totalOverdraft)}
                </div>
              </li>

            </ul>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={availOpen} onOpenChange={setAvailOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Facility Available — Detail</DialogTitle>
            <DialogDescription>
              Remaining available limit per active facility (limit − drawn + repaid).
            </DialogDescription>
          </DialogHeader>
          {facilities.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active facilities.</p>
          ) : (
            <ul className="divide-y max-h-[60vh] overflow-auto">
              {[...facilities]
                .sort((a, b) => facilityAvailable(b) - facilityAvailable(a))
                .map((f) => {
                  const avail = facilityAvailable(f);
                  const limit = Number(f.total_limit);
                  const pct = limit > 0 ? Math.max(0, Math.min(100, (avail / limit) * 100)) : 0;
                  return (
                    <li key={f.id} className="py-3">
                      <div className="flex items-center justify-between text-sm">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{f.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {f.lending_bank} · {f.facility_type.replace(/_/g, " ")}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold text-emerald-600">{formatMoney(avail)}</div>
                          <div className="text-xs text-muted-foreground">
                            of {formatMoney(limit)}
                          </div>
                        </div>
                      </div>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              <li className="flex items-center justify-between pt-3 text-sm font-semibold">
                <span>Total Available</span>
                <span className="text-emerald-600">{formatMoney(totals.totalAvailable)}</span>
              </li>
            </ul>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={expectedDialog !== null} onOpenChange={(o) => !o && setExpectedDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {expectedDialog === "payable" ? "Expected Outgoing — Detail" : "Expected Incoming — Detail"}
            </DialogTitle>
            <DialogDescription>
              {expectedDialog === "payable"
                ? "Pending payments, with anything past its expected date flagged as overdue."
                : "Pending receivables, with anything past its expected date flagged as overdue."}
            </DialogDescription>
          </DialogHeader>
          {(() => {
            const rows = expectedPending
              .filter((r) => r.direction === expectedDialog)
              .sort((a, b) => {
                const ad = new Date(a.due_date).getTime();
                const bd = new Date(b.due_date).getTime();
                return ad - bd;
              });
            const overdue = rows.filter((r) => new Date(r.due_date).getTime() < Date.now());
            const total = rows.reduce((s, r) => s + Number(r.amount), 0);
            const overdueTotal = overdue.reduce((s, r) => s + Number(r.amount), 0);
            if (rows.length === 0)
              return <p className="text-sm text-muted-foreground">Nothing pending.</p>;
            return (
              <>
                {overdue.length > 0 && (
                  <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {overdue.length} item(s) past their expected date and not yet processed —{" "}
                      {formatMoney(overdueTotal)} in total.
                    </span>
                  </div>
                )}
                {(() => {
                  const groups = new Map<string, typeof rows>();
                  for (const r of rows) {
                    const key = r.bank_account_name
                      ? `${r.bank_account_name}${r.bank_account_number ? ` (${r.bank_account_number})` : ""}`
                      : "No bank selected";
                    const list = groups.get(key) ?? [];
                    list.push(r);
                    groups.set(key, list);
                  }
                  return (
                    <div className="max-h-[55vh] space-y-4 overflow-auto pr-1">
                      {[...groups.entries()].map(([bank, items]) => {
                        const subtotal = items.reduce((s, r) => s + Number(r.amount), 0);
                        return (
                          <div key={bank} className="rounded-md border">
                            <div className="flex items-center justify-between gap-4 border-b bg-muted/50 px-3 py-2">
                              <span className="truncate text-sm font-medium">{bank}</span>
                              <span
                                className={`shrink-0 text-sm font-semibold ${
                                  expectedDialog === "receivable" ? "text-emerald-600" : "text-red-600"
                                }`}
                              >
                                {formatMoney(subtotal)}
                              </span>
                            </div>
                            <ul className="divide-y">
                              {items.map((r) => {
                                const days = Math.ceil(
                                  (new Date(r.due_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                                );
                                const isOverdue = days < 0;
                                return (
                                  <li
                                    key={r.id}
                                    className={`flex items-center justify-between gap-4 px-3 py-3 text-sm ${
                                      isOverdue ? "bg-red-50/60 dark:bg-red-950/20" : ""
                                    }`}
                                  >
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-2">
                                        <span className="truncate font-medium">
                                          {r.counterparty || r.remarks || (r.direction === "receivable" ? "Receivable" : "Payment")}
                                        </span>
                                        {isOverdue && (
                                          <Badge variant="destructive" className="shrink-0 text-[10px]">
                                            Overdue {Math.abs(days)}d
                                          </Badge>
                                        )}
                                      </div>
                                      <div className="text-xs text-muted-foreground">
                                        Expected {new Date(r.due_date).toLocaleDateString()}
                                        {r.remarks && r.counterparty ? ` · ${r.remarks}` : ""}
                                      </div>
                                    </div>
                                    <div
                                      className={`shrink-0 text-right font-medium ${
                                        r.direction === "receivable" ? "text-emerald-600" : "text-red-600"
                                      }`}
                                    >
                                      {formatMoney(Number(r.amount), r.currency)}
                                    </div>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
                <div className="flex items-center justify-between border-t pt-3 text-sm font-semibold">
                  <span>Total pending</span>
                  <span className={expectedDialog === "receivable" ? "text-emerald-600" : "text-red-600"}>
                    {formatMoney(total)}
                  </span>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function BigStat({
  label,
  value,
  icon,
  tone,
  emphasized,
  onClick,
  hint,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "positive" | "negative" | "warn";
  emphasized?: boolean;
  onClick?: () => void;
  hint?: string;
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "negative"
        ? "text-red-600 dark:text-red-400"
        : tone === "warn"
          ? "text-amber-600 dark:text-amber-400"
          : "text-foreground";
  const clickable = !!onClick;
  return (
    <Card
      className={[
        emphasized ? "border-primary/40 shadow-md" : "",
        clickable ? "cursor-pointer transition-colors hover:bg-accent/40 hover:border-primary/40" : "",
      ].join(" ")}
      onClick={onClick}
      role={clickable ? "button" : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider text-muted-foreground">
          <span>{label}</span>
          <span className="text-muted-foreground/70">{icon}</span>
        </div>
        <div className={`mt-3 text-2xl font-semibold tabular-nums md:text-3xl ${toneClass}`}>
          {value}
        </div>
        {hint && <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  );
}
