import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useSession } from "@/lib/session-context";
import type { FeatureKey } from "@/lib/tenant";
import { SignIn } from "@/components/SignIn";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  ArrowRightLeft,
  Landmark,
  History,
  ListChecks,
  LogOut,
  Loader2,
  Wallet,
  CalendarClock,
  ShieldOff,

} from "lucide-react";

const allNav: { to: string; label: string; icon: typeof LayoutDashboard; feature?: FeatureKey; adminOnly?: boolean }[] = [
  { to: "/", label: "Summary Dashboard", icon: LayoutDashboard, feature: "dashboard" },
  { to: "/cash", label: "Cash Transaction Entry", icon: ArrowRightLeft, feature: "cash" },
  { to: "/expected", label: "Upcoming Payment / Receivable", icon: CalendarClock, feature: "expected" },
  { to: "/bank-accounts", label: "Bank Accounts", icon: Wallet, feature: "bank_accounts" },
  { to: "/facilities", label: "Facility Management", icon: Landmark, feature: "facilities" },
  { to: "/facility-transactions", label: "Facility Transaction Entry", icon: ArrowRightLeft, feature: "facility_transactions" },
  { to: "/facility-history", label: "Facility Transaction History", icon: History, feature: "facility_history" },
  { to: "/transactions", label: "Transaction History", icon: History, feature: "transactions" },
  { to: "/facility-list", label: "Facility List", icon: ListChecks, feature: "facility_list" },
  { to: "/access", label: "Access Control", icon: ShieldOff, adminOnly: true },
];


export function AppShell({ children }: { children: ReactNode }) {
  const { status, session, signOut, isAdmin, canView } = useSession();
  const routerState = useRouterState();
  const currentPath = routerState.location.pathname;

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (status === "unauthenticated" || status === "forbidden") return <SignIn />;

  const nav = allNav.filter((item) =>
    item.adminOnly ? isAdmin : item.feature ? canView(item.feature) : true,
  );
  const currentItem = allNav.find((item) =>
    item.to === "/" ? currentPath === "/" : currentPath.startsWith(item.to),
  );
  const blocked =
    !!currentItem &&
    (currentItem.adminOnly ? !isAdmin : currentItem.feature ? !canView(currentItem.feature) : false);

  return (
    <div className="flex min-h-screen bg-muted/30">
      {/* Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r bg-card md:flex">
        <div className="border-b p-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            N3 Integration
          </div>
          <div className="mt-1 text-base font-semibold leading-tight">Finance Balance Monitor</div>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {nav.map((item) => {
            const active =
              item.to === "/" ? currentPath === "/" : currentPath.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={[
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-foreground/70 hover:bg-accent hover:text-foreground",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-3 text-xs text-muted-foreground">Phase 1</div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b bg-card px-4 py-3 md:px-6">
          <div className="flex flex-wrap items-center gap-4 text-xs md:text-sm">
            <SessionField label="Company" value={session.company} />
            <SessionField label="Tenant" value={session.tenantCode} mono />
            <SessionField label="User" value={session.email} />
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-1.5 h-4 w-4" />
            Sign out
          </Button>
        </header>
        {/* Mobile nav */}
        <nav className="flex gap-1 overflow-x-auto border-b bg-card px-2 py-2 md:hidden">
          {nav.map((item) => {
            const active =
              item.to === "/" ? currentPath === "/" : currentPath.startsWith(item.to);
            return (
              <Link
                key={item.to}
                to={item.to}
                className={[
                  "whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium",
                  active ? "bg-primary text-primary-foreground" : "text-foreground/70",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">
          {blocked ? (
            <div className="mx-auto max-w-md rounded-lg border bg-card p-8 text-center">
              <ShieldOff className="mx-auto h-8 w-8 text-muted-foreground" />
              <h1 className="mt-3 text-lg font-semibold">This section is turned off</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Your account doesn't have access to this part of the app. Ask the administrator if you
                need it enabled.
              </p>
            </div>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}

function SessionField({ label, value, mono }: { label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-muted-foreground">{label}:</span>
      <span className={mono ? "font-mono font-medium" : "font-medium"}>{value ?? "…"}</span>
    </div>
  );
}
