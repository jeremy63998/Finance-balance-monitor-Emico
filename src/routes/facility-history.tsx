import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/qne-client";
import { formatMoney } from "@/lib/finance";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { FacilityTxn } from "./facility-transactions";

export const Route = createFileRoute("/facility-history")({
  head: () => ({
    meta: [
      { title: "Facility Transaction History — Finance Balance Monitor" },
      { name: "description", content: "Full history of facility drawdowns, repayments, settlements and letters of credit." },
    ],
  }),
  component: FacilityHistoryPage,
});

type TypeFilter = "all" | "drawdown" | "repayment" | "letter_of_credit";
type StatusFilter = "all" | "open" | "settled" | "edited";

function FacilityHistoryPage() {
  const txnQ = useQuery({
    queryKey: ["facility-transactions"],
    queryFn: () => api.get<{ rows: FacilityTxn[] }>("/api/data/facility-transactions"),
  });
  const [q, setQ] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const rows = useMemo(() => {
    const base = txnQ.data?.rows ?? [];
    return [...base]
      .filter((r) => {
        if (typeFilter !== "all" && r.txn_type !== typeFilter) return false;
        if (statusFilter === "edited" && !r.is_superseded) return false;
        if (statusFilter === "settled" && !(r.settled_at || r.txn_type === "repayment")) return false;
        if (statusFilter === "open" && (r.settled_at || r.txn_type === "repayment" || r.is_superseded)) return false;
        if (q) {
          const s = q.toLowerCase();
          const hay = [
            r.facility_name,
            r.txn_number ?? "",

            r.lending_bank,
            r.remarks ?? "",
            r.entered_by ?? "",
            r.entered_by_email ?? "",
            r.settlement_bank_account_name ?? "",
          ]
            .join(" ")
            .toLowerCase();
          if (!hay.includes(s)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const d = (b.txn_date || "").localeCompare(a.txn_date || "");
        if (d) return d;
        return (b.created_at || "").localeCompare(a.created_at || "");
      });
  }, [txnQ.data, q, typeFilter, statusFilter]);

  const typeLabel = (t: FacilityTxn["txn_type"]) =>
    t === "drawdown" ? "Drawdown" : t === "repayment" ? "Repayment" : "LC";
  const typeCls = (t: FacilityTxn["txn_type"]) =>
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Facility Transaction History</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Every drawdown, repayment, settlement and letter of credit ever recorded.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search facility, bank, remarks, user…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="max-w-md"
        />
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Type" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="drawdown">Drawdown</SelectItem>
            <SelectItem value="repayment">Repayment</SelectItem>
            <SelectItem value="letter_of_credit">Letter of credit</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-44"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="settled">Settled / posted</SelectItem>
            <SelectItem value="edited">Edited (superseded)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Date</th>
                  <th className="px-3 py-2 text-left">Txn no.</th>
                  <th className="px-3 py-2 text-left">Type</th>

                  <th className="px-3 py-2 text-left">Facility</th>
                  <th className="px-3 py-2 text-left">Bank</th>
                  <th className="px-3 py-2 text-right">Amount</th>
                  <th className="px-3 py-2 text-left">Maturity</th>
                  <th className="px-3 py-2 text-left">Settlement</th>
                  <th className="px-3 py-2 text-left">Status</th>
                  <th className="px-3 py-2 text-left">Entered by</th>
                </tr>
              </thead>
              <tbody>
                {txnQ.isLoading && (
                  <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
                )}
                {!txnQ.isLoading && rows.length === 0 && (
                  <tr><td colSpan={10} className="p-6 text-center text-muted-foreground">No transactions match.</td></tr>
                )}
                {rows.map((r) => {
                  const s = statusOf(r);
                  return (
                    <tr key={r.id} className={`border-b last:border-0 ${r.is_superseded ? "opacity-70" : ""}`}>
                      <td className="px-3 py-2 whitespace-nowrap">{r.txn_date}</td>
                      <td className="px-3 py-2 font-mono text-xs">{r.txn_number || "—"}</td>

                      <td className="px-3 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${typeCls(r.txn_type)}`}>
                          {typeLabel(r.txn_type)}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{r.facility_name}</div>
                        {r.remarks && <div className="text-xs text-muted-foreground">{r.remarks}</div>}
                      </td>
                      <td className="px-3 py-2">{r.lending_bank}</td>
                      <td className="px-3 py-2 text-right font-mono">
                        {r.currency} {formatMoney(Number(r.amount || 0))}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{r.maturity_date || "—"}</td>
                      <td className="px-3 py-2">
                        {r.settlement_bank_account_name ? (
                          <>
                            <div>{r.settlement_bank_account_name}</div>
                            {r.settlement_bank_account_number && (
                              <div className="text-xs text-muted-foreground">{r.settlement_bank_account_number}</div>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                        {r.settled_at && (
                          <div className="text-xs text-muted-foreground">on {r.settled_at.slice(0, 10)}</div>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${s.cls}`}>
                          {s.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground">
                        {r.entered_by || r.entered_by_email || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
