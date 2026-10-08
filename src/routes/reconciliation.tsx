import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { api } from "@/lib/qne-client";
import { type CashTxn, formatMoney } from "@/lib/finance";
import { reconcile, type Statement } from "@/lib/reconcile";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, ScanLine } from "lucide-react";
import type { BankAccount } from "./bank-accounts";

export const Route = createFileRoute("/reconciliation")({
  head: () => ({
    meta: [
      { title: "Bank Reconciliation — Finance Balance Monitor" },
      { name: "description", content: "Scan a bank statement and compare it with recorded cash transactions." },
    ],
  }),
  component: ReconciliationPage,
});

const MAX_BYTES = 10 * 1024 * 1024;
const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp,image/gif";

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(new Error("Could not read the file"));
    reader.readAsDataURL(file);
  });
}

const digits = (s: string | null | undefined) => (s || "").replace(/\D/g, "");

function ReconciliationPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [accountId, setAccountId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [statement, setStatement] = useState<Statement | null>(null);
  const [opening, setOpening] = useState("");
  const [closing, setClosing] = useState("");

  const accountsQ = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: () => api.get<{ rows: BankAccount[] }>("/api/data/bank-accounts"),
  });
  const cashQ = useQuery({
    queryKey: ["cash"],
    queryFn: () => api.get<{ rows: CashTxn[] }>("/api/data/cash"),
  });
  const accounts = (accountsQ.data?.rows ?? []).filter((a) => a.is_active);
  const account = accounts.find((a) => a.id === accountId) ?? null;

  const scan = useMutation({
    mutationFn: async (f: File) =>
      api.post<{ statement: Statement }>("/api/data/reconcile-scan", {
        file_base64: await toBase64(f),
        media_type: f.type,
      }),
    onSuccess: ({ statement: s }) => {
      setStatement(s);
      setOpening(s.opening_balance === null ? "" : String(s.opening_balance));
      setClosing(s.closing_balance === null ? "" : String(s.closing_balance));
      if (s.transactions.length === 0) toast.warning("No transactions were found in this file");
    },
    onError: (e: any) => toast.error(e?.message || "Scan failed"),
  });

  const accountTxns = useMemo(() => {
    if (!account) return [];
    return (cashQ.data?.rows ?? []).filter((t) =>
      account.account_number
        ? t.bank_account_number === account.account_number
        : t.bank_account_name === account.account_name,
    );
  }, [cashQ.data, account]);

  const result = useMemo(() => {
    if (!statement || !account) return null;
    const num = (v: string) => (v.trim() === "" || Number.isNaN(Number(v)) ? null : Number(v));
    return reconcile(
      { ...statement, opening_balance: num(opening), closing_balance: num(closing) },
      accountTxns,
    );
  }, [statement, account, opening, closing, accountTxns]);

  const currency = account?.currency || statement?.currency || "MYR";
  const money = (n: number) => formatMoney(n, currency);
  const accountMismatch =
    !!statement?.account_number &&
    !!account?.account_number &&
    digits(statement.account_number) !== digits(account.account_number) &&
    !digits(statement.account_number).endsWith(digits(account.account_number).slice(-4));

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Bank Reconciliation</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a bank statement (PDF or image). It is scanned automatically and compared with the cash
          transactions recorded for the selected account.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Statement</CardTitle>
          <CardDescription>Choose the account, then upload its statement (max 10 MB).</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Bank account</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a bank account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.bank_name} — {a.account_name} ({a.account_number})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Statement file</Label>
            <Input
              ref={fileRef}
              type="file"
              accept={ACCEPT}
              onChange={(e) => {
                const f = e.target.files?.[0] ?? null;
                if (f && f.size > MAX_BYTES) {
                  toast.error("File is larger than 10 MB");
                  e.target.value = "";
                  return;
                }
                setFile(f);
                setStatement(null);
              }}
            />
          </div>
          <div className="md:col-span-2 flex justify-end">
            <Button
              disabled={!file || !account || scan.isPending}
              onClick={() => file && scan.mutate(file)}
            >
              <ScanLine className="mr-2 h-4 w-4" />
              {scan.isPending ? "Scanning…" : "Scan & reconcile"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {statement && result && account && (
        <>
          {accountMismatch && (
            <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                The statement shows account <span className="font-mono">{statement.account_number}</span>, but
                you selected <span className="font-mono">{account.account_number}</span>. Check you picked the
                right account.
              </span>
            </div>
          )}

          <Card>
            <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
              <div>
                <CardTitle className="text-base">2. Result</CardTitle>
                <CardDescription>
                  {statement.bank_name || "Statement"} · {result.periodStart || "?"} to {result.periodEnd || "?"} ·{" "}
                  {statement.transactions.length} lines scanned
                </CardDescription>
              </div>
              {result.closingDiff === null ? (
                <Badge variant="secondary">Enter closing balance</Badge>
              ) : result.balanced ? (
                <Badge className="gap-1 bg-emerald-600 text-white hover:bg-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Balanced
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <AlertTriangle className="h-3.5 w-3.5" /> Difference {money(result.closingDiff)}
                </Badge>
              )}
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Statement opening balance</Label>
                  <Input type="number" step="0.01" value={opening} onChange={(e) => setOpening(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Statement closing balance</Label>
                  <Input type="number" step="0.01" value={closing} onChange={(e) => setClosing(e.target.value)} />
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Balances read from the statement — correct them here if the scan misread a figure.
              </p>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Stat label="Statement closing" value={result.statementClosing === null ? "—" : money(result.statementClosing)} />
                <Stat label="System balance (same date)" value={money(result.systemClosing)} />
                <Stat
                  label="Difference"
                  value={result.closingDiff === null ? "—" : money(result.closingDiff)}
                  tone={result.closingDiff === null ? undefined : result.balanced ? "good" : "bad"}
                />
              </div>

              {result.statementMathDiff !== null && Math.abs(result.statementMathDiff) >= 0.005 && (
                <Note tone="warn">
                  The scanned lines don't add up to the statement: opening + credits − debits is{" "}
                  {money(Math.abs(result.statementMathDiff))} {result.statementMathDiff > 0 ? "above" : "below"} the
                  closing balance. A line may have been missed or misread — check the figures against the file.
                </Note>
              )}
              {result.openingDiff !== null && Math.abs(result.openingDiff) >= 0.005 && (
                <Note tone="warn">
                  Opening balances differ by {money(result.openingDiff)} (statement {money(result.statementOpening ?? 0)}{" "}
                  vs system {money(result.systemOpening)}). Entries from before {result.periodStart} may be missing or
                  wrong, and this carries into the closing difference.
                </Note>
              )}
              {result.closingDiff !== null && !result.balanced && (
                <Note tone="info">
                  Unmatched items below explain {money(result.unmatchedNet)} of the {money(result.closingDiff)}{" "}
                  difference
                  {Math.abs(result.closingDiff - result.unmatchedNet) >= 0.005
                    ? `; the remaining ${money(round2(result.closingDiff - result.unmatchedNet))} comes from the opening balance or scan errors.`
                    : "."}
                </Note>
              )}
            </CardContent>
          </Card>

          <Card className={result.statementOnly.length ? "border-red-500/40" : undefined}>
            <CardHeader>
              <CardTitle className="text-base">On the statement, missing in the system ({result.statementOnly.length})</CardTitle>
              <CardDescription>The bank shows these, but no matching entry was recorded. Add them in Cash Transaction Entry.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Rows
                empty="Nothing missing."
                rows={result.statementOnly.map((t, i) => ({
                  key: `s${i}`,
                  date: t.date,
                  text: t.description,
                  amount: t.direction === "credit" ? t.amount : -t.amount,
                  tag: "Not in system",
                  tone: "red",
                }))}
                money={money}
              />
            </CardContent>
          </Card>

          <Card className={result.systemOnly.length ? "border-amber-500/40" : undefined}>
            <CardHeader>
              <CardTitle className="text-base">In the system, not on the statement ({result.systemOnly.length})</CardTitle>
              <CardDescription>Recorded here but not on the bank statement — uncleared items, wrong amounts, or wrong dates.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Rows
                empty="Nothing extra."
                rows={result.systemOnly.map((t) => ({
                  key: t.id,
                  date: t.txn_date,
                  text: t.remarks || "—",
                  amount: t.txn_type === "deposit" ? Number(t.amount) : -Number(t.amount),
                  tag: "Not on statement",
                  tone: "amber",
                }))}
                money={money}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Matched ({result.matched.length})</CardTitle>
              <CardDescription>Same amount and direction, dates within 3 days.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Rows
                empty="No matches."
                rows={result.matched.map((m, i) => ({
                  key: `m${i}`,
                  date: m.stmt.date,
                  text: m.stmt.description,
                  amount: m.stmt.direction === "credit" ? m.stmt.amount : -m.stmt.amount,
                  tag: m.dayDiff === 0 ? "Matched" : `Matched (${m.dayDiff}d apart)`,
                  tone: "green",
                }))}
                money={money}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function Stat({ label, value, tone }: { label: string; value: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-md border bg-muted/30 p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div
        className={`mt-1 font-mono text-lg font-semibold tabular-nums ${
          tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

function Note({ tone, children }: { tone: "warn" | "info"; children: React.ReactNode }) {
  return (
    <div
      className={`rounded-md border p-3 text-sm ${
        tone === "warn" ? "border-amber-500/40 bg-amber-500/10" : "bg-muted/40 text-muted-foreground"
      }`}
    >
      {children}
    </div>
  );
}

type Row = { key: string; date: string; text: string; amount: number; tag: string; tone: "red" | "amber" | "green" };

function Rows({ rows, empty, money }: { rows: Row[]; empty: string; money: (n: number) => string }) {
  if (rows.length === 0) return <p className="p-4 text-sm text-muted-foreground">{empty}</p>;
  const bg = { red: "bg-red-500/10", amber: "bg-amber-500/10", green: "" } as const;
  const tagCls = {
    red: "bg-red-500/15 text-red-700",
    amber: "bg-amber-500/15 text-amber-700",
    green: "bg-emerald-500/15 text-emerald-700",
  } as const;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <tbody className="divide-y">
          {rows.map((r) => (
            <tr key={r.key} className={bg[r.tone]}>
              <td className="whitespace-nowrap px-4 py-2">{r.date}</td>
              <td className="px-4 py-2">{r.text}</td>
              <td className="px-4 py-2">
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${tagCls[r.tone]}`}>
                  {r.tag}
                </span>
              </td>
              <td className={`whitespace-nowrap px-4 py-2 text-right font-mono ${r.amount < 0 ? "text-red-600" : "text-emerald-600"}`}>
                {r.amount < 0 ? "−" : "+"}
                {money(Math.abs(r.amount))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
