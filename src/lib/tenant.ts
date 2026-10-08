// Workspace access rules shared by client and server.
export const ALLOWED_EMAIL_DOMAIN = "emicomingu.com";
// All finance data belongs to this single workspace tenant.
export const TENANT_CODE = "255-38A-051";
// The one account allowed to manage access and feature permissions.
export const ADMIN_EMAIL = "jeremy@emicomingu.com";

export function isAllowedEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase().endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}

export function isAdminEmail(email?: string | null): boolean {
  return (email || "").trim().toLowerCase() === ADMIN_EMAIL;
}

export type FeatureKey =
  | "dashboard"
  | "cash"
  | "expected"
  | "bank_accounts"
  | "facilities"
  | "facility_transactions"
  | "facility_history"
  | "transactions"
  | "facility_list"
  | "reconciliation";

export type PermissionLevel = "none" | "view" | "edit";
export type Permissions = Partial<Record<FeatureKey, PermissionLevel>>;

export const FEATURES: {
  key: FeatureKey;
  label: string;
  path: string;
  description: string;
  /** Read-only screens can't be granted "edit". */
  readOnly?: boolean;
}[] = [
  { key: "dashboard", label: "Summary Dashboard", path: "/", description: "Overview of cash, overdraft and facilities.", readOnly: true },
  { key: "cash", label: "Cash Transaction Entry", path: "/cash", description: "Record deposits, withdrawals and internal transfers." },
  { key: "expected", label: "Upcoming Payment / Receivable", path: "/expected", description: "Expected incoming and outgoing payments with due dates." },
  { key: "bank_accounts", label: "Bank Accounts", path: "/bank-accounts", description: "Bank account list and overdraft limits." },
  { key: "facilities", label: "Facility Management", path: "/facilities", description: "Create and edit banking facilities." },
  { key: "facility_transactions", label: "Facility Transaction Entry", path: "/facility-transactions", description: "Drawdowns, LCs, settlements and amendments." },
  { key: "facility_history", label: "Facility Transaction History", path: "/facility-history", description: "Full history of facility activity.", readOnly: true },
  { key: "transactions", label: "Transaction History", path: "/transactions", description: "Cash transaction history by bank." },
  { key: "facility_list", label: "Facility List", path: "/facility-list", description: "Facility balances with active drawdowns and LCs.", readOnly: true },
  { key: "reconciliation", label: "Bank Reconciliation", path: "/reconciliation", description: "Scan bank statements and compare them with recorded transactions.", readOnly: true },
];

export const DEFAULT_LEVEL: PermissionLevel = "edit";

export function levelFor(
  permissions: Permissions | null | undefined,
  key: FeatureKey,
  isAdmin = false,
): PermissionLevel {
  if (isAdmin) return "edit";
  const value = permissions?.[key];
  if (value === "none" || value === "view" || value === "edit") return value;
  return DEFAULT_LEVEL;
}

export function canView(permissions: Permissions | null | undefined, key: FeatureKey, isAdmin = false) {
  return levelFor(permissions, key, isAdmin) !== "none";
}

export function canEdit(permissions: Permissions | null | undefined, key: FeatureKey, isAdmin = false) {
  return levelFor(permissions, key, isAdmin) === "edit";
}
