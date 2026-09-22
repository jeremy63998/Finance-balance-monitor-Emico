import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { api } from "@/lib/qne-client";
import {
  ALLOWED_EMAIL_DOMAIN,
  ADMIN_EMAIL,
  FEATURES,
  isAdminEmail,
  levelFor,
  type FeatureKey,
  type PermissionLevel,
  type Permissions,
} from "@/lib/tenant";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldOff, ShieldCheck, SlidersHorizontal, Crown } from "lucide-react";

type AccessRow = {
  id: string;
  email: string;
  is_active: boolean;
  note: string | null;
  revoked_at: string | null;
  revoked_by_email: string | null;
  permissions: Permissions | null;
};

export const Route = createFileRoute("/access")({
  head: () => ({
    meta: [
      { title: "Access Control | Finance Balance Monitor" },
      {
        name: "description",
        content:
          "Administrator tools to control which workspace accounts can sign in to the Finance Balance Monitor and which sections each account can use.",
      },
      { property: "og:title", content: "Access Control | Finance Balance Monitor" },
      {
        property: "og:description",
        content: "Revoke access and switch individual sections on or off per account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccessPage,
});

const LEVELS: { value: PermissionLevel; label: string }[] = [
  { value: "edit", label: "Full" },
  { value: "view", label: "View only" },
  { value: "none", label: "Off" },
];

function AccessPage() {
  const [rows, setRows] = useState<AccessRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [openEmail, setOpenEmail] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await api.get<{ rows: AccessRow[] }>("/api/data/app-access");
      setRows(res.rows || []);
      setError(null);
    } catch (e: any) {
      setError(e?.message || "Failed to load access list");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function save(payload: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/data/app-access", payload);
      await load();
    } catch (e: any) {
      setError(e?.message || "Failed to update access");
    } finally {
      setBusy(false);
    }
  }

  async function setLevel(row: AccessRow, feature: FeatureKey, level: PermissionLevel) {
    const next: Permissions = { ...(row.permissions || {}), [feature]: level };
    setRows((prev) => prev.map((r) => (r.email === row.email ? { ...r, permissions: next } : r)));
    await save({ email: row.email, is_active: row.is_active, permissions: next });
  }

  return (
    <AppShell>
      <div className="mx-auto max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">Access Control</h1>
          <p className="text-sm text-muted-foreground">
            Only {ADMIN_EMAIL} can open this page. Every @{ALLOWED_EMAIL_DOMAIN} account that signs in is
            listed here — revoke an account that should no longer get in, or switch individual sections
            on, off, or to view-only for each person.
          </p>
        </div>

        {error && (
          <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Revoke an account</CardTitle>
            <CardDescription>
              Enter the workspace email that should no longer have access.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-[2fr_2fr_auto] sm:items-end">
            <div className="space-y-1.5">
              <Label htmlFor="access-email">Email</Label>
              <Input
                id="access-email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={`name@${ALLOWED_EMAIL_DOMAIN}`}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="access-note">Reason (optional)</Label>
              <Input
                id="access-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Left the company"
              />
            </div>
            <Button
              variant="destructive"
              disabled={busy || !email.trim()}
              onClick={async () => {
                await save({ email: email.trim().toLowerCase(), is_active: false, note });
                setEmail("");
                setNote("");
              }}
            >
              <ShieldOff className="mr-1.5 h-4 w-4" />
              Revoke
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Accounts</CardTitle>
            <CardDescription>Open an account to choose what it can use.</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : rows.length === 0 ? (
              <p className="py-6 text-sm text-muted-foreground">No accounts recorded yet.</p>
            ) : (
              <div className="divide-y">
                {rows.map((r) => {
                  const admin = isAdminEmail(r.email);
                  const open = openEmail === r.email;
                  return (
                    <div key={r.id} className="py-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5 truncate text-sm font-medium">
                            {admin && <Crown className="h-3.5 w-3.5 text-primary" />}
                            {r.email}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {admin ? (
                              "Administrator — full access to everything"
                            ) : r.is_active ? (
                              "Active"
                            ) : (
                              <>
                                Revoked
                                {r.revoked_at ? ` on ${new Date(r.revoked_at).toLocaleDateString()}` : ""}
                                {r.revoked_by_email ? ` by ${r.revoked_by_email}` : ""}
                                {r.note ? ` — ${r.note}` : ""}
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {!admin && (
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => setOpenEmail(open ? null : r.email)}
                            >
                              <SlidersHorizontal className="mr-1.5 h-4 w-4" />
                              {open ? "Close" : "Features"}
                            </Button>
                          )}
                          {!admin &&
                            (r.is_active ? (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                onClick={() => save({ email: r.email, is_active: false })}
                              >
                                <ShieldOff className="mr-1.5 h-4 w-4" />
                                Revoke
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                onClick={() => save({ email: r.email, is_active: true })}
                              >
                                <ShieldCheck className="mr-1.5 h-4 w-4" />
                                Restore
                              </Button>
                            ))}
                        </div>
                      </div>

                      {open && !admin && (
                        <div className="mt-3 space-y-2 rounded-md border bg-muted/30 p-3">
                          {FEATURES.map((f) => {
                            const current = levelFor(r.permissions, f.key);
                            const options = f.readOnly
                              ? LEVELS.filter((l) => l.value !== "edit")
                              : LEVELS;
                            const value = f.readOnly && current === "edit" ? "view" : current;
                            return (
                              <div
                                key={f.key}
                                className="flex flex-wrap items-center justify-between gap-2"
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-medium">{f.label}</div>
                                  <div className="text-xs text-muted-foreground">{f.description}</div>
                                </div>
                                <div className="flex overflow-hidden rounded-md border bg-background">
                                  {options.map((l) => (
                                    <button
                                      key={l.value}
                                      type="button"
                                      disabled={busy}
                                      onClick={() => setLevel(r, f.key, l.value)}
                                      className={[
                                        "px-3 py-1.5 text-xs font-medium transition-colors",
                                        value === l.value
                                          ? "bg-primary text-primary-foreground"
                                          : "text-muted-foreground hover:bg-accent",
                                      ].join(" ")}
                                    >
                                      {l.label}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
