import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { api } from "@/lib/qne-client";
import {
  type Facility,
  facilityAvailable,
  facilityMaturityAlert,
  facilityOutstanding,
  formatMoney,
} from "@/lib/finance";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowUpDown, ChevronRight } from "lucide-react";
import type { FacilityTxn } from "./facility-transactions";


export const Route = createFileRoute("/facility-list")({
  head: () => ({
    meta: [
      { title: "Facility List — Finance Balance Monitor" },
      { name: "description", content: "Sortable list of all bank facilities and current exposure." },
    ],
  }),
  component: FacilityListPage,
});

type SortKey = "name" | "lending_bank" | "total_limit" | "amount_drawn" | "available" | "maturity_date" | "status";

function FacilityListPage() {
  const facQ = useQuery({
    queryKey: ["facilities"],
    queryFn: () => api.get<{ rows: Facility[] }>("/api/data/facilities"),
  });
  const txnQ = useQuery({
    queryKey: ["facility-transactions"],
    queryFn: () => api.get<{ rows: FacilityTxn[] }>("/api/data/facility-transactions"),
  });
  const [q, setQ] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("maturity_date");
  const [asc, setAsc] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const activeByFacility = useMemo(() => {
    const map = new Map<string, FacilityTxn[]>();
    for (const r of txnQ.data?.rows ?? []) {
      if (r.is_superseded) continue;
      if (r.txn_type !== "drawdown" && r.txn_type !== "letter_of_credit") continue;
      if (r.settled_at) continue;
      if (!r.facility_id) continue;
      const arr = map.get(r.facility_id) ?? [];
      arr.push(r);
      map.set(r.facility_id, arr);
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (b.txn_date || "").localeCompare(a.txn_date || ""));
    }
    return map;
  }, [txnQ.data]);


  const rows = useMemo(() => {
    const base = (facQ.data?.rows ?? []).filter((f) => {
      if (!q) return true;
      const s = q.toLowerCase();
      return (
        f.name.toLowerCase().includes(s) ||
        f.lending_bank.toLowerCase().includes(s) ||
        f.facility_type.includes(s) ||
        f.status.includes(s)
      );
    });
    const sorted = [...base].sort((a, b) => {
      const getV = (f: Facility) => {
        switch (sortKey) {
          case "available": return facilityAvailable(f);
          case "amount_drawn": return facilityOutstanding(f);
          case "maturity_date": return f.maturity_date ? new Date(f.maturity_date).getTime() : Infinity;
          case "total_limit": return f.total_limit;
          default: return (f as any)[sortKey] ?? "";
        }
      };
      const va = getV(a);
      const vb = getV(b);
      if (va < vb) return asc ? -1 : 1;
      if (va > vb) return asc ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [facQ.data, q, sortKey, asc]);

  function toggle(k: SortKey) {
    if (sortKey === k) setAsc(!asc);
    else { setSortKey(k); setAsc(true); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Facility List</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review exposure across all bank facilities at a glance.
        </p>
      </div>

      <Input
        placeholder="Search facility, bank, type, status…"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="max-w-md"
      />

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <Th onClick={() => toggle("name")}>Facility</Th>
                  <Th onClick={() => toggle("lending_bank")}>Bank</Th>
                  <Th onClick={() => toggle("total_limit")} align="right">Limit</Th>
                  <Th onClick={() => toggle("amount_drawn")} align="right">Drawn</Th>
                  <Th onClick={() => toggle("available")} align="right">Available</Th>
                  <Th onClick={() => toggle("maturity_date")}>Maturity</Th>
                  <Th onClick={() => toggle("status")}>Status</Th>
                </tr>
              </thead>
              <tbody>
                {facQ.isLoading && (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
                )}
                {!facQ.isLoading && rows.length === 0 && (
                  <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No facilities.</td></tr>
                )}
                {rows.map((f) => {
                  const alert = facilityMaturityAlert(f.maturity_date);
                  const dot =
                    alert === "red" ? "bg-red-500" : alert === "amber" ? "bg-amber-500" : alert === "green" ? "bg-emerald-500" : "bg-muted-foreground/30";
                  const active = activeByFacility.get(f.id) ?? [];
                  const isOpen = expanded === f.id;
                  return (
                    <Fragment key={f.id}>
                      <tr
                        className="cursor-pointer border-b last:border-0 hover:bg-muted/40"
                        onClick={() => setExpanded(isOpen ? null : f.id)}
                      >

                        <td className="px-4 py-2">
                          <div className="flex items-center gap-1.5">
                            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-90" : ""}`} />
                            <div>
                              <div className="font-medium">{f.name}</div>
                              <div className="text-xs text-muted-foreground">{f.facility_type.replace("_", " ")}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-2">{f.lending_bank}</td>
                        <td className="px-4 py-2 text-right font-mono">{formatMoney(f.total_limit, f.currency)}</td>
                        <td className="px-4 py-2 text-right font-mono">{formatMoney(facilityOutstanding(f), f.currency)}</td>
                        <td className="px-4 py-2 text-right font-mono">{formatMoney(facilityAvailable(f), f.currency)}</td>
                        <td className="px-4 py-2">
                          <div className="flex items-center gap-2">
                            <span className={`inline-block h-2 w-2 rounded-full ${dot}`} />
                            <span>{f.maturity_date || "—"}</span>
                          </div>
                        </td>
                        <td className="px-4 py-2 capitalize">{f.status}</td>
                      </tr>
                      {isOpen && (
                        <tr key={`${f.id}-active`} className="border-b bg-muted/20 last:border-0">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              Active drawdowns &amp; LCs ({active.length})
                            </div>
                            {active.length === 0 ? (
                              <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                                No open drawdowns or letters of credit for this facility.
                              </div>
                            ) : (
                              <table className="w-full text-xs">
                                <thead className="text-muted-foreground">
                                  <tr className="border-b">
                                    <th className="px-2 py-1 text-left font-medium">Type</th>
                                    <th className="px-2 py-1 text-left font-medium">Date</th>
                                    <th className="px-2 py-1 text-left font-medium">Txn no.</th>

                                    <th className="px-2 py-1 text-left font-medium">Maturity</th>
                                    <th className="px-2 py-1 text-right font-medium">Amount</th>
                                    <th className="px-2 py-1 text-left font-medium">Settlement bank</th>
                                    <th className="px-2 py-1 text-left font-medium">Remarks</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {active.map((t) => (
                                    <tr key={t.id} className="border-b last:border-0">
                                      <td className="px-2 py-1">
                                        <span
                                          className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                                            t.txn_type === "letter_of_credit"
                                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                              : "bg-blue-500/10 text-blue-700 dark:text-blue-300"
                                          }`}
                                        >
                                          {t.txn_type === "letter_of_credit" ? "LC" : "Drawdown"}
                                        </span>
                                      </td>
                                      <td className="px-2 py-1">{t.txn_date}</td>
                                      <td className="px-2 py-1 font-mono">{t.txn_number || "—"}</td>

                                      <td className="px-2 py-1">{t.maturity_date || "—"}</td>
                                      <td className="px-2 py-1 text-right font-mono">
                                        {formatMoney(Number(t.amount || 0), t.currency)}
                                      </td>
                                      <td className="px-2 py-1">
                                        {t.settlement_bank_account_name || "—"}
                                        {t.settlement_bank_account_number ? (
                                          <span className="text-muted-foreground"> · {t.settlement_bank_account_number}</span>
                                        ) : null}
                                      </td>
                                      <td className="px-2 py-1 text-muted-foreground">{t.remarks || ""}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
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

function Th({
  children,
  onClick,
  align = "left",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  align?: "left" | "right";
}) {
  return (
    <th className={`px-4 py-2 text-${align}`}>
      <button
        type="button"
        onClick={onClick}
        className={`inline-flex items-center gap-1 ${align === "right" ? "flex-row-reverse" : ""}`}
      >
        {children}
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </button>
    </th>
  );
}
