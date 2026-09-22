import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/qne-client";
import type { Facility } from "@/lib/finance";
import { facilityAvailable, formatMoney } from "@/lib/finance";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { exportToXlsx, type ExportColumn } from "@/lib/export-xlsx";
import { Download, Trash2 } from "lucide-react";
import type { BankAccount } from "./bank-accounts";

export const Route = createFileRoute("/facilities")({
  head: () => ({
    meta: [
      { title: "Facility Management — Finance Balance Monitor" },
      { name: "description", content: "Create and update bank credit facilities." },
    ],
  }),
  component: FacilityFormPage,
});

const empty = {
  id: "",
  name: "",
  lending_bank: "",
  facility_type: "revolving_credit" as Facility["facility_type"],
  total_limit: "",
  amount_drawn: "",
  amount_repaid: "",
  maturity_date: "",
  interest_rate: "",
  currency: "MYR",
  status: "active" as Facility["status"],
  remarks: "",
};

function FacilityFormPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const facQ = useQuery({
    queryKey: ["facilities"],
    queryFn: () => api.get<{ rows: Facility[] }>("/api/data/facilities"),
  });

  const banksQ = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get<{ rows: BankAccount[] }>("/api/data/bank-accounts"),
  });
  const lendingBanks = useMemo(() => {
    const names = (banksQ.data?.rows ?? []).filter((b) => b.is_active).map((b) => b.bank_name);
    return Array.from(new Set(names)).sort();
  }, [banksQ.data]);

  const preview = useMemo(() => {
    const limit = Number(form.total_limit || 0);
    const drawn = Number(form.amount_drawn || 0);
    const repaid = Number(form.amount_repaid || 0);
    return limit - drawn + repaid;
  }, [form.total_limit, form.amount_drawn, form.amount_repaid]);

  const mut = useMutation({
    mutationFn: (body: any) => api.post("/api/data/facilities", body),
    onSuccess: () => {
      toast.success(form.id ? "Facility updated" : "Facility created");
      qc.invalidateQueries({ queryKey: ["facilities"] });
      setForm(empty);
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save"),
  });

  const del = useMutation({
    mutationFn: (id: string) => api.del(`/api/data/facilities?id=${encodeURIComponent(id)}`),
    onSuccess: () => {
      toast.success("Facility deleted");
      qc.invalidateQueries({ queryKey: ["facilities"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to delete"),
  });

  function edit(f: Facility) {
    setForm({
      id: f.id,
      name: f.name,
      lending_bank: f.lending_bank,
      facility_type: f.facility_type,
      total_limit: String(f.total_limit),
      amount_drawn: String(f.amount_drawn),
      amount_repaid: String(f.amount_repaid),
      maturity_date: f.maturity_date || "",
      interest_rate: f.interest_rate == null ? "" : String(f.interest_rate),
      currency: f.currency,
      status: f.status,
      remarks: f.remarks || "",
    });
  }

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Facility Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create or edit bank facility records. Amount available is calculated automatically.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {form.id ? "Edit facility" : "New facility"}
            </CardTitle>
            <CardDescription>Changes update the dashboard immediately.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="grid grid-cols-1 gap-4 md:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.lending_bank) {
                  toast.error("Select a lending bank");
                  return;
                }
                mut.mutate({ ...form, id: form.id || undefined });
              }}
            >
              <F label="Facility name">
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </F>
              <F label="Lending bank">
                {lendingBanks.length === 0 ? (
                  <div className="rounded-md border border-dashed p-2 text-xs text-muted-foreground">
                    No bank accounts yet.{" "}
                    <Link to="/bank-accounts" className="font-medium text-primary underline-offset-4 hover:underline">
                      Add one
                    </Link>
                  </div>
                ) : (
                  <Select
                    value={form.lending_bank}
                    onValueChange={(v) => setForm({ ...form, lending_bank: v })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {lendingBanks.map((name) => (
                        <SelectItem key={name} value={name}>
                          {name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </F>
              <F label="Facility type">
                <Select
                  value={form.facility_type}
                  onValueChange={(v) => setForm({ ...form, facility_type: v as any })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="revolving_credit">Revolving credit</SelectItem>
                    <SelectItem value="term_loan">Term loan</SelectItem>
                    <SelectItem value="overdraft">Overdraft</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </F>
              <F label="Status">
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="matured">Matured</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </F>
              <F label="Total limit">
                <Input type="number" step="0.01" min="0" required value={form.total_limit} onChange={(e) => setForm({ ...form, total_limit: e.target.value })} />
              </F>
              <F label="Amount drawn">
                <Input type="number" step="0.01" min="0" value={form.amount_drawn} onChange={(e) => setForm({ ...form, amount_drawn: e.target.value })} />
              </F>
              <F label="Amount repaid">
                <Input type="number" step="0.01" min="0" value={form.amount_repaid} onChange={(e) => setForm({ ...form, amount_repaid: e.target.value })} />
              </F>
              <F label="Amount available (calculated)">
                <Input readOnly value={formatMoney(preview, form.currency)} className="bg-muted font-mono" />
              </F>
              <F label="Maturity date">
                <Input type="date" value={form.maturity_date} onChange={(e) => setForm({ ...form, maturity_date: e.target.value })} />
              </F>
              <F label="Interest rate (%)">
                <Input type="number" step="0.001" min="0" value={form.interest_rate} onChange={(e) => setForm({ ...form, interest_rate: e.target.value })} />
              </F>
              <F label="Currency">
                <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} maxLength={5} />
              </F>
              <F label="Remarks" className="md:col-span-2">
                <Textarea rows={3} value={form.remarks} onChange={(e) => setForm({ ...form, remarks: e.target.value })} />
              </F>
              <div className="md:col-span-2 flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setForm(empty)}>
                  {form.id ? "Cancel edit" : "Reset"}
                </Button>
                <Button type="submit" disabled={mut.isPending}>
                  {mut.isPending ? "Saving…" : form.id ? "Save changes" : "Create facility"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>

      <Card className="h-fit">
        <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0">
          <div>
            <CardTitle className="text-base">Existing facilities</CardTitle>
            <CardDescription>Click a row to edit.</CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={(facQ.data?.rows ?? []).length === 0}
            onClick={() => {
              const rows = facQ.data?.rows ?? [];
              const cols: ExportColumn<Facility>[] = [
                { header: "Facility Name", value: "name", width: 28 },
                { header: "Lending Bank", value: "lending_bank", width: 24 },
                { header: "Type", value: "facility_type", width: 18 },
                { header: "Status", value: "status", width: 12 },
                { header: "Currency", value: "currency", width: 10 },
                { header: "Total Limit", value: (f) => Number(f.total_limit || 0), numFmt: "#,##0.00;(#,##0.00);-", width: 16 },
                { header: "Amount Drawn", value: (f) => Number(f.amount_drawn || 0), numFmt: "#,##0.00;(#,##0.00);-", width: 16 },
                { header: "Amount Repaid", value: (f) => Number(f.amount_repaid || 0), numFmt: "#,##0.00;(#,##0.00);-", width: 16 },
                { header: "Available", value: (f) => facilityAvailable(f), numFmt: "#,##0.00;(#,##0.00);-", width: 16 },
                { header: "Interest Rate %", value: (f) => (f.interest_rate ?? null), numFmt: "0.000", width: 14 },
                { header: "Maturity Date", value: (f) => f.maturity_date || "", width: 14 },
                { header: "Remarks", value: (f) => f.remarks || "", width: 40 },
              ];
              exportToXlsx("facilities", [
                { name: "Facilities", columns: cols, rows },
              ]);
            }}
          >
            <Download className="mr-2 h-4 w-4" /> Export
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          {facQ.isLoading ? (
            <p className="p-4 text-sm text-muted-foreground">Loading…</p>
          ) : (facQ.data?.rows ?? []).length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">No facilities yet.</p>
          ) : (
            <ul className="divide-y">
              {(facQ.data?.rows ?? []).map((f) => (
                <li key={f.id} className="flex items-center gap-1 px-2">
                  <button
                    type="button"
                    onClick={() => edit(f)}
                    className="min-w-0 flex-1 px-2 py-3 text-left hover:bg-accent"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-sm font-medium">{f.name}</span>
                      <span className="text-xs text-muted-foreground">{f.status}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {f.lending_bank} · Available {formatMoney(facilityAvailable(f), f.currency)}
                    </div>
                  </button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    title="Delete"
                    disabled={del.isPending}
                    onClick={() => {
                      if (confirm(`Delete facility "${f.name}"?`)) del.mutate(f.id);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function F({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className}`}>
      <Label>{label}</Label>
      {children}
    </div>
  );
}
