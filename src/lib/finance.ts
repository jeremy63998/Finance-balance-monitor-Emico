// Domain types shared between the frontend and the JSON payloads returned by /api/data/*.
export type CashTxn = {
  id: string;
  tenant_code: string;
  txn_date: string;
  txn_type: "deposit" | "withdrawal" | "transfer";
  amount: number;
  bank_account_name: string;
  bank_account_number: string | null;
  currency: string;
  remarks: string | null;
  entered_by: string | null;
  entered_by_email: string | null;
  supersedes_id: string | null;
  is_superseded: boolean;
  created_at: string;
};

export type Facility = {
  id: string;
  tenant_code: string;
  name: string;
  lending_bank: string;
  facility_type: "revolving_credit" | "term_loan" | "overdraft" | "other";
  total_limit: number;
  amount_drawn: number;
  amount_repaid: number;
  maturity_date: string | null;
  interest_rate: number | null;
  currency: string;
  status: "active" | "matured" | "cancelled";
  remarks: string | null;
  entered_by: string | null;
  entered_by_email: string | null;
  created_at: string;
  updated_at: string;
};

export function facilityAvailable(f: Facility): number {
  return Number(f.total_limit) - Number(f.amount_drawn) + Number(f.amount_repaid);
}

export function facilityOutstanding(f: Facility): number {
  return Math.max(0, Number(f.amount_drawn) - Number(f.amount_repaid));
}

export function cashSignedAmount(t: CashTxn): number {
  const a = Number(t.amount);
  if (t.txn_type === "deposit") return a;
  if (t.txn_type === "withdrawal") return -a;
  return 0; // transfer nets out
}

export function formatMoney(value: number | string | null | undefined, currency = "MYR") {
  const n = Number(value ?? 0);
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(n);
}

export type FacilityAlert = "green" | "amber" | "red";
export function facilityMaturityAlert(
  maturity: string | null,
  warningDays = 60,
  criticalDays = 14,
): FacilityAlert | null {
  if (!maturity) return null;
  const days = Math.ceil((new Date(maturity).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (days <= criticalDays) return "red";
  if (days <= warningDays) return "amber";
  return "green";
}
