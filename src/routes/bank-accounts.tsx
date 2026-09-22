import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/qne-client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Pencil, Trash2, X } from "lucide-react";

export type BankAccount = {
  id: string;
  tenant_code: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  currency: string;
  is_active: boolean;
  remarks: string | null;
  overdraft_limit: number;
  created_at: string;
  updated_at: string;
};

export const Route = createFileRoute("/bank-accounts")({
  head: () => ({
    meta: [
      { title: "Bank Accounts — Finance Balance Monitor" },
      { name: "description", content: "Maintain the list of bank accounts used in cash transactions." },
    ],
  }),
  component: BankAccountsPage,
});

const empty = {
  bank_name: "",
  account_name: "",
  account_number: "",
  currency: "MYR",
  remarks: "",
  overdraft_limit: "",
  is_active: true,
};


function BankAccountsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(empty);
  const [editingId, setEditingId] = useState<string | null>(null);

  const q = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get<{ rows: BankAccount[] }>("/api/data/bank-accounts"),
  });

  const save = useMutation({
    mutationFn: (body: any) => api.post("/api/data/bank-accounts", body),
    onSuccess: () => {
      toast.success(editingId ? "Bank account updated" : "Bank account added");
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
      setForm(empty);
      setEditingId(null);
    },
    onError: (e: any) => toast.error(e?.message || "Failed to save"),
  });

  const update = useMutation({
    mutationFn: (body: any) => api.post("/api/data/bank-accounts", body),
    onSuccess: () => {
      toast.success("Overdraft updated");
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to update"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/api/data/bank-accounts?id=${encodeURIComponent(id)}`),
    onSuccess: () => {
      toast.success("Bank account removed");
      qc.invalidateQueries({ queryKey: ["bank-accounts"] });
    },
    onError: (e: any) => toast.error(e?.message || "Failed to delete"),
  });

  const rows = q.data?.rows ?? [];

  const startEdit = (r: BankAccount) => {
    setEditingId(r.id);
    setForm({
      bank_name: r.bank_name,
      account_name: r.account_name,
      account_number: r.account_number,
      currency: r.currency,
      remarks: r.remarks ?? "",
      overdraft_limit: String(r.overdraft_limit ?? ""),
      is_active: r.is_active,
    });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(empty);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="max-w-5xl space-y-6 min-w-0">

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bank Accounts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reusable list of bank accounts. Selecting one in Cash Transaction Entry auto-fills the account number.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editingId ? "Edit bank account" : "Add bank account"}</CardTitle>
          <CardDescription>Bank, account name, and number are required.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            className="grid grid-cols-1 gap-4 md:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!form.bank_name || !form.account_name || !form.account_number) {
                toast.error("Fill in bank, account name and account number");
                return;
              }
              save.mutate(editingId ? { ...form, id: editingId } : form);
            }}
          >
            <Field label="Bank">
              <Input
                required
                value={form.bank_name}
                onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
                placeholder="Maybank"
              />
            </Field>
            <Field label="Account name">
              <Input
                required
                value={form.account_name}
                onChange={(e) => setForm({ ...form, account_name: e.target.value })}
                placeholder="Maybank Current 001"
              />
            </Field>
            <Field label="Account number">
              <Input
                required
                value={form.account_number}
                onChange={(e) => setForm({ ...form, account_number: e.target.value })}
                placeholder="1234-5678-90"
              />
            </Field>
            <Field label="Currency">
              <Input
                value={form.currency}
                maxLength={5}
                onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
              />
            </Field>
            <Field label="Overdraft limit">
              <Input
                type="number"
                min="0"
                step="0.01"
                placeholder="0.00"
                value={form.overdraft_limit}
                onChange={(e) => setForm({ ...form, overdraft_limit: e.target.value })}
              />
            </Field>

            <Field label="Remarks" className="md:col-span-2">
              <Textarea
                rows={2}
                value={form.remarks}
                onChange={(e) => setForm({ ...form, remarks: e.target.value })}
              />
            </Field>
            <div className="md:col-span-2 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={cancelEdit}>
                {editingId ? "Cancel" : "Reset"}
              </Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Saving…" : editingId ? "Update bank account" : "Add bank account"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Existing accounts</CardTitle>
          <CardDescription>{rows.length} account{rows.length === 1 ? "" : "s"}</CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bank</TableHead>
                <TableHead>Account name</TableHead>
                <TableHead>Account number</TableHead>
                <TableHead>Currency</TableHead>
                <TableHead className="text-right">Overdraft</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-24 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-6">
                    {q.isLoading ? "Loading…" : "No bank accounts yet."}
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id} className={editingId === r.id ? "bg-muted/40" : undefined}>
                    <TableCell className="font-medium">{r.bank_name}</TableCell>
                    <TableCell>{r.account_name}</TableCell>
                    <TableCell className="font-mono text-xs">{r.account_number}</TableCell>
                    <TableCell>{r.currency}</TableCell>
                    <TableCell className="text-right font-mono">
                      {Number(r.overdraft_limit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </TableCell>

                    <TableCell>
                      <Badge variant={r.is_active ? "default" : "secondary"}>
                        {r.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {editingId === r.id ? (
                          <Button size="icon" variant="ghost" onClick={cancelEdit} title="Cancel edit">
                            <X className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button size="icon" variant="ghost" onClick={() => startEdit(r)} title="Edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => {
                            if (confirm(`Delete ${r.account_name}?`)) remove.mutate(r.id);
                          }}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
      <OverdraftSidebar
        rows={rows}
        onSave={(r, limit) => update.mutate({ ...r, overdraft_limit: limit })}
        saving={update.isPending}
      />
    </div>
  );
}

function OverdraftSidebar({
  rows,
  onSave,
  saving,
}: {
  rows: BankAccount[];
  onSave: (r: BankAccount, limit: number) => void;
  saving: boolean;
}) {
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const total = rows.reduce((s, r) => s + Number(r.overdraft_limit || 0), 0);
  return (
    <aside className="xl:sticky xl:top-4 xl:h-[calc(100vh-2rem)]">
      <Card className="flex h-full flex-col">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Overdraft Facility</CardTitle>
          <CardDescription>
            Overdraft limits are added on top of each bank account's balance.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex-1 space-y-3 overflow-y-auto">
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
            <div className="text-muted-foreground uppercase tracking-wide">Total overdraft</div>
            <div className="font-mono text-sm font-semibold tabular-nums">
              {total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          {rows.length === 0 ? (
            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              Add a bank account first.
            </div>
          ) : (
            <ul className="space-y-2">
              {rows.map((r) => {
                const draft = drafts[r.id];
                const current = Number(r.overdraft_limit || 0);
                const val = draft ?? String(current || "");
                const dirty = Number(val || 0) !== current;
                return (
                  <li key={r.id} className="rounded-md border p-2 text-xs">
                    <div className="font-medium">{r.account_name}</div>
                    <div className="text-muted-foreground">
                      {r.bank_name} · {r.currency}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="h-8"
                        value={val}
                        onChange={(e) => setDrafts({ ...drafts, [r.id]: e.target.value })}
                      />
                      <Button
                        type="button"
                        size="sm"
                        disabled={!dirty || saving}
                        onClick={() => {
                          onSave(r, Number(val || 0));
                          setDrafts((d) => {
                            const { [r.id]: _, ...rest } = d;
                            return rest;
                          });
                        }}
                      >
                        Save
                      </Button>
                    </div>
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
