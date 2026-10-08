import type { CashTxn } from "./finance";

export type StatementTxn = {
  date: string;
  description: string;
  amount: number;
  direction: "credit" | "debit";
};

export type Statement = {
  bank_name: string | null;
  account_number: string | null;
  currency: string | null;
  period_start: string | null;
  period_end: string | null;
  opening_balance: number | null;
  closing_balance: number | null;
  transactions: StatementTxn[];
};

export type Match = { stmt: StatementTxn; sys: CashTxn; dayDiff: number };

export type ReconcileResult = {
  periodStart: string;
  periodEnd: string;
  matched: Match[];
  statementOnly: StatementTxn[];
  systemOnly: CashTxn[];
  systemOpening: number;
  systemClosing: number;
  statementOpening: number | null;
  statementClosing: number | null;
  openingDiff: number | null;
  closingDiff: number | null;
  statementMathDiff: number | null;
  unmatchedNet: number;
  balanced: boolean;
};

const cents = (n: number) => Math.round(Number(n) * 100);
const dayMs = 24 * 60 * 60 * 1000;
const dayDiffOf = (a: string, b: string) =>
  Math.round(Math.abs(new Date(a).getTime() - new Date(b).getTime()) / dayMs);

function sysDirection(t: CashTxn): "credit" | "debit" | null {
  if (t.txn_type === "deposit") return "credit";
  if (t.txn_type === "withdrawal") return "debit";
  return null;
}

function signed(t: CashTxn): number {
  const d = sysDirection(t);
  return d === "credit" ? Number(t.amount) : d === "debit" ? -Number(t.amount) : 0;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export function reconcile(
  statement: Statement,
  systemTxns: CashTxn[],
  toleranceDays = 3,
): ReconcileResult {
  const live = systemTxns.filter((t) => !t.is_superseded && sysDirection(t) !== null);
  const dates = statement.transactions.map((t) => t.date).filter(Boolean).sort();
  const periodStart = statement.period_start || dates[0] || "";
  const periodEnd = statement.period_end || dates[dates.length - 1] || "";

  const systemOpening = round2(
    live.filter((t) => t.txn_date < periodStart).reduce((s, t) => s + signed(t), 0),
  );
  const systemClosing = round2(
    live.filter((t) => t.txn_date <= periodEnd).reduce((s, t) => s + signed(t), 0),
  );

  const candidates = live.filter((t) => {
    const d = dayDiffOf(t.txn_date, periodStart);
    const e = dayDiffOf(t.txn_date, periodEnd);
    return (t.txn_date >= periodStart || d <= toleranceDays) && (t.txn_date <= periodEnd || e <= toleranceDays);
  });
  const used = new Set<string>();
  const matched: Match[] = [];
  const statementOnly: StatementTxn[] = [];

  const lines = [...statement.transactions].sort((a, b) => a.date.localeCompare(b.date));
  for (const line of lines) {
    let best: { sys: CashTxn; diff: number } | null = null;
    for (const t of candidates) {
      if (used.has(t.id)) continue;
      if (sysDirection(t) !== line.direction) continue;
      if (cents(t.amount) !== cents(line.amount)) continue;
      const diff = dayDiffOf(t.txn_date, line.date);
      if (diff > toleranceDays) continue;
      if (!best || diff < best.diff) best = { sys: t, diff };
    }
    if (best) {
      used.add(best.sys.id);
      matched.push({ stmt: line, sys: best.sys, dayDiff: best.diff });
    } else {
      statementOnly.push(line);
    }
  }

  const systemOnly = live
    .filter((t) => t.txn_date >= periodStart && t.txn_date <= periodEnd && !used.has(t.id))
    .sort((a, b) => a.txn_date.localeCompare(b.txn_date));

  const stmtSigned = (t: StatementTxn) => (t.direction === "credit" ? t.amount : -t.amount);
  const unmatchedNet = round2(
    statementOnly.reduce((s, t) => s + stmtSigned(t), 0) - systemOnly.reduce((s, t) => s + signed(t), 0),
  );

  const statementOpening = statement.opening_balance;
  const statementClosing = statement.closing_balance;
  const statementNet = statement.transactions.reduce((s, t) => s + stmtSigned(t), 0);
  const statementMathDiff =
    statementOpening !== null && statementClosing !== null
      ? round2(statementOpening + statementNet - statementClosing)
      : null;
  const closingDiff = statementClosing !== null ? round2(statementClosing - systemClosing) : null;
  const openingDiff = statementOpening !== null ? round2(statementOpening - systemOpening) : null;

  return {
    periodStart,
    periodEnd,
    matched,
    statementOnly,
    systemOnly,
    systemOpening,
    systemClosing,
    statementOpening,
    statementClosing,
    openingDiff,
    closingDiff,
    statementMathDiff,
    unmatchedNet,
    balanced: closingDiff !== null && Math.abs(closingDiff) < 0.005,
  };
}
